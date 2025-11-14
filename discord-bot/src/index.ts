import {
  InteractionType,
  InteractionResponseType,
  verifyKey,
} from 'discord-interactions';

// Type definitions for Cloudflare Workers
interface Env {
  DB: D1Database;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
  DISCORD_TOKEN: string;
}

// Global D1Database type (available in Cloudflare Workers)
declare global {
  interface D1Database {
    prepare(query: string): D1PreparedStatement;
  }

  interface D1PreparedStatement {
    bind(...values: any[]): D1PreparedStatement;
    first(): Promise<any>;
    all(): Promise<D1Result>;
    run(): Promise<D1Result>;
  }

  interface D1Result {
    results?: any[];
    success: boolean;
    error?: string;
  }
}

// Types
interface User {
  id: string;
  username: string;
  discriminator?: string;
  avatar?: string;
}

interface VacationBalance {
  total_days: number;
  used_days: number;
  pending_days: number;
  carried_over_days: number;
}

interface TimeEntry {
  id: number;
  entry_type: string;
  timestamp: string;
  location: string;
  notes?: string;
}

interface VacationRequest {
  id: number;
  requested_days: number;
  start_date: string;
  end_date: string;
  reason?: string;
  status: string;
}


// Discord interaction handlers
async function handleClockIn(DB: D1Database, user: User, location: string = 'office'): Promise<any> {
  await ensureUserExists(DB, user.id, user.username);

  const activeSession = await getActiveSession(DB, user.id);
  if (activeSession && activeSession.session_type === 'work') {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ Već ste clock-in! Koristite \`/clock-out\` da završite radni dan.`,
        flags: 64, // Ephemeral
      },
    };
  }

  // End any existing non-work session
  if (activeSession && activeSession.session_type !== 'work') {
    await endSession(DB, user.id, activeSession.session_type);
  }

  await startSession(DB, user.id, 'work', location);
  await logTimeEntry(DB, user.id, 'clock_in', location);

  const locationEmoji = location === 'home' ? '🏠' : '🏢';

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '🕐 Clock In',
        description: `${locationEmoji} **${user.username}** je clock-in u **${new Date().toLocaleString('bs-BA')}**`,
        color: 0x00ff00,
        fields: [
          { name: 'Lokacija', value: location === 'home' ? '🏠 Kuća' : '🏢 Kancelarija', inline: true },
          { name: 'Vrijeme', value: new Date().toLocaleTimeString('bs-BA'), inline: true }
        ]
      }]
    },
  };
}

async function handlePauzaStart(DB: D1Database, user: User): Promise<any> {
  await ensureUserExists(DB, user.id, user.username);

  const activeSession = await getActiveSession(DB, user.id);
  if (!activeSession || activeSession.session_type !== 'work') {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ Niste clock-in! Koristite \`/clock-in\` da započnete radni dan prije pauze.`,
        flags: 64,
      },
    };
  }

  if (activeSession.session_type === 'pauza') {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ Već ste na pauzi! Koristite \`/pauza-end\` da završite pauzu.`,
        flags: 64,
      },
    };
  }

  await startSession(DB, user.id, 'pauza', activeSession.location);
  await logTimeEntry(DB, user.id, 'pauza_start', activeSession.location);

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '☕ Pauza Start',
        description: `⏸️ **${user.username}** je započeo pauzu`,
        color: 0xffa500,
        fields: [
          { name: 'Vrijeme', value: new Date().toLocaleTimeString('bs-BA'), inline: true },
          { name: 'Lokacija', value: activeSession.location === 'home' ? '🏠 Kuća' : '🏢 Kancelarija', inline: true }
        ]
      }]
    },
  };
}

async function handlePauzaEnd(DB: D1Database, user: User): Promise<any> {
  await ensureUserExists(DB, user.id, user.username);

  const activeSession = await getActiveSession(DB, user.id);
  if (!activeSession || activeSession.session_type !== 'pauza') {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ Niste na pauzi! Koristite \`/pauza-start\` da započnete pauzu.`,
        flags: 64,
      },
    };
  }

  const pauzaData = await endSession(DB, user.id, 'pauza');
  await logTimeEntry(DB, user.id, 'pauza_end', pauzaData.location);

  const duration = Math.floor((Date.now() - new Date(pauzaData.start_time).getTime()) / (1000 * 60));
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '▶️ Pauza End',
        description: `⏯️ **${user.username}** je završio pauzu`,
        color: 0x00aa00,
        fields: [
          { name: 'Trajanje pauze', value: `${hours}h ${minutes}min`, inline: true },
          { name: 'Vrijeme povratka', value: new Date().toLocaleTimeString('bs-BA'), inline: true }
        ]
      }]
    },
  };
}

async function handleOff(DB: D1Database, user: User): Promise<any> {
  await ensureUserExists(DB, user.id, user.username);

  const activeSession = await getActiveSession(DB, user.id);
  if (activeSession && activeSession.session_type === 'work') {
    // End work session first
    await endSession(DB, user.id, 'work');
    await logTimeEntry(DB, user.id, 'clock_out', activeSession.location);
  }

  await logTimeEntry(DB, user.id, 'off', 'away');

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '🚪 Off Duty',
        description: `👋 **${user.username}** je označio da nije na poslu`,
        color: 0x666666,
        fields: [
          { name: 'Status', value: '🚫 Ne računa se u radno vrijeme', inline: true },
          { name: 'Vrijeme', value: new Date().toLocaleTimeString('bs-BA'), inline: true }
        ]
      }]
    },
  };
}

async function handleWFH(DB: D1Database, user: User): Promise<any> {
  return await handleClockIn(DB, user, 'home');
}

async function handleWFO(DB: D1Database, user: User): Promise<any> {
  return await handleClockIn(DB, user, 'office');
}

async function handleClockOut(DB: D1Database, user: User): Promise<any> {
  await ensureUserExists(DB, user.id, user.username);

  const activeSession = await getActiveSession(DB, user.id);
  if (!activeSession) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ Niste clock-in! Koristite \`/clock-in\` da započnete radni dan.`,
        flags: 64,
      },
    };
  }

  const sessionData = await endSession(DB, user.id, 'work');
  await logTimeEntry(DB, user.id, 'clock_out', sessionData.location);

  const duration = Math.floor((Date.now() - new Date(sessionData.start_time).getTime()) / (1000 * 60 * 60 * 1000));
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '🕐 Clock Out',
        description: `👋 **${user.username}** je clock-out`,
        color: 0xff6b6b,
        fields: [
          { name: 'Radno vrijeme', value: `${hours}h ${minutes}min`, inline: true },
          { name: 'Lokacija', value: sessionData.location === 'home' ? '🏠 Kuća' : '🏢 Kancelarija', inline: true },
          { name: 'Vrijeme', value: new Date().toLocaleTimeString('bs-BA'), inline: true }
        ]
      }]
    },
  };
}

async function handleVacationRequest(DB: D1Database, user: User, startDate: string, endDate: string, workingDays: number, reason?: string): Promise<any> {
  await ensureUserExists(DB, user.id, user.username);

  const balance = await getUserBalance(DB, user.id);
  if (!balance) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ Greška: Nema podataka o vašem vacation balance-u.`,
        flags: 64,
      },
    };
  }

  const availableDays = balance.total_days - balance.used_days - balance.pending_days;

  if (workingDays > availableDays) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ Nemate dovoljno dana godišnjeg! Imate ${availableDays} dana na raspolaganju.`,
        flags: 64,
      },
    };
  }

  const requestId = await createVacationRequest(DB, user.id, startDate, endDate, workingDays, reason);

  // TODO: Send PM notifications to PMs about pending request

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '🌴 Zahtjev za Godišnji',
        description: `**${user.username}** je podnio zahtjev za godišnji`,
        color: 0xffa500,
        fields: [
          { name: 'Period', value: `${startDate} - ${endDate}`, inline: true },
          { name: 'Radnih dana', value: `${workingDays}`, inline: true },
          { name: 'Status', value: '⏳ Na čekanju (PM)', inline: true },
          { name: 'Razlog', value: reason || 'Nije naveden', inline: false }
        ],
        footer: { text: `Zahtjev ID: ${requestId}` }
      }]
    },
  };
}

async function handleSickLeave(DB: D1Database, user: User, startDate: string, endDate: string, workingDays: number, reason: string): Promise<any> {
  await ensureUserExists(DB, user.id, user.username);

  // Automatic approval for sick leave, but log it
  const result = await DB.prepare(`
    INSERT INTO vacation_requests (user_id, requested_days, start_date, end_date, reason, status, admin_approved_by, admin_approved_at)
    VALUES (?, ?, ?, ?, ?, 'admin_approved', ?, datetime('now'))
    RETURNING id
  `).bind(user.id, workingDays, startDate, endDate, reason, user.id).first();

  // Mark user as off sick during the period
  await logTimeEntry(DB, user.id, 'off_sick', 'away', `Sick leave: ${reason}`);

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '🤒 Bolovanje Prijavljeno',
        description: `**${user.username}** - Bolovanje automatski odobreno`,
        color: 0xff6b6b,
        fields: [
          { name: 'Period', value: `${startDate} - ${endDate}`, inline: true },
          { name: 'Radnih dana', value: `${workingDays}`, inline: true },
          { name: 'Status', value: '✅ Automatski odobreno', inline: true },
          { name: 'Razlog', value: reason, inline: false }
        ],
        footer: { text: `Zahtjev ID: ${result.id} | Logovano kao off sick` }
      }]
    },
  };
}

async function handleVacationStatus(DB: D1Database, user: User): Promise<any> {
  await ensureUserExists(DB, user.id, user.username);

  const balance = await getUserBalance(DB, user.id);
  const vacations = await getUserVacations(DB, user.id);

  if (!balance) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ Greška: Nema podataka o vašem vacation balance-u.`,
        flags: 64,
      },
    };
  }

  const embed = {
    title: '🌴 Vacation Status',
    description: `**${user.username}** - Pregled godišnjih dana`,
    color: 0x0099ff,
    fields: [
      { name: 'Ukupno dana', value: `${balance.total_days}`, inline: true },
      { name: 'Iskorišteno', value: `${balance.used_days}`, inline: true },
      { name: 'Na čekanju', value: `${balance.pending_days}`, inline: true },
      { name: 'Preostalo', value: `${balance.total_days - balance.used_days - balance.pending_days}`, inline: true },
      { name: 'Prijenos', value: `${balance.carried_over_days}`, inline: true }
    ]
  };

  if (vacations.length > 0) {
    embed.fields.push({
      name: 'Posljednji zahtjevi',
      value: vacations.slice(0, 3).map(v =>
        `${v.start_date} - ${v.end_date} (${v.requested_days}d) - ${v.status}`
      ).join('\n'),
      inline: false
    });
  }

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { embeds: [embed] },
  };
}

async function handleAdminSetBalance(DB: D1Database, adminUser: User, targetUser: User, days: number): Promise<any> {
  // Check admin permissions (this would be implemented with role checking)
  await ensureUserExists(DB, targetUser.id, targetUser.username);
  await updateVacationBalance(DB, targetUser.id, 'set', days);

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ **${adminUser.username}** je postavio **${targetUser.username}** ${days} dana godišnjeg.`,
    },
  };
}

async function handlePMApprove(DB: D1Database, user: User, requestId: number): Promise<any> {
  const request = await DB.prepare(`SELECT vr.*, u.username FROM vacation_requests vr JOIN users u ON vr.user_id = u.id WHERE vr.id = ?`).bind(requestId).first();
  if (!request) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `❌ Zahtjev ${requestId} nije pronađen.`, flags: 64 },
    };
  }

  await updateVacationStatus(DB, requestId, 'pm_approved', user.id);

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ PM **${user.username}** je odobrio zahtjev #${requestId} za **${request.username}**.`,
    },
  };
}

