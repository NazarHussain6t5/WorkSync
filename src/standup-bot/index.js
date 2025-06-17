import axios from 'axios';
import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { LinearClient } from '@linear/sdk';
import dotenv from 'dotenv';

dotenv.config();
dayjs.extend(utc);
dayjs.extend(timezone);

const HARVEST_ACCOUNT_ID = process.env.HARVEST_ACCOUNT_ID || '1602879';
const HARVEST_ACCESS_TOKEN = process.env.HARVEST_ACCESS_TOKEN || '4018942.pt.HLtw16w2dWbPlhGpVo27wtXcJNFT2FhgcOZNTgNu1SVvHKcqkk89MivfpoZRZ-TxuR10NlRLzkoNRez5cWoHBQ';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const TIMEZONE = process.env.TIMEZONE || 'America/New_York';

// Test mode flag
const isTestMode = process.argv.includes('--test');

// Initialize Linear client
const linearClient = LINEAR_API_KEY ? new LinearClient({ apiKey: LINEAR_API_KEY }) : null;

// Harvest API client
const harvestApi = axios.create({
  baseURL: 'https://api.harvestapp.com/api/v2',
  headers: {
    'Harvest-Account-ID': HARVEST_ACCOUNT_ID,
    'Authorization': `Bearer ${HARVEST_ACCESS_TOKEN}`,
    'User-Agent': 'Harvest Slack Bot'
  }
});

// Get project code from project name
function getProjectCode(projectName) {
  // Map common project names to codes
  const projectMappings = {
    'Good Code': 'GC',
    'GoodCode': 'GC',
    // Add more mappings as needed
  };
  
  // Check if we have a specific mapping
  for (const [name, code] of Object.entries(projectMappings)) {
    if (projectName.toLowerCase().includes(name.toLowerCase())) {
      return code;
    }
  }
  
  // Otherwise, try to extract initials or use first 3 letters
  const words = projectName.split(' ');
  if (words.length > 1) {
    return words.map(w => w[0]).join('').toUpperCase();
  }
  return projectName.substring(0, 3).toUpperCase();
}

// Format time entry for Slack
function formatTimeEntry(entry) {
  const projectCode = entry.project?.code || getProjectCode(entry.project?.name || 'Unknown');
  const taskName = entry.task?.name || '';
  const notes = entry.notes || '';
  
  // Combine task name and notes
  let description = '';
  if (taskName && notes) {
    description = `${taskName}: ${notes}`;
  } else {
    description = taskName || notes || 'No description';
  }
  
  return `[${projectCode}] ${description}`;
}

// Format Linear issue for Slack
function formatLinearIssue(issue, action = 'worked on') {
  const identifier = issue.identifier;
  const title = issue.title;
  const projectName = issue.project?.name || 'Linear';
  const projectCode = getProjectCode(projectName);
  
  return `[${projectCode}] ${action} ${identifier}: ${title}`;
}

// Fetch time entries for a specific date
async function fetchTimeEntries(date) {
  try {
    const response = await harvestApi.get('/time_entries', {
      params: {
        from: date,
        to: date
      }
    });
    
    return response.data.time_entries;
  } catch (error) {
    console.error('Error fetching time entries:', error.message);
    throw error;
  }
}

// Fetch Linear issues worked on or completed yesterday
async function fetchLinearActivity(date) {
  if (!linearClient) {
    console.log('Linear API key not configured, skipping Linear integration');
    return { workedOn: [], completed: [] };
  }

  try {
    const startOfDay = dayjs(date).startOf('day').toISOString();
    const endOfDay = dayjs(date).endOf('day').toISOString();
    
    // Get current user
    const me = await linearClient.viewer;
    
    // Fetch issues completed yesterday
    const completedIssues = await linearClient.issues({
      filter: {
        completedAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        assignee: { id: { eq: me.id } }
      }
    });
    
    // Fetch issues updated yesterday (worked on but not completed)
    const updatedIssues = await linearClient.issues({
      filter: {
        updatedAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        assignee: { id: { eq: me.id } },
        completedAt: { null: true } // Not completed
      }
    });
    
    // Fetch issues with comments from me yesterday
    const myComments = await linearClient.comments({
      filter: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        user: { id: { eq: me.id } }
      },
      includeArchived: false
    });
    
    // Get unique issue IDs from comments
    const commentedIssueIds = new Set();
    for (const comment of myComments.nodes) {
      if (comment.issue) {
        commentedIssueIds.add(comment.issue.id);
      }
    }
    
    // Fetch the commented issues
    const commentedIssues = [];
    for (const issueId of commentedIssueIds) {
      try {
        const issue = await linearClient.issue(issueId);
        if (issue && !issue.completedAt) { // Only include if not completed
          commentedIssues.push(issue);
        }
      } catch (error) {
        console.error(`Error fetching issue ${issueId}:`, error.message);
      }
    }
    
    // Combine worked on issues (updated + commented) and remove duplicates
    const workedOnMap = new Map();
    [...updatedIssues.nodes, ...commentedIssues].forEach(issue => {
      if (!workedOnMap.has(issue.id)) {
        workedOnMap.set(issue.id, issue);
      }
    });
    
    return {
      workedOn: Array.from(workedOnMap.values()),
      completed: completedIssues.nodes
    };
    
  } catch (error) {
    console.error('Error fetching Linear activity:', error.message);
    return { workedOn: [], completed: [] };
  }
}

