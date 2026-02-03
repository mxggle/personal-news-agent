import * as fs from 'fs/promises';
import * as path from 'path';
import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import { runDailyBriefing } from './agent.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 8787);
import { readSources, writeSources, readSettings } from './storage.js';

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NewsAgent Console</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;600&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    :root {
      --bg: #0a0a0c;
      --fg: #d1d1d1;
      --accent: #00ff41;
      --dim: #4a4a4a;
      --error: #ff3333;
      --warn: #ffcc00;
      --font: 'IBM Plex Mono', monospace;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font-family: var(--font);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    #terminal {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--dim) transparent;
      line-height: 1.5;
    }

    #terminal::-webkit-scrollbar { width: 6px; }
    #terminal::-webkit-scrollbar-thumb { background: var(--dim); border-radius: 3px; }

    .line { margin-bottom: 4px; white-space: pre-wrap; }
    .prompt { color: var(--accent); font-weight: 600; }
    .command { color: #fff; }
    .output { margin-top: 4px; color: var(--fg); }
    .system { color: var(--dim); font-style: italic; }
    .success { color: var(--accent); }
    .error { color: var(--error); }
    .warn { color: var(--warn); }

    #input-area {
      background: #111;
      border-top: 1px solid #222;
      padding: 12px 20px;
      display: flex;
      align-items: center;
    }

    #command-input {
      background: transparent;
      border: none;
      color: var(--accent);
      font-family: var(--font);
      font-size: 16px;
      flex: 1;
      outline: none;
      margin-left: 10px;
    }

    .cursor {
      display: inline-block;
      width: 8px;
      height: 18px;
      background: var(--accent);
      animation: blink 1s infinite;
      vertical-align: middle;
    }

    @keyframes blink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0; }
    }

    /* Briefing Content Styles */
    .briefing-content {
      background: #0f1215;
      padding: 20px;
      border: 1px solid #222;
      border-radius: 4px;
      margin: 10px 0;
    }
    .briefing-content h1, .briefing-content h2, .briefing-content h3 { color: var(--accent); }
    .briefing-content a { color: #38bdf8; text-decoration: none; }
    .briefing-content a:hover { text-decoration: underline; }
    .briefing-content code { background: #1a1a1e; padding: 2px 4px; border-radius: 2px; }

    /* Vim Window Styles */
    #vim-overlay {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: var(--bg);
      z-index: 100;
      display: none;
      flex-direction: column;
    }
    #vim-header {
      padding: 4px 20px;
      background: #1a1a1e;
      color: var(--dim);
      font-size: 12px;
      border-bottom: 1px solid #222;
    }
    #vim-content {
      flex: 1;
      padding: 40px 10%;
      overflow-y: auto;
      line-height: 1.6;
    }
    #vim-status-line {
       background: #00ff41;
       color: #000;
       padding: 2px 20px;
       font-weight: 600;
       font-size: 13px;
       display: flex;
       justify-content: space-between;
    }
    #vim-command-bar {
      background: var(--bg);
      padding: 4px 20px;
      height: 30px;
      display: flex;
      align-items: center;
    }
    #vim-command-input {
      background: transparent;
      border: none;
      color: var(--fg);
      font-family: var(--font);
      outline: none;
      width: 100%;
    }

    /* Override for markdown in vim */
    #vim-content h1, #vim-content h2, #vim-content h3 { color: var(--accent); margin-top: 1.5em; }
    #vim-content hr { border: 0; border-top: 1px solid var(--dim); margin: 2em 0; }
    #vim-content blockquote { border-left: 4px solid var(--accent); padding-left: 20px; color: #aaa; font-style: italic; }

    #scanline {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
      background-size: 100% 4px, 3px 100%;
      pointer-events: none;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <div id="scanline"></div>
  
  <div id="vim-overlay">
    <div id="vim-header">[VIM] - READ ONLY MODE</div>
    <div id="vim-content"></div>
    <div id="vim-status-line">
      <span id="vim-filename">briefing.md</span>
      <span id="vim-pos">0%</span>
    </div>
    <div id="vim-command-bar">
      <input type="text" id="vim-command-input" spellcheck="false" autocomplete="off" />
    </div>
  </div>


  <div id="terminal">
    <div class="line system">Initializing NewsAgent OS v1.0.4...</div>
    <div class="line system">Type 'help' for available commands.</div>
  </div>
  <div id="input-area">
    <span id="prompt-label" class="prompt">guest@newsagent:/$</span>
    <input type="text" id="command-input" autofocus spellcheck="false" autocomplete="off" />
  </div>