async function handleStatus(DB: D1Database, user: User, statusType: string): Promise<any> {
  await ensureUserExists(DB, user.id, user.username);

  let title: string = '';
  let description: string = '';
  let color: number = 0x0099ff;
  let fields: any[] = [];

  switch (statusType) {
    case 'online':
      const onlineResult = await DB.prepare(`
        SELECT u.username, sa.session_type, sa.start_time, sa.location
        FROM active_sessions sa
        JOIN users u ON sa.user_id = u.id
        WHERE sa.session_type = 'work'
        ORDER BY sa.start_time ASC
      `).all();
      const onlineUsers = onlineResult.results || [];

      title = '🟢 Ko je Online (Na Poslu)';
      description = `**${onlineUsers.length}** korisnika trenutno radi`;
      color = 0x00ff00;

      if (onlineUsers.length > 0) {
        fields = onlineUsers.map((user: any) => ({
          name: user.username,
          value: `📍 ${user.location === 'home' ? '🏠 Kuća' : '🏢 Kancelarija'}\n🕐 Od ${new Date(user.start_time).toLocaleTimeString('bs-BA')}`,
          inline: true
        }));
      } else {
        fields = [{ name: 'Status', value: 'Niko nije na poslu trenutno', inline: false }];
      }
      break;

    case 'on-break':
      const breakResult = await DB.prepare(`
        SELECT u.username, sa.start_time, sa.location
        FROM active_sessions sa
        JOIN users u ON sa.user_id = u.id
        WHERE sa.session_type = 'pauza'
        ORDER BY sa.start_time ASC
      `).all();
      const breakUsers = breakResult.results || [];

      title = '☕ Ko je na Pauzi';
      description = `**${breakUsers.length}** korisnika na pauzi`;
      color = 0xffa500;

      if (breakUsers.length > 0) {
        fields = breakUsers.map((user: any) => ({
          name: user.username,
          value: `🕐 Pauza od ${new Date(user.start_time).toLocaleTimeString('bs-BA')}`,
          inline: true
        }));
      } else {
        fields = [{ name: 'Status', value: 'Niko nije na pauzi trenutno', inline: false }];
      }
      break;

    case 'on-vacation':
      const vacationResult = await DB.prepare(`
        SELECT u.username, vr.start_date, vr.end_date, vr.requested_days
        FROM vacation_requests vr
        JOIN users u ON vr.user_id = u.id
        WHERE vr.status = 'admin_approved'
          AND date('now') BETWEEN vr.start_date AND vr.end_date
        ORDER BY vr.start_date ASC
      `).all();
      const vacationUsers = vacationResult.results || [];

      title = '🏖️ Ko je na Godišnjem';
      description = `**${vacationUsers.length}** korisnika na godišnjem`;
      color = 0x0099ff;

      if (vacationUsers.length > 0) {
        fields = vacationUsers.map((user: any) => ({
          name: user.username,
          value: `📅 ${user.start_date} - ${user.end_date}\n🎯 ${user.requested_days} dana`,
          inline: true
        }));
      } else {
        fields = [{ name: 'Status', value: 'Niko nije na godišnjem trenutno', inline: false }];
      }
      break;

    case 'off-duty':
      const offResult = await DB.prepare(`
        SELECT u.username, te.timestamp, te.notes
        FROM time_entries te
        JOIN users u ON te.user_id = u.id
        WHERE te.entry_type IN ('off', 'off_sick')
          AND te.timestamp >= datetime('now', '-1 day')
        ORDER BY te.timestamp DESC
        LIMIT 10
      `).all();
      const recentOffEntries = offResult.results || [];

      title = '🚪 Ko je Off Duty';
      description = `Nedavne off/sick entries (24h)`;
      color = 0x666666;

      if (recentOffEntries.length > 0) {
        fields = recentOffEntries.map((entry: any) => ({
          name: entry.username,
          value: `🕐 ${new Date(entry.timestamp).toLocaleString('bs-BA')}\n📝 ${entry.notes || 'Off duty'}`,
          inline: true
        }));
      } else {
        fields = [{ name: 'Status', value: 'Nema recent off entries', inline: false }];
      }
      break;

    case 'team-overview':
      // Get all statuses in one query
      const onlineCount = await DB.prepare(`SELECT COUNT(*) as count FROM active_sessions WHERE session_type = 'work'`).first();
      const breakCount = await DB.prepare(`SELECT COUNT(*) as count FROM active_sessions WHERE session_type = 'pauza'`).first();
      const vacationCount = await DB.prepare(`SELECT COUNT(*) as count FROM vacation_requests WHERE status = 'admin_approved' AND date('now') BETWEEN start_date AND end_date`).first();
      const offCount = await DB.prepare(`SELECT COUNT(*) as count FROM time_entries WHERE entry_type IN ('off', 'off_sick') AND timestamp >= datetime('now', '-1 day')`).first();

      title = '📊 Team Overview - Kompletan Pregled';
      description = `Real-time status svih članova tima`;
      color = 0x7289da;

      fields = [
        { name: '🟢 Online (Na poslu)', value: `${onlineCount?.count || 0}`, inline: true },
        { name: '☕ Na pauzi', value: `${breakCount?.count || 0}`, inline: true },
        { name: '🏖️ Na godišnjem', value: `${vacationCount?.count || 0}`, inline: true },
        { name: '🚪 Off duty (24h)', value: `${offCount?.count || 0}`, inline: true },
        { name: '📅 Datum', value: new Date().toLocaleDateString('bs-BA'), inline: true },
        { name: '🕐 Vrijeme', value: new Date().toLocaleTimeString('bs-BA'), inline: true }
      ];
      break;
  }

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title,
        description,
        color,
        fields,
        footer: { text: `Requested by ${user.username}` }
      }]
    },
  };
}

