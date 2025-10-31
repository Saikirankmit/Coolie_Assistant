import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_NAME = 'gemini-2.0-flash';
const API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!API_KEY) {
  console.warn('GOOGLE_AI_API_KEY not configured - Gemini analysis may not work');
}

function createModelForKey(key: string) {
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: MODEL_NAME });
}

export async function analyzeText(text: string, prompt?: string): Promise<string> {
  if (!API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY not configured');
  }
  return analyzeTextWithKey(text, prompt, API_KEY);
}

export async function analyzeTextWithKey(text: string, prompt: string | undefined, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error('apiKey required');

  const model = createModelForKey(apiKey);

  const generationConfig = {
    temperature: 0.4,
    topK: 32,
    topP: 1,
    maxOutputTokens: 2048,
  } as any;

  const fullPrompt = prompt ? `${prompt}\n\nContent:\n${text}` : text;

  try {
    const result = await model.generateContent(fullPrompt, generationConfig);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error('Gemini text analysis error:', error);
    throw new Error(`Text analysis failed: ${error?.message ?? String(error)}`);
  }
}

export async function analyzeImage(base64Image: string, prompt: string = 'Describe this image in detail') {
  if (!API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY not configured');
  }

  const model = createModelForKey(API_KEY);

  // Extract mime type and actual base64 from the data URL
  const matches = base64Image.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 image data URL');
  }

  const [_, mimeType, base64Data] = matches;

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType
    }
  };

  const generationConfig = {
    temperature: 0.4,
    topK: 32,
    topP: 1,
    maxOutputTokens: 2048,
  } as any;

  try {
    const result = await model.generateContent([prompt, imagePart], generationConfig);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error('Gemini image analysis error:', error);
    throw new Error(`Image analysis failed: ${error?.message ?? String(error)}`);
  }
}