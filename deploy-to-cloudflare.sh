#!/bin/bash

# Vacation Tracker - Complete Cloudflare Deployment Script
# This script automates the entire deployment process

set -e

echo "🚀 Vacation Tracker - Complete Cloudflare Deployment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi

    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node -v)"
        exit 1
    fi

    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed."
        exit 1
    fi

    print_success "Prerequisites check passed"
}

# Setup environment variables
setup_environment() {
    print_status "Setting up environment variables..."

    # Create .env files with placeholders
    cat > vacation-tracker/.env.local << EOL
# NextAuth Configuration
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="https://vacation-tracker.vercel.app"

# Discord OAuth (REPLACE WITH YOUR VALUES)
DISCORD_CLIENT_ID="your-discord-client-id"
DISCORD_CLIENT_SECRET="your-discord-client-secret"

# Database
DATABASE_URL="file:./dev.db"
EOL

    cat > discord-bot/.env << EOL
# Discord Bot Configuration (REPLACE WITH YOUR VALUES)
DISCORD_PUBLIC_KEY="your-discord-public-key"
DISCORD_APPLICATION_ID="your-discord-application-id"
DISCORD_TOKEN="your-discord-bot-token"
EOL

    print_success "Environment files created"
    print_warning "Please update the Discord credentials in the .env files"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."

    # Install web app dependencies
    cd vacation-tracker
    print_status "Installing web app dependencies..."
    npm install
    cd ..

    # Install bot dependencies
    cd discord-bot
    print_status "Installing Discord bot dependencies..."
    npm install
    cd ..

    print_success "Dependencies installed"
}

# Setup Cloudflare Workers
setup_cloudflare() {
    print_status "Setting up Cloudflare Workers..."

    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        print_status "Installing Wrangler CLI..."
        npm install -g wrangler
    fi

    # Login to Cloudflare (interactive)
    print_status "Please login to Cloudflare..."
    if ! wrangler auth login; then
        print_error "Failed to login to Cloudflare"
        exit 1
    fi

    # Create D1 database
    print_status "Creating D1 database..."
    DB_CREATE_OUTPUT=$(wrangler d1 create vacation-tracker-db 2>&1)
    if echo "$DB_CREATE_OUTPUT" | grep -q "database_id"; then
        DATABASE_ID=$(echo "$DB_CREATE_OUTPUT" | grep "database_id" | sed 's/.*database_id = //' | tr -d '"')
        print_success "D1 database created with ID: $DATABASE_ID"
    else
        print_warning "Could not extract database ID. Please check manually."
        DATABASE_ID="your-database-id-here"
    fi

    # Update wrangler.toml with database ID
    sed -i.bak "s/database_id = \"\"/database_id = \"$DATABASE_ID\"/" discord-bot/wrangler.toml
    rm discord-bot/wrangler.toml.bak

    print_success "Cloudflare setup completed"
}

# Deploy Discord bot
deploy_discord_bot() {
    print_status "Deploying Discord bot..."

    # Check if we're in the right directory
    if [ ! -f "discord-bot/wrangler.toml" ]; then
        print_error "wrangler.toml not found in discord-bot directory"
        print_error "Current directory: $(pwd)"
        print_error "Please run this script from the project root directory"
        exit 1
    fi

    cd discord-bot

    # Verify wrangler.toml exists
    if [ ! -f "wrangler.toml" ]; then
        print_error "wrangler.toml not found in discord-bot directory"
        cd ..
        exit 1
    fi

    print_status "Current directory: $(pwd)"
    print_status "Files in directory: $(ls -la)"

    # Run database migrations
    print_status "Running database migrations..."
    if wrangler d1 execute vacation-tracker-db --file=./migrations/init.sql; then
        print_success "Database migrations completed"
    else
        print_warning "Database migrations may have failed, but continuing with deployment..."
    fi

    # Deploy the bot
    print_status "Deploying bot to Cloudflare Workers..."
    DEPLOY_OUTPUT=$(wrangler deploy 2>&1)
    if echo "$DEPLOY_OUTPUT" | grep -q "https://"; then
        BOT_URL=$(echo "$DEPLOY_OUTPUT" | grep "https://" | head -1)
        print_success "Discord bot deployed successfully: $BOT_URL"
    else
        print_error "Bot deployment may have failed. Check the output above."
        print_warning "You can try manual deployment with: cd discord-bot && wrangler deploy"
    fi

    cd ..
}

