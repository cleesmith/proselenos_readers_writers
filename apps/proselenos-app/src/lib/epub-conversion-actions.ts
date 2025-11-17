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
    
    const containerXml = await containerFile.async("text");
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
    
    const opfXml = await opfFile.async("text");
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