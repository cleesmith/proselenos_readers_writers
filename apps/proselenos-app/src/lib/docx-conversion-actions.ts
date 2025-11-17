// lib/docx-conversion-actions.ts
//
// This module contains server actions for converting Microsoft Word documents
// (.docx) into plain text and saving to GitHub repositories. The conversion
// uses the `mammoth` library, which extracts raw text and ignores formatting
// and embedded images.

"use server";

import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { uploadFile, downloadFile } from './github-storage';

/**
 * Converts a DOCX file supplied as a Buffer into a plain-text string.
 * This helper uses the `mammoth` library to extract raw text, discarding
 * formatting and images. It can be useful in server-side contexts where
 * client-side conversion is not available or desired.
 *
 * @param buffer A Node.js Buffer containing the contents of a `.docx` file.
 * @returns The extracted text as a string.
 */
export async function convertDocxBufferToTxt(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: buffer });
  return value;
}

/**
 * GitHub version: Convert uploaded DOCX file to TXT and save to GitHub repo
 * User uploads .docx from local computer → server converts → .txt saved to repo
 */
export async function convertDocxToTxtActionGitHub(
  file: File,
  outputFileName: string,
  projectName: string
): Promise<{
  success: boolean;
  data?: {
    fileName: string;
    chapterCount: number;
    characterCount: number;
  };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    // Convert File to ArrayBuffer, then to Node.js Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Convert DOCX to text
    const text = await convertDocxBufferToTxt(buffer);

    // Count chapters (looking for common chapter patterns)
    const chapterMatches = text.match(/^(Chapter|CHAPTER|\d+\.)\s+/gm);
    const chapterCount = chapterMatches ? chapterMatches.length : 0;

    // Upload to GitHub repo
    const outputPath = `${projectName}/${outputFileName}`;
    await uploadFile(userId, 'proselenos', outputPath, text, 'Import DOCX as TXT');

    return {
      success: true,
      data: {
        fileName: outputFileName,
        chapterCount,
        characterCount: text.length
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to convert DOCX to TXT'
    };
  }
}

/**
 * GitHub version: Convert TXT file from GitHub repo to DOCX and return as buffer
 * Reads TXT from GitHub → converts to proper DOCX → returns for download
 *
 * @param projectName The project folder name
 * @param txtFilePath The full path to the TXT file (e.g., "projectName/file.txt")
 * @param outputFileName The desired name for the output .docx file
 */
export async function convertTxtToDocxActionGitHub(
  _projectName: string,
  txtFilePath: string,
  outputFileName: string
): Promise<{
  success: boolean;
  data?: {
    docxBuffer: string; // base64 encoded for serialization
    fileName: string;
    paragraphCount: number;
    chapterCount: number;
    characterCount: number;
  };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    // Download the TXT file from GitHub
    const { content } = await downloadFile(userId, 'proselenos', txtFilePath);

    // Decode ArrayBuffer to UTF-8 string
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(content);

    // Count statistics
    const paragraphs = text.split(/\n\n+/);
    const paragraphCount = paragraphs.filter(p => p.trim().length > 0).length;
    const chapterMatches = text.match(/^(Chapter|CHAPTER|\d+\.)\s+/gm);
    const chapterCount = chapterMatches ? chapterMatches.length : 0;

    // Create DOCX document with proper structure
    const docParagraphs = paragraphs
      .filter(p => p.trim().length > 0)
      .map(paragraphText =>
        new Paragraph({
          children: [new TextRun(paragraphText.trim())]
        })
      );

    const doc = new Document({
      sections: [{
        properties: {},
        children: docParagraphs
      }]
    });

    // Generate DOCX buffer
    const docxBuffer = await Packer.toBuffer(doc);

    // Convert to base64 for serialization across server action boundary
    const base64Buffer = Buffer.from(docxBuffer).toString('base64');

    return {
      success: true,
      data: {
        docxBuffer: base64Buffer,
        fileName: outputFileName,
        paragraphCount,
        chapterCount,
        characterCount: text.length
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to convert TXT to DOCX'
    };
  }
}