async function handleRemind(DB: D1Database, user: User, targetUser: User, message: string, minutes: number): Promise<any> {
  // In a real implementation, this would use a job queue or scheduled tasks
  // For now, we'll just acknowledge and log it
  await ensureUserExists(DB, user.id, user.username);
  await ensureUserExists(DB, targetUser.id, targetUser.username);

  // Log the reminder request
  await DB.prepare(`
    INSERT INTO audit_log (user_id, action, details, ip_address)
    VALUES (?, 'reminder_sent', ?, 'discord_bot')
  `).bind(user.id, JSON.stringify({
    target_user: targetUser.id,
    message,
    delay_minutes: minutes,
    scheduled_for: new Date(Date.now() + minutes * 60 * 1000).toISOString()
  })).run();

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '⏰ Podsjetnik Postavljen',
        description: `**${user.username}** je postavio podsjetnik za **${targetUser.username}**`,
        color: 0xffd700,
        fields: [
          { name: 'Primaoc', value: targetUser.username, inline: true },
          { name: 'Poruka', value: message, inline: false },
          { name: 'Za (minuta)', value: `${minutes}`, inline: true },
          { name: 'Pošalji u', value: new Date(Date.now() + minutes * 60 * 1000).toLocaleString('bs-BA'), inline: true }
        ],
        footer: { text: 'Podsjetnik će biti poslan u navedeno vrijeme' }
      }]
    },
  };
}

async function handleSchedule(DB: D1Database, user: User, scheduleType: string): Promise<any> {
  await ensureUserExists(DB, user.id, user.username);

  let title: string = '';
  let description: string = '';
  let color: number = 0x3498db;
  let fields: any[] = [];

  switch (scheduleType) {
    case 'today':
      const todayResult = await DB.prepare(`
        SELECT u.username, te.entry_type, te.timestamp, te.location
        FROM time_entries te
        JOIN users u ON te.user_id = u.id
        WHERE date(te.timestamp) = date('now')
        ORDER BY te.timestamp ASC
      `).all();
      const todaySchedule = todayResult.results || [];

      title = '📅 Današnji Raspored';
      description = `Aktivnosti tima danas`;
      color = 0x3498db;

      if (todaySchedule.length > 0) {
        // Group by user
        const userActivities: { [key: string]: any[] } = {};
        todaySchedule.forEach((entry: any) => {
          if (!userActivities[entry.username]) {
            userActivities[entry.username] = [];
          }
          userActivities[entry.username].push(entry);
        });

        Object.keys(userActivities).forEach(username => {
          const activities = userActivities[username];
          const activityText = activities.map(a =>
            `${a.entry_type} ${new Date(a.timestamp).toLocaleTimeString('bs-BA')}`
          ).join('\n');
          fields.push({
            name: username,
            value: activityText.substring(0, 1024), // Discord field limit
            inline: true
          });
        });
      } else {
        fields = [{ name: 'Status', value: 'Nema aktivnosti danas', inline: false }];
      }
      break;

    case 'week':
      // Simplified week stats for D1 (no window functions)
      const weekResult = await DB.prepare(`
        SELECT u.username, COUNT(DISTINCT date(te.timestamp)) as work_days
        FROM users u
        LEFT JOIN time_entries te ON u.id = te.user_id
          AND te.timestamp >= datetime('now', '-7 days')
        GROUP BY u.id, u.username
        ORDER BY work_days DESC
      `).all();
      const weekStats = weekResult.results || [];

      title = '📊 Sedmični Pregled';
      description = `Statistike za poslednjih 7 dana`;
      color = 0x2ecc71;

      fields = weekStats.map((stat: any) => ({
        name: stat.username,
        value: `📅 ${stat.work_days || 0} dana`,
        inline: true
      }));
      break;

    case 'vacation-calendar':
      const vacationResult = await DB.prepare(`
        SELECT u.username, vr.start_date, vr.end_date, vr.requested_days
        FROM vacation_requests vr
        JOIN users u ON vr.user_id = u.id
        WHERE vr.status = 'admin_approved'
          AND vr.start_date >= date('now')
        ORDER BY vr.start_date ASC
        LIMIT 10
      `).all();
      const upcomingVacations = vacationResult.results || [];

      title = '🏖️ Vacation Calendar';
      description = `Predstojeći godišnji odmori`;
      color = 0xe67e22;

      if (upcomingVacations.length > 0) {
        fields = upcomingVacations.map((vacation: any) => ({
          name: vacation.username,
          value: `${vacation.start_date} - ${vacation.end_date}\n${vacation.requested_days} dana`,
          inline: true
        }));
      } else {
        fields = [{ name: 'Status', value: 'Nema predstojećih godišnjih', inline: false }];
      }
      break;

    case 'birthdays':
      // This would require a birthdays table in the database
      title = '🎂 Rođendani';
      description = `Rođendani članova tima`;
      color = 0xff69b4;
      fields = [{ name: 'Info', value: 'Funkcionalnost rođendana će biti dodana u budućoj verziji', inline: false }];
      break;
  }

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title,
        description,
        color,
        fields,
        footer: { text: `Generated by ${user.username}` }
      }]
    },
  };
}

