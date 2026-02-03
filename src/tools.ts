import { Type } from '@sinclair/typebox';
import type { AgentTool } from '@mariozechner/pi-agent-core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { JSDOM } from 'jsdom';

import { readSources, writeSources, OBSIDIAN_VAULT_PATH } from './storage.js';
import type { Source, SourcesFile } from './storage.js';

export const fetchUrlTool: AgentTool = {
  name: 'fetch_url',
  label: 'Fetch URL',
  description: 'Fetches text content from a URL.',
  parameters: Type.Object({
    url: Type.String({ format: 'uri', description: 'The URL to fetch' }),
  }),
  execute: async (toolCallId, params) => {
    const { url } = params as { url: string };
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const errorText = `Error: HTTP ${res.status} for ${url}`;
        return {
          content: [{ type: 'text', text: errorText }],
          details: { error: errorText },
        };
      }
      const text = await res.text();
      const dom = new JSDOM(text);
      const content = dom.window.document.body.textContent || '';
      const cleanContent = content.replace(/\s+/g, ' ').trim().slice(0, 3000) || 'No content';

      return {
        content: [{ type: 'text', text: cleanContent }],
        details: { url, contentLength: cleanContent.length },
      };
    } catch (e) {
      const errorText = `Error: ${e instanceof Error ? e.message : String(e)}`;
      return {
        content: [{ type: 'text', text: errorText }],
        details: { error: errorText },
      };
    }
  },
};

export const saveToObsidianTool: AgentTool = {
  name: 'save_to_obsidian',
  label: 'Save to Obsidian',
  description: 'Saves markdown content to a file in Obsidian.',
  parameters: Type.Object({
    filename: Type.String({ description: 'The filename to save (with or without .md extension)' }),
    content: Type.String({ description: 'The markdown content to save' }),
  }),
  execute: async (toolCallId, params) => {
    const { filename, content } = params as { filename: string; content: string };
    const safeName = filename.endsWith('.md') ? filename : `${filename}.md`;
    const fullPath = path.join(OBSIDIAN_VAULT_PATH, safeName);
    await fs.mkdir(OBSIDIAN_VAULT_PATH, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');

    const resultText = `Saved to ${fullPath}`;
    return {
      content: [{ type: 'text', text: resultText }],
      details: { path: fullPath, filename: safeName },
    };
  },
};

export const getSourcesTool: AgentTool = {
  name: 'get_sources',
  label: 'Get Sources',
  description: 'Reads the list of news sources to check.',
  parameters: Type.Object({}),
  execute: async (toolCallId) => {
    const data = await readSources();
    const jsonText = JSON.stringify(data, null, 2);

    return {
      content: [{ type: 'text', text: jsonText }],
      details: data,
    };
  },
};

export const manageSourcesTool: AgentTool = {
  name: 'manage_sources',
  label: 'Manage Sources',
  description: 'Adds or removes a news source in sources.json.',
  parameters: Type.Object({
    action: Type.String({
      enum: ['add', 'remove', 'toggle', 'set_active'],
      description: 'The action to perform: add, remove, toggle, or set_active'
    }),
    name: Type.Optional(Type.String({ description: 'The name of the source' })),
    url: Type.Optional(Type.String({ description: 'The URL of the source' })),
    active: Type.Optional(Type.Boolean({ description: 'Whether the source is active' })),
  }),
  execute: async (toolCallId, params) => {
    const { action, name, url, active } = params as { action: 'add' | 'remove' | 'toggle' | 'set_active'; name?: string; url?: string; active?: boolean };
    const data = await readSources();

    if (action === 'add') {
      if (!name || !url) {
        const errorText = 'Error: add requires name and url';
        return {
          content: [{ type: 'text', text: errorText }],
          details: { error: errorText },
        };
      }
      if (data.sources.some((s) => s.url === url)) {
        const errorText = `Source already exists: ${url}`;
        return {
          content: [{ type: 'text', text: errorText }],
          details: { error: errorText },
        };
      }
      data.sources.push({ name, url, active: active ?? true });
      await writeSources(data);
      const resultText = `Added source: ${name}`;
      return {
        content: [{ type: 'text', text: resultText }],
        details: { action: 'add', name, url },
      };
    }

    if (!url && !name) {
      const errorText = 'Error: remove/toggle/set_active requires url or name';
      return {
        content: [{ type: 'text', text: errorText }],
        details: { error: errorText },
      };
    }

    const match = (s: Source) => (url ? s.url === url : s.name === name);
    const idx = data.sources.findIndex(match);
    if (idx === -1) {
      const errorText = 'Source not found';
      return {
        content: [{ type: 'text', text: errorText }],
        details: { error: errorText },
      };
    }

    if (action === 'remove') {
      const removed = data.sources.splice(idx, 1)[0];
      await writeSources(data);
      const resultText = `Removed source: ${removed.name}`;
      return {
        content: [{ type: 'text', text: resultText }],
        details: { action: 'remove', source: removed },
      };
    }

    if (action === 'toggle') {
      data.sources[idx].active = !data.sources[idx].active;
      await writeSources(data);
      const resultText = `Toggled source: ${data.sources[idx].name} -> ${data.sources[idx].active}`;
      return {
        content: [{ type: 'text', text: resultText }],
        details: { action: 'toggle', source: data.sources[idx] },
      };
    }

    if (action === 'set_active') {
      if (typeof active !== 'boolean') {
        const errorText = 'Error: set_active requires active boolean';
        return {
          content: [{ type: 'text', text: errorText }],
          details: { error: errorText },
        };
      }
      data.sources[idx].active = active;
      await writeSources(data);
      const resultText = `Updated source: ${data.sources[idx].name} -> ${data.sources[idx].active}`;
      return {
        content: [{ type: 'text', text: resultText }],
        details: { action: 'set_active', source: data.sources[idx] },
      };
    }

    const errorText = 'No action taken';
    return {
      content: [{ type: 'text', text: errorText }],
      details: { error: errorText },
    };
  },
};

export const runShellCommandTool: AgentTool = {
  name: 'run_shell_command',
  label: 'Run Shell Command',
  description: 'Executes a command in the shell.',
  parameters: Type.Object({
    command: Type.String({ description: 'The command to execute' }),
  }),
  execute: async (toolCallId, params) => {
    const { command } = params as { command: string };
    try {
      // Use child_process to execute the command
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout, stderr } = await execAsync(command);
      const output = stdout || stderr || 'Command completed with no output';

      return {
        content: [{ type: 'text', text: output }],
        details: { command, stdout, stderr },
      };
    } catch (e) {
      const errorText = `Error: ${e instanceof Error ? e.message : String(e)}`;
      return {
        content: [{ type: 'text', text: errorText }],
        details: { error: errorText },
      };
    }
  },
};
