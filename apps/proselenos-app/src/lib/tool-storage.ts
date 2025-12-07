// lib/tool-storage.ts
// Supabase-based tool prompt operations

'use server';

import { supabase, isSupabaseConfigured, getSupabaseUserByGoogleId } from './supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';

interface ExtendedSession {
  user: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
  };
}

export interface ToolActionResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Get user's UUID from google_id
 */
async function getUserId(googleId: string): Promise<string | null> {
  const user = await getSupabaseUserByGoogleId(googleId);
  return user?.id || null;
}

/**
 * Parse toolId into category and tool_name
 * Format: "category/toolname.txt" -> { category: "category", toolName: "toolname" }
 */
function parseToolId(toolId: string): { category: string; toolName: string } {
  // Remove .txt extension if present
  const withoutExt = toolId.replace(/\.txt$/, '');
  const parts = withoutExt.split('/');

  if (parts.length >= 2) {
    const category = parts[0] || 'Other';
    const toolName = parts[1] || withoutExt;
    return { category, toolName };
  }

  // Fallback: treat whole thing as tool name
  return { category: 'Other', toolName: withoutExt };
}

/**
 * Get a tool prompt from Supabase
 * Falls back to default_tool_prompts if user hasn't customized it
 */
export async function getToolPrompt(toolId: string): Promise<ToolActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase not configured' };
    }

    const userId = await getUserId(session.user.id);
    if (!userId) {
      return { success: false, error: 'User not found' };
    }

    const { category, toolName } = parseToolId(toolId);

    // First try user's customized prompt
    const { data: userPrompt, error: userError } = await supabase!
      .from('tool_prompts')
      .select('content')
      .eq('user_id', userId)
      .eq('category', category)
      .eq('tool_name', toolName)
      .single();

    if (userPrompt && !userError) {
      return { success: true, content: userPrompt.content };
    }

    // Fall back to default prompt
    const { data: defaultPrompt, error: defaultError } = await supabase!
      .from('default_tool_prompts')
      .select('content')
      .eq('category', category)
      .eq('tool_name', toolName)
      .single();

    if (defaultPrompt && !defaultError) {
      return { success: true, content: defaultPrompt.content };
    }

    return { success: false, error: `Tool prompt not found: ${toolId}` };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Update a tool prompt in Supabase (creates user copy if first edit)
 */
export async function updateToolPrompt(toolId: string, content: string): Promise<ToolActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase not configured' };
    }

    const userId = await getUserId(session.user.id);
    if (!userId) {
      return { success: false, error: 'User not found' };
    }

    const { category, toolName } = parseToolId(toolId);

    // Upsert the user's prompt
    const { error } = await supabase!
      .from('tool_prompts')
      .upsert(
        {
          user_id: userId,
          category,
          tool_name: toolName,
          content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,category,tool_name' }
      );

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * List all tool categories and tools available to a user
 * Returns both defaults and user customizations
 */
export async function listToolPrompts(): Promise<{
  success: boolean;
  tools?: Array<{ category: string; toolName: string; isCustomized: boolean }>;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase not configured' };
    }

    const userId = await getUserId(session.user.id);
    if (!userId) {
      return { success: false, error: 'User not found' };
    }

    // Get all default prompts
    const { data: defaults, error: defaultError } = await supabase!
      .from('default_tool_prompts')
      .select('category, tool_name')
      .order('category')
      .order('tool_name');

    if (defaultError) {
      return { success: false, error: defaultError.message };
    }

    // Get user's customized prompts
    const { data: userPrompts, error: userError } = await supabase!
      .from('tool_prompts')
      .select('category, tool_name')
      .eq('user_id', userId);

    if (userError) {
      return { success: false, error: userError.message };
    }

    // Create set of customized tools for quick lookup
    const customizedSet = new Set(
      (userPrompts || []).map(p => `${p.category}/${p.tool_name}`)
    );

    // Combine into result
    const tools = (defaults || []).map(d => ({
      category: d.category,
      toolName: d.tool_name,
      isCustomized: customizedSet.has(`${d.category}/${d.tool_name}`)
    }));

    return { success: true, tools };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Seed user's tool prompts from defaults (copy all defaults to user's prompts)
 * Only copies prompts that don't already exist for the user
 */
export async function seedUserToolPrompts(googleId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase not configured' };
    }

    const userId = await getUserId(googleId);
    if (!userId) {
      return { success: false, error: 'User not found' };
    }

    // Get all default prompts
    const { data: defaults, error: defaultError } = await supabase!
      .from('default_tool_prompts')
      .select('category, tool_name, content');

    if (defaultError || !defaults) {
      return { success: false, error: defaultError?.message || 'Failed to get defaults' };
    }

    // Get existing user prompts
    const { data: existing } = await supabase!
      .from('tool_prompts')
      .select('category, tool_name')
      .eq('user_id', userId);

    const existingSet = new Set(
      (existing || []).map(p => `${p.category}/${p.tool_name}`)
    );

    // Filter to only prompts that don't exist for user
    const toInsert = defaults
      .filter(d => !existingSet.has(`${d.category}/${d.tool_name}`))
      .map(d => ({
        user_id: userId,
        category: d.category,
        tool_name: d.tool_name,
        content: d.content,
      }));

    if (toInsert.length === 0) {
      return { success: true }; // Nothing to seed
    }

    const { error: insertError } = await supabase!
      .from('tool_prompts')
      .insert(toInsert);

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
