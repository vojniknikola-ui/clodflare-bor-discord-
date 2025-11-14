# 🤖 Vacation Tracker Discord Bot

**Full-featured Discord bot for time tracking, vacation management, and team coordination** - Built with Cloudflare Workers & Neon PostgreSQL

## ✨ Features

### 🕐 **Time Tracking**
- `/clock-in [location]` - Start work session (office/home)
- `/clock-out` - End work session with duration
- `/pauza-start` & `/pauza-end` - Break management (counts as work time)
- `/off` - Mark as not working (doesn't count as work time)
- `/wfh` - Clock in for work from home
- `/wfo` - Clock in for work from office
- `/time-log [days]` - View recent time entries

### 🌴 **Vacation Management**
- **2-Layer Approval System**: PM → Admin approval
- `/vacation-request` - Request vacation (specify working days)
- `/sick-leave` - Report sick leave (automatic approval, logged)
- `/vacation-status` - View vacation balance & history
- **PM Notifications**: Automatic DMs for pending requests
- Automatic balance tracking & validation

### 👑 **Role-Based Administration**
- **Admin Commands**:
  - `/admin-set-balance` - Set vacation days
  - `/admin-add-days` - Add vacation days
  - `/admin-remove-days` - Remove vacation days
  - `/admin-approve` - Final vacation approval

- **PM Commands**:
  - `/pm-pending` - View pending requests
  - `/pm-approve` - Approve vacation requests
  - `/pm-deny` - Deny with reason

### 📊 **Reporting & Analytics**
- `/report time-today` - Today's time entries
- `/report vacation-pending` - Pending vacations
- `/report user-activity` - Active users
- `/report vacation-usage` - Vacation usage stats
- `/report work-hours` - Work hours summary

### ⚙️ **Server Configuration**
- `/settings` - Configure roles and work hours
- Custom admin/PM roles per server
- Work hour definitions
- Timezone settings

### 🔔 **Notifications & Automation**
- **PM Notifications**: Automatic DMs for pending vacation requests
- **Role-based Alerts**: PMs get notified of new requests
- **Auto-approval**: Sick leave automatically approved and logged
- **Status Updates**: Real-time status changes in Discord

### 👁️ **Team Intelligence & Monitoring**
- **Real-time Status**: `/status` - See who's online, on break, or on vacation
- **Team Scheduling**: `/schedule` - View team calendars and vacation plans
- **Smart Reminders**: `/remind` - Set automated reminders for team members
- **Team Overview**: Complete visibility into team activities and availability

## 🚀 **Quick Start**

### 1. **Prerequisites**
- Discord Developer Account
- Cloudflare Account
- Neon PostgreSQL Database

### 2. **Discord Bot Setup**
```bash
# Create bot at https://discord.com/developers/applications
# Get: APPLICATION ID, PUBLIC KEY, BOT TOKEN
```

### 3. **Database Setup**
```bash
# Create Neon database at https://neon.tech
# Get connection string: postgresql://...

# Initialize schema
npm run db:init
```

### 4. **Environment Variables**
```bash
# .env or wrangler secrets
DISCORD_PUBLIC_KEY=your_public_key
DISCORD_APPLICATION_ID=your_app_id
DISCORD_TOKEN=your_bot_token
NEON_DATABASE_URL=your_neon_connection_string
```

### 5. **Deploy**
```bash
# Register slash commands
npm run register-commands

# Deploy to Cloudflare
npm run deploy
```

## 📋 **Slash Commands Overview**

### 👤 **User Commands**
```
/clock-in [location]     # Start work (office/home)
/clock-out               # End work with summary
/pauza-start             # Start break (counts as work time)
/pauza-end               # End break
/off                     # Mark as not working (doesn't count)
/wfh                     # Clock in - work from home
/wfo                     # Clock in - work from office
/time-log [days]         # View time entries
/vacation-request        # Request vacation (specify working days)
/sick-leave              # Report sick leave (auto-approved)
/vacation-status         # View vacation balance
/status [type]           # Check team status (online/break/vacation)
/schedule [type]         # View team schedules and calendars
/remind @user [msg]      # Set reminders for team members
```

### 👨‍💼 **PM Commands**
```
/pm-pending              # View pending requests
/pm-approve <id>         # Approve vacation
/pm-deny <id> <reason>   # Deny vacation
```

### 👑 **Admin Commands**
```
/admin-set-balance @user <days>    # Set vacation days
/admin-add-days @user <days>       # Add vacation days
/admin-remove-days @user <days>    # Remove vacation days
/admin-approve <id>                # Final approval
/settings                          # Server configuration
```

### 📊 **Reporting Commands**
```
/report time-today           # Today's time entries
/report vacation-pending     # Pending vacations
/report user-activity        # Active users (7 days)
/report vacation-usage       # Vacation usage stats
/report work-hours           # Work hours summary
```

## 🗄️ **Database Schema**

### **Core Tables**
- `users` - Discord user profiles
- `user_vacation_balance` - Vacation entitlements
- `time_entries` - Clock in/out records
- `active_sessions` - Current work sessions
- `vacation_requests` - Vacation approval workflow
- `server_settings` - Guild-specific configuration
- `audit_log` - All system actions

### **Key Features**
- Automatic user registration on first command
- 2-layer vacation approval (PM → Admin)
- Real-time session tracking
- Comprehensive audit logging
- Role-based permissions

## 🔧 **Technical Architecture**

### **Cloudflare Workers**
- Serverless Discord interaction handling
- Sub-3-second response requirement
- Global CDN deployment
- 100k requests/day free tier

### **Neon PostgreSQL**
- Serverless PostgreSQL
- 512MB free storage
- Automatic scaling
- Connection pooling

### **Security**
- Discord signature verification
- Role-based command access
- Input validation & sanitization
- Audit logging for all actions

## 📊 **Business Logic**

### **Time Tracking**
- Session-based tracking (work/break)
- Location awareness (office/home)
- Automatic overtime calculation
- Break time deduction

### **Vacation Workflow**
```
User Request → PM Review → PM Approval → Admin Review → Admin Approval → Confirmed
```

### **Balance Management**
- Annual vacation allocation
- Carry-over tracking
- Usage validation
- Automatic updates

## 🚀 **Deployment Guide**

### **1. Discord Setup**
```bash
# Create application
# Add bot to server with permissions:
# - Use Slash Commands
# - Send Messages
# - Embed Links
# - Read Message History
```

### **2. Cloudflare Setup**
```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler auth login

# Configure environment
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_TOKEN
wrangler secret put NEON_DATABASE_URL
```

### **3. Database Setup**
```bash
# Create Neon project
# Run schema.sql
psql $NEON_DATABASE_URL -f schema.sql
```

### **4. Command Registration**
```bash
# Register slash commands globally
npm run register-commands
```

### **5. Deploy**
```bash
wrangler deploy
```

## 🎯 **Usage Examples**

### **Daily Workflow**
```
User: /clock-in location:office
Bot: ✅ Clocked in at 09:00

User: /pauza-start
Bot: 🕐 Pauza started

User: /pauza-end
Bot: ✅ Pauza ended (30 min)

User: /clock-out
Bot: ✅ Clocked out - Worked: 8h 30min

# Or work from home:
User: /wfh
Bot: ✅ Clocked in at 09:00 (Home)

# Mark as off work:
User: /off
Bot: 🚪 Marked as not working
```

### **Vacation Request**
```
User: /vacation-request start_date:2024-07-15 end_date:2024-07-20 working_days:5 reason:Family vacation
Bot: 📝 Request submitted - awaiting PM approval
Bot: [PM gets DM notification about pending request]

PM: /pm-approve request_id:123
Bot: ✅ PM approved - awaiting admin approval

Admin: /admin-approve request_id:123
Bot: 🎉 Vacation approved! 5 days confirmed
```

### **Sick Leave (Auto-Approved)**
```
User: /sick-leave start_date:2024-07-15 end_date:2024-07-17 working_days:3 reason:Flu
Bot: 🤒 Bolovanje prijavljeno - automatski odobreno
Bot: ✅ Marked as off sick for the period
```

### **Team Status Monitoring**
```
User: /status online
Bot: 🟢 Ko je Online (Na Poslu)
     John - 📍 Kancelarija, Od 09:15
     Jane - 📍 Kuća, Od 08:45

User: /status on-break
Bot: ☕ Ko je na Pauzi
     Mike - Pauza od 11:30

User: /status on-vacation
Bot: 🏖️ Ko je na Godišnjem
     Sarah - 2024-08-01 - 2024-08-15 (10 dana)

User: /status team-overview
Bot: 📊 Team Overview - Kompletan Pregled
     🟢 Online: 3    ☕ Na pauzi: 1
     🏖️ Na godišnjem: 2    🚪 Off duty: 1
```

### **Team Scheduling**
```
User: /schedule today
Bot: 📅 Današnji Raspored
     John: clock_in 09:00, pauza_start 12:00, pauza_end 12:30
     Jane: clock_in 08:30, pauza_start 11:00

User: /schedule week
Bot: 📊 Sedmični Pregled
     John: 5 dana, ⏰ 42.5h
     Jane: 4 dana, ⏰ 38.0h

User: /schedule vacation-calendar
Bot: 🏖️ Vacation Calendar
     Sarah: 2024-08-01 - 2024-08-15 (10 dana)
     Mike: 2024-09-10 - 2024-09-20 (8 dana)
```

### **Smart Reminders**
```
User: /remind @john "Don't forget the client meeting at 3 PM" when:60
Bot: ⏰ Podsjetnik postavljen
     Primaoc: @john
     Poruka: Don't forget the client meeting at 3 PM
     Za: 60 minuta
```

### **Admin Management**
```
Admin: /admin-set-balance @john 25
Bot: ✅ Set John's vacation balance to 25 days

Admin: /admin-add-days @jane 3
Bot: ✅ Added 3 days to Jane's balance
```

## 🔧 **Development**

### **Local Development**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Register commands for testing
npm run register-commands
```

### **Testing**
```bash
# Test database connection
psql $NEON_DATABASE_URL -c "SELECT version();"

# Test bot commands in Discord
# Use /time-log, /vacation-status, etc.
```

## 📈 **Scaling & Performance**

- **Cloudflare Workers**: Auto-scaling, global distribution
- **Neon Database**: Connection pooling, query optimization
- **Caching**: Response caching for reports
- **Rate Limiting**: Built-in Discord rate limiting

## 🛡️ **Security & Compliance**

- **Data Encryption**: All data encrypted at rest
- **Access Control**: Role-based command permissions
- **Audit Trail**: Complete action logging
- **GDPR Ready**: User data export/deletion capabilities

## 🎉 **Ready for Production!**

This Discord bot provides enterprise-grade time tracking and vacation management with:

- ✅ **Free hosting** (Cloudflare Workers + Neon)
- ✅ **Real-time interactions** via Discord
- ✅ **Professional workflow** with approvals
- ✅ **Comprehensive reporting** and analytics
- ✅ **Role-based permissions** and security
- ✅ **Scalable architecture** for growing teams

**Deploy in minutes, manage vacations effortlessly!** 🚀

<!-- Trigger new deployment -->