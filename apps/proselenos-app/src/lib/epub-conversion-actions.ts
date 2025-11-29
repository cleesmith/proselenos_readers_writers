// lib/epub-conversion-actions.ts

'use server';

import { listFiles, downloadBinaryFile, uploadFile } from '@/lib/github-storage';
import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
// import xpath from 'xpath';

type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

interface ChapterData {
  title: string;
  textBlocks: string[];
}

interface EpubProcessingResult {
  chapters: ChapterData[];
  success: boolean;
}

// Convert EPUB file to plain text and save to project folder
export async function convertEpubToTextAction(
  epubFilePath: string,
  outputFileName: string,
  projectName: string
): Promise<ActionResult<{ fileName: string; chapterCount: number; wordCount: number }>> {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    if (!epubFilePath || !outputFileName || !projectName) {
      return { success: false, error: 'Missing required parameters' };
    }

    // Ensure output filename has .txt extension
    let finalOutputName = outputFileName.trim();
    if (!finalOutputName.toLowerCase().endsWith('.txt')) {
      finalOutputName += '.txt';
    }

    try {
      // Download the EPUB file from GitHub repo (returns Buffer directly)
      const { content: buffer, filename } = await downloadBinaryFile(userId, 'proselenos', epubFilePath);

      // Check file size to prevent memory issues
      const fileSizeInMB = buffer.length / (1024 * 1024);

      if (fileSizeInMB > 10) {
        return {
          success: false,
          error: `File too large (${fileSizeInMB.toFixed(1)}MB). Please use files smaller than 10MB.`
        };
      }

      // Process the EPUB file
      const result = await processEpub(buffer);

      if (result.chapters.length === 0) {
        return {
          success: false,
          error: 'No chapters found in EPUB file'
        };
      }

      // Generate text content
      let allText = '';
      result.chapters.forEach((ch) => {
        if (ch.title) {
          allText += ch.title + '\n\n';
        }
        allText += ch.textBlocks.join('\n\n') + '\n\n';
      });

      // Create output filename with timestamp
      const timestamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 15);
      const baseFileName = filename.replace('.epub', '');
      const timestampedOutputName = `${baseFileName}_${timestamp}.txt`;

      // Save to GitHub repo
      const outputPath = `${projectName}/${timestampedOutputName}`;
      await uploadFile(userId, 'proselenos', outputPath, allText, 'Convert EPUB to TXT');

      return {
        success: true,
        data: {
          fileName: timestampedOutputName,
          chapterCount: result.chapters.length,
          wordCount: countWords(allText)
        },
        message: `Successfully converted EPUB to text with ${result.chapters.length} chapters (${countWords(allText)} words).`
      };

    } catch (conversionError: any) {
      console.error('EPUB conversion error:', conversionError);
      return {
        success: false,
        error: `Conversion failed: ${conversionError.message || 'Unknown error'}`
      };
    }

  } catch (error: any) {
    console.error('Error in convertEpubToTextAction:', error);
    return {
      success: false,
      error: error.message || 'Failed to convert EPUB file'
    };
  }
}

