import { chromium, type Browser } from 'playwright';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import open from 'open';

export interface NavigationResult {
  tool: string;
  url: string;
  action: string;
  data?: {
    screenshot_path?: string;
    screenshot_url?: string;
    title?: string;
    text_preview?: string;
    full_text_length?: number;
    click_info?: {
      clicked: boolean;
      strategy?: string | null;
      details?: any;
      error?: string | null;
    } | null;
  };
  final_url?: string;
  opened_in_system_browser: boolean;
  open_error?: string | undefined;
  status: string;
  error?: string;
}

export async function openWebsiteAndNavigate(
  url: string,
  clickText?: string,
  action: 'screenshot' | 'extract_text' | 'get_title' = 'screenshot',
  openInBrowser: boolean = false
): Promise<NavigationResult> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Handle click text if provided
    let clickInfo: { clicked: boolean; strategy?: string | null; details?: any; error?: string | null } | null = null;
    if (clickText) {
      clickInfo = { clicked: false, strategy: null, details: null, error: null };

      // Strategy 1: Exact text
      try {
        const locator = page.locator(`text="${clickText}"`);
        if (await locator.count() > 0) {
          await locator.first().click();
          clickInfo = { clicked: true, strategy: 'text-exact' };
        }
      } catch (e) {
        // Continue to next strategy
      }

      // Strategy 2: Role=link
      if (!clickInfo.clicked) {
        try {
          const linkLocator = page.getByRole('link', { name: clickText });
          if (await linkLocator.count() > 0) {
            await linkLocator.first().click();
            clickInfo = { clicked: true, strategy: 'role-link' };
          }
        } catch (e) {
          // Continue to next strategy
        }
      }

      // Wait for navigation if clicked
      if (clickInfo.clicked) {
        try {
          await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch {
          await page.waitForTimeout(1200);
        }
      }
    }

  let resultData: NavigationResult['data'] | undefined = undefined;
    const finalUrl = page.url();

    // Perform requested action
    if (action === 'screenshot') {
      const staticDir = path.join(__dirname, '..', '..', 'static');
      await fs.mkdir(staticDir, { recursive: true });
      
      const fileName = `playwright_${uuidv4()}.png`;
      const filePath = path.join(staticDir, fileName);
      
      await page.screenshot({ path: filePath, fullPage: false });
      resultData = {
        screenshot_path: filePath,
        screenshot_url: `/static/${fileName}`,
        click_info: clickInfo
      };
    } else if (action === 'extract_text') {
      const title = await page.title();
      const text = await page.innerText('body');
      resultData = {
        title,
        text_preview: text.length > 500 ? text.substring(0, 500) + '...' : text,
        full_text_length: text.length,
        click_info: clickInfo
      };
    } else if (action === 'get_title') {
      const title = await page.title();
      resultData = {
        title,
        click_info: clickInfo
      };
    }

    await browser.close();
    browser = null;

    // Handle system browser opening
    let opened = false;
    let openError: string | undefined = undefined;

    if (openInBrowser) {
      try {
        await open(finalUrl);
        opened = true;
      } catch (err) {
        if (err instanceof Error) openError = err.message; else openError = String(err);
      }
    }

    return {
      tool: 'playwright_navigate',
      url,
      action,
      data: resultData,
      final_url: finalUrl,
      opened_in_system_browser: opened,
      open_error: openError,
      status: 'success'
    };

  } catch (err) {
    if (browser) {
      await browser.close();
    }

    // Attempt fallback to system browser
    let opened = false;
    let openError: string | undefined = undefined;

    if (openInBrowser) {
      try {
        await open(url);
        opened = true;
      } catch (e2) {
        if (e2 instanceof Error) openError = e2.message; else openError = String(e2);
      }
    }

    const errorMsg = err instanceof Error ? err.message : String(err);

    return {
      tool: 'playwright_navigate',
      url,
      action,
      status: 'error',
      error: errorMsg,
      opened_in_system_browser: opened,
      open_error: openError
    };
  }
}