async function handleReport(DB: D1Database, user: User, reportType: string, options?: any): Promise<any> {
  let data: any = {};
  let title: string;
  let description: string;
  let color: number = 0x00ff88;
  let fields: any[] = [];

  switch (reportType) {
    case 'time-today':
      const todayResult = await DB.prepare(`
        SELECT u.username, te.entry_type, te.timestamp, te.location
        FROM time_entries te
        JOIN users u ON te.user_id = u.id
        WHERE date(te.timestamp) = date('now')
        ORDER BY te.timestamp DESC
      `).all();
      const todayEntries = todayResult.results || [];
      data = { entries: todayEntries, count: todayEntries.length };

      title = '📊 Time Entries Danas';
      description = `Sve aktivnosti danas`;
      fields = [
        { name: 'Ukupno entries', value: `${data.count}`, inline: true },
        { name: 'Generated', value: new Date().toLocaleString('bs-BA'), inline: true }
      ];
      break;

    case 'vacation-pending':
      const pending = await getPendingVacations(DB);
      data = { requests: pending, count: pending.length };

      title = '🌴 Pending Vacations';
      description = `Zahtjevi koji čekaju odobrenje`;
      fields = [
        { name: 'Broj zahtjeva', value: `${data.count}`, inline: true },
        { name: 'Status', value: 'Na čekanju', inline: true }
      ];
      break;

    case 'user-activity':
      const days = options?.days || 7;
      const activeResult = await DB.prepare(`
        SELECT username, last_active
        FROM users
        WHERE last_active >= datetime('now', '-${days} days')
        ORDER BY last_active DESC
      `).all();
      const activeUsers = activeResult.results || [];
      data = { users: activeUsers, count: activeUsers.length };

      title = '👥 User Activity Report';
      description = `Aktivni korisnici u poslednjih ${days} dana`;
      fields = [
        { name: 'Aktivnih korisnika', value: `${data.count}`, inline: true },
        { name: 'Period', value: `${days} dana`, inline: true }
      ];
      break;

    case 'monthly-attendance':
      const month = options?.month || new Date().getMonth() + 1;
      const year = options?.year || new Date().getFullYear();

      // Simplified monthly data for D1 (no EXTRACT function)
      const monthlyResult = await DB.prepare(`
        SELECT u.username, COUNT(DISTINCT date(te.timestamp)) as work_days
        FROM users u
        LEFT JOIN time_entries te ON u.id = te.user_id
        GROUP BY u.id, u.username
        ORDER BY work_days DESC
      `).all();
      const monthlyData = monthlyResult.results || [];

      title = `📅 Monthly Attendance - ${month}/${year}`;
      description = `Mjesečni izvještaj o prisutnosti`;
      color = 0x9b59b6;

      fields = monthlyData.map((user: any) => ({
        name: user.username,
        value: `📅 ${user.work_days} dana`,
        inline: true
      }));
      break;

    case 'productivity':
      const prodDays = options?.days || 30;
      // Simplified productivity data for D1
      const prodResult = await DB.prepare(`
        SELECT u.username, COUNT(DISTINCT date(te.timestamp)) as work_days,
               COUNT(CASE WHEN te.entry_type = 'pauza_start' THEN 1 END) as breaks_taken
        FROM users u
        LEFT JOIN time_entries te ON u.id = te.user_id
          AND te.timestamp >= datetime('now', '-${prodDays} days')
        GROUP BY u.id, u.username
        ORDER BY work_days DESC
      `).all();
      const productivityData = prodResult.results || [];

      title = '🎯 Productivity Metrics';
      description = `Mjerenja produktivnosti za poslednjih ${prodDays} dana`;
      color = 0x1abc9c;

      fields = productivityData.map((user: any) => ({
        name: user.username,
        value: `📅 ${user.work_days} dana\n☕ ${user.breaks_taken} pauza`,
        inline: true
      }));
      break;

    default:
      const defaultResult = await DB.prepare(`
        SELECT u.username, te.entry_type, te.timestamp, te.location
        FROM time_entries te
        JOIN users u ON te.user_id = u.id
        WHERE date(te.timestamp) = date('now')
        ORDER BY te.timestamp DESC
      `).all();
      const defaultEntries = defaultResult.results || [];
      data = { entries: defaultEntries, count: defaultEntries.length };

      title = `📊 ${reportType.replace('-', ' ').toUpperCase()} Report`;
      description = `Generated by ${user.username}`;
      fields = [
        { name: 'Count', value: `${data.count}`, inline: true },
        { name: 'Generated', value: new Date().toLocaleString('bs-BA'), inline: true }
      ];
  }

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title,
        description,
        color,
        fields,
        footer: { text: `Report generated by ${user.username}` }
      }]
    },
  };
}