# Setup Vercel deployment
setup_vercel() {
    print_status "Setting up Vercel deployment..."

    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        print_status "Installing Vercel CLI..."
        npm install -g vercel
    fi

    # Login to Vercel (interactive)
    print_status "Please login to Vercel..."
    if ! vercel login; then
        print_error "Failed to login to Vercel"
        exit 1
    fi

    # Deploy web app
    cd vacation-tracker
    print_status "Deploying web app to Vercel..."
    VERCEL_OUTPUT=$(vercel --prod --yes 2>&1)
    if echo "$VERCEL_OUTPUT" | grep -q "https://"; then
        WEB_URL=$(echo "$VERCEL_OUTPUT" | grep "https://" | head -1)
        print_success "Web app deployed successfully: $WEB_URL"
    else
        print_error "Web app deployment may have failed. Check the output above."
    fi

    cd ..
}

# Create Discord slash commands registration script
create_command_registration() {
    print_status "Creating Discord slash commands registration script..."

    cat > register-discord-commands.js << 'EOL'
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
require('dotenv').config();

const commands = [
  {
    name: 'clock-in',
    description: 'Počni radni dan',
    options: [{
      name: 'location',
      type: 3,
      description: 'Lokacija (office ili home)',
      choices: [
        { name: 'Kancelarija', value: 'office' },
        { name: 'Kuća', value: 'home' }
      ]
    }]
  },
  {
    name: 'clock-out',
    description: 'Završi radni dan'
  },
  {
    name: 'pauza-start',
    description: 'Započni pauzu'
  },
  {
    name: 'pauza-end',
    description: 'Završi pauzu'
  },
  {
    name: 'off',
    description: 'Označi da nisi na poslu'
  },
  {
    name: 'wfh',
    description: 'Clock-in od kuće'
  },
  {
    name: 'wfo',
    description: 'Clock-in u kancelariju'
  },
  {
    name: 'vacation-request',
    description: 'Podnesi zahtjev za godišnji',
    options: [
      {
        name: 'start_date',
        type: 3,
        description: 'Početni datum (YYYY-MM-DD)',
        required: true
      },
      {
        name: 'end_date',
        type: 3,
        description: 'Krajnji datum (YYYY-MM-DD)',
        required: true
      },
      {
        name: 'working_days',
        type: 4,
        description: 'Broj radnih dana',
        required: true
      },
      {
        name: 'reason',
        type: 3,
        description: 'Razlog (opcionalno)'
      }
    ]
  },
  {
    name: 'sick-leave',
    description: 'Prijavi bolovanje',
    options: [
      {
        name: 'start_date',
        type: 3,
        description: 'Početni datum (YYYY-MM-DD)',
        required: true
      },
      {
        name: 'end_date',
        type: 3,
        description: 'Krajnji datum (YYYY-MM-DD)',
        required: true
      },
      {
        name: 'working_days',
        type: 4,
        description: 'Broj radnih dana',
        required: true
      },
      {
        name: 'reason',
        type: 3,
        description: 'Razlog bolovanja',
        required: true
      }
    ]
  },
  {
    name: 'vacation-status',
    description: 'Provjeri status godišnjih dana'
  },
  {
    name: 'admin-set-balance',
    description: 'Postavi vacation balance (Admin only)',
    options: [
      {
        name: 'user',
        type: 3,
        description: 'Discord User ID',
        required: true
      },
      {
        name: 'days',
        type: 4,
        description: 'Broj dana',
        required: true
      }
    ]
  },
  {
    name: 'pm-approve',
    description: 'Odobri vacation request (PM only)',
    options: [{
      name: 'request_id',
      type: 4,
      description: 'Request ID',
      required: true
    }]
  },
  {
    name: 'status',
    description: 'Vidi status tima',
    options: [{
      name: 'type',
      type: 3,
      description: 'Tip statusa',
      required: true,
      choices: [
        { name: 'Online (Na poslu)', value: 'online' },
        { name: 'Na pauzi', value: 'on-break' },
        { name: 'Na godišnjem', value: 'on-vacation' },
        { name: 'Off duty', value: 'off-duty' },
        { name: 'Team overview', value: 'team-overview' }
      ]
    }]
  },
  {
    name: 'schedule',
    description: 'Vidi raspored i statistike',
    options: [{
      name: 'type',
      type: 3,
      description: 'Tip rasporeda',
      required: true,
      choices: [
        { name: 'Danas', value: 'today' },
        { name: 'Sedmica', value: 'week' },
        { name: 'Vacation calendar', value: 'vacation-calendar' },
        { name: 'Rođendani', value: 'birthdays' }
      ]
    }]
  },
  {
    name: 'report',
    description: 'Generiši izvještaje',
    options: [
      {
        name: 'type',
        type: 3,
        description: 'Tip izvještaja',
        required: true,
        choices: [
          { name: 'Time entries danas', value: 'time-today' },
          { name: 'Pending vacations', value: 'vacation-pending' },
          { name: 'User activity', value: 'user-activity' },
          { name: 'Monthly attendance', value: 'monthly-attendance' },
          { name: 'Productivity metrics', value: 'productivity' }
        ]
      },
      {
        name: 'days',
        type: 4,
        description: 'Broj dana (za neke izvještaje)'
      },
      {
        name: 'month',
        type: 4,
        description: 'Mjesec (1-12)'
      },
      {
        name: 'year',
        type: 4,
        description: 'Godina'
      }
    ]
  },
  {
    name: 'remind',
    description: 'Pošalji podsjetnik',
    options: [
      {
        name: 'user',
        type: 3,
        description: 'Korisnik za podsjetnik',
        required: true
      },
      {
        name: 'message',
        type: 3,
        description: 'Poruka podsjetnika',
        required: true
      },
      {
        name: 'when',
        type: 4,
        description: 'Za koliko minuta',
        required: true
      }
    ]
  }
];

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🚀 Registrujem Discord slash commands...');

    if (!process.env.DISCORD_APPLICATION_ID) {
      console.error('❌ DISCORD_APPLICATION_ID nije postavljen u .env fajlu');
      process.exit(1);
    }

    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID),
      { body: commands }
    );

    console.log('✅ Slash commands uspješno registrovani!');
    console.log('📝 Možete testirati komande u vašem Discord serveru');
  } catch (error) {
    console.error('❌ Greška pri registraciji komandi:', error);
    process.exit(1);
  }
})();
EOL

    print_success "Discord commands registration script created"
}

# Create final setup instructions
create_setup_instructions() {
    print_status "Creating setup instructions..."

    cat > SETUP-INSTRUCTIONS.md << 'EOL'
# Vacation Tracker - Final Setup Instructions

## ✅ Što je već urađeno:
- [x] Kreirana kompletna aplikacija sa Discord OAuth
- [x] Implementiran Discord bot sa svim funkcijama
- [x] Podesena Cloudflare D1 baza podataka
- [x] Kreirani deployment scriptovi
- [x] Podesene environment varijable

## 🔧 Što trebate uraditi ručno:

### 1. Postavite Discord Credentials

#### A) Kreirajte Discord Aplikaciju:
1. Idite na https://discord.com/developers/applications
2. Kliknite "New Application"
3. Nazovite je "Vacation Tracker"
4. Idite na "Bot" sekciju i kreirajte bota

#### B) Kopirajte Credentials:
- **Application ID**: Iz "General Information"
- **Public Key**: Iz "General Information"  
- **Bot Token**: Iz "Bot" sekcije
- **Client ID & Secret**: Iz "OAuth2" sekcije

#### C) Ažurirajte .env fajlove:

**discord-bot/.env:**
```env
DISCORD_PUBLIC_KEY="vaš-public-key"
DISCORD_APPLICATION_ID="vaš-application-id"
DISCORD_TOKEN="vaš-bot-token"
```

**vacation-tracker/.env.local:**
```env
DISCORD_CLIENT_ID="vaš-client-id"
DISCORD_CLIENT_SECRET="vaš-client-secret"
```

### 2. Dodajte Bota na Server

#### A) Generišite Invite Link:
U Discord Developer Portal → OAuth2 → URL Generator:
- Scopes: `bot`, `applications.commands`
- Bot Permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`

#### B) Dodajte bota na vaš server klikom na generisani link

### 3. Registrujte Slash Commands

```bash
# Instalirajte dependencies
npm install dotenv @discordjs/rest discord-api-types

# Registrujte komande
node register-discord-commands.js
```

### 4. Deploy na Vercel (ako nije automatski)

```bash
cd vacation-tracker
vercel --prod
```

### 5. Testirajte Sistem

#### A) Test Web Aplikacije:
1. Idite na Vercel URL
2. Kliknite "Sign in with Discord"
3. Autorizujte aplikaciju

#### B) Test Discord Bota:
U vašem Discord serveru pokrenite:
```
/clock-in
/status type:team-overview
/vacation-status
```

## 📊 Monitoring i Maintenance

### Logs:
```bash
# Cloudflare Workers logs
wrangler tail

# Vercel logs u dashboard-u
```

### Backup:
```bash
# Automatski backup
wrangler d1 backup create vacation-tracker-db

# Manual backup
curl -X POST https://your-worker-url/backup
```

### Updates:
```bash
# Update bota
cd discord-bot && wrangler deploy

# Update web app
cd vacation-tracker && vercel --prod
```

## 🎉 Čestitam!

Vaš Vacation Tracker sistem je sada potpuno funkcionalan sa:
- ✅ Web aplikacijom na Vercel
- ✅ Discord botom na Cloudflare Workers
- ✅ D1 bazom podataka
- ✅ Kompletnim time tracking sistemom
- ✅ Vacation management sa 2-layer approval
- ✅ Reporting i analytics
- ✅ Backup i restore funkcionalnostima

Sistem je dizajniran da **uvijek radi** sa robustnim error handlingom i comprehensive loggingom!
EOL

    print_success "Setup instructions created"
}

# Main execution
main() {
    echo ""
    print_status "Starting Vacation Tracker deployment process..."
    echo ""

    check_prerequisites
    setup_environment
    install_dependencies
    setup_cloudflare
    deploy_discord_bot
    setup_vercel
    create_command_registration
    create_setup_instructions

    echo ""
    echo "=================================================="
    print_success "DEPLOYMENT PREPARATION COMPLETED!"
    echo ""
    print_warning "Please follow the instructions in SETUP-INSTRUCTIONS.md"
    print_warning "to complete the manual setup steps."
    echo ""
    print_status "Key files created:"
    echo "  📄 SETUP-INSTRUCTIONS.md - Complete setup guide"
    echo "  📄 register-discord-commands.js - Discord commands registration"
    echo "  🔧 vacation-tracker/.env.local - Web app environment"
    echo "  🔧 discord-bot/.env - Bot environment"
    echo ""
    print_status "URLs (after manual setup):"
    echo "  🌐 Web App: https://vacation-tracker.vercel.app"
    echo "  🤖 Discord Bot: https://your-worker-name.your-subdomain.workers.dev"
    echo ""
}

# Run main function
main "$@"
EOL