/**
 * Google Cloud Vision OCR Handler
 * Replaces worker-based OCR with Vision API calls
 */

import { ImageAnnotatorClient } from '@google-cloud/vision';
import fs from 'fs';

let visionClient: ImageAnnotatorClient | null = null;

export function getVisionClient(): ImageAnnotatorClient {
  if (!visionClient) {
    visionClient = new ImageAnnotatorClient({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }
  return visionClient;
}

export interface OCRResult {
  text: string;
  confidence: number;
  duration_ms: number;
  webEntities?: Array<{description: string, score: number}>;
}

export async function performCloudVisionOCR(filePath: string): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    const client = getVisionClient();
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');

    const request = {
      image: { content: base64Image },
      features: [
        { type: 'TEXT_DETECTION' as const },
        { type: 'WEB_DETECTION' as const }
      ]
    };

    const [result] = await client.annotateImage(request);
    const annotations = result.textAnnotations || [];
    const webDetection = result.webDetection || {};

    let webEntities: Array<{description: string, score: number}> = [];
    if (webDetection.webEntities) {
      webEntities = webDetection.webEntities
        .filter(e => e.description && e.score)
        .map(e => ({ description: e.description as string, score: e.score as number }));
    }

    if (annotations.length === 0) {
      return {
        text: '[No text detected]',
        confidence: 0,
        duration_ms: Date.now() - startTime,
        webEntities
      };
    }

    // First annotation is the full text
    const fullText = annotations[0].description || '';
    const confidence = annotations[0].confidence || 0;

    return {
      text: fullText,
      confidence,
      duration_ms: Date.now() - startTime,
      webEntities
    };
  } catch (err: any) {
    const duration = Date.now() - startTime;

    // Handle specific errors
    if (err.message.includes('quota')) {
      throw new Error(`[GCV_QUOTA_EXCEEDED] ${err.message}`);
    }
    if (err.message.includes('auth') || err.message.includes('credentials')) {
      throw new Error(`[GCV_AUTH_ERROR] ${err.message}`);
    }
    if (err.message.includes('timeout')) {
      throw new Error(`[GCV_TIMEOUT] ${err.message}`);
    }

    throw new Error(`[GCV_ERROR] ${err.message}`);
  }
}
