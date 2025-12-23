// lib/docx-processing-utils.ts
// Client-side DOCX comments extraction for local-first operation
// Adapted from docx-comments-actions.ts for browser environment

import JSZip from 'jszip';
import * as mammoth from 'mammoth';

interface CommentData {
  id: string;
  author: string;
  date: string;
  text: string;
  referencedText: string;
}

interface ExtractionResult {
  comments: CommentData[];
  documentContent: string;
}

/**
 * Extract comments from a DOCX file and return formatted text
 */
export async function extractDocxComments(buffer: ArrayBuffer): Promise<{ content: string; commentCount: number }> {
  const extractionResult = await extractComments(buffer);

  if (extractionResult.comments.length === 0) {
    const content = `No comments found in the document.

=== DOCUMENT CONTENT ===

${cleanupText(extractionResult.documentContent)}`;

    return { content, commentCount: 0 };
  }

  const content = generateFormattedOutput(extractionResult);
  return { content, commentCount: extractionResult.comments.length };
}

/**
 * Extract comments from DOCX buffer
 */
async function extractComments(buffer: ArrayBuffer): Promise<ExtractionResult> {
  const zip = await JSZip.loadAsync(buffer);

  // Extract comments.xml and document.xml
  const commentsFile = zip.file('word/comments.xml');
  const documentFile = zip.file('word/document.xml');

  let commentsFromXml: CommentData[] = [];
  let commentRefs: Record<string, string> = {};

  if (commentsFile && documentFile) {
    const commentsXml = await commentsFile.async('string');
    const documentXml = await documentFile.async('string');

    // Extract comments from XML
    commentsFromXml = extractCommentsFromXml(commentsXml);

    // Extract comment references from document XML
    commentRefs = extractCommentReferences(documentXml);

    // Merge referenced text with comments
    commentsFromXml = commentsFromXml.map(comment => ({
      ...comment,
      referencedText: commentRefs[comment.id] || ''
    }));
  }

  // Use mammoth to get document content
  const documentContent = await mammoth.extractRawText({ arrayBuffer: buffer });

  // If no XML comments found, try HTML extraction as backup
  if (commentsFromXml.length === 0) {
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer: buffer });
    const commentsFromHtml = extractCommentsFromHtml(htmlResult.value);
    if (commentsFromHtml.length > 0) {
      commentsFromXml = commentsFromHtml;
    }
  }

  return {
    comments: commentsFromXml,
    documentContent: documentContent.value
  };
}

/**
 * Extract comments from comments.xml using browser's native DOMParser
 */
function extractCommentsFromXml(commentsXml: string): CommentData[] {
  const parser = new DOMParser();
  const commentsDoc = parser.parseFromString(commentsXml, 'application/xml');

  // Word namespace
  const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

  // Find all comment nodes using getElementsByTagNameNS
  const commentNodes = commentsDoc.getElementsByTagNameNS(W_NS, 'comment');
  const comments: CommentData[] = [];

  for (let i = 0; i < commentNodes.length; i++) {
    const node = commentNodes[i];
    if (!node) continue;

    const id = node.getAttributeNS(W_NS, 'id') || node.getAttribute('w:id') || '';
    const author = node.getAttributeNS(W_NS, 'author') || node.getAttribute('w:author') || 'Unknown';
    const date = node.getAttributeNS(W_NS, 'date') || node.getAttribute('w:date') || '';

    // Extract the comment text from w:t elements
    const textNodes = node.getElementsByTagNameNS(W_NS, 't');
    let commentText = '';

    for (let j = 0; j < textNodes.length; j++) {
      commentText += textNodes[j]?.textContent || '';
    }

    comments.push({
      id,
      author,
      date,
      text: commentText.trim(),
      referencedText: ''
    });
  }

  return comments;
}

/**
 * Extract comment references from document.xml
 */
function extractCommentReferences(documentXml: string): Record<string, string> {
  const parser = new DOMParser();
  const docXmlDoc = parser.parseFromString(documentXml, 'application/xml');

  const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const commentRefs: Record<string, string> = {};

  // Look for paragraphs with comment ranges
  const paragraphs = docXmlDoc.getElementsByTagNameNS(W_NS, 'p');

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    if (!paragraph) continue;

    // Get the text content of the paragraph
    const textNodes = paragraph.getElementsByTagNameNS(W_NS, 't');
    let textContent = '';
    for (let j = 0; j < textNodes.length; j++) {
      textContent += textNodes[j]?.textContent || '';
    }
    textContent = textContent.trim();

    // Look for comment range starts
    const commentRangeStarts = paragraph.getElementsByTagNameNS(W_NS, 'commentRangeStart');
    for (let j = 0; j < commentRangeStarts.length; j++) {
      const startNode = commentRangeStarts[j];
      const commentId = startNode?.getAttributeNS(W_NS, 'id') || startNode?.getAttribute('w:id');
      if (commentId && textContent) {
        commentRefs[commentId] = textContent;
      }
    }

    // Look for simple comment references
    const commentRefNodes = paragraph.getElementsByTagNameNS(W_NS, 'commentReference');
    for (let j = 0; j < commentRefNodes.length; j++) {
      const refNode = commentRefNodes[j];
      const commentId = refNode?.getAttributeNS(W_NS, 'id') || refNode?.getAttribute('w:id');
      if (commentId && !commentRefs[commentId] && textContent) {
        commentRefs[commentId] = textContent;
      }
    }
  }

  return commentRefs;
}

/**
 * Extract comments from HTML content (backup method)
 */
function extractCommentsFromHtml(html: string): CommentData[] {
  const commentRegex = /<!--([\s\S]*?)-->/g;
  const comments: CommentData[] = [];

  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = commentRegex.exec(html)) !== null) {
    const commentText = match[1]?.trim();
    if (!commentText) continue;

    // Look 200 chars around the comment to extract nearby context
    const start = Math.max(0, match.index - 200);
    const end = Math.min(html.length, match.index + match[0].length + 200);
    const context = html.substring(start, end);

    // Remove HTML tags to get plain text
    const contextText = context.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    comments.push({
      id: `html-${index++}`,
      author: 'Unknown',
      date: '',
      text: commentText,
      referencedText: contextText
    });
  }

  return comments;
}

/**
 * Clean up text by replacing special characters
 */
function cleanupText(text: string): string {
  if (!text) return '';

  // Replace non-breaking spaces with regular spaces
  let cleaned = text.replace(/\u00A0/g, ' ');

  // Replace multiple spaces with a single space
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Trim leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Generate formatted output with comments paired with referenced text
 */
function generateFormattedOutput(extractionResult: ExtractionResult): string {
  const timestamp = new Date().toISOString();
  const { comments } = extractionResult;

  let formattedOutput = `DOCX COMMENTS EXTRACTION

Extracted: ${timestamp}

Comments Found: ${comments.length}

`;

  comments.forEach((comment) => {
    if (comment.referencedText && comment.referencedText.trim()) {
      const cleanedText = cleanupText(comment.referencedText);
      formattedOutput += `original text:\n${cleanedText}\n\n`;
    }

    if (comment.text && comment.text.trim()) {
      const cleanedComment = cleanupText(comment.text);
      formattedOutput += `comment:\n${cleanedComment}\n`;

      // Add author and date if available
      if (comment.author && comment.author !== 'Unknown') {
        formattedOutput += `author: ${comment.author}\n`;
      }
      if (comment.date) {
        formattedOutput += `date: ${comment.date}\n`;
      }
    }

    formattedOutput += `\n---\n\n`;
  });

  return formattedOutput;
}
