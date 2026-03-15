/**
 * ANTHROPIC CLIENT (Claude 3.5 Sonnet)
 * 
 * Used as the primary engine for high-accuracy research and appraisal.
 */

import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { ConductorResponse, ExpertResponse } from './schema';
import { getPrompt, CONDUCTOR_PROMPT_FILE, EXPERT_PROMPT_MAP } from './prompts';

const apiKey = process.env.ANTHROPIC_API_KEY || "";
const anthropic = new Anthropic({ apiKey });

// Model names
const PRIMARY_MODEL = "claude-sonnet-4-6";          // Full appraisal — use Sonnet for quality
const ROUTER_MODEL = "claude-haiku-4-5-20251001";   // Fast routing — latest Haiku

export async function routeItemAnthropic(
  imagePath: string,
  ocrText: string
): Promise<ConductorResponse> {
  const prompt = getPrompt(CONDUCTOR_PROMPT_FILE);
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const isWebp = imagePath.toLowerCase().endsWith('.webp');
  const mediaType = isWebp ? "image/webp" : "image/jpeg"; 

  console.log(`[Anthropic] Routing item with Claude 3.5 Haiku...`);

  const response = await anthropic.messages.create({
    model: ROUTER_MODEL,
    max_tokens: 1024,
    system: prompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as any,
              data: base64Image,
            },
          },
          {
            type: "text",
            text: `OCR Hint: ${ocrText.substring(0, 1000)}`
          }
        ],
      },
      {
        role: "assistant",
        content: "{" // Pre-fill JSON bracket for better output
      }
    ],
  });

  const text = "{" + (response.content[0] as any).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Anthropic failed to return valid JSON for routing");
  return JSON.parse(jsonMatch[0]) as ConductorResponse;
}

export async function appraiseItemAnthropic(
  category: string,
  imagePath: string,
  ocrText: string
): Promise<ExpertResponse> {
  const promptFile = EXPERT_PROMPT_MAP[category] || EXPERT_PROMPT_MAP['general_vintage_ephemera'];
  let prompt = getPrompt(promptFile);
  const schemaStr = getPrompt('EXPERT_BASE_SCHEMA.json');
  prompt += `\n\nREQUIRED JSON SCHEMA:\n${schemaStr}`;

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const isWebp = imagePath.toLowerCase().endsWith('.webp');
  const mediaType = isWebp ? "image/webp" : "image/jpeg";

  console.log(`[Anthropic] Appraising as ${category} with Claude 3.5 Sonnet...`);

  const response = await anthropic.messages.create({
    model: PRIMARY_MODEL,
    max_tokens: 4096,
    system: prompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as any,
              data: base64Image,
            },
          },
          {
            type: "text",
            text: `Full OCR Text:
${ocrText}`
          }
        ],
      },
      {
        role: "assistant",
        content: "{" 
      }
    ],
  });

  const text = "{" + (response.content[0] as any).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Anthropic failed to return valid JSON for appraisal");
  return JSON.parse(jsonMatch[0]) as ExpertResponse;
}
