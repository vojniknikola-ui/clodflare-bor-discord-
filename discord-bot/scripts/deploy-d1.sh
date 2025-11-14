#!/bin/bash

# Vacation Tracker Discord Bot - D1 Deployment Script
# This script sets up and deploys the Discord bot with Cloudflare D1 database

set -e

echo "🚀 Vacation Tracker Discord Bot - D1 Deployment"
echo "================================================"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI is not installed. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if logged in to Cloudflare
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler auth login --status &> /dev/null; then
    echo "Please login to Cloudflare:"
    wrangler auth login
fi

# Create D1 database if it doesn't exist
echo "🗄️  Setting up D1 database..."
DB_NAME="vacation-tracker-db"

if ! wrangler d1 list | grep -q "$DB_NAME"; then
    echo "Creating D1 database: $DB_NAME"
    wrangler d1 create "$DB_NAME"
else
    echo "D1 database $DB_NAME already exists"
fi

# Run migrations
echo "📋 Running database migrations..."
wrangler d1 execute "$DB_NAME" --file=./migrations/init.sql

# Deploy the worker
echo "🚀 Deploying Discord bot to Cloudflare Workers..."
wrangler deploy

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Copy your Discord bot token and application ID"
echo "2. Update wrangler.toml with your Discord credentials:"
echo "   - DISCORD_PUBLIC_KEY"
echo "   - DISCORD_APPLICATION_ID"
echo "   - DISCORD_TOKEN"
echo "3. Register Discord slash commands (see README)"
echo "4. Test the bot in your Discord server"
echo ""
echo "🔗 Useful commands:"
echo "  wrangler dev                    # Local development"
echo "  wrangler tail                   # View logs"
echo "  wrangler d1 execute $DB_NAME --command='SELECT * FROM users;'  # Query database"
echo ""
echo "📚 Documentation: https://developers.cloudflare.com/workers/"