import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DEEP_DIVE_SYSTEM_PROMPT } from '@/lib/ai/prompts';

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ prompt: DEEP_DIVE_SYSTEM_PROMPT });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message, type = 'INFO', timestamp = new Date().toISOString() } = await req.json();
    
    const logFile = path.join(process.cwd(), 'ai-prompt-debug.txt');
    const logEntry = `[${timestamp}] [${type}] ${message}\n---\n`;
    
    fs.appendFileSync(logFile, logEntry);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
