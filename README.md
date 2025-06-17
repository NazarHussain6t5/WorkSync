# WorkSync 🔄

Synchronize work activities across Harvest, Linear, and Slack - featuring automated daily standups, AI-powered time tracking, and comprehensive activity reporting.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🎯 Key Features

### 🤖 Claude AI Integration (MCP Server)
- **Natural Language Time Entry**: Tell Claude "I worked on the API for 2 hours" and it's logged
- **Smart Prompts System**: Guided workflows for time tracking
- **Context-Aware Suggestions**: Claude helps you track time based on your patterns
- **Voice-Like Interaction**: No more clicking through forms - just describe your work

### 📅 Automated Slack Standups
- **Daily Posts**: Automatically posts standup updates at 9 AM (configurable)
- **Harvest Integration**: Fetches all time entries from the previous day  
- **Linear Integration**: Shows completed issues and work in progress
- **Smart Formatting**: Project codes like [GC], [API] for easy scanning
- **Duplicate Detection**: Avoids showing Linear issues already in Harvest

### 🛠️ Developer Experience
- **TypeScript Support**: Full type safety for the MCP server
- **Docker Ready**: Production-grade containerization
- **Timezone Aware**: Works across global teams
- **Test Modes**: Dry runs and immediate testing
- **Modular Architecture**: Use components independently

## 📋 Example Output

```
**What have you done since yesterday?**
• [AKC] Created a comprehensive task list and testing plan for the correlation feature
• [AKC] Started development of the correlation feature
• [GC] Good Code: Meeting: Internal
• [LIN] Completed ENG-123: Fix authentication bug
• [API] Worked on API-456: Implement rate limiting

**What will you do today?**
• [ENG] Work on ENG-789: Refactor user service
• [API] Work on API-012: Add pagination to endpoints
• [LIN] Work on LIN-345: Update documentation

**Anything blocking your progress? Any vacation/etc coming up?**
Partial block on testing API responses due to the lack of access to the .env file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ (for local development)
- Docker & Docker Compose (for containerized deployment)
- Harvest account with API access
- Linear account with API access (optional)
- Slack workspace with webhook permissions

### 1️⃣ Clone or Download

```bash
# If using git
git clone https://github.com/yourusername/worksync.git
cd worksync

# Or create the directory
mkdir -p ~/worksync
cd ~/worksync
```

### 2️⃣ Get Your API Credentials

#### Harvest API Token
1. Log in to Harvest
2. Click on your profile → "Developers"
3. Create a new Personal Access Token
4. Copy the token and your Account ID

#### Slack Webhook URL
1. Go to https://api.slack.com/apps
2. Create a new app (or use existing)
3. Go to "Incoming Webhooks" → Enable
4. Add New Webhook to Workspace
5. Select the channel for standup posts
6. Copy the webhook URL

#### Linear API Key (Optional)
1. Go to Linear → Settings → API
2. Click "Personal API keys"
3. Create a new key with a descriptive name
4. Copy the generated key

### 3️⃣ Configure Environment

Create a `.env` file in the project root:

```bash
# Harvest credentials
HARVEST_ACCOUNT_ID=your_account_id
HARVEST_ACCESS_TOKEN=your_harvest_token

# Slack webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Linear API (optional - leave empty to skip Linear integration)
LINEAR_API_KEY=lin_api_your_key_here

# Timezone (see: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
TIMEZONE=America/New_York
```

## 🏃 Running the Bot

### Option A: Using Docker (Recommended)

#### First Time Setup
```bash
# Build the Docker image
docker-compose build

# Test run to verify everything works
docker-compose run --rm standup-bot node index.js --test
```

#### Daily Operation
```bash
# Start the bot (runs in background)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the bot
docker-compose down
```

#### Using the Helper Script
```bash
# Make script executable
chmod +x docker-run.sh

# Run the interactive menu
./docker-run.sh
```

### Option B: Local Node.js

#### First Time Setup
```bash
# Install dependencies
npm install

# Test run
npm run test-run
```

#### Daily Operation
```bash
# Start the bot
npm start

# Or use the helper script
chmod +x run-bot.sh
./run-bot.sh
```

## ⚙️ Configuration

### Scheduling

The bot runs daily at 9:00 AM in your configured timezone. To change the schedule, edit `index.js`:

```javascript
// Change the cron expression (uses standard cron format)
cron.schedule('0 9 * * *', runDailyUpdate, {
  timezone: TIMEZONE
});

// Examples:
// '30 8 * * *'    - 8:30 AM daily
// '0 9 * * 1-5'   - 9:00 AM Monday-Friday only
// '0 10 * * *'    - 10:00 AM daily
```

### Project Code Mappings

Customize how project names map to codes in `index.js`:

```javascript
const projectMappings = {
  'Good Code': 'GC',
  'Engineering': 'ENG',
  'API Team': 'API',
  'Mobile App': 'MOB',
  // Add your mappings here
};
```

### Today's Plans

The bot automatically pulls your assigned Linear issues. To customize or add static plans, modify the `getTodayPlans()` function in `index.js`.

### Blockers Section

Currently returns "No blockers" by default. You can:
1. Set an environment variable: `BLOCKERS="Your blocker message"`
2. Modify the code to read from a file
3. Integrate with your project management tool

## 🐳 Production Deployment

### Using Docker Compose with Production Settings

```bash
# Deploy with production configuration
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

### Deployment Options

1. **VPS/Cloud Server**: Deploy to any Linux server with Docker
2. **Kubernetes**: Use the Dockerfile to create a Kubernetes deployment
3. **Cloud Run/ECS**: Deploy as a containerized service
4. **Local Server**: Run on any always-on computer

### Health Monitoring

The production configuration includes health checks. Monitor with:

```bash
# Check container health
docker ps
docker inspect worksync | grep -A 5 "Health"
```

## 🔧 Troubleshooting

### Common Issues

#### "No Slack message appeared"
- Check console output - message is printed if webhook fails
- Verify webhook URL is correct and starts with `https://hooks.slack.com/services/`
- Ensure the channel still exists and webhook has permissions

#### "No time entries found"
- Verify you have entries for yesterday in Harvest
- Check timezone settings - "yesterday" is timezone-dependent
- Run test mode to see what date is being queried

#### "Linear connection failed"
- Verify your API key is correct
- The bot continues without Linear data if connection fails
- Check if Linear API is accessible from your network

#### "Docker permission denied"
```bash
# Fix Docker permissions
sudo chown -R $(whoami):$(whoami) ~/.docker

# Or run with sudo
sudo docker-compose build
```

### Debug Mode

For detailed debugging, add to your `.env`:
```bash
DEBUG=true
```

Then check logs for verbose output.

## 🤖 MCP Server for Claude Desktop

The MCP (Model Context Protocol) server allows Claude to add time entries to Harvest using natural language.

### Setting Up MCP Server

1. **Install dependencies** (including TypeScript):
   ```bash
   npm install
   ```

2. **Configure Claude Desktop**:
   
   Edit your Claude Desktop configuration file:
   - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   
   Add the Harvest MCP server:
   ```json
   {
     "mcpServers": {
       "worksync-mcp": {
         "command": "npm",
         "args": ["run", "mcp"],
         "cwd": "/path/to/worksync",
         "env": {
           "HARVEST_ACCOUNT_ID": "1602879",
           "HARVEST_ACCESS_TOKEN": "your-harvest-token"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop** to load the MCP server

### Using MCP Server with Claude

Once configured, you can tell Claude things like:
- "Add meet with Austin for 30m"
- "Log 2 hours of development on the API project"
- "Add 45 minutes internal meeting yesterday"
- "Show me my time entries for the last week"
- "How many hours have I logged today?"

#### 🎯 Smart Prompts (NEW!)

The MCP server now includes intelligent prompts that guide you through time tracking:

1. **discover** - Start here! Shows all capabilities and examples
2. **guide** - Get personalized suggestions based on your current tracking
3. **smart_add** - Analyzes natural language to help you add complex entries
4. **weekly_review** - Guides you through reviewing and filling time gaps
5. **quick_log** - Fast shortcuts for common activities (meeting, lunch, break)

**Example workflow:**
```
You: "Use the discover prompt"
Claude: [Shows all capabilities and smart examples]

You: "Use the guide prompt" 
Claude: [Analyzes your current hours and suggests what to track next]

You: "Use smart_add 'worked on the API documentation for 2.5 hours this morning'"
Claude: [Breaks down the interpretation and shows exact command to run]

You: "Use quick_log meeting"
Claude: [Sets up a 30-minute meeting entry]
```

Claude will use the MCP server to:
- Parse the duration (30m, 2h, 1.5 hours, etc.)
- Find the appropriate project and task
- Add the time entry to Harvest
- Show you confirmation of what was added

### MCP Server Commands

- **add_time_entry**: Add time with natural language
- **list_recent_entries**: Show recent time entries
- **get_today_total**: Get today's total hours

### Development

```bash
# Run MCP server in development mode with auto-reload
npm run dev:mcp

# Build TypeScript files
npm run build
```

## 📂 Project Structure

```
worksync/
├── index.js              # Main application code
├── mcp-server.ts         # TypeScript MCP server for Claude
├── package.json          # Node.js dependencies
├── tsconfig.json         # TypeScript configuration
├── .env                  # Your configuration (git ignored)
├── .env.example          # Example configuration
├── Dockerfile            # Docker container definition
├── docker-compose.yml    # Docker Compose configuration
├── docker-compose.prod.yml # Production overrides
├── docker-run.sh         # Docker management script
├── run-bot.sh           # Local run helper script
├── claude-mcp-config.json # Example MCP configuration
├── README.md            # This file
├── .gitignore           # Git ignore rules
└── .dockerignore        # Docker ignore rules
```

## 🔒 Security Best Practices

1. **Never commit `.env` files** - Keep credentials secure
2. **Use environment variables** in production instead of `.env` files
3. **Rotate API tokens** regularly
4. **Limit webhook permissions** to specific channels
5. **Run containers as non-root** (already configured)
6. **Keep dependencies updated**: `npm audit fix`

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Development Setup

```bash
# Install all dependencies (including dev)
npm install

# Run tests (if available)
npm test

# Check code style
npm run lint
```

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with Node.js and the Linear SDK
- Uses Harvest API v2
- Integrates with Slack via Incoming Webhooks
- Scheduling powered by node-cron

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review logs for error messages
3. Create an issue in the repository
4. Contact your system administrator

---

Made with ❤️ to automate daily standups and keep teams in sync
