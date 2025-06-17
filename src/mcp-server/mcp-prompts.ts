import { 
  Prompt
} from '@modelcontextprotocol/sdk/types.js';
import dayjs from 'dayjs';

// Define all prompts
export const prompts: Prompt[] = [
  {
    name: 'discover',
    description: 'Discover all capabilities of the Harvest time tracker - start here!',
    arguments: []
  },
  {
    name: 'guide',
    description: 'Get personalized time tracking guidance based on your current status',
    arguments: []
  },
  {
    name: 'smart_add',
    description: 'Add time entries with intelligent parsing and suggestions',
    arguments: [
      {
        name: 'description',
        description: 'Natural language description like "worked on API docs for 2 hours this morning"',
        required: true
      }
    ]
  },
  {
    name: 'weekly_review',
    description: 'Analyze your week and identify gaps in time tracking',
    arguments: [
      {
        name: 'weeks_back',
        description: 'Number of weeks to analyze (default: 1)',
        required: false
      }
    ]
  },
  {
    name: 'quick_log',
    description: 'Quick commands for common time entries (meetings, breaks, admin)',
    arguments: [
      {
        name: 'type',
        description: 'Type of activity: meeting, break, admin, review, standup, lunch',
        required: true
      },
      {
        name: 'duration',
        description: 'Duration (default: 30m for meetings, 15m for breaks)',
        required: false
      }
    ]
  }
];

