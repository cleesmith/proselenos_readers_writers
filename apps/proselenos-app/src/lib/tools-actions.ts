'use server';

// lib/tools-actions.ts
// Server Actions for tools operations
import { getAvailableToolsInternal, executeToolInternal, initializeToolsInternal } from './toolsInternal';
import { getToolPromptFromGitHub, updateToolPromptInGitHub } from './github-tool-actions';
import type { ToolExecutionResult } from './toolsInternal';
// import { getServerSession } from 'next-auth';
// import { authOptions } from '@proselenosebooks/auth-core/lib/auth';


// Server action to initialize tool system
export async function getToolsAction(): Promise<{
  success: boolean;
  tools?: any[];
  error?: string;
}> {
  try {
    // First initialize the tool system (this does the copy if needed)
    const initResult = await initializeToolsInternal();
    
    if (!initResult.success) {
      return {
        success: false,
        error: initResult.message || 'Tool initialization failed'
      };
    }

    // If tools were just copied or already exist, get the tools list
    // This should be fast since we know tools are ready
    const result = await getAvailableToolsInternal();
    return result;
  } catch (error) {
    console.error('Error in getToolsAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Server action to get available tools (fast, assumes tools are already initialized)
export async function getAvailableToolsAction(): Promise<{
  success: boolean;
  tools?: any[];
  error?: string;
}> {
  // console.time('getAvailableTools-total');
  try {
    const result = await getAvailableToolsInternal();
    // console.timeEnd('getAvailableTools-total');
    return result;
  } catch (error) {
    // console.timeEnd('getAvailableTools-total');
    console.error('Error in getAvailableToolsAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Server action to execute a tool
export async function executeToolAction(
  toolId: string,
  manuscriptContent: string
): Promise<ToolExecutionResult> {
  try {
    // ============== FAKE TEST ===============
    // Simulate Vercel 504 timeout after 5 seconds - REMOVE AFTER TESTING
    // await new Promise((_, reject) =>
    //   setTimeout(() => reject(new Error('An unexpected response was received from the server.')), 5000)
    // );
    // ============== FAKE TEST ===============

    const result = await executeToolInternal(toolId, manuscriptContent);
    return result;
  } catch (error) {
    console.error('Error in executeToolAction:', error);
    return {
      success: false,
      toolId,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: 0
    };
  }
}

// Server action to get tool prompt content
export async function getToolPromptAction(toolId: string): Promise<{
  success: boolean;
  content?: string;
  fileId?: string;
  error?: string;
}> {
  try {
    const result = await getToolPromptFromGitHub(toolId);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      content: result.content,
      fileId: `tool-prompts/${toolId}`  // Full path for correct save location
    };
  } catch (error: any) {
    return { success: false, error: error.message ?? 'Failed to load prompt from GitHub' };
  }
}

// Server action to update tool prompt content
export async function updateToolPromptAction(toolId: string, content: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const result = await updateToolPromptInGitHub(toolId, content);
    return result;
  } catch (error: any) {
    return { success: false, error: error.message ?? 'Failed to update prompt in GitHub' };
  }
}
