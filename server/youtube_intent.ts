import { analyzeText } from './gemini';

// Special prompt to detect video-related requests and extract info
const INTENT_PROMPT = `
Your task is to analyze the user message and determine if it's requesting to open/watch/play a video.
If it is a video request, extract the search query.

Return JSON in this format:
{
  "isVideoRequest": boolean, // true if user wants to watch/open/play a video
  "searchQuery": string | null, // the search query to use, or null if not a video request
  "confidence": number // 0-1 score of how confident this is a video request
}

Example user messages and responses:

1. "Can you open a video about cats playing piano"
{
  "isVideoRequest": true,
  "searchQuery": "cats playing piano",
  "confidence": 0.95
}

2. "What's the weather like?"
{
  "isVideoRequest": false,
  "searchQuery": null,
  "confidence": 0
}

3. "Play despacito music video"
{
  "isVideoRequest": true,
  "searchQuery": "despacito official music video",
  "confidence": 0.98
}

4. "I want to watch how to make pasta"
{
  "isVideoRequest": true,
  "searchQuery": "how to make pasta tutorial",
  "confidence": 0.9
}

Analyze this message:
`;

export interface VideoIntent {
  isVideoRequest: boolean;
  searchQuery: string | null;
  confidence: number;
}

export async function analyzeVideoIntent(message: string): Promise<VideoIntent> {
  try {
    const result = await analyzeText(message, INTENT_PROMPT);
    // Clean up the response in case it's wrapped in markdown code blocks
    let cleanResult = result.trim();
    // Remove markdown code block markers if present
    if (cleanResult.startsWith('```')) {
      cleanResult = cleanResult.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
    }
    // Parse the cleaned JSON
    return JSON.parse(cleanResult) as VideoIntent;
  } catch (error: any) {
    console.error('Video intent analysis failed:', error);
    // Default to non-video request on error
    return {
      isVideoRequest: false,
      searchQuery: null,
      confidence: 0
    };
  }
}