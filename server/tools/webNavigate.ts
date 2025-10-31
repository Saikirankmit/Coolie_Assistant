import { openWebsiteAndNavigate, type NavigationResult } from '../lib/playwrightHelper';

interface WebNavigateToolInput {
  url: string;
  clickText?: string;
  action?: 'screenshot' | 'extract_text' | 'get_title';
  openInBrowser?: boolean;
}

const WEB_NAVIGATE_TOOL = {
  name: "browse_webpage",
  description: "Browse and interact with a webpage. Can take screenshots, extract text, and click on elements.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to navigate to"
      },
      clickText: {
        type: "string",
        description: "Optional text to click on after loading the page"
      },
      action: {
        type: "string",
        enum: ["screenshot", "extract_text", "get_title"],
        description: "Action to perform on the page"
      },
      openInBrowser: {
        type: "boolean",
        description: "Whether to open the URL in the system browser"
      }
    },
    required: ["url"]
  }
};

export async function handleWebNavigateRequest(input: WebNavigateToolInput) {
  // Allow disabling Playwright-driven automation in constrained environments (e.g., Render free plan)
  // When disabled, we short-circuit and return a minimal success response so the client can open the URL directly.
  const disable = (process.env.PLAYWRIGHT_DISABLED || '').toLowerCase();
  if (disable === '1' || disable === 'true' || disable === 'yes') {
    return {
      tool: 'playwright_navigate',
      url: input.url,
      action: input.action || 'screenshot',
      data: undefined,
      final_url: input.url,
      opened_in_system_browser: false,
      status: 'success'
    } as NavigationResult;
  }
  // Block certain domains
  const lowerUrl = input.url.toLowerCase();
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be') || lowerUrl.includes('gmail.com')) {
    return {
      error: "This tool is disabled for youtube.com and gmail.com domains. Use the dedicated tools instead.",
      status: "error"
    };
  }

  try {
    return await openWebsiteAndNavigate(
      input.url,
      input.clickText,
      input.action || 'screenshot',
      input.openInBrowser || false
    );
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

// Export tool definition for Gemini integration
export const TOOL_DEFINITION = WEB_NAVIGATE_TOOL;