<script>
  const terminal = document.getElementById('terminal');
  const input = document.getElementById('command-input');
  const vimOverlay = document.getElementById('vim-overlay');
  const vimContent = document.getElementById('vim-content');
  const vimCommandInput = document.getElementById('vim-command-input');
  const vimFilename = document.getElementById('vim-filename');
  const vimPos = document.getElementById('vim-pos');

  let currentView = 'console';
  let isVimMode = false;
  let isVimCommandMode = false;
  let currentPath = '/';

  function updatePrompt() {
    const label = document.getElementById('prompt-label');
    label.textContent = 'guest@newsagent:' + (currentPath === '/' ? '/' : currentPath.toLowerCase()) + '$';
  }

  function print(text, type = 'output', scroll = true) {
    const line = document.createElement('div');
    line.className = 'line ' + type;
    line.innerHTML = text;
    terminal.appendChild(line);
    if (scroll) terminal.scrollTop = terminal.scrollHeight;
  }

  function clearTerminal() {
    terminal.innerHTML = '';
  }

  function showView(view) {
    currentView = view;
    if (view === 'console') currentPath = '/';
    else if (view === 'sources') currentPath = '/SOURCES';
    else if (view === 'briefings') currentPath = '/BRIEFINGS';
    
    updatePrompt();

    if (view === 'console') {
      clearTerminal();
      print('Back to console.', 'system');
    }
  }

  async function loadSources() {
    showView('sources');
    clearTerminal();
    print('Fetching sources...', 'system');
    try {
      const res = await fetch('/api/sources');
      const data = await res.json();
      print('--- ACTIVE SOURCES ---', 'success');
      data.sources.forEach((s, i) => {
        print(\`[\${i}] [\${s.active ? 'ACTIVE' : 'PAUSED'}] \${s.name} - \${s.url}\`);
      });
      print('----------------------', 'success');
      print('Commands: add &lt;name&gt; &lt;url&gt;, toggle &lt;index&gt;, remove &lt;index&gt;', 'system');
    } catch (e) {
      print('Error: ' + e.message, 'error');
    }
  }

  async function loadBriefings() {
    showView('briefings');
    clearTerminal();
    print('Listing saved briefings...', 'system');
    try {
      const res = await fetch('/api/briefings');
      const data = await res.json();
      if (data.briefings.length === 0) {
        print('No briefings found.', 'warn');
        return;
      }
      print('--- SAVED BRIEFINGS ---', 'success');
      data.briefings.forEach((b, i) => {
        const date = b.replace('Daily-Briefing-', '').replace('.md', '');
        print(\`[\${i}] \${date} (\${b})\`);
      });
      print('-----------------------', 'success');
      print('Type "read &lt;index&gt;" to view content.', 'system');
    } catch (e) {
      print('Error: ' + e.message, 'error');
    }
  }

  async function readBriefing(index) {
    const res = await fetch('/api/briefings');
    const data = await res.json();
    const filename = data.briefings[index];
    if (!filename) {
      print('Invalid index.', 'error');
      return;
    }

    print(\`Entering Vim mode for: \${filename}...\`, 'system');
    try {
      const res2 = await fetch('/api/briefings/' + filename);
      const data2 = await res2.json();
      
      vimContent.innerHTML = marked.parse(data2.content);
      vimFilename.textContent = filename;
      vimOverlay.style.display = 'flex';
      isVimMode = true;
      vimContent.scrollTop = 0;
      updateVimPos();
      input.blur();
    } catch (e) {
      print('Error: ' + e.message, 'error');
    }
  }

  function updateVimPos() {
    const scroll = vimContent.scrollTop;
    const height = vimContent.scrollHeight - vimContent.clientHeight;
    const percent = height > 0 ? Math.round((scroll / height) * 100) : 100;
    vimPos.textContent = percent + '%';
  }

  vimContent.addEventListener('scroll', updateVimPos);

  function exitVimMode() {
    vimOverlay.style.display = 'none';
    isVimMode = false;
    isVimCommandMode = false;
    vimCommandInput.value = '';
    input.focus();
    print('Exited Vim mode.', 'system');
  }

  async function runBriefing() {
    print('Triggering daily briefing...', 'system');
    try {
      const res = await fetch('/api/run', { method: 'POST' });
      if (res.ok) {
        print('Briefing completed successfully.', 'success');
        loadBriefings();
      } else {
        print('Briefing failed.', 'error');
      }
    } catch (e) {
      print('Error: ' + e.message, 'error');
    }
  }

  async function toggleSource(index) {
    const res = await fetch('/api/sources');
    const data = await res.json();
    const s = data.sources[index];
    if (!s) {
      print('Invalid index.', 'error');
      return;
    }
    await fetch('/api/sources/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: s.url })
    });
    loadSources();
  }

  async function removeSource(index) {
    const res = await fetch('/api/sources');
    const data = await res.json();
    const s = data.sources[index];
    if (!s) {
      print('Invalid index.', 'error');
      return;
    }
    await fetch('/api/sources', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: s.url })
    });
    loadSources();
  }

  async function handleCommand(cmd) {
    const parts = cmd.trim().split(' ');
    const action = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    print('<span class="prompt">guest@newsagent:' + (currentPath === '/' ? '/' : currentPath.toLowerCase()) + '$</span> ' + cmd, 'line');

    switch (action) {
      case 'help':
        print('Available commands:');
        print(' - cd &lt;dir&gt;: Change directory (/, /SOURCES, /BRIEFINGS)');
        print(' - ls: List contents of current directory');
        print(' - ./run_briefing: Execute daily briefing script');
        print(' - sources: List all news sources');
        print(' - briefings: List all saved briefings');
        print(' - read &lt;index&gt;: Read a briefing by index');
        print(' - run: Trigger a new briefing');
        print(' - add &lt;name&gt; &lt;url&gt;: Add a new source');
        print(' - toggle &lt;index&gt;: Toggle source active/paused');
        print(' - remove &lt;index&gt;: Remove source');
        print(' - clear: Clear the terminal');
        print(' ');
        print('Navigation (Vim keys):');
        print(' - j/k: Scroll down/up');
        print(' - ctrl-d/u: Half page down/up');
        print(' - gg/G: Top/Bottom');
        break;
      case 'cd':
        const target = (args[0] || '/').toLowerCase();
        if (target === '/' || target === '~' || target === '..') {
          showView('console');
        } else if (target === 'sources' || target === '/sources') {
          loadSources();
        } else if (target === 'briefings' || target === '/briefings') {
          loadBriefings();
        } else {
          print('cd: ' + target + ': No such directory', 'error');
        }
        break;
      case 'ls':
        if (currentPath === '/') {
          print('SOURCES/  BRIEFINGS/  <span class="success">RUN_BRIEFING*</span>');
        } else if (currentPath === '/SOURCES') {
          loadSources();
        } else if (currentPath === '/BRIEFINGS') {
          loadBriefings();
        }
        break;
      case './run_briefing':
      case 'run_briefing':
        runBriefing();
        break;
      case 'sources':
        loadSources();
        break;
      case 'briefings':
        loadBriefings();
        break;
      case 'read':
        if (args[0]) readBriefing(args[0]);
        else print('Usage: read &lt;index&gt;', 'warn');
        break;
      case 'run':
        runBriefing();
        break;
      case 'clear':
        clearTerminal();
        break;
      case 'toggle':
        if (args[0]) toggleSource(args[0]);
        else print('Usage: toggle &lt;index&gt;', 'warn');
        break;
      case 'remove':
        if (args[0]) removeSource(args[0]);
        else print('Usage: remove &lt;index&gt;', 'warn');
        break;
      case 'add':
        if (args.length >= 2) {
          const url = args.pop();
          const name = args.join(' ');
          await fetch('/api/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, url })
          });
          print('Added source: ' + name, 'success');
          loadSources();
        } else {
          print('Usage: add &lt;name&gt; &lt;url&gt;', 'warn');
        }
        break;
      default:
        print('Unknown command: ' + action + '. Type "help" for a list of commands.', 'error');
    }
  }

input.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const val = input.value;
    const commands = ['help', 'sources', 'briefings', 'read', 'run', 'add', 'toggle', 'remove', 'clear', 'cd', 'ls', './run_briefing'];
    const dirs = ['SOURCES', 'BRIEFINGS'];

    if (val.startsWith('cd ')) {
      const arg = val.slice(3) || '';
      const match = dirs.find(d => d.toLowerCase().startsWith(arg.toLowerCase()));
      if (match) input.value = 'cd ' + match;
    } else {
      const match = commands.find(c => c.toLowerCase().startsWith(val.toLowerCase()));
      if (match) input.value = match;
    }
  }

  if (e.key === 'Enter') {
    const cmd = input.value;
    if (cmd) handleCommand(cmd);
    input.value = '';
  }
});

vimCommandInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const cmd = vimCommandInput.value.trim();
    if (cmd === ':q' || cmd === ':exit') {
      exitVimMode();
    } else {
      vimCommandInput.value = '';
      isVimCommandMode = false;
      vimCommandInput.blur();
    }
  } else if (e.key === 'Escape') {
    vimCommandInput.value = '';
    isVimCommandMode = false;
    vimCommandInput.blur();
  }
});

// NAVIGATION SUPPORT
let lastKey = '';
document.addEventListener('keydown', (e) => {
  if (isVimCommandMode) return;

  if (isVimMode) {
    const scrollAmount = 80;
    const key = e.key;
    const target = vimContent;

    if (key === 'j') {
      target.scrollBy({ top: scrollAmount });
    } else if (key === 'k') {
      target.scrollBy({ top: -scrollAmount });
    } else if (key === 'd' && e.ctrlKey) {
      e.preventDefault();
      target.scrollBy({ top: target.clientHeight / 2 });
    } else if (key === 'u' && e.ctrlKey) {
      e.preventDefault();
      target.scrollBy({ top: -target.clientHeight / 2 });
    } else if (key === 'G') {
      target.scrollTo({ top: target.scrollHeight });
    } else if (key === 'g') {
      if (lastKey === 'g') {
        target.scrollTo({ top: 0 });
        lastKey = '';
      } else {
        lastKey = 'g';
        setTimeout(() => { if (lastKey === 'g') lastKey = ''; }, 500);
      }
    } else if (key === ':') {
      e.preventDefault();
      isVimCommandMode = true;
      vimCommandInput.value = ':';
      vimCommandInput.focus();
    }
    return;
  }

  if (input.value !== '') return;

  const scrollAmount = 60;
  const key = e.key;

  if (key === 'j') {
    terminal.scrollBy({ top: scrollAmount, behavior: 'smooth' });
  } else if (key === 'k') {
    terminal.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
  } else if (key === 'G') {
    terminal.scrollTo({ top: terminal.scrollHeight, behavior: 'smooth' });
  }
});

document.addEventListener('click', () => {
  if (!isVimMode) input.focus();
  else if (isVimCommandMode) vimCommandInput.focus();
});
  handleCommand('ls');
</script>
  </body>
  </html>`);
});

app.get('/api/sources', async (_req: Request, res: Response) => {
  try {
    const data = await readSources();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/sources', async (req: Request, res: Response) => {
  const { name, url } = req.body as { name?: string; url?: string };
  if (!name || !url) {
    res.status(400).json({ error: 'name and url are required' });
    return;
  }

  const data = await readSources();
  if (data.sources.some((s: any) => s.url === url)) {
    res.status(409).json({ error: 'source already exists' });
    return;
  }

  data.sources.push({ name, url, active: true });
  await writeSources(data);
  res.json({ ok: true });
});

app.post('/api/sources/toggle', async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }
  const data = await readSources();
  const src = data.sources.find((s: any) => s.url === url);
  if (!src) {
    res.status(404).json({ error: 'source not found' });
    return;
  }
  src.active = !src.active;
  await writeSources(data);
  res.json({ ok: true, active: src.active });
});

app.delete('/api/sources', async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }
  const data = await readSources();
  const next = data.sources.filter((s: any) => s.url !== url);
  if (next.length === data.sources.length) {
    res.status(404).json({ error: 'source not found' });
    return;
  }
  await writeSources({ sources: next });
  res.json({ ok: true });
});

app.post('/api/run', async (_req: Request, res: Response) => {
  try {
    await runDailyBriefing();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/briefings', async (_req: Request, res: Response) => {
  try {
    const settings = await readSettings();
    const vaultPath = settings.obsidianPath || './obsidian_vault';
    const files = await fs.readdir(vaultPath);
    const briefings = files.filter(f => f.endsWith('.md')).sort().reverse();
    res.json({ briefings });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/briefings/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const settings = await readSettings();
    const vaultPath = settings.obsidianPath || './obsidian_vault';
    const content = await fs.readFile(path.join(vaultPath, filename), 'utf-8');
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Control panel running at http://localhost:${PORT}`);
});
