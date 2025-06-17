import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  Tool,
  CallToolRequest,
  TextContent,
  CallToolResult,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { prompts, handlePrompt } from './mcp-prompts.js';

dotenv.config();
dayjs.extend(customParseFormat);
dayjs.extend(timezone);
dayjs.extend(utc);

// Export for use in prompts
export { harvestApi, getProjects, getTasks };

// Types
interface HarvestProject {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
  client: {
    id: number;
    name: string;
  };
}

interface HarvestTask {
  id: number;
  name: string;
  is_active: boolean;
}

interface HarvestTimeEntry {
  id: number;
  spent_date: string;
  hours: number;
  notes: string | null;
  project: {
    id: number;
    name: string;
  };
  task: {
    id: number;
    name: string;
  };
}

interface AddTimeEntryArgs {
  description: string;
  project?: string;
  date?: string;
}

interface ListRecentEntriesArgs {
  days?: number;
}

interface DurationPattern {
  regex: RegExp;
  multiplier: number;
}

interface TaskMapping {
  [key: string]: string[];
}

// Harvest API configuration
const HARVEST_ACCOUNT_ID = process.env.HARVEST_ACCOUNT_ID;
const HARVEST_ACCESS_TOKEN = process.env.HARVEST_ACCESS_TOKEN;

if (!HARVEST_ACCOUNT_ID || !HARVEST_ACCESS_TOKEN) {
  throw new Error('Missing required environment variables: HARVEST_ACCOUNT_ID and HARVEST_ACCESS_TOKEN');
}

const harvestApi: AxiosInstance = axios.create({
  baseURL: 'https://api.harvestapp.com/api/v2',
  headers: {
    'Harvest-Account-ID': HARVEST_ACCOUNT_ID,
    'Authorization': `Bearer ${HARVEST_ACCESS_TOKEN}`,
    'User-Agent': 'Harvest MCP Server'
  }
});

// Cache for projects and tasks
let projectsCache: HarvestProject[] | null = null;
let tasksCache: HarvestTask[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION: number = 3600000; // 1 hour

// Parse natural language time duration
function parseDuration(text: string): number {
  const patterns: DurationPattern[] = [
    { regex: /(\d+(?:\.\d+)?)\s*h(?:ours?)?/i, multiplier: 1 },
    { regex: /(\d+(?:\.\d+)?)\s*m(?:ins?|inutes?)?/i, multiplier: 1/60 },
    { regex: /(\d+(?:\.\d+)?)\s*(?:hrs?)/i, multiplier: 1 },
  ];
  
  for (const { regex, multiplier } of patterns) {
    const match = text.match(regex);
    if (match) {
      return parseFloat(match[1]!) * multiplier;
    }
  }
  
  // Default to 1 hour if no duration found
  return 1;
}

// Parse date from natural language
function parseDate(text: string): string {
  const today = dayjs();
  
  // Check for relative dates
  if (text.includes('today')) return today.format('YYYY-MM-DD');
  if (text.includes('yesterday')) return today.subtract(1, 'day').format('YYYY-MM-DD');
  if (text.includes('tomorrow')) return today.add(1, 'day').format('YYYY-MM-DD');
  
  // Try common date formats
  const formats: string[] = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'MMM DD', 'MMMM DD'];
  for (const format of formats) {
    const parsed = dayjs(text, format);
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM-DD');
    }
  }
  
  // Default to today
  return today.format('YYYY-MM-DD');
}

// Fetch and cache projects
async function getProjects(): Promise<HarvestProject[]> {
  if (projectsCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return projectsCache;
  }
  
  const response = await harvestApi.get<{ projects: HarvestProject[] }>('/projects', {
    params: { is_active: true, per_page: 100 }
  });
  
  projectsCache = response.data.projects;
  cacheTimestamp = Date.now();
  return projectsCache;
}