// Prompt handler that returns instructions for the assistant
export async function handlePrompt(name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case 'discover':
      return discoverPrompt();
    
    case 'guide':
      return guidePrompt();
    
    case 'smart_add':
      return smartAddPrompt(args.description as string);
    
    case 'weekly_review':
      return weeklyReviewPrompt(args.weeks_back as number || 1);
    
    case 'quick_log':
      return quickLogPrompt(args.type as string, args.duration as string);
    
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

function discoverPrompt(): string {
  return `🎯 **Harvest Time Tracker MCP Server**

I can help you track time in Harvest with natural language! Here's what I can do:

📚 **Tools Available:**
  • add_time_entry - Add time with natural language like "30m meeting with Austin"
  • list_recent_entries - Show time entries from the past N days
  • get_today_total - See how many hours you've logged today

🎯 **Smart Prompts for Workflows:**
  • discover - This guide showing all capabilities
  • guide - Get personalized suggestions based on your time tracking
  • smart_add - Intelligently parse complex time descriptions
  • weekly_review - Analyze your week and find missing time
  • quick_log - Fast shortcuts for common activities

💡 **Examples to Try:**
  • "Add 2 hours working on API documentation"
  • "Show me this week's time entries"
  • "Quick log a meeting"
  • "I worked on the presentation for 3 hours yesterday morning"
  • "How many hours have I logged today?"

🚀 **Quick Start:** 
First, check your current status with "get_today_total", then use "guide" for personalized suggestions!

The system understands:
  - Durations: 30m, 2h, 1.5 hours, 90 minutes
  - Dates: today, yesterday, "last Tuesday", specific dates
  - Projects: Will match based on keywords
  - Common tasks: meeting, development, documentation, review`;
}

function guidePrompt(): string {
  return `📊 **Time Tracking Guide**

To see your current status and get personalized suggestions:

1. First run: "get_today_total" to see today's hours
2. Then run: "list_recent_entries 7" to see this week
3. Based on the results, I'll help you:
   - Fill in any gaps
   - Log current work
   - Quick-add common activities

**Common Scenarios:**

🎯 Just finished something?
  → Use: "add 1h finished the API documentation"

🎯 In a meeting now?
  → Use: "quick_log meeting" (defaults to 30m)

🎯 Forgot yesterday?
  → Use: "add 3h worked on client presentation yesterday"

🎯 Multiple activities?
  → Use smart_add for each:
    "smart_add worked 2h on bug fixes this morning"
    "smart_add 1h team meeting after lunch"

💡 **Pro Tips:**
  - Log time as you go for accuracy
  - Use descriptive notes for future reference
  - Check weekly_review every Friday
  - Set reminders to log time before leaving`;
}

function smartAddPrompt(description: string): string {
  // Parse the description to show what would be added
  const duration = extractDuration(description);
  const date = extractDate(description);
  const projectHint = extractProjectHint(description);
  const taskHint = extractTaskHint(description);
  
  return `🤖 **Smart Add Analysis**

From: "${description}"

I understand you want to add:
  • Duration: ${duration}
  • Date: ${date}
  • Project hint: ${projectHint || 'Will auto-detect'}
  • Task type: ${taskHint || 'Will auto-detect'}

To add this entry, use:
\`\`\`
add_time_entry with:
- description: "${description}"
- date: "${date}"
${projectHint ? `- project: "${projectHint}"` : ''}
\`\`\`

The system will:
1. Find the best matching project ${projectHint ? `(looking for "${projectHint}")` : ''}
2. Select appropriate task type ${taskHint ? `(likely "${taskHint}")` : ''}
3. Create the time entry with your full description as notes

💡 **Tips for better matching:**
  - Include project name or code: "2h on GoodCode feature"
  - Specify task type: "1h meeting with client"
  - Add date context: "worked yesterday afternoon"`;
}

function weeklyReviewPrompt(weeksBack: number): string {
  const startDate = dayjs().subtract(weeksBack * 7, 'days').format('YYYY-MM-DD');
  const endDate = dayjs().format('YYYY-MM-DD');
  
  return `📊 **Weekly Review Guide**

To analyze ${weeksBack === 1 ? 'this week' : `the last ${weeksBack} weeks`}:

1. Run: "list_recent_entries ${weeksBack * 7}"
2. This will show all entries from ${startDate} to ${endDate}

**What to look for:**
  • Days with less than 8 hours
  • Missing time blocks (lunch, afternoon, etc.)
  • Projects that need more time logged
  • Patterns in your work schedule

**Common gaps to check:**
  ❓ Monday morning startup time
  ❓ Friday afternoon wrap-up
  ❓ Meeting time not logged
  ❓ Quick tasks and interruptions
  ❓ Code review and PR time

**After reviewing, fill gaps with:**
  • "add 1h morning standup on Monday"
  • "add 2h code review for API project yesterday"
  • "add 30m responded to emails on Tuesday"

💡 **Weekly targets:**
  - Aim for 40 hours/week
  - Log time same day for accuracy
  - Include all billable activities
  - Don't forget internal meetings`;
}

function quickLogPrompt(type: string, duration?: string): string {
  const defaults: Record<string, string> = {
    meeting: '30m',
    break: '15m',
    admin: '30m',
    review: '1h',
    standup: '15m',
    lunch: '1h',
    email: '30m',
    planning: '1h'
  };

  const actualDuration = duration || defaults[type.toLowerCase()] || '30m';
  const validTypes = Object.keys(defaults).join(', ');
  
  if (!defaults[type.toLowerCase()]) {
    return `❓ Unknown quick log type: "${type}"
    
Valid types: ${validTypes}

Examples:
  • "quick_log meeting" - 30m meeting
  • "quick_log lunch" - 1h lunch break
  • "quick_log standup" - 15m standup
  • "quick_log review 2h" - 2h code review

You can also specify custom duration:
  • "quick_log meeting 45m"
  • "quick_log admin 2h"`;
  }
  
  return `⚡ **Quick Log: ${type}**

Ready to add:
  • Type: ${type}
  • Duration: ${actualDuration}
  • Date: Today
  • Project: ${type === 'meeting' || type === 'standup' ? 'Will use your main project' : 'Internal/Admin'}

To confirm, use:
\`\`\`
add_time_entry with:
- description: "${type} - ${actualDuration}"
- date: "today"
\`\`\`

**Other quick logs:**
${Object.entries(defaults)
  .filter(([t]) => t !== type)
  .slice(0, 5)
  .map(([t, d]) => `  • quick_log ${t} (${d})`)
  .join('\n')}

💡 Tip: You can always add more detail:
"add 30m team meeting about new feature design"`;
}

// Helper functions
function extractDuration(text: string): string {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*h(?:ours?)?/i,
    /(\d+(?:\.\d+)?)\s*m(?:ins?|inutes?)?/i,
    /(\d+)\s*(?:hrs?)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return '1 hour (default)';
}

function extractDate(text: string): string {
  const lower = text.toLowerCase();
  
  if (lower.includes('yesterday')) return 'yesterday';
  if (lower.includes('today')) return 'today';
  if (lower.includes('this morning')) return 'today';
  if (lower.includes('this afternoon')) return 'today';
  if (lower.includes('last')) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    for (const day of days) {
      if (lower.includes(day)) return `last ${day}`;
    }
  }
  
  // Check for specific dates
  const datePattern = /(\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})/;
  const dateMatch = text.match(datePattern);
  if (dateMatch) return dateMatch[0];
  
  return 'today';
}

function extractProjectHint(text: string): string | null {
  const keywords: Record<string, string> = {
    'api': 'API',
    'good code': 'GoodCode',
    'goodcode': 'GoodCode',
    'gc': 'GoodCode',
    'internal': 'Internal',
    'client': 'Client'
  };
  
  const lower = text.toLowerCase();
  for (const [keyword, hint] of Object.entries(keywords)) {
    if (lower.includes(keyword)) return hint;
  }
  
  return null;
}

function extractTaskHint(text: string): string | null {
  const keywords: Record<string, string> = {
    'meeting': 'meeting',
    'standup': 'meeting',
    'documentation': 'documentation',
    'docs': 'documentation',
    'bug': 'bug fix',
    'fix': 'bug fix',
    'feature': 'development',
    'review': 'code review',
    'pr': 'code review',
    'planning': 'planning',
    'design': 'design',
    'email': 'admin',
    'admin': 'admin'
  };
  
  const lower = text.toLowerCase();
  for (const [keyword, hint] of Object.entries(keywords)) {
    if (lower.includes(keyword)) return hint;
  }
  
  return null;
}
