// lib/toolsInternal.ts - Internal tool functions (not exposed as public API)
// Only callable from within the app, never accessible from outside

// import { getServerSession } from 'next-auth';
// import { authOptions } from '@proselenosebooks/auth-core/lib/auth';

// Read timeout from env var (server-side) - must be set in .env.local
const TOOL_TIMEOUT_MS = parseInt(process.env['TOOL_TIMEOUT_MS']!, 10);

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
  timeoutMs?: number;
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

import { getToolPrompt } from './tool-storage';
import { streamAIInternal } from './aiInternal';

/**
 * Internal function to get all available tools - NOT a public API endpoint
 * @returns List of available tools with metadata
 */
export async function getAvailableToolsInternal(): Promise<ToolListResponse> {
  try {
    // This is a compatibility stub - the client should use fastInitServer data
    const { fastInitForUser } = require('@/lib/fastInitServer');
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

    // Create abort signal with timeout from env var
    const timeoutSignal = AbortSignal.timeout(TOOL_TIMEOUT_MS);

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

    // Execute via AI service with abort signal
    const result = await streamAIInternal(
      fullPrompt,
      manuscript,
      {
        temperature: options.temperature || 0.3,
        includeMetadata: options.includeMetadata || false,
        signal: timeoutSignal,
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

    // Check for timeout abort
    if (error instanceof Error &&
        (error.message.includes('TOOL_TIMEOUT_ABORTED') ||
         error.name === 'TimeoutError' ||
         error.message?.toLowerCase().includes('abort'))) {
      console.log(`Tool execution timed out: ${toolId}`);
      return {
        success: false,
        toolId,
        error: 'TOOL_TIMEOUT',
        executionTime,
        timeoutMs: TOOL_TIMEOUT_MS
      };
    }

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
 * @returns Sync result indicating if prompts were copied
 */
export async function initializeToolsInternal(): Promise<ToolPromptSyncResult> {
  try {
    console.log('Tools already initialized');
    return {
      success: true,
      syncedCount: 0,
      message: 'Tools already initialized'
    };
  } catch (error) {
    console.error('Internal tool initialization error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown initialization error'
    };
  }
}

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