# My News Agent

An autonomous Personal News Briefing Agent built with pi-mono AI toolkit. This agent automatically fetches content from your configured news sources, summarizes it using an LLM, and saves daily briefings to your Obsidian vault.

## Features

- 📰 Automated news aggregation from multiple sources
- 🤖 AI-powered summarization using multiple LLM providers
- 📝 Markdown output saved directly to Obsidian
- 🔧 Simple web control panel for managing sources
- 🎯 Support for OpenAI, Anthropic, Google AI, and **Gemini CLI**

## Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd my-news-agent
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
MODEL_PROVIDER=openai  # Options: openai, anthropic, google, gemini-cli

# OpenAI Configuration (if using openai)
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=gpt-4o

# Anthropic Configuration (if using anthropic)
ANTHROPIC_API_KEY=your-api-key-here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Google AI Configuration (if using google)
GOOGLE_API_KEY=your-api-key-here
GOOGLE_MODEL=gemini-2.0-flash-exp

# Gemini CLI Configuration (if using gemini-cli)
GEMINI_MODEL=gemini-2.5-flash
GEMINI_INCLUDE_DIRS=../lib,../docs  # Optional: additional directories for context

# Obsidian Configuration
OBSIDIAN_PATH=./obsidian_vault  # Path to your Obsidian vault
```

## Using Gemini CLI

The Gemini CLI integration is a unique feature that allows you to use Google's Gemini models through a command-line interface instead of API calls.

### Prerequisites

1. Install the Gemini CLI globally:
   ```bash
   npm install -g @google/gemini-cli
   ```

2. Authenticate with your Google account:
   ```bash
   gemini
   ```
   Follow the prompts to log in.

### Benefits

- ✅ **Free tier**: Generous free usage with Google account (60 RPM, 1000 RPD)
- ✅ **Code-aware**: Understands your entire codebase
- ✅ **Local context**: Access to file system and shell commands
- ✅ **Latest models**: Access to Gemini 2.5 Flash and other cutting-edge models
- ✅ **No API key management**: Uses OAuth login

### Configuration

Set `MODEL_PROVIDER=gemini-cli` in your `.env` file:

```bash
MODEL_PROVIDER=gemini-cli
GEMINI_MODEL=gemini-2.5-flash
```

For more details, see [GEMINI_CLI.md](./GEMINI_CLI.md).

## Usage

### Run the Daily Briefing

```bash
npm run dev
```

This will:
1. Read your configured news sources from `sources.json`
2. Fetch content from each active source
3. Generate an AI-powered summary
4. Save the briefing to your Obsidian vault

### Start the Web Control Panel

```bash
npm run server
```

Then open `http://localhost:3000` in your browser to manage your news sources.

## News Sources

Edit `sources.json` to configure your news sources:

```json
{
  "sources": [
    {
      "name": "Hacker News",
      "url": "https://news.ycombinator.com/",
      "active": true
    },
    {
      "name": "The Verge",
      "url": "https://www.theverge.com/",
      "active": true
    }
  ]
}
```

## Project Structure

```
my-news-agent/
├── src/
│   ├── agent.ts              # Main agent logic
│   ├── tools.ts              # Tool definitions (fetch, save, manage sources)
│   ├── index.ts              # CLI entry point
│   ├── server.ts             # Web control panel
│   └── gemini-cli-provider.ts # Gemini CLI integration
├── sources.json              # News source configuration
├── obsidian_vault/           # Output directory for briefings
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

## Troubleshooting

### Gemini CLI Issues

If you get "command not found" errors:
```bash
which gemini  # Check if installed
npm install -g @google/gemini-cli  # Install if needed
```

If authentication fails:
```bash
gemini --logout
gemini  # Re-authenticate
```

### API Rate Limits

If you hit rate limits:
- Switch to a different provider
- Use Gemini CLI for free tier access
- Reduce the number of active sources

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
# personal-news-agent
