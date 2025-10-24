import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_NAME = 'gemini-2.0-flash';
const API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!API_KEY) {
  console.warn('GOOGLE_AI_API_KEY not configured - Gemini analysis will not work');
}

export async function analyzeText(text: string, prompt?: string): Promise<string> {
  if (!API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const generationConfig = {
    temperature: 0.4,
    topK: 32,
    topP: 1,
    maxOutputTokens: 2048,
  } as any;

  const fullPrompt = prompt 
    ? `${prompt}\n\nContent:\n${text}`
    : text;

  try {
    const result = await model.generateContent(fullPrompt, generationConfig);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error('Gemini text analysis error:', error);
    throw new Error(`Text analysis failed: ${error.message}`);
  }
}

export async function analyzeImage(base64Image: string, prompt: string = 'Describe this image in detail') {
  if (!API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  // Extract mime type and actual base64 from the data URL
  const matches = base64Image.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 image data URL');
  }

  const [_, mimeType, base64Data] = matches;

  // Create the image part for the model
  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType
    }
  };

  // Configuration for generation
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
    throw new Error(`Image analysis failed: ${error.message}`);
  }
}