import * as fs from 'fs/promises';
import * as path from 'path';
import express from 'express';
import * as dotenv from 'dotenv';
import { runDailyBriefing } from './agent.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 8787);
import { readSources, writeSources } from './storage.js';

app.use(express.json());

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Personal News Agent</title>
  <style>
    :root {
      --bg: #0f172a;
      --panel: #111827;
      --ink: #e5e7eb;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --danger: #f87171;
    }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      background: radial-gradient(circle at 20% 20%, #1f2937 0%, #0f172a 40%, #020617 100%);
      color: var(--ink);
    }
    .wrap {
      max-width: 960px;
      margin: 0 auto;
      padding: 32px 20px 64px;
    }
    h1 {
      font-size: 28px;
      margin: 0 0 8px;
    }
    p { color: var(--muted); }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }
    .card {
      background: rgba(17, 24, 39, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
    }
    .row {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.15);
    }
    .row:last-child { border-bottom: 0; }
    .pill {
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(56, 189, 248, 0.2);
      color: var(--accent);
    }
    button {
      background: var(--accent);
      color: #04101b;
      border: 0;
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }
    button.secondary {
      background: transparent;
      border: 1px solid rgba(148, 163, 184, 0.4);
      color: var(--ink);
    }
    button.danger {
      background: var(--danger);
      color: #1f2937;
    }
    input {
      width: 100%;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid rgba(148, 163, 184, 0.4);
      background: rgba(15, 23, 42, 0.6);
      color: var(--ink);
    }
    .form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .form .full { grid-column: 1 / -1; }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
    }
    @media (max-width: 640px) {
      .form { grid-template-columns: 1fr; }
      .footer { flex-direction: column; gap: 8px; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Personal News Briefing</h1>
    <p>Manage your sources and trigger the daily briefing.</p>

    <div class="grid">
      <div class="card">
        <h2>Sources</h2>
        <div id="sources"></div>
      </div>

      <div class="card">
        <h2>Add Source</h2>
        <div class="form">
          <input id="name" placeholder="Name (e.g., The Verge)" />
          <input id="url" placeholder="URL (https://...)" />
          <div class="full footer">
            <button id="add">Add Source</button>
            <span id="status" class="pill">Idle</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Run Briefing</h2>
        <p>Generate a markdown report and save it to your Obsidian vault.</p>
        <button id="run">Run Briefing Now</button>
      </div>
    </div>
  </div>

<script>
  const sourcesEl = document.getElementById('sources');
  const statusEl = document.getElementById('status');
  const nameEl = document.getElementById('name');
  const urlEl = document.getElementById('url');

  function setStatus(text) {
    statusEl.textContent = text;
  }

  async function loadSources() {
    const res = await fetch('/api/sources');
    const data = await res.json();
    sourcesEl.innerHTML = '';

    data.sources.forEach((s) => {
      const row = document.createElement('div');
      row.className = 'row';

      const left = document.createElement('div');
      left.innerHTML = '<div><strong>' + s.name + '</strong></div><div style="color: var(--muted); font-size: 12px;">' + s.url + '</div>';

      const right = document.createElement('div');
      const badge = document.createElement('span');
      badge.className = 'pill';
      badge.textContent = s.active ? 'Active' : 'Paused';

      const toggle = document.createElement('button');
      toggle.className = 'secondary';
      toggle.textContent = s.active ? 'Pause' : 'Activate';
      toggle.onclick = async () => {
        await fetch('/api/sources/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: s.url })
        });
        await loadSources();
      };

      const remove = document.createElement('button');
      remove.className = 'danger';
      remove.textContent = 'Remove';
      remove.onclick = async () => {
        await fetch('/api/sources', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: s.url })
        });
        await loadSources();
      };

      right.appendChild(badge);
      right.appendChild(toggle);
      right.appendChild(remove);
      right.style.display = 'flex';
      right.style.gap = '8px';
      row.appendChild(left);
      row.appendChild(right);
      sourcesEl.appendChild(row);
    });
  }

  document.getElementById('add').onclick = async () => {
    const name = nameEl.value.trim();
    const url = urlEl.value.trim();
    if (!name || !url) return;
    setStatus('Adding...');
    await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url })
    });
    nameEl.value = '';
    urlEl.value = '';
    setStatus('Added');
    await loadSources();
  };

  document.getElementById('run').onclick = async () => {
    setStatus('Running...');
    await fetch('/api/run', { method: 'POST' });
    setStatus('Complete');
  };

  loadSources();
</script>
</body>
</html>`);
});

app.get('/api/sources', async (_req, res) => {
  try {
    const data = await readSources();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/sources', async (req, res) => {
  const { name, url } = req.body as { name?: string; url?: string };
  if (!name || !url) {
    res.status(400).json({ error: 'name and url are required' });
    return;
  }

  const data = await readSources();
  if (data.sources.some((s) => s.url === url)) {
    res.status(409).json({ error: 'source already exists' });
    return;
  }

  data.sources.push({ name, url, active: true });
  await writeSources(data);
  res.json({ ok: true });
});

app.post('/api/sources/toggle', async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }
  const data = await readSources();
  const src = data.sources.find((s) => s.url === url);
  if (!src) {
    res.status(404).json({ error: 'source not found' });
    return;
  }
  src.active = !src.active;
  await writeSources(data);
  res.json({ ok: true, active: src.active });
});

app.delete('/api/sources', async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }
  const data = await readSources();
  const next = data.sources.filter((s) => s.url !== url);
  if (next.length === data.sources.length) {
    res.status(404).json({ error: 'source not found' });
    return;
  }
  await writeSources({ sources: next });
  res.json({ ok: true });
});

app.post('/api/run', async (_req, res) => {
  try {
    await runDailyBriefing();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Control panel running at http://localhost:${PORT}`);
});
