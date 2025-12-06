// lib/toolsInternal.ts - Internal tool functions (not exposed as public API)
// Only callable from within the app, never accessible from outside

// import { getServerSession } from 'next-auth';
// import { authOptions } from '@proselenosebooks/auth-core/lib/auth';

// Type definitions
export type ToolCategory = string;

export interface ToolExecutionOptions {
  additionalContext?: string;
  temperature?: number;
  includeMetadata?: boolean;
  [key: string]: any;
}

export interface ToolExecutionResult {
  success: boolean;
  toolId: string;
  result?: string;
  error?: string;
  executionTime: number;
  category?: ToolCategory;
  timestamp?: string;
  promptLength?: number;
  metadata?: any;
}

export interface ToolListResponse {
  success: boolean;
  tools?: any[];
  error?: string;
}

export interface ToolPromptSyncResult {
  success: boolean;
  content?: string;
  error?: string;
  syncedCount?: number;
  message?: string;
}

import { getToolPrompt } from './supabase-tool-actions';
import { streamAIInternal } from './aiInternal';

/**
 * Internal function to get all available tools - NOT a public API endpoint
 * Note: With GitHub storage, tools are loaded from fastInitServer
 * This function returns the tools from the GitHub repo structure
 * @returns List of available tools with metadata
 */
export async function getAvailableToolsInternal(): Promise<ToolListResponse> {
  try {
    // With GitHub, tools are already available via fastInitServer
    // This is a compatibility stub - the client should use fastInitServer data
    const { fastInitForUser } = require('@/lib/github/fastInitServer');
    const init = await fastInitForUser();

    // Convert toolsByCategory to flat tool list
    const tools: any[] = [];
    Object.entries(init.toolsByCategory).forEach(([category, categoryTools]: [string, any]) => {
      categoryTools.forEach((tool: any) => {
        tools.push({
          id: tool.id,
          name: tool.name,
          category: category
        });
      });
    });

    return {
      success: true,
      tools
    };
  } catch (error) {
    console.error('Internal tools list error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Internal function to execute a tool - NOT a public API endpoint
 * @param toolId - The tool to execute (format: "category/toolname.txt")
 * @param manuscript - The manuscript content
 * @param options - Optional execution parameters
 * @returns Tool execution result
 */
export async function executeToolInternal(
  toolId: string,
  manuscript: string,
  options: ToolExecutionOptions = {}
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    console.log(`Executing tool: ${toolId}`);

    // Read the tool prompt from Supabase
    const promptResult = await getToolPrompt(toolId);
    if (!promptResult.success || !promptResult.content) {
      return {
        success: false,
        toolId,
        error: promptResult.error || 'Failed to load tool prompt',
        executionTime: Date.now() - startTime
      };
    }

    const toolPrompt = promptResult.content;

    // Prepare the full prompt by combining tool prompt with any additional context
    let fullPrompt = toolPrompt;
    if (options.additionalContext) {
      fullPrompt += `\n\nAdditional Context:\n${options.additionalContext}`;
    }

    // Execute via AI service
    const result = await streamAIInternal(
      fullPrompt,
      manuscript,
      {
        temperature: options.temperature || 0.3,
        includeMetadata: options.includeMetadata || false,
        ...options
      }
    );

    const executionTime = Date.now() - startTime;

    console.log(`Tool execution completed: ${toolId}, success: true`);

    return {
      success: true,
      toolId,
      result,
      executionTime,
      metadata: {
        toolName: toolId.split('/')[1] || toolId,
        category: (toolId.split('/')[0] || 'Other Editing Tools') as ToolCategory,
        timestamp: new Date().toISOString(),
        promptLength: toolPrompt.length,
        manuscriptLength: manuscript.length,
        resultLength: result.length
      }
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`Tool execution error for ${toolId}:`, error);
    return {
      success: false,
      toolId,
      error: error instanceof Error ? error.message : 'Unknown execution error',
      executionTime
    };
  }
}

/**
 * Internal function to initialize tool system - NOT a public API endpoint
 * Note: With GitHub storage, tools are pre-initialized via template repo
 * This is a compatibility stub that always returns success
 * @returns Sync result indicating if prompts were copied
 */
export async function initializeToolsInternal(): Promise<ToolPromptSyncResult> {
  try {
    console.log('Tools already initialized via GitHub template repo');
    return {
      success: true,
      syncedCount: 0,
      message: 'Tools already initialized in GitHub repo'
    };
  } catch (error) {
    console.error('Internal tool initialization error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown initialization error'
    };
  }
}

// The following functions are no longer needed with GitHub storage

/*
export async function getToolsByCategoryInternal(category: string): Promise<ToolMetadata[]> {
  // Not needed - tools by category available via fastInitServer
  return [];
}

export async function getToolInfoInternal(toolId: string): Promise<ToolMetadata | null> {
  // Not needed - tool metadata available via fastInitServer
  return null;
}

export async function validateToolInternal(toolId: string): Promise<boolean> {
  // Not needed - validation happens during execution
  return false;
}

export async function getToolSyncStatusInternal(): Promise<{ hasToolPrompts: boolean; needsSync: boolean }> {
  // Not needed - GitHub tools are always in sync via repo
  return { hasToolPrompts: true, needsSync: false };
}

export async function forceSyncToolsInternal(): Promise<ToolPromptSyncResult> {
  // Not needed - GitHub repo is source of truth
  return { success: true, syncedCount: 0, message: 'No sync needed with GitHub' };
}
*/

/**
 * Internal function to get tool prompt content - NOT a public API endpoint
 * @param toolId - The tool ID (format: "category/toolname.txt")
 * @returns Tool prompt content or null if not found
 */
export async function getToolPromptInternal(toolId: string): Promise<string | null> {
  try {
    const result = await getToolPrompt(toolId);
    return result.success ? result.content || null : null;
  } catch (error) {
    console.error(`Internal get prompt error for ${toolId}:`, error);
    return null;
  }
}