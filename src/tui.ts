
import { TUI, ProcessTerminal, Markdown, Text, Box, Loader, Spacer, Container, Component, matchesKey, Key, truncateToWidth, Input } from '@mariozechner/pi-tui';
import { readSources, writeSources, readSettings, writeSettings, OBSIDIAN_VAULT_PATH } from './storage.js';
import { createAgent } from './agent.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// --- Components ---

class Menu implements Component {
    private selectedIndex = 0;

    constructor(
        private tui: TUI,
        private items: { label: string, action: () => void | Promise<void>, checked?: boolean }[],
        private title?: string
    ) {
    }

    render(width: number): string[] {
        const lines: string[] = [];
        if (this.title) {
            lines.push(`\x1b[1m${this.title}\x1b[0m`);
            lines.push('');
        }

        this.items.forEach((item, i) => {
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? '👉 ' : '   ';
            const check = item.checked !== undefined ? (item.checked ? '[x] ' : '[ ] ') : '';
            const style = isSelected ? '\x1b[36m' : '\x1b[37m'; // Cyan vs White
            const reset = '\x1b[0m';
            lines.push(`${style}${prefix}${check}${item.label}${reset}`);
        });
        return lines.map(l => truncateToWidth(l, width));
    }

    handleInput(data: string): void {
        if (matchesKey(data, Key.up)) {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.tui.requestRender();
        } else if (matchesKey(data, Key.down)) {
            this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
            this.tui.requestRender();
        } else if (matchesKey(data, Key.enter)) {
            this.items[this.selectedIndex].action();
        }
    }

    invalidate(): void { }
}

class TextViewer implements Component {
    private scrollOffset = 0;
    private lines: string[] = [];

    constructor(private tui: TUI, content: string, private onBack: () => void) {
        this.lines = content.split('\n');
    }

    render(width: number): string[] {
        // Simple scrolling viewer
        const visibleLines = this.lines.slice(this.scrollOffset, this.scrollOffset + 20); // rough height guess
        return [
            ...visibleLines,
            '',
            '\x1b[90mPress (q) or (Esc) to back. Up/Down to scroll.\x1b[0m'
        ].map(l => truncateToWidth(l, width));
    }

    handleInput(data: string): void {
        if (matchesKey(data, 'q') || matchesKey(data, Key.esc)) {
            this.onBack();
        } else if (matchesKey(data, Key.up)) {
            this.scrollOffset = Math.max(0, this.scrollOffset - 1);
            this.tui.requestRender();
        } else if (matchesKey(data, Key.down)) {
            this.scrollOffset = Math.min(this.lines.length - 1, this.scrollOffset + 1);
            this.tui.requestRender();
        }
    }

    invalidate(): void { }
}

class PromptView implements Component {
    private input: Input;

    constructor(
        private tui: TUI,
        private title: string,
        initialValue: string,
        private onConfirm: (val: string) => void,
        private onCancel: () => void
    ) {
        this.input = new Input();
        this.input.setValue(initialValue);
        this.input.focused = true; // Ensure it renders cursor

        // We can hook into input callbacks or handle key events manually.
        // Input has onSubmit but let's handle it manually to be sure about control flow
        this.input.onSubmit = (val) => this.onConfirm(val);
        this.input.onEscape = () => this.onCancel();
    }

    render(width: number): string[] {
        return [
            truncateToWidth(`\x1b[1m${this.title}\x1b[0m`, width),
            '',
            ...this.input.render(width),
            '',
            truncateToWidth('\x1b[90mEnter to save, Esc to cancel\x1b[0m', width)
        ];
    }

    handleInput(data: string) {
        // Delegate to input component which handles editing + callbacks
        this.input.handleInput(data);
    }

    invalidate() {
        this.input.invalidate();
    }
}

// --- Main App Logic ---