// Process an EPUB file
async function processEpub(fileData: Buffer): Promise<EpubProcessingResult> {
  try {
    const zip = await JSZip.loadAsync(fileData);
    
    // 1. locate the OPF file via META-INF/container.xml
    const containerFile = zip.file("META-INF/container.xml");
    if (!containerFile) throw new Error("META-INF/container.xml not found.");
    
    const containerXml = stripBOM(await containerFile.async("text"));
    const containerDoc = new DOMParser().parseFromString(containerXml, "application/xml");
    
    const rootfileElement = containerDoc.getElementsByTagName("rootfile")[0];
    if (!rootfileElement) throw new Error("OPF file reference not found.");
    
    const opfPath = rootfileElement.getAttribute("full-path");
    if (!opfPath) throw new Error("OPF file path is missing.");
    
    // Get the base path (e.g. if opfPath is "OEBPS/content.opf", base = "OEBPS/")
    const basePath = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) : "";

    // 2. read the OPF file
    const opfFile = zip.file(opfPath);
    if (!opfFile) throw new Error("OPF file not found: " + opfPath);
    
    const opfXml = stripBOM(await opfFile.async("text"));
    const opfDoc = new DOMParser().parseFromString(opfXml, "application/xml");

    // 3. build a manifest (id → href)
    const manifest: Record<string, string> = {};
    const items = opfDoc.getElementsByTagName("item");
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      const id = item.getAttribute("id");
      const href = item.getAttribute("href");
      if (id && href) {
        manifest[id] = href;
      }
    }

    // 4. get the spine (reading order)
    const spineItems: string[] = [];
    const itemrefs = opfDoc.getElementsByTagName("itemref");
    for (let i = 0; i < itemrefs.length; i++) {
      const itemref = itemrefs[i];
      if (!itemref) continue;
      const idref = itemref.getAttribute("idref");
      if (idref && manifest[idref]) {
        spineItems.push(manifest[idref]);
      }
    }

    // 5. process each chapter file from the spine
    const chapters: ChapterData[] = [];
    
    // Define a list of unwanted titles
    const unwantedTitles = ["TITLE PAGE", "COPYRIGHT"];

    for (const itemHref of spineItems) {
      const chapterPath = basePath + itemHref;
      const chapterFile = zip.file(chapterPath);
      
      if (!chapterFile) {
        continue;
      }
      
      const chapterContent = await chapterFile.async("text");
      
      // Parse the chapter content into a DOM
      const doc = new DOMParser().parseFromString(chapterContent, "text/html");
      
      // Extract and store the title from the first <h1>
      let title = "";
      const h1Elements = doc.getElementsByTagName("h1");
      if (h1Elements.length > 0 && h1Elements[0]) {
        title = h1Elements[0].textContent?.trim() || "";
        
        // Filter out unwanted titles
        if (unwantedTitles.includes(title.toUpperCase())) {
          continue;
        }
      }
      
      // Extract the body text
      let bodyText = "";
      const bodyElements = doc.getElementsByTagName("body");
      if (bodyElements.length > 0 && bodyElements[0]) {
        bodyText = bodyElements[0].textContent?.trim() || "";
      }
      
      // Split into paragraphs
      const textBlocks = bodyText.split(/\n\s*\n/).filter(block => block.trim() !== "");
      
      // Special handling for CONTENTS page
      if (title.toUpperCase() === "CONTENTS") {
        for (let i = 0; i < textBlocks.length; i++) {
          const block = textBlocks[i];
          if (!block) continue;
          // If a line is non-empty and does not start with whitespace, add an indent
          if (block.trim() && !/^\s/.test(block)) {
            textBlocks[i] = "        " + block;
          }
        }
      }
      
      // If no title and content is too short, skip this chapter
      if (!title && textBlocks.join("").length < 100) {
        continue;
      }
      
      chapters.push({
        title: title,
        textBlocks: textBlocks
      });
    }

    return {
      chapters: chapters,
      success: true
    };
  } catch (error) {
    console.error('Error processing EPUB:', error);
    throw error;
  }
}

// Count words in text
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

// Strip BOM (Byte Order Mark) from XML content
// Some EPUBs have UTF-8 BOM at the start which breaks XML parsing
function stripBOM(content: string): string {
  // UTF-8 BOM is \uFEFF, UTF-16 BE is \uFFFE, UTF-16 LE is \uFEFF
  if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE) {
    return content.slice(1);
  }
  return content;
}

// List EPUB files in a project folder
export async function listEpubFilesAction(projectName: string): Promise<ActionResult> {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    // List all files in the project folder with .epub extension
    const epubFiles = await listFiles(userId, 'proselenos', `${projectName}/`, '.epub');

    // Map to format expected by UI
    const formattedFiles = epubFiles.map(file => ({
      id: file.path,
      name: file.name,
      path: file.path,
      mimeType: 'application/epub+zip'
    }));

    return {
      success: true,
      data: { files: formattedFiles },
      message: `Found ${formattedFiles.length} EPUB files`
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to list EPUB files' };
  }
}

/**
 * Extract cover image from an EPUB file
 * Returns base64 encoded image data or null if no cover found
 */
export async function extractCoverFromEpubAction(
  epubFilePath: string
): Promise<ActionResult<{ coverBase64: string; mimeType: string } | null>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    if (!epubFilePath) {
      return { success: false, error: 'EPUB file path is required' };
    }

    // Download the EPUB file
    const { content: buffer } = await downloadBinaryFile(userId, 'proselenos', epubFilePath);

    // Load the EPUB as a zip
    const zip = await JSZip.loadAsync(buffer);

    // 1. Find the OPF file via container.xml
    const containerFile = zip.file("META-INF/container.xml");
    if (!containerFile) {
      return { success: true, data: null, message: 'No container.xml found' };
    }

    const containerXml = stripBOM(await containerFile.async("text"));
    const containerDoc = new DOMParser().parseFromString(containerXml, "application/xml");

    const rootfileElement = containerDoc.getElementsByTagName("rootfile")[0];
    if (!rootfileElement) {
      return { success: true, data: null, message: 'No rootfile found' };
    }

    const opfPath = rootfileElement.getAttribute("full-path");
    if (!opfPath) {
      return { success: true, data: null, message: 'No OPF path found' };
    }

    // Get the base path
    const basePath = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) : "";

    // 2. Read the OPF file
    const opfFile = zip.file(opfPath);
    if (!opfFile) {
      return { success: true, data: null, message: 'OPF file not found' };
    }

    const opfXml = stripBOM(await opfFile.async("text"));
    const opfDoc = new DOMParser().parseFromString(opfXml, "application/xml");

    // 3. Find the cover image in the manifest
    // Look for item with properties="cover-image" (EPUB 3) or id containing "cover"
    const items = opfDoc.getElementsByTagName("item");
    let coverHref: string | null = null;
    let coverMimeType: string | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;

      const properties = item.getAttribute("properties") || "";
      const id = item.getAttribute("id") || "";
      const mediaType = item.getAttribute("media-type") || "";

      // EPUB 3: properties contains "cover-image"
      if (properties.includes("cover-image")) {
        coverHref = item.getAttribute("href");
        coverMimeType = mediaType;
        break;
      }

      // Fallback: id contains "cover" and is an image
      if (id.toLowerCase().includes("cover") && mediaType.startsWith("image/")) {
        coverHref = item.getAttribute("href");
        coverMimeType = mediaType;
        // Don't break - prefer properties="cover-image" if found later
      }
    }

    // Also check for EPUB 2 style: <meta name="cover" content="cover-id"/>
    if (!coverHref) {
      const metaElements = opfDoc.getElementsByTagName("meta");
      for (let i = 0; i < metaElements.length; i++) {
        const meta = metaElements[i];
        if (!meta) continue;
        if (meta.getAttribute("name") === "cover") {
          const coverRef = meta.getAttribute("content");
          if (coverRef) {
            // First try: find item by id (correct per EPUB spec)
            for (let j = 0; j < items.length; j++) {
              const item = items[j];
              if (!item) continue;
              if (item.getAttribute("id") === coverRef) {
                coverHref = item.getAttribute("href");
                coverMimeType = item.getAttribute("media-type");
                break;
              }
            }
            // Second try: some malformed EPUBs use href/path instead of id
            if (!coverHref) {
              for (let j = 0; j < items.length; j++) {
                const item = items[j];
                if (!item) continue;
                const href = item.getAttribute("href");
                if (href === coverRef || href?.endsWith(coverRef)) {
                  coverHref = href;
                  coverMimeType = item.getAttribute("media-type");
                  break;
                }
              }
            }
          }
          break;
        }
      }
    }

    // Final fallback: look for any image with "cover" in the filename
    if (!coverHref) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        const href = item.getAttribute("href") || "";
        const mediaType = item.getAttribute("media-type") || "";
        if (mediaType.startsWith("image/") && href.toLowerCase().includes("cover")) {
          coverHref = href;
          coverMimeType = mediaType;
          break;
        }
      }
    }

    if (!coverHref) {
      return { success: true, data: null, message: 'No cover image found in EPUB' };
    }

    // 4. Extract the cover image
    const coverPath = basePath + coverHref;
    const coverFile = zip.file(coverPath);

    if (!coverFile) {
      return { success: true, data: null, message: 'Cover file not found in EPUB' };
    }

    // Get the cover as base64
    const coverData = await coverFile.async("base64");
    const mimeType = coverMimeType || "image/jpeg";

    // Return as data URL
    const coverBase64 = `data:${mimeType};base64,${coverData}`;

    return {
      success: true,
      data: { coverBase64, mimeType },
      message: 'Cover image extracted successfully'
    };

  } catch (error: any) {
    console.error('Error extracting cover from EPUB:', error);
    return { success: false, error: error.message || 'Failed to extract cover from EPUB' };
  }
}