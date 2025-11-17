// lib/github-tool-actions.ts
// Server actions for reading/writing tool prompts from GitHub repos

'use server'

import { downloadFile, uploadFile } from './github-storage';
import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';

export interface ToolActionResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Read a single tool prompt from GitHub
 * @param toolId - Format: "category/toolname.txt" (e.g., "Other Editing Tools/Drunken.txt")
 */
export async function getToolPromptFromGitHub(toolId: string): Promise<ToolActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const filePath = `tool-prompts/${toolId}`;
    const { content } = await downloadFile(
      session.user.id,
      'proselenos',
      filePath
    );

    const textContent = new TextDecoder('utf-8').decode(content);
    return { success: true, content: textContent };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Update a single tool prompt in GitHub
 * @param toolId - Format: "category/toolname.txt"
 * @param content - New tool prompt content
 */
export async function updateToolPromptInGitHub(toolId: string, content: string): Promise<ToolActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const filePath = `tool-prompts/${toolId}`;
    await uploadFile(
      session.user.id,
      'proselenos',
      filePath,
      content,
      `Update tool prompt: ${toolId}`
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