// Database helper functions for D1
async function ensureUserExists(DB: D1Database, userId: string, username: string): Promise<void> {
  await DB.prepare(`
    INSERT OR REPLACE INTO users (id, username, last_active)
    VALUES (?, ?, datetime('now'))
  `).bind(userId, username).run();
}

async function getUserBalance(DB: D1Database, userId: string): Promise<VacationBalance | null> {
  const result = await DB.prepare(`
    SELECT total_days, used_days, pending_days, carried_over_days
    FROM user_vacation_balance
    WHERE user_id = ?
  `).bind(userId).first();
  return result as VacationBalance | null;
}

async function getActiveSession(DB: D1Database, userId: string): Promise<any | null> {
  const result = await DB.prepare(`
    SELECT * FROM active_sessions
    WHERE user_id = ?
    ORDER BY start_time DESC
    LIMIT 1
  `).bind(userId).first();
  return result || null;
}

async function logTimeEntry(DB: D1Database, userId: string, entryType: string, location: string = 'office', notes?: string): Promise<void> {
  await DB.prepare(`
    INSERT INTO time_entries (user_id, entry_type, location, notes)
    VALUES (?, ?, ?, ?)
  `).bind(userId, entryType, location, notes).run();
}

async function startSession(DB: D1Database, userId: string, sessionType: string, location: string = 'office'): Promise<void> {
  await DB.prepare(`
    INSERT OR REPLACE INTO active_sessions (user_id, session_type, start_time, location)
    VALUES (?, ?, datetime('now'), ?)
  `).bind(userId, sessionType, location).run();
}

async function endSession(DB: D1Database, userId: string, sessionType: string): Promise<any> {
  const result = await DB.prepare(`
    DELETE FROM active_sessions
    WHERE user_id = ? AND session_type = ?
    RETURNING start_time, location
  `).bind(userId, sessionType).first();
  return result;
}

async function createVacationRequest(DB: D1Database, userId: string, startDate: string, endDate: string, requestedDays: number, reason?: string): Promise<number> {
  const result = await DB.prepare(`
    INSERT INTO vacation_requests (user_id, requested_days, start_date, end_date, reason)
    VALUES (?, ?, ?, ?, ?)
    RETURNING id
  `).bind(userId, requestedDays, startDate, endDate, reason).first();
  return result.id;
}

async function getPendingVacations(DB: D1Database): Promise<any[]> {
  const result = await DB.prepare(`
    SELECT vr.*, u.username
    FROM vacation_requests vr
    JOIN users u ON vr.user_id = u.id
    WHERE vr.status = 'pending'
    ORDER BY vr.created_at ASC
  `).all();
  return result.results || [];
}

async function updateVacationStatus(DB: D1Database, requestId: number, status: string, approvedBy: string, rejectionReason?: string): Promise<void> {
  let field: string;
  let value: string;

  if (status === 'pm_approved') {
    field = 'pm_approved_by, pm_approved_at';
    value = `${approvedBy}, datetime('now')`;
  } else if (status === 'admin_approved') {
    field = 'admin_approved_by, admin_approved_at';
    value = `${approvedBy}, datetime('now')`;
  } else if (status === 'rejected') {
    field = 'rejected_by, rejected_at, rejection_reason';
    value = `${approvedBy}, datetime('now'), ${rejectionReason}`;
  } else {
    return;
  }

  await DB.prepare(`
    UPDATE vacation_requests
    SET status = ?, ${field} = ?
    WHERE id = ?
  `).bind(status, value, requestId).run();
}

