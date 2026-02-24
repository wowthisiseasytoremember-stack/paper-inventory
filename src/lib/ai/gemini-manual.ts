/**
 * GEMINI CLIENT (V1 API Implementation)
 * 
 * Used as a fallback when OpenAI is unavailable or keys are exhausted.
 */

import fs from 'fs';
import { ConductorResponse, ExpertResponse } from './schema';
import { getPrompt, CONDUCTOR_PROMPT_FILE, EXPERT_PROMPT_MAP } from './prompts';

const primaryKey = process.env.GEMINI_API_KEY || "";
const backupKey = process.env.GEMINI_API_KEY_BACKUP || "";

async function callGemini(model: string, prompt: string, imagePath: string, key: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`;
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      topK: 32,
      topP: 1,
      maxOutputTokens: 4096,
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini V1 Error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty content");
  return text;
}

export async function routeItemGemini(imagePath: string, ocrText: string): Promise<ConductorResponse> {
  const prompt = getPrompt(CONDUCTOR_PROMPT_FILE) + `\n\nOCR Hint: ${ocrText.substring(0, 1000)}`;
  const text = await callGemini("gemini-1.5-flash", prompt, imagePath, primaryKey);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Gemini response");
  return JSON.parse(jsonMatch[0]);
}

export async function appraiseItemGemini(category: string, imagePath: string, ocrText: string): Promise<ExpertResponse> {
  const promptFile = EXPERT_PROMPT_MAP[category] || EXPERT_PROMPT_MAP['general_vintage_ephemera'];
  const prompt = getPrompt(promptFile) + `\n\nFull OCR Text:\n${ocrText}`;
  const text = await callGemini("gemini-1.5-pro", prompt, imagePath, primaryKey);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Gemini response");
  return JSON.parse(jsonMatch[0]);
}
