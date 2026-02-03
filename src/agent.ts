import { getModel } from '@mariozechner/pi-ai';
import { Agent } from '@mariozechner/pi-agent-core';
import { fetchUrlTool, saveToObsidianTool, getSourcesTool, manageSourcesTool, runShellCommandTool } from './tools.js';

import { readSettings } from './storage.js';

export async function createAgent() {
  const settings = await readSettings();
  const modelProvider = settings.modelProvider;
  console.log(`📦 Using model provider: ${modelProvider}`);

  let model;

  if (modelProvider === 'openai') {
    // Use OpenAI (default)
    model = getModel('openai', (settings.openaiModel || 'gpt-4o') as any);
  } else if (modelProvider === 'anthropic') {
    // Use Anthropic Claude
    model = getModel('anthropic', (settings.anthropicModel || 'claude-3-5-sonnet-20241022') as any);
  } else if (modelProvider === 'google') {
    // Use Google AI (Gemini via API)
    const modelName = settings.googleModel || 'gemini-2.0-flash-exp';
    console.log(`🤖 Getting Google model: ${modelName}`);
    model = getModel('google', modelName as any);
  } else {
    throw new Error(`Unknown model provider: ${modelProvider}. Supported: openai, anthropic, google`);
  }

  console.log('🔧 Creating Agent...');

  const agentConfig: any = {
    initialState: {
      model,
      tools: [fetchUrlTool, saveToObsidianTool, getSourcesTool, manageSourcesTool, runShellCommandTool],
      systemPrompt: `You are a Daily News Briefer.
1. Call 'get_sources' to see what to read.
2. For each active source, use 'fetch_url'.
3. Synthesize all findings into one 'Daily Briefing' markdown report.
4. Save it using 'save_to_obsidian' with today's date.`,
      messages: [],
    },
  };

  return new Agent(agentConfig);
}

export async function runDailyBriefing(): Promise<void> {
  console.log('🚀 Starting runDailyBriefing...');
  const agent = await createAgent();

  // Subscribe to agent events for debugging
  agent.subscribe((event) => {
    console.log(`📡 Agent Event: ${event.type}`);
    if (event.type === 'message_end' && 'message' in event) {
      const msg = event.message as any;
      if (msg.stopReason === 'error') {
        console.error('❌ API Error:', msg.errorMessage || 'No error message provided');
      }
      console.log('   Message details:', JSON.stringify(msg, null, 2));
    }
  });

  const today = new Date().toISOString().slice(0, 10);
  console.log(`📝 Prompting agent with date: ${today}`);

  try {
    // Send the prompt and wait for completion
    await agent.prompt(`Generate my daily briefing now. Use filename Daily-Briefing-${today}.md`);

    // Wait for the agent to finish processing
    console.log('⏳ Waiting for agent to finish...');
    await agent.waitForIdle();

    console.log('✅ Agent completed successfully');
    console.log('📊 Final messages count:', agent.state.messages.length);
  } catch (err) {
    console.error('❌ Agent prompt failed:', err);
    throw err;
  }
}

