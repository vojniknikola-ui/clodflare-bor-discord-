import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

const commands = [
  {
    name: 'clock-in',
    description: 'Započni radni dan',
    options: [
      {
        name: 'location',
        description: 'Gdje radite?',
        type: 3, // STRING
        choices: [
          { name: '🏢 Kancelarija', value: 'office' },
          { name: '🏠 Kuća', value: 'home' }
        ]
      }
    ]
  },
  {
    name: 'clock-out',
    description: 'Završi radni dan'
  },
  {
    name: 'pauza-start',
    description: 'Započni pauzu (računa se u radno vrijeme)'
  },
  {
    name: 'pauza-end',
    description: 'Završi pauzu'
  },
  {
    name: 'off',
    description: 'Označi da nisi na poslu (ne računa se u radno vrijeme)'
  },
  {
    name: 'wfh',
    description: 'Clock in - rad od kuće'
  },
  {
    name: 'wfo',
    description: 'Clock in - rad u kancelariji'
  },
  {
    name: 'vacation-request',
    description: 'Podnesi zahtjev za godišnji',
    options: [
      {
        name: 'start_date',
        description: 'Početni datum (YYYY-MM-DD)',
        type: 3, // STRING
        required: true
      },
      {
        name: 'end_date',
        description: 'Krajnji datum (YYYY-MM-DD)',
        type: 3, // STRING
        required: true
      },
      {
        name: 'working_days',
        description: 'Broj radnih dana',
        type: 4, // INTEGER
        required: true,
        min_value: 1,
        max_value: 365
      },
      {
        name: 'reason',
        description: 'Razlog (opcionalno)',
        type: 3 // STRING
      }
    ]
  },
  {
    name: 'sick-leave',
    description: 'Prijavi bolovanje (automatsko odobrenje)',
    options: [
      {
        name: 'start_date',
        description: 'Početni datum (YYYY-MM-DD)',
        type: 3, // STRING
        required: true
      },
      {
        name: 'end_date',
        description: 'Krajnji datum (YYYY-MM-DD)',
        type: 3, // STRING
        required: true
      },
      {
        name: 'working_days',
        description: 'Broj radnih dana',
        type: 4, // INTEGER
        required: true,
        min_value: 1,
        max_value: 365
      },
      {
        name: 'reason',
        description: 'Razlog bolovanja',
        type: 3, // STRING
        required: true
      }
    ]
  },
  {
    name: 'vacation-status',
    description: 'Pogledaj svoj vacation status'
  },
  {
    name: 'time-log',
    description: 'Pogledaj svoj time log',
    options: [
      {
        name: 'days',
        description: 'Broj dana unazad (default: 7)',
        type: 4, // INTEGER
        min_value: 1,
        max_value: 30
      }
    ]
  },
  {
    name: 'admin-set-balance',
    description: 'Postavi vacation dane korisniku (Admin only)',
    options: [
      {
        name: 'user',
        description: 'Korisnik',
        type: 6, // USER
        required: true
      },
      {
        name: 'days',
        description: 'Broj dana',
        type: 4, // INTEGER
        required: true,
        min_value: 0,
        max_value: 365
      }
    ]
  },
  {
    name: 'admin-add-days',
    description: 'Dodaj vacation dane korisniku (Admin only)',
    options: [
      {
        name: 'user',
        description: 'Korisnik',
        type: 6, // USER
        required: true
      },
      {
        name: 'days',
        description: 'Broj dana za dodati',
        type: 4, // INTEGER
        required: true,
        min_value: 1,
        max_value: 100
      }
    ]
  },
  {
    name: 'admin-remove-days',
    description: 'Oduzmi vacation dane korisniku (Admin only)',
    options: [
      {
        name: 'user',
        description: 'Korisnik',
        type: 6, // USER
        required: true
      },
      {
        name: 'days',
        description: 'Broj dana za oduzeti',
        type: 4, // INTEGER
        required: true,
        min_value: 1,
        max_value: 100
      }
    ]
  },
  {
    name: 'pm-pending',
    description: 'Pogledaj zahtjeve na čekanju (PM only)'
  },
  {
    name: 'pm-approve',
    description: 'Odobri vacation zahtjev (PM only)',
    options: [
      {
        name: 'request_id',
        description: 'ID zahtjeva',
        type: 4, // INTEGER
        required: true
      }
    ]
  },
  {
    name: 'pm-deny',
    description: 'Odbij vacation zahtjev (PM only)',
    options: [
      {
        name: 'request_id',
        description: 'ID zahtjeva',
        type: 4, // INTEGER
        required: true
      },
      {
        name: 'reason',
        description: 'Razlog odbijanja',
        type: 3, // STRING
        required: true
      }
    ]
  },
  {
    name: 'admin-approve',
    description: 'Finalno odobri vacation zahtjev (Admin only)',
    options: [
      {
        name: 'request_id',
        description: 'ID zahtjeva',
        type: 4, // INTEGER
        required: true
      }
    ]
  },
  {
    name: 'report',
    description: 'Generiši izvještaj',
    options: [
      {
        name: 'type',
        description: 'Tip izvještaja',
        type: 3, // STRING
        required: true,
        choices: [
          { name: '📊 Time entries danas', value: 'time-today' },
          { name: '🌴 Pending vacations', value: 'vacation-pending' },
          { name: '👥 Active users', value: 'user-activity' },
          { name: '📈 Vacation usage', value: 'vacation-usage' },
          { name: '⏰ Work hours summary', value: 'work-hours' }
        ]
      },
      {
        name: 'days',
        description: 'Period u danima (za neke izvještaje)',
        type: 4, // INTEGER
        min_value: 1,
        max_value: 365
      }
    ]
  },
  {
    name: 'status',
    description: 'Pogledaj status tima u realnom vremenu',
    options: [
      {
        name: 'type',
        description: 'Tip statusa',
        type: 3, // STRING
        required: true,
        choices: [
          { name: '🟢 Ko je online (na poslu)', value: 'online' },
          { name: '☕ Ko je na pauzi', value: 'on-break' },
          { name: '🏖️ Ko je na godišnjem', value: 'on-vacation' },
          { name: '🚪 Ko je off duty', value: 'off-duty' },
          { name: '📊 Kompletan pregled tima', value: 'team-overview' }
        ]
      }
    ]
  },
  {
    name: 'report',
    description: 'Generiši detaljne izvještaje',
    options: [
      {
        name: 'type',
        description: 'Tip izvještaja',
        type: 3, // STRING
        required: true,
        choices: [
          { name: '📊 Time entries danas', value: 'time-today' },
          { name: '🌴 Pending vacations', value: 'vacation-pending' },
          { name: '👥 Active users', value: 'user-activity' },
          { name: '📈 Vacation usage', value: 'vacation-usage' },
          { name: '⏰ Work hours summary', value: 'work-hours' },
          { name: '📅 Monthly attendance', value: 'monthly-attendance' },
          { name: '🎯 Productivity metrics', value: 'productivity' }
        ]
      },
      {
        name: 'days',
        description: 'Period u danima (za neke izvještaje)',
        type: 4, // INTEGER
        min_value: 1,
        max_value: 365
      },
      {
        name: 'month',
        description: 'Mjesec (1-12) za monthly reports',
        type: 4, // INTEGER
        min_value: 1,
        max_value: 12
      },
      {
        name: 'year',
        description: 'Godina za monthly reports',
        type: 4, // INTEGER
        min_value: 2020,
        max_value: 2030
      }
    ]
  },
  {
    name: 'remind',
    description: 'Podsjeti korisnika na nešto',
    options: [
      {
        name: 'user',
        description: 'Korisnik kojeg želite podsjetiti',
        type: 6, // USER
        required: true
      },
      {
        name: 'message',
        description: 'Poruka podsjetnika',
        type: 3, // STRING
        required: true
      },
      {
        name: 'when',
        description: 'Kada poslati (u minutama)',
        type: 4, // INTEGER
        min_value: 1,
        max_value: 1440 // 24 hours
      }
    ]
  },
  {
    name: 'schedule',
    description: 'Pogledaj raspored i planove tima',
    options: [
      {
        name: 'type',
        description: 'Tip rasporeda',
        type: 3, // STRING
        required: true,
        choices: [
          { name: '📅 Današnji raspored', value: 'today' },
          { name: '📊 Sedmični pregled', value: 'week' },
          { name: '🏖️ Vacation kalendar', value: 'vacation-calendar' },
          { name: '🎂 Rođendani', value: 'birthdays' }
        ]
      }
    ]
  },
  {
    name: 'settings',
    description: 'Konfiguriši server settings (Admin only)',
    options: [
      {
        name: 'admin_role',
        description: 'Admin role ID',
        type: 3 // STRING
      },
      {
        name: 'pm_role',
        description: 'PM role ID',
        type: 3 // STRING
      },
      {
        name: 'work_start',
        description: 'Početak radnog vremena (HH:MM)',
        type: 3 // STRING
      },
      {
        name: 'work_end',
        description: 'Kraj radnog vremena (HH:MM)',
        type: 3 // STRING
      }
    ]
  }
];

export async function registerCommands(token: string, applicationId: string) {
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(applicationId),
      { body: commands }
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

export { commands };