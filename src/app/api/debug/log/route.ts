import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DEEP_DIVE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { AVAILABLE_MODELS } from '@/lib/ai';

export async function GET(req: NextRequest) {
  return NextResponse.json({
    prompt: DEEP_DIVE_SYSTEM_PROMPT,
    models: AVAILABLE_MODELS,
    defaults: {
      baselineModel: 'gemini-2.0-flash',
      deepDiveModel: 'gpt-4o',
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
