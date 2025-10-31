import fetch from 'node-fetch';
import { TOOL_DEFINITION } from './tools/webNavigate';
import { handleWebNavigateRequest } from './tools/webNavigate';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-3.5';

async function callClaudeForNavigation(userRequest: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const prompt = `You are an assistant that extracts a single JSON object from a user's request for opening a website.\nRespond with only a JSON object (no surrounding text) with the fields:\n- url: string (the full URL to open)\n- clickText: string or null (optional text to click after loading)\n- action: one of \"screenshot\", \"extract_text\", \"get_title\"\n- openInBrowser: boolean\n\nIf the user already provided a URL, use that URL. Try to infer the correct URL when possible. If you cannot determine a URL, return {\n  \"url\": null,\n  \"clickText\": null,\n  \"action\": \"screenshot\",\n  \"openInBrowser\": false\n}.\n\nUser request:\n${userRequest}`;

  const body = {
    model: CLAUDE_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 300,
    temperature: 0.0,
  } as any;

  const resp = await fetch('https://api.anthropic.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANTHROPIC_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Claude API error ${resp.status}: ${txt}`);
  }

  const data = await resp.json();
  // try to locate the assistant message content
  const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.delta?.content ?? data?.output?.[0]?.content?.[0]?.text ?? null;
  if (!content) throw new Error('No content returned from Claude');
  return content;
}

export async function handleWebsiteRequestWithClaude(userRequest: string) {
  try {
    const content = await callClaudeForNavigation(userRequest);

    // attempt to extract JSON object from content
    const jsonMatch = content.match(/\{[^]*\}/m);
    let parsed: any = null;
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        // ignore parse error
      }
    }

    if (!parsed || !parsed.url) {
      // Fallback: if userRequest contains a URL, attempt to extract it
      const urlRegex = /(https?:\/\/[^\s]+)/i;
      const m = userRequest.match(urlRegex);
      if (m) {
        parsed = parsed || {};
        parsed.url = m[1];
      }
    }

    if (!parsed || !parsed.url) {
      return { status: 'error', error: 'Could not determine URL from request' };
    }

    const args = {
      url: parsed.url,
      clickText: parsed.clickText ?? parsed.click_text ?? null,
      action: parsed.action ?? 'screenshot',
      openInBrowser: parsed.openInBrowser ?? parsed.open_in_browser ?? false,
    } as any;

    return await handleWebNavigateRequest(args);
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

export const TOOL_DEF = TOOL_DEFINITION;