// Fetch and cache tasks
async function getTasks(): Promise<HarvestTask[]> {
  if (tasksCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return tasksCache;
  }
  
  const response = await harvestApi.get<{ tasks: HarvestTask[] }>('/tasks', {
    params: { is_active: true, per_page: 100 }
  });
  
  tasksCache = response.data.tasks;
  return tasksCache;
}

// Find best matching project
async function findProject(query: string): Promise<HarvestProject | undefined> {
  const projects = await getProjects();
  const searchTerm = query.toLowerCase();
  
  // First try exact match
  let project = projects.find(p => p.name.toLowerCase() === searchTerm);
  if (project) return project;
  
  // Then try contains
  project = projects.find(p => p.name.toLowerCase().includes(searchTerm));
  if (project) return project;
  
  // Then try code match
  project = projects.find(p => p.code && p.code.toLowerCase() === searchTerm);
  if (project) return project;
  
  // Return first active project as fallback
  return projects[0];
}

// Find best matching task
async function findTask(query: string): Promise<HarvestTask | undefined> {
  const tasks = await getTasks();
  const searchTerm = query.toLowerCase();
  
  // Common task mappings
  const taskMappings: TaskMapping = {
    'meeting': ['meeting', 'meetings', 'standup', 'sync'],
    'development': ['development', 'coding', 'programming', 'dev'],
    'design': ['design', 'ui', 'ux'],
    'review': ['review', 'code review', 'pr review'],
    'planning': ['planning', 'estimation', 'grooming'],
    'internal': ['internal', 'admin', 'administrative']
  };
  
  // Check mappings
  for (const [key, aliases] of Object.entries(taskMappings)) {
    if (aliases.some(alias => searchTerm.includes(alias))) {
      const task = tasks.find(t => t.name.toLowerCase().includes(key));
      if (task) return task;
    }
  }
  
  // Try exact match
  let task = tasks.find(t => t.name.toLowerCase() === searchTerm);
  if (task) return task;
  
  // Try contains
  task = tasks.find(t => t.name.toLowerCase().includes(searchTerm));
  if (task) return task;
  
  // Return first task as fallback
  return tasks[0];
}

