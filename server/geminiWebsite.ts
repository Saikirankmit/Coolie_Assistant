import { analyzeTextWithKey } from './gemini';
import { handleWebNavigateRequest } from './tools/webNavigate';

const FALLBACK_KEY = process.env.GEMINI_FALLBACK_KEY;

const NAV_PROMPT = `You are an assistant that reads a user's instruction about opening a website and returns exactly one JSON object (no surrounding text) with the following fields:\n- url: string or null\n- clickText: string or null\n- action: one of \"screenshot\", \"extract_text\", \"get_title\"\n- openInBrowser: boolean\nIf the user did not provide a URL, try to infer a likely URL from the wording. If you cannot determine a URL, set url to null.`;

export async function handleWebsiteRequest(userRequest: string) {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY || FALLBACK_KEY;
    if (!apiKey) return { status: 'error', error: 'No Gemini API key configured' };

    const text = await analyzeTextWithKey(userRequest, NAV_PROMPT, apiKey);

    // Extract JSON object from response
    const m = text.match(/\{[\s\S]*\}/);
    let parsed: any = null;
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch (e) { parsed = null; }
    }

    // fallback to simple URL extraction when needed
    if ((!parsed || !parsed.url) && typeof userRequest === 'string') {
      const urlMatch = userRequest.match(/https?:\/\/[^\s]+/i);
      if (urlMatch) {
        parsed = parsed || {};
        parsed.url = urlMatch[0];
      }
    }

    if (!parsed || !parsed.url) return { status: 'error', error: 'Could not determine URL from request' };

    const args = {
      url: parsed.url,
      clickText: parsed.clickText ?? parsed.click_text ?? null,
      action: parsed.action ?? 'screenshot',
      // For chat quick-path assume user wants to open the site in their browser
      openInBrowser: parsed.openInBrowser ?? parsed.open_in_browser ?? true,
    } as any;

    return await handleWebNavigateRequest(args);
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}
