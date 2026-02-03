# Personal News Agent

An autonomous Personal News Briefing Agent built with pi-mono AI toolkit. This agent automatically fetches content from your configured news sources, summarizes it using an LLM, and saves daily briefings to your Obsidian vault.

## Features

- 📰 Automated news aggregation from multiple sources
- 🤖 AI-powered summarization using LLM providers
- 📝 Markdown output saved directly to Obsidian
- �️ Interactive Terminal User Interface (TUI) for management
- �🔧 Simple web control panel for managing sources
- 🎯 Support for OpenAI, Anthropic, and Google AI

## Installation

1. Clone the repository:
   ```bash
   git clone git@github.com:mxggle/personal-news-agent.git
   cd personal-news-agent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

## Configuration

Create a `.env` file with the following settings:

```bash
# Choose your AI provider
MODEL_PROVIDER=openai  # Options: openai, anthropic, google

# OpenAI Configuration
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=gpt-4o

# Obsidian Configuration
OBSIDIAN_PATH=./obsidian_vault  # Path to your Obsidian vault
```

## Usage

### Run the Daily Briefing (CLI)

```bash
npm run dev
```

### Run the Interactive TUI

```bash
npm run dev -- --tui
```

### Start the Web Control Panel

```bash
npm run server
```

Then open `http://localhost:3000` in your browser to manage your news sources.

## Project Structure

```
personal-news-agent/
├── src/
│   ├── agent.ts      # Main agent logic
│   ├── tools.ts      # Tool definitions (fetch, save, manage sources)
│   ├── index.ts      # CLI entry point
│   ├── server.ts     # Web control panel
│   ├── tui.ts        # Terminal User Interface
│   └── storage.ts    # Data storage logic
├── sources.json      # News source configuration
├── obsidian_vault/   # Output directory for briefings
└── package.json
```

## Development

Build the project:
```bash
npm run build
```

Run in development mode:
```bash
npm run dev
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