// Get today's planned activities (you can customize this)
async function getTodayPlans() {
  const plans = [];
  
  // Add Linear issues assigned to me that are in progress or todo
  if (linearClient) {
    try {
      const me = await linearClient.viewer;
      const myIssues = await linearClient.issues({
        filter: {
          assignee: { id: { eq: me.id } },
          state: { type: { in: ['started', 'unstarted'] } }
        },
        orderBy: 'priority'
      });
      
      // Add top priority issues to today's plans
      const topIssues = myIssues.nodes.slice(0, 3);
      topIssues.forEach(issue => {
        const projectCode = getProjectCode(issue.project?.name || 'Linear');
        plans.push(`[${projectCode}] Work on ${issue.identifier}: ${issue.title}`);
      });
    } catch (error) {
      console.error('Error fetching today\'s Linear issues:', error.message);
    }
  }
  
  // Add default plans if no Linear issues found
  if (plans.length === 0) {
    plans.push(
      "Continue with current sprint tasks",
      "Review and respond to PRs",
      "Team standup meeting"
    );
  }
  
  return plans;
}

// Format the complete message for Slack
function formatSlackMessage(harvestEntries, linearActivity, todayPlans = [], blockers = '') {
  // Combine all yesterday's activities
  const yesterdayTasks = [];
  
  // Add Harvest time entries
  harvestEntries.forEach(entry => {
    yesterdayTasks.push(`• ${formatTimeEntry(entry)}`);
  });
  
  // Add Linear completed issues
  linearActivity.completed.forEach(issue => {
    yesterdayTasks.push(`• ${formatLinearIssue(issue, 'Completed')}`);
  });
  
  // Add Linear worked on issues (if not already in Harvest)
  linearActivity.workedOn.forEach(issue => {
    // Check if this might already be logged in Harvest
    const possiblyLogged = harvestEntries.some(entry => 
      entry.notes?.includes(issue.identifier) || 
      entry.notes?.includes(issue.title)
    );
    
    if (!possiblyLogged) {
      yesterdayTasks.push(`• ${formatLinearIssue(issue, 'Worked on')}`);
    }
  });
  
  const todayTasksFormatted = todayPlans.map(plan => `• ${plan}`).join('\n');
  
  let message = `*What have you done since yesterday?*\n${yesterdayTasks.join('\n') || '• No activities recorded'}\n\n`;
  message += `*What will you do today?*\n${todayTasksFormatted || '• To be determined'}\n\n`;
  message += `*Anything blocking your progress? Any vacation/etc coming up?*\n${blockers || 'No blockers'}`;
  
  return message;
}

// Post message to Slack
async function postToSlack(message) {
  if (!SLACK_WEBHOOK_URL) {
    console.error('SLACK_WEBHOOK_URL not configured');
    console.log('\n📋 Message that would be sent:\n');
    console.log(message);
    console.log('\n');
    return;
  }
  
  try {
    await axios.post(SLACK_WEBHOOK_URL, {
      text: message
    });
    console.log('Successfully posted to Slack');
  } catch (error) {
    console.error('Error posting to Slack:', error.message);
    throw error;
  }
}

// Main function to run the daily update
async function runDailyUpdate() {
  console.log(`Running daily update at ${dayjs().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')}`);
  
  try {
    // Get yesterday's date
    const yesterday = dayjs().tz(TIMEZONE).subtract(1, 'day').format('YYYY-MM-DD');
    console.log(`\nFetching activity for ${yesterday}`);
    
    // Fetch yesterday's data in parallel
    console.log('📊 Fetching Harvest time entries...');
    const harvestEntriesPromise = fetchTimeEntries(yesterday);
    
    console.log('📝 Fetching Linear activity...');
    const linearActivityPromise = fetchLinearActivity(yesterday);
    
    const [harvestEntries, linearActivity] = await Promise.all([
      harvestEntriesPromise,
      linearActivityPromise
    ]);
    
    console.log(`✅ Found ${harvestEntries.length} Harvest time entries`);
    console.log(`✅ Found ${linearActivity.completed.length} completed Linear issues`);
    console.log(`✅ Found ${linearActivity.workedOn.length} Linear issues worked on`);
    
    // Get today's plans
    console.log('\n📅 Getting today\'s plans...');
    const todayPlans = await getTodayPlans();
    
    // Format the message
    const message = formatSlackMessage(harvestEntries, linearActivity, todayPlans);
    
    // Post to Slack
    await postToSlack(message);
    
  } catch (error) {
    console.error('Error in daily update:', error);
  }
}

// Initialize the bot
async function init() {
  console.log('🤖 Starting Harvest + Linear Slack Bot...');
  console.log(`⏰ Timezone: ${TIMEZONE}`);
  
  // Verify Harvest connection
  try {
    const response = await harvestApi.get('/users/me.json');
    console.log(`✅ Connected to Harvest as: ${response.data.first_name} ${response.data.last_name}`);
  } catch (error) {
    console.error('❌ Failed to connect to Harvest:', error.message);
    process.exit(1);
  }
  
  // Verify Linear connection if configured
  if (linearClient) {
    try {
      const me = await linearClient.viewer;
      console.log(`✅ Connected to Linear as: ${me.name}`);
    } catch (error) {
      console.error('⚠️  Failed to connect to Linear:', error.message);
      console.log('   Continuing without Linear integration...');
    }
  } else {
    console.log('ℹ️  Linear API key not configured - skipping Linear integration');
  }
  
  if (isTestMode) {
    console.log('\n🧪 --- TEST MODE ---');
    await runDailyUpdate();
    console.log('--- END TEST ---\n');
    process.exit(0);
  }
  
  // Schedule daily update at 9:00 AM
  cron.schedule('0 9 * * *', runDailyUpdate, {
    timezone: TIMEZONE
  });
  
  console.log('\n⏰ Bot scheduled to run daily at 9:00 AM');
  console.log('Press Ctrl+C to stop\n');
  
  // Keep the process running
  process.stdin.resume();
}

// Start the bot
init().catch(console.error);
