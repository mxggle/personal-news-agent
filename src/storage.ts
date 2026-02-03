
import * as fs from 'fs/promises';
import * as path from 'path';

export const SOURCES_PATH = path.join(process.cwd(), 'sources.json');
export const SETTINGS_PATH = path.join(process.cwd(), 'settings.json');
export const OBSIDIAN_VAULT_PATH = process.env.OBSIDIAN_PATH || './obsidian_vault';

export type Source = { name: string; url: string; active: boolean };
export type SourcesFile = { sources: Source[] };

export type SiteSettings = {
    modelProvider: 'openai' | 'anthropic' | 'google';
    openaiModel?: string;
    anthropicModel?: string;
    googleModel?: string;
    obsidianPath?: string;
};

const DEFAULT_SETTINGS: SiteSettings = {
    modelProvider: 'openai',
    openaiModel: 'gpt-4o',
    anthropicModel: 'claude-3-5-sonnet-20241022',
    googleModel: 'gemini-2.0-flash-exp',
    obsidianPath: './obsidian_vault'
};

export async function readSources(): Promise<SourcesFile> {
    try {
        const raw = await fs.readFile(SOURCES_PATH, 'utf-8');
        return JSON.parse(raw) as SourcesFile;
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            return { sources: [] };
        }
        throw error;
    }
}

export async function writeSources(data: SourcesFile): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(SOURCES_PATH, json, 'utf-8');
}

export async function readSettings(): Promise<SiteSettings> {
    try {
        const raw = await fs.readFile(SETTINGS_PATH, 'utf-8');
        const fileSettings = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...fileSettings };
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            // If no settings file, try to construct from env or defaults
            const envSettings: Partial<SiteSettings> = {};
            if (process.env.MODEL_PROVIDER) envSettings.modelProvider = process.env.MODEL_PROVIDER as any;
            if (process.env.OPENAI_MODEL) envSettings.openaiModel = process.env.OPENAI_MODEL;
            if (process.env.ANTHROPIC_MODEL) envSettings.anthropicModel = process.env.ANTHROPIC_MODEL;
            if (process.env.GOOGLE_MODEL) envSettings.googleModel = process.env.GOOGLE_MODEL;
            if (process.env.OBSIDIAN_PATH) envSettings.obsidianPath = process.env.OBSIDIAN_PATH;

            return { ...DEFAULT_SETTINGS, ...envSettings };
        }
        throw error;
    }
}

export async function writeSettings(data: SiteSettings): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(SETTINGS_PATH, json, 'utf-8');
}
