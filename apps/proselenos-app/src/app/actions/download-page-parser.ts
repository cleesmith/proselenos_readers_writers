'use server';

// Define the return type for the action
type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

/**
 * Server Action: Parses download pages with meta-refresh redirects to extract and download EPUBs.
 * Works with StandardEbooks.org, OceanofPDF, and other sites using meta refresh tags.
 */
export async function parseMetaRefreshAction(
  downloadPageUrl: string
): Promise<ActionResult<{ base64: string; filename: string }>> {
  try {
    // 1. Fetch the download page HTML
    const pageResponse = await fetch(downloadPageUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!pageResponse.ok) {
      return {
        success: false,
        error: `Failed to fetch download page: ${pageResponse.statusText}`
      };
    }

    const html = await pageResponse.text();

    // 2. Parse HTML to find meta refresh tag
    // Look for: <meta http-equiv="refresh" content="0; url=ACTUAL_URL">
    const metaRefreshRegex = /<meta\s+http-equiv=["']refresh["']\s+content=["'](\d+);\s*url=([^"']+)["']/i;
    const match = html.match(metaRefreshRegex);

    if (!match) {
      // Try alternate format: content comes before http-equiv
      const altRegex = /<meta\s+content=["'](\d+);\s*url=([^"']+)["']\s+http-equiv=["']refresh["']/i;
      const altMatch = html.match(altRegex);

      if (!altMatch) {
        return {
          success: false,
          error: 'No meta refresh tag found. This may not be a valid download page.'
        };
      }

      const actualUrl = altMatch[2];
      if (!actualUrl) {
        return { success: false, error: 'Failed to extract URL from meta refresh tag' };
      }
      return await downloadEpub(actualUrl, downloadPageUrl);
    }

    const actualUrl = match[2];
    if (!actualUrl) {
      return { success: false, error: 'Failed to extract URL from meta refresh tag' };
    }
    return await downloadEpub(actualUrl, downloadPageUrl);

  } catch (error: any) {
    console.error('Server Action Error:', error);
    return { success: false, error: error.message || 'Unknown server error' };
  }
}

/**
 * Helper function to download the EPUB from the extracted URL
 */
async function downloadEpub(
  epubUrl: string,
  originalPageUrl: string
): Promise<ActionResult<{ base64: string; filename: string }>> {
  try {
    // Handle relative URLs by resolving against the original page URL
    let fullEpubUrl = epubUrl;
    if (epubUrl.startsWith('/')) {
      const pageUrlObj = new URL(originalPageUrl);
      fullEpubUrl = `${pageUrlObj.protocol}//${pageUrlObj.host}${epubUrl}`;
    } else if (!epubUrl.startsWith('http')) {
      const pageUrlObj = new URL(originalPageUrl);
      fullEpubUrl = `${pageUrlObj.protocol}//${pageUrlObj.host}/${epubUrl}`;
    }

    // Download the EPUB file
    const epubResponse = await fetch(fullEpubUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!epubResponse.ok) {
      return {
        success: false,
        error: `Failed to download EPUB: ${epubResponse.statusText}`
      };
    }

    // Convert to ArrayBuffer and then to base64
    const arrayBuffer = await epubResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    const base64 = btoa(binary);

    // Extract filename from URL or use default
    let filename = 'book.epub';
    try {
      const urlObj = new URL(fullEpubUrl);
      const pathParts = urlObj.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && lastPart.endsWith('.epub')) {
        filename = lastPart.split('?')[0] || 'book.epub'; // Remove query params
      }
    } catch (e) {
      // Use default filename if parsing fails
    }

    return {
      success: true,
      data: {
        base64,
        filename,
      },
    };
  } catch (error: any) {
    console.error('Download Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to download EPUB file'
    };
  }
}