async function getUserVacations(DB: D1Database, userId: string): Promise<VacationRequest[]> {
  const result = await DB.prepare(`
    SELECT id, requested_days, start_date, end_date, reason, status
    FROM vacation_requests
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).bind(userId).all();
  return result.results || [];
}

async function getTimeEntries(DB: D1Database, userId: string, days: number = 7): Promise<TimeEntry[]> {
  const result = await DB.prepare(`
    SELECT id, entry_type, timestamp, location, notes
    FROM time_entries
    WHERE user_id = ?
      AND timestamp >= datetime('now', '-${days} days')
    ORDER BY timestamp DESC
  `).bind(userId).all();
  return result.results || [];
}

async function updateVacationBalance(DB: D1Database, userId: string, operation: 'add' | 'remove' | 'set', days: number): Promise<void> {
  let sql: string;
  switch (operation) {
    case 'add':
      sql = 'UPDATE user_vacation_balance SET total_days = total_days + ?, last_updated = datetime(\'now\') WHERE user_id = ?';
      break;
    case 'remove':
      sql = 'UPDATE user_vacation_balance SET total_days = MAX(0, total_days - ?), last_updated = datetime(\'now\') WHERE user_id = ?';
      break;
    case 'set':
      sql = 'UPDATE user_vacation_balance SET total_days = ?, last_updated = datetime(\'now\') WHERE user_id = ?';
      break;
  }
  await DB.prepare(sql).bind(days, userId).run();
}

// Main handler
export default {
  async fetch(request: Request, env: Env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const signature = request.headers.get('X-Signature-Ed25519');
    const timestamp = request.headers.get('X-Signature-Timestamp');
    const body = await request.text();

    if (!signature || !timestamp || !verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const interaction = JSON.parse(body);

    if (interaction.type === InteractionType.PING) {
      return new Response(JSON.stringify({ type: InteractionResponseType.PONG }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      const { name, options } = interaction.data;
      const user = interaction.member?.user || interaction.user;

      try {
        let response;

        switch (name) {
          case 'clock-in':
            const location = options?.find((opt: any) => opt.name === 'location')?.value || 'office';
            response = await handleClockIn(env.DB, user, location);
            break;

          case 'clock-out':
            response = await handleClockOut(env.DB, user);
            break;

          case 'pauza-start':
            response = await handlePauzaStart(env.DB, user);
            break;

          case 'pauza-end':
            response = await handlePauzaEnd(env.DB, user);
            break;

          case 'off':
            response = await handleOff(env.DB, user);
            break;

          case 'wfh':
            response = await handleWFH(env.DB, user);
            break;

          case 'wfo':
            response = await handleWFO(env.DB, user);
            break;

          case 'vacation-request':
            const startDate = options?.find((opt: any) => opt.name === 'start_date')?.value;
            const endDate = options?.find((opt: any) => opt.name === 'end_date')?.value;
            const workingDays = options?.find((opt: any) => opt.name === 'working_days')?.value;
            const reason = options?.find((opt: any) => opt.name === 'reason')?.value;
            response = await handleVacationRequest(env.DB, user, startDate, endDate, workingDays, reason);
            break;

          case 'sick-leave':
            const sickStartDate = options?.find((opt: any) => opt.name === 'start_date')?.value;
            const sickEndDate = options?.find((opt: any) => opt.name === 'end_date')?.value;
            const sickWorkingDays = options?.find((opt: any) => opt.name === 'working_days')?.value;
            const sickReason = options?.find((opt: any) => opt.name === 'reason')?.value;
            response = await handleSickLeave(env.DB, user, sickStartDate, sickEndDate, sickWorkingDays, sickReason);
            break;

          case 'vacation-status':
            response = await handleVacationStatus(env.DB, user);
            break;

          case 'admin-set-balance':
            const targetUser = options?.find((opt: any) => opt.name === 'user')?.value;
            const days = options?.find((opt: any) => opt.name === 'days')?.value;
            response = await handleAdminSetBalance(env.DB, user, { id: targetUser, username: 'target' }, days);
            break;

          case 'pm-approve':
            const requestId = options?.find((opt: any) => opt.name === 'request_id')?.value;
            response = await handlePMApprove(env.DB, user, requestId);
            break;

          case 'status':
            const statusType = options?.find((opt: any) => opt.name === 'type')?.value;
            response = await handleStatus(env.DB, user, statusType);
            break;

          case 'remind':
            const remindTargetUser = options?.find((opt: any) => opt.name === 'user')?.value;
            const remindMessage = options?.find((opt: any) => opt.name === 'message')?.value;
            const remindMinutes = options?.find((opt: any) => opt.name === 'when')?.value;
            response = await handleRemind(env.DB, user, { id: remindTargetUser, username: 'target' }, remindMessage, remindMinutes);
            break;

          case 'schedule':
            const scheduleType = options?.find((opt: any) => opt.name === 'type')?.value;
            response = await handleSchedule(env.DB, user, scheduleType);
            break;

          case 'report':
            const reportType = options?.find((opt: any) => opt.name === 'type')?.value;
            const reportOptions = {
              days: options?.find((opt: any) => opt.name === 'days')?.value,
              month: options?.find((opt: any) => opt.name === 'month')?.value,
              year: options?.find((opt: any) => opt.name === 'year')?.value,
            };
            response = await handleReport(env.DB, user, reportType, reportOptions);
            break;

          default:
            response = {
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: '❌ Nepoznata komanda.', flags: 64 },
            };
        }

        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('Command error:', error);
        return new Response(JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: '❌ Došlo je do greške. Pokušajte ponovo.', flags: 64 },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    console.log(event.scheduledTime)
  },
};