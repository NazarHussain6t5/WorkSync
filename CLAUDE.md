# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
# Install dependencies (using pnpm)
pnpm install

# Run the standup bot once (test mode)
npm run test-run

# Start the standup bot (scheduled mode)
npm start

# Run MCP server for Claude Desktop
npm run mcp

# Run MCP server in development mode (auto-reload)
npm run dev:mcp

# Build TypeScript files
npm run build
```

### Docker Operations
```bash
# Build Docker image
cd docker && docker-compose build

# Test run in Docker
cd docker && docker-compose run --rm standup-bot node src/standup-bot/index.js --test

# Start bot in background
cd docker && docker-compose up -d

# Production deployment
cd docker && docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View logs
cd docker && docker-compose logs -f

# Or use the helper script
./scripts/docker-run.sh
```

## Project Structure

```
worksync/
├── src/
│   ├── standup-bot/
│   │   └── index.js          # Daily standup bot main file
│   └── mcp-server/
│       ├── mcp-server.ts     # MCP server for Claude Desktop
│       └── mcp-prompts.ts    # Smart prompts system
├── scripts/
│   ├── docker-run.sh         # Docker management helper
│   └── run-bot.sh           # Local development runner
├── docker/
│   ├── Dockerfile           # Container definition
│   ├── docker-compose.yml   # Base compose configuration
│   └── docker-compose.prod.yml # Production overrides
├── config/
│   ├── .env.example         # Environment template
│   └── claude-mcp-config.json # Example MCP config
├── package.json             # Node.js dependencies
├── tsconfig.json           # TypeScript configuration
├── README.md               # Documentation
└── CLAUDE.md              # This file
```

## Architecture Overview

This codebase contains two independent but related systems:

### 1. Daily Standup Bot (src/standup-bot/index.js)
- **Purpose**: Posts automated daily standup updates to Slack at 9 AM
- **Data Sources**: 
  - Harvest API for time entries (required)
  - Linear API for issue tracking (optional)
- **Key Features**:
  - Timezone-aware scheduling using node-cron
  - Project code extraction (e.g., "Good Code" → "[GC]")
  - Duplicate detection between Linear issues and Harvest entries
  - Graceful degradation if Linear API fails

### 2. MCP Server (src/mcp-server/)
- **Purpose**: Enables Claude Desktop to interact with Harvest using natural language
- **Architecture**: TypeScript-based Model Context Protocol server
- **Tools Provided**:
  - `add_time_entry`: Natural language time entry creation
  - `list_recent_entries`: View recent time logs
  - `get_today_total`: Check daily hours
- **Smart Prompts System** (mcp-prompts.ts):
  - `discover`: Shows all capabilities
  - `guide`: Personalized suggestions based on current tracking
  - `smart_add`: Analyzes complex natural language inputs
  - `weekly_review`: Helps fill time gaps
  - `quick_log`: Fast shortcuts for common activities

## Critical Configuration

### Environment Variables (.env)
```bash
HARVEST_ACCOUNT_ID=       # Required for both components
HARVEST_ACCESS_TOKEN=     # Required for both components
SLACK_WEBHOOK_URL=        # Required for standup bot
LINEAR_API_KEY=           # Optional for standup bot
TIMEZONE=America/New_York # Default timezone for scheduling
```

### Project Code Mappings
Located in src/standup-bot/index.js around line 56:
```javascript
const projectMappings = {
  'Good Code': 'GC',
  'Engineering': 'ENG',
  // Add custom mappings here
};
```

### MCP Configuration for Claude Desktop
Path: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
```json
{
  "mcpServers": {
    "worksync-mcp": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/path/to/worksync",
      "env": {
        "HARVEST_ACCOUNT_ID": "your-id",
        "HARVEST_ACCESS_TOKEN": "your-token"
      }
    }
  }
}
```

## Key Implementation Details

### Time Entry Parsing (src/mcp-server/mcp-server.ts)
- Duration patterns: "30m", "2h", "1.5 hours", "90 mins"
- Date parsing: "today", "yesterday", "tomorrow", or standard formats
- Project inference from keywords: "for", "on", "@", or [brackets]
- Task mapping based on keywords: meeting → Meeting task, development → Development task

### Slack Message Format
- **Yesterday's Work**: Harvest entries + completed Linear issues
- **Today's Plans**: Assigned Linear issues marked as in-progress or todo
- **Blockers**: Currently hardcoded as "No blockers" (customizable)

### Docker Production Settings
- Non-root user execution (uid 1000)
- Resource limits: 0.5 CPU, 256MB memory
- Health checks every 30 seconds
- Read-only filesystem with specific write mounts
- Automatic restart policy

## Common Modifications

### Change Schedule Time
Edit the cron expression in src/standup-bot/index.js (line ~214):
```javascript
cron.schedule('0 9 * * *', runDailyUpdate, {
  timezone: TIMEZONE
});
```

### Add New Task Mappings
Edit taskMappings in src/mcp-server/mcp-server.ts (line ~202):
```javascript
const taskMappings: TaskMapping = {
  'meeting': ['meeting', 'meetings', 'standup', 'sync'],
  // Add new mappings here
};
```

### Customize Blocker Message
Replace the getBlockers() function in src/standup-bot/index.js or set BLOCKERS environment variable.

## Testing Approach

- **Standup Bot**: Use `--test` flag or empty SLACK_WEBHOOK_URL for dry runs
- **MCP Server**: Test with Claude Desktop using discover/guide prompts
- **TypeScript**: Run `npx tsc --noEmit` for type checking
- **Docker**: Use test mode before deploying to production