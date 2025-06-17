#!/bin/bash

# Harvest Slack Bot Runner
# This script makes it easy to run the bot from Claude Desktop App

echo "🤖 Harvest Slack Bot Runner"
echo "=========================="
echo ""

# Navigate to the bot directory (script is in scripts/)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found!"
    echo "Creating .env from .env.example..."
    cp config/.env.example .env
    echo ""
    echo "⚠️  IMPORTANT: You need to add your Slack webhook URL to the .env file"
    echo "Edit /Users/quintinhenry/harvest-slack-bot/.env and add your SLACK_WEBHOOK_URL"
    echo ""
fi

# Menu
echo "What would you like to do?"
echo "1) Test run (post immediately)"
echo "2) Start bot (run daily at 9 AM)"
echo "3) View today's message (dry run)"
echo "4) Exit"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🧪 Running test..."
        node src/standup-bot/index.js --test
        ;;
    2)
        echo ""
        echo "🚀 Starting bot (will run daily at 9 AM)..."
        echo "Press Ctrl+C to stop"
        echo ""
        npm start
        ;;
    3)
        echo ""
        echo "👀 Dry run (no Slack post)..."
        SLACK_WEBHOOK_URL="" node src/standup-bot/index.js --test
        ;;
    4)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac
