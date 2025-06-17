#!/bin/bash

# Docker Helper Script for Harvest + Linear Slack Bot

# Navigate to the project root (script is in scripts/)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo "🐳 Docker Harvest Slack Bot Manager"
echo "==================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    # Try docker compose (newer syntax)
    if ! docker compose version &> /dev/null; then
        echo "❌ Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    # Use newer syntax
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Menu
echo "What would you like to do?"
echo "1) Build the Docker image"
echo "2) Start the bot (background)"
echo "3) Start the bot (foreground with logs)"
echo "4) Stop the bot"
echo "5) View logs"
echo "6) Test run (one-time execution)"
echo "7) Rebuild and start"
echo "8) Remove containers and images"
echo "9) Exit"
echo ""
read -p "Enter your choice (1-9): " choice

case $choice in
    1)
        echo ""
        echo "🔨 Building Docker image..."
        cd docker && $DOCKER_COMPOSE build
        ;;
    2)
        echo ""
        echo "🚀 Starting bot in background..."
        cd docker && $DOCKER_COMPOSE up -d
        echo ""
        echo "✅ Bot is running! Use option 5 to view logs."
        ;;
    3)
        echo ""
        echo "🚀 Starting bot with logs..."
        echo "Press Ctrl+C to stop"
        echo ""
        cd docker && $DOCKER_COMPOSE up
        ;;
    4)
        echo ""
        echo "🛑 Stopping bot..."
        cd docker && $DOCKER_COMPOSE down
        ;;
    5)
        echo ""
        echo "📋 Showing logs (press Ctrl+C to exit)..."
        echo ""
        cd docker && $DOCKER_COMPOSE logs -f
        ;;
    6)
        echo ""
        echo "🧪 Running test (one-time execution)..."
        cd docker && $DOCKER_COMPOSE run --rm standup-bot node src/standup-bot/index.js --test
        ;;
    7)
        echo ""
        echo "🔄 Rebuilding and starting..."
        cd docker && $DOCKER_COMPOSE down
        cd docker && $DOCKER_COMPOSE build
        cd docker && $DOCKER_COMPOSE up -d
        echo ""
        echo "✅ Bot rebuilt and running!"
        ;;
    8)
        echo ""
        echo "🧹 Cleaning up Docker resources..."
        cd docker && $DOCKER_COMPOSE down --rmi all -v
        echo "✅ Cleaned up!"
        ;;
    9)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac
