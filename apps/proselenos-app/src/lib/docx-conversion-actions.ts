// lib/docx-conversion-actions.ts
// DOCX conversion - uses Supabase storage
//
// This module contains server actions for converting Microsoft Word documents
// (.docx) into plain text and saving to Supabase storage. The conversion
// uses the `mammoth` library, which extracts raw text and ignores formatting
// and embedded images.

"use server";

import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { uploadFileToProject, readTextFile } from './project-storage';

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
 * Convert DOCX file to TXT and save to project storage
 * User selects .docx from local computer → converts to text → .txt saved to storage
 * Note: The original .docx is not stored, only the resulting .txt
 */
export async function convertDocxToTxtAction(
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

    // Upload to Supabase storage
    await uploadFileToProject(userId, projectName, outputFileName, text);

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
 * Convert TXT file from project storage to DOCX and return as buffer
 * Reads TXT from storage → converts to proper DOCX → returns for download
 *
 * @param projectName The project folder name
 * @param txtFilePath The full path to the TXT file (e.g., "projectName/file.txt")
 * @param outputFileName The desired name for the output .docx file
 */
export async function convertTxtToDocxAction(
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

    // Extract project name and filename from path
    const parts = txtFilePath.split('/');
    const projectName = parts[0] || '';
    const fileName = parts.slice(1).join('/');

    // Download the TXT file from Supabase storage
    const text = await readTextFile(userId, projectName, fileName);

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
