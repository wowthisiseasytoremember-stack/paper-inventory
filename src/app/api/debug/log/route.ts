import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getPrompt, EXPERT_BASE_PROMPT_FILE } from '@/lib/ai/prompts';

export async function GET(req: NextRequest) {
  // TODO: Model list should be dynamic based on config
  const availableModels = {
    baseline: ['gemini-2.0-flash', 'gpt-4o-mini', 'gpt-4o'],
    deepDive: ['gemini-2.5-flash', 'claude-sonnet', 'groq'],
    grounding: []
  };

  return NextResponse.json({
    prompt: getPrompt(EXPERT_BASE_PROMPT_FILE),
    models: availableModels,
    defaults: {
      baselineModel: 'gemini-2.0-flash',
      deepDiveModel: 'gemini-2.5-flash',
      enableGrounding: true,
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const { message, type = 'INFO', timestamp = new Date().toISOString() } = await req.json();
    const logFile = path.join(process.cwd(), 'ai-prompt-debug.txt');
    fs.appendFileSync(logFile, `[${timestamp}] [${type}] ${message}\n---\n`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
