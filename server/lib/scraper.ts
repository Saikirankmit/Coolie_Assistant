import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

export async function scrapeWebpage(url: string): Promise<string> {
  try {
    // Fetch HTML content
    const response = await fetch(url);
    const html = await response.text();

    // Parse HTML with JSDOM
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Remove unwanted elements
    const elementsToRemove = ['script', 'style', 'nav', 'footer', 'iframe'];
    elementsToRemove.forEach(tag => {
      document.querySelectorAll(tag).forEach(el => el.remove());
    });

    // Extract main content
    const mainContent = document.querySelector('main, article, .content, .article, #content, #main');
    let contentHtml = mainContent ? mainContent.innerHTML : document.body.innerHTML;

    // Convert HTML to Markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced'
    });

    const markdown = turndownService.turndown(contentHtml);

    // Return cleaned up content
    return markdown.trim();
  } catch (error) {
    console.error('Error scraping webpage:', error);
    throw new Error('Failed to scrape webpage content');
  }
}