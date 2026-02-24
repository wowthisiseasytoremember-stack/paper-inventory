/**
 * PROMPT LOADER
 * 
 * Utility to load Markdown prompts from the docs/prompts directory.
 */

import fs from 'fs';
import path from 'path';

const PROMPTS_DIR = path.join(process.cwd(), 'docs', 'prompts');

export function getPrompt(filename: string): string {
  try {
    const fullPath = path.join(PROMPTS_DIR, filename);
    if (!fs.existsSync(fullPath)) {
      // Check in experts subdirectory if not found in root
      const expertPath = path.join(PROMPTS_DIR, 'experts', filename);
      if (fs.existsSync(expertPath)) {
        return fs.readFileSync(expertPath, 'utf-8');
      }
      throw new Error(`Prompt file not found: ${filename}`);
    }
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (err) {
    console.error(`Error loading prompt ${filename}:`, err);
    return '';
  }
}

// Map categories to prompt filenames
export const EXPERT_PROMPT_MAP: Record<string, string> = {
  'comic_books': 'COMIC_BOOK_EXPERT.md',
  'railroadiana': 'RAILROAD_EXPERT.md',
  'aerospace_technical': 'AEROSPACE_EXPERT.md',
  'serial_publications': 'SERIAL_PUB_EXPERT.md',
  'analog_media_electronics': 'ANALOG_MEDIA_EXPERT.md',
  'stamps_postal': 'STAMPS_EXPERT.md',
  'geographic_media': 'GEOGRAPHIC_EXPERT.md',
  'general_vintage_ephemera': 'EPHEMERA_EXPERT.md'
};

export const CONDUCTOR_PROMPT_FILE = 'CONDUCTOR_PROMPT.md';
export const EXPERT_BASE_PROMPT_FILE = 'EXPERT_BASE_PROMPT.md';
export const EXPERT_SCHEMA_FILE = 'EXPERT_BASE_SCHEMA.json';