// Create MCP server
const server = new Server(
  {
    name: 'harvest-time-tracker',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
);

// Define tools
const tools: Tool[] = [
  {
    name: 'add_time_entry',
    description: 'Add a time entry to Harvest. Supports natural language like "meet with Austin for 30m" or "2h development on API"',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Natural language description of the time entry, including duration (e.g., "30m meeting with Austin")'
        },
        project: {
          type: 'string',
          description: 'Project name or code (optional, will be inferred from description)'
        },
        date: {
          type: 'string',
          description: 'Date for the entry (optional, defaults to today). Can be "today", "yesterday", or YYYY-MM-DD'
        }
      },
      required: ['description']
    }
  },
  {
    name: 'list_recent_entries',
    description: 'List recent time entries from Harvest',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look back (default: 7)'
        }
      }
    }
  },
  {
    name: 'get_today_total',
    description: 'Get total hours logged today',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'add_time_entry': {
        const { description, project: projectHint, date } = args as unknown as AddTimeEntryArgs;
        
        // Parse the description
        const hours = parseDuration(description);
        const entryDate = date ? parseDate(date) : dayjs().format('YYYY-MM-DD');
        
        // Extract project hint from description if not provided
        let projectQuery = projectHint;
        if (!projectQuery) {
          // Look for common project indicators
          const projectPatterns: RegExp[] = [
            /(?:for|on|@)\s+(\w+)/i,
            /\[(\w+)\]/,
            /^(\w+):/
          ];
          
          for (const pattern of projectPatterns) {
            const match = description.match(pattern);
            if (match) {
              projectQuery = match[1];
              break;
            }
          }
        }
        
        // Find project and task
        const project = await findProject(projectQuery || 'default');
        if (!project) {
          throw new Error('No project found');
        }
        
        // Determine task type from description
        let taskQuery = 'general';
        const taskKeywords: string[] = ['meeting', 'development', 'review', 'planning', 'design', 'internal'];
        for (const keyword of taskKeywords) {
          if (description.toLowerCase().includes(keyword)) {
            taskQuery = keyword;
            break;
          }
        }
        
        const task = await findTask(taskQuery);
        if (!task) {
          throw new Error('No task found');
        }
        
        // Create the time entry
        const response = await harvestApi.post<HarvestTimeEntry>('/time_entries', {
          project_id: project.id,
          task_id: task.id,
          spent_date: entryDate,
          hours: hours,
          notes: description
        });
        
        const content: TextContent = {
          type: 'text',
          text: `✅ Added ${hours}h to ${project.name} - ${task.name}\nDate: ${entryDate}\nNotes: ${description}\nEntry ID: ${response.data.id}`
        };
        
        return { content: [content] };
      }
      
      case 'list_recent_entries': {
        const { days = 7 } = args as unknown as ListRecentEntriesArgs;
        const fromDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD');
        const toDate = dayjs().format('YYYY-MM-DD');
        
        const response = await harvestApi.get<{ time_entries: HarvestTimeEntry[] }>('/time_entries', {
          params: {
            from: fromDate,
            to: toDate,
            per_page: 100
          }
        });
        
        const entries = response.data.time_entries;
        const entriesByDate: Record<string, HarvestTimeEntry[]> = {};
        
        entries.forEach(entry => {
          const date = entry.spent_date;
          if (!entriesByDate[date]) {
            entriesByDate[date] = [];
          }
          entriesByDate[date].push(entry);
        });
        
        let output = `📊 Time entries for the last ${days} days:\n\n`;
        
        Object.keys(entriesByDate)
          .sort()
          .reverse()
          .forEach(date => {
            const dayEntries = entriesByDate[date];
            if (!dayEntries) return;
            const totalHours = dayEntries.reduce((sum, e) => sum + e.hours, 0);
            
            output += `**${dayjs(date).format('dddd, MMMM D')}** (${totalHours}h total)\n`;
            dayEntries.forEach(entry => {
              output += `  • ${entry.hours}h - ${entry.project.name}: ${entry.notes || entry.task.name}\n`;
            });
            output += '\n';
          });
        
        const content: TextContent = {
          type: 'text',
          text: output
        };
        
        return { content: [content] };
      }
      
      case 'get_today_total': {
        const today = dayjs().format('YYYY-MM-DD');
        
        const response = await harvestApi.get<{ time_entries: HarvestTimeEntry[] }>('/time_entries', {
          params: {
            from: today,
            to: today
          }
        });
        
        const totalHours = response.data.time_entries.reduce((sum, entry) => sum + entry.hours, 0);
        const entries = response.data.time_entries;
        
        let output = `📅 Today's time tracking (${today}):\n\n`;
        output += `Total: ${totalHours} hours\n\n`;
        
        if (entries.length > 0) {
          output += 'Entries:\n';
          entries.forEach(entry => {
            output += `• ${entry.hours}h - ${entry.project.name}: ${entry.notes || entry.task.name}\n`;
          });
        } else {
          output += 'No entries logged yet today.';
        }
        
        const content: TextContent = {
          type: 'text',
          text: output
        };
        
        return { content: [content] };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const content: TextContent = {
      type: 'text',
      text: `❌ Error: ${errorMessage}`
    };
    
    return {
      content: [content],
      isError: true
    };
  }
});

// Handle prompt listing
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return { prompts };
});

// Handle prompt execution
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const prompt = prompts.find(p => p.name === name);
  if (!prompt) {
    throw new Error(`Unknown prompt: ${name}`);
  }
  
  const result = await handlePrompt(name, args || {});
  
  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Use the prompt: ${name} ${args ? JSON.stringify(args) : ''}`
        }
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: result
        }
      }
    ]
  };
});

// Start the server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Harvest MCP server running on stdio');
}

main().catch(console.error);