export async function runTui() {
    const terminal = new ProcessTerminal();
    const tui = new TUI(terminal);

    // Header
    const header = new Box(1, 0, (s) => `\x1b[44m\x1b[37m${s}\x1b[0m`);
    header.addChild(new Text("📰 My News Agent - Terminal Interface"));
    tui.addChild(header);

    // Main Content Area
    const contentArea = new Container();
    tui.addChild(contentArea);

    // Footer
    const footer = new Box(1, 0); // Spacer/Footer
    tui.addChild(footer);

    // --- State & Navigation ---

    const clearContent = () => {
        // remove all children from contentArea is not directly exposed as clear(), need to rebuild or impl remove child
        // pi-tui Container doesn't have clear. We can re-create contentArea logic or just replace the component logic.
        // Actually, TUI.addChild adds to root. contentArea is a Container.
        // We will just replace the child of contentArea. Container.children is public? No.
        // We can just construct a new list of children.
        // Workaround: We will use a wrapper component that delegates to the 'current view'.
    };

    let currentView: Component | null = null;

    // We create a "ViewManager" component to swap views
    class ViewManager implements Component {
        start() { }
        stop() { }
        constructor() { }
        render(width: number): string[] {
            return currentView ? currentView.render(width) : [];
        }
        handleInput(data: string) {
            if (currentView && currentView.handleInput) currentView.handleInput(data);
        }
        invalidate() { }
    }

    const viewManager = new ViewManager();
    contentArea.addChild(viewManager);

    const switchView = (view: Component) => {
        currentView = view;
        tui.setFocus(view);
        tui.requestRender();
    };

    // --- Views ---

    const showMainMenu = () => {
        const menu = new Menu(tui, [
            { label: "🚀 Run Daily Briefing", action: () => runBriefing() },
            { label: "⚙️  Settings", action: () => showSettings() },
            { label: "📡 Manage Sources", action: () => showSources() },
            { label: "📄 Read Briefings", action: () => showBriefingsList() },
            { label: "❌ Exit", action: () => exitApp() }
        ], "Main Menu");
        switchView(menu);
    };

    const showSources = async () => {
        const data = await readSources();
        const items: any[] = data.sources.map(s => ({
            label: `${s.name} (${s.url})`,
            checked: s.active,
            action: async () => {
                s.active = !s.active;
                await writeSources(data);
                showSources(); // refresh
            }
        }));
        items.push({ label: "🔙 Back", action: () => showMainMenu() });

        const menu = new Menu(tui, items as any, "Manage Sources (Enter to Toggle)");
        switchView(menu);
    };

    const showSettings = async () => {
        const settings = await readSettings();
        const providers: ("openai" | "anthropic" | "google")[] = ["openai", "anthropic", "google"];

        const items = [
            {
                label: `Model Provider: ${settings.modelProvider}`,
                action: async () => {
                    const idx = providers.indexOf(settings.modelProvider);
                    const next = providers[(idx + 1) % providers.length];
                    settings.modelProvider = next;
                    await writeSettings(settings);
                    showSettings(); // Refresh
                }
            },
            {
                label: `OpenAI Model: ${settings.openaiModel || 'gpt-4o'}`,
                action: () => {
                    const view = new PromptView(tui, "Edit OpenAI Model Name", settings.openaiModel || 'gpt-4o', async (val) => {
                        settings.openaiModel = val;
                        await writeSettings(settings);
                        showSettings();
                    }, () => showSettings());
                    switchView(view);
                }
            },
            {
                label: `Anthropic Model: ${settings.anthropicModel || 'claude-3-5-sonnet-20241022'}`,
                action: () => {
                    const view = new PromptView(tui, "Edit Anthropic Model Name", settings.anthropicModel || 'claude-3-5-sonnet-20241022', async (val) => {
                        settings.anthropicModel = val;
                        await writeSettings(settings);
                        showSettings();
                    }, () => showSettings());
                    switchView(view);
                }
            },
            {
                label: `Google Model: ${settings.googleModel || 'gemini-2.0-flash-exp'}`,
                action: () => {
                    const view = new PromptView(tui, "Edit Google Model Name", settings.googleModel || 'gemini-2.0-flash-exp', async (val) => {
                        settings.googleModel = val;
                        await writeSettings(settings);
                        showSettings();
                    }, () => showSettings());
                    switchView(view);
                }
            },
            { label: "🔙 Back", action: () => showMainMenu() }
        ];

        const menu = new Menu(tui, items as any, "Settings (Enter to cycle Provider)");
        switchView(menu);
    };

    const showBriefingsList = async () => {
        try {
            const files = await fs.readdir(OBSIDIAN_VAULT_PATH);
            const mdFiles = files.filter(f => f.endsWith('.md')).sort().reverse();

            if (mdFiles.length === 0) {
                const menu = new Menu(tui, [{ label: "🔙 Back", action: () => showMainMenu() }], "No briefings found.");
                switchView(menu);
                return;
            }

            const items: any[] = mdFiles.map(f => ({
                label: f,
                action: async () => {
                    const content = await fs.readFile(path.join(OBSIDIAN_VAULT_PATH, f), 'utf-8');
                    showMarkdownView(content);
                }
            }));
            items.push({ label: "🔙 Back", action: () => showMainMenu() });

            const menu = new Menu(tui, items, "Select a Briefing to Read");
            switchView(menu);
        } catch (e) {
            const menu = new Menu(tui, [{ label: "🔙 Back", action: () => showMainMenu() }], `Error: ${e}`);
            switchView(menu);
        }
    };

    const showMarkdownView = (content: string) => {
        // Use pi-tui Markdown component wrapped in a scrollable view or just a simple view
        // The Markdown component in pi-tui handles rendering but maybe not scrolling?
        // Let's use our TextViewer for now, assuming Markdown component is static.
        // Actually, let's try to use Markdown component if we can wrap it.
        // For now, TextViewer is safer for scrolling long text.

        const viewer = new TextViewer(tui, content, () => showBriefingsList());
        switchView(viewer);
    };

    const runBriefing = async () => {
        // Create a custom view for logs
        const logLines: string[] = [];
        const updateLogs = () => tui.requestRender();

        class LogView implements Component {
            render(width: number): string[] {
                const visible = logLines.slice(-20);
                return [
                    '\x1b[1mRunning Daily Briefing...\x1b[0m',
                    ...visible,
                    '',
                    '\x1b[90mPlease wait...\x1b[0m'
                ].map(l => truncateToWidth(l, width));
            }
            handleInput(data: string) { } // block input
            invalidate() { }
        }

        const logView = new LogView();
        switchView(logView);

        // Intercept logs
        const originalLog = console.log;
        const originalError = console.error;
        console.log = (...args: any[]) => {
            logLines.push(args.map(String).join(' '));
            updateLogs();
        };
        console.error = (...args: any[]) => {
            logLines.push(`❌ ${args.map(String).join(' ')}`);
            updateLogs();
        };

        try {
            const agent = await createAgent();

            agent.subscribe((event: any) => {
                if (event.type === 'tool_start') {
                    console.log(`🛠️  Calling ${event.toolName}...`);
                } else if (event.type === 'tool_end') {
                    console.log(`✅ Tool ${event.toolName} finished.`);
                }
            });

            const today = new Date().toISOString().slice(0, 10);
            await agent.prompt(`Generate my daily briefing now. Use filename Daily-Briefing-${today}.md`);
            await agent.waitForIdle();

            console.log("Completed!");

            // Wait a sec then show result
            currentView = new Menu(tui, [
                {
                    label: "📄 View Briefing", action: async () => {
                        try {
                            const content = await fs.readFile(path.join(OBSIDIAN_VAULT_PATH, `Daily-Briefing-${today}.md`), 'utf-8');
                            showMarkdownView(content);
                        } catch {
                            console.log("Could not find file.");
                        }
                    }
                },
                { label: "🔙 Main Menu", action: () => showMainMenu() }
            ], "Briefing Complete");
            tui.setFocus(currentView);
            tui.requestRender();

        } catch (err: any) {
            console.error(`Error: ${err.message}`);
            // Give option to go back
            currentView = new Menu(tui, [
                { label: "🔙 Back", action: () => showMainMenu() }
            ], "Error Occurred");
            tui.setFocus(currentView);
            tui.requestRender();
        } finally {
            console.log = originalLog;
            console.error = originalError;
        }
    };

    const exitApp = () => {
        tui.stop();
        resolveExit();
    };

    let resolveExit: () => void;
    const exitPromise = new Promise<void>((resolve) => { resolveExit = resolve; });

    tui.start();
    showMainMenu();

    await exitPromise;
}
