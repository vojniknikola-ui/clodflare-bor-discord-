# Vacation Tracker - Manual Deployment Guide

## 🚀 Manual Deployment Instructions

If the automated script has issues, follow these manual steps:

### 1. Deploy Discord Bot to Cloudflare Workers

```bash
# Navigate to bot directory
cd discord-bot

# Install dependencies
npm install

# Login to Cloudflare (if not already logged in)
npx wrangler auth login

# Create D1 database
npx wrangler d1 create vacation-tracker-db

# Copy the database ID from the output above
# Update wrangler.toml with your database ID:
# database_id = "your-database-id-here"

# Run migrations
npx wrangler d1 execute vacation-tracker-db --file=./migrations/init.sql

# Deploy the bot
npx wrangler deploy
```

### 2. Deploy Web App to Vercel

```bash
# Navigate to web app directory
cd ../vacation-tracker

# Install dependencies
npm install

# Login to Vercel (if not already logged in)
npx vercel login

# Deploy to production
npx vercel --prod
```

### 3. Register Discord Commands

```bash
# Install required packages
npm install dotenv @discordjs/rest discord-api-types

# Update .env file with your Discord credentials
# DISCORD_APPLICATION_ID=your-app-id
# DISCORD_TOKEN=your-bot-token

# Register commands
node ../register-discord-commands.js
```

### 4. Environment Variables Setup

#### For Discord Bot (.env):
```env
DISCORD_PUBLIC_KEY=0df5ac6ab2ee3b4a0b34faec3ca023bd04d4ec93a5c7eb4
DISCORD_APPLICATION_ID=1438393404424716449
DISCORD_TOKEN=MTQzODM5MzQwNDQyNDcxNjQ0OS.GdpiCC.izUEo6onq
```

#### For Web App (.env.local):
```env
NEXTAUTH_SECRET=smVpXlGHkgDJQxJdeAruG7XluhEGUhKzklVpc5KpxtU=
NEXTAUTH_URL=https://your-vercel-app.vercel.app
DISCORD_CLIENT_ID=1438393404424716449
DISCORD_CLIENT_SECRET=mx83q5mqTuXKxIi8NPKkqPubHYz3XRH3
DATABASE_URL=file:./dev.db
```

### 5. Test the System

#### Test Web App:
1. Go to your Vercel URL
2. Click "Sign in with Discord"
3. Authorize the application

#### Test Discord Bot:
In your Discord server, try:
```
/clock-in
/status type:team-overview
/vacation-status
```

### 6. Troubleshooting

#### If wrangler deploy fails:
```bash
# Check if you're in the right directory
pwd
ls -la

# Check wrangler.toml
cat wrangler.toml

# Try with explicit path
npx wrangler deploy --config wrangler.toml
```

#### If Vercel deploy fails:
```bash
# Check environment variables
vercel env ls

# Add missing variables
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL
vercel env add DISCORD_CLIENT_ID
vercel env add DISCORD_CLIENT_SECRET
```

#### If Discord commands fail:
```bash
# Check your .env file
cat .env

# Verify Discord application settings
# Go to https://discord.com/developers/applications
# Check Application ID, Bot Token, Public Key
```

### 7. Monitoring & Maintenance

#### View logs:
```bash
# Cloudflare Workers logs
npx wrangler tail

# Vercel logs (in dashboard)
```

#### Backup database:
```bash
# Create backup
npx wrangler d1 backup create vacation-tracker-db

# List backups
npx wrangler d1 backup list vacation-tracker-db
```

#### Update deployments:
```bash
# Update bot
cd discord-bot && npx wrangler deploy

# Update web app
cd ../vacation-tracker && npx vercel --prod
```

## ✅ Success Checklist

- [ ] Discord bot deployed to Cloudflare Workers
- [ ] Web app deployed to Vercel
- [ ] Discord slash commands registered
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Test login works
- [ ] Test bot commands work

## 🎉 You're Done!

Your Vacation Tracker system is now live with:
- 🌐 Web dashboard on Vercel
- 🤖 Discord bot on Cloudflare Workers
- 🗄️ D1 database for data storage
- 🔐 Secure Discord OAuth authentication
- 📊 Complete time tracking and vacation management

The system is designed to **always work** with comprehensive error handling and logging!