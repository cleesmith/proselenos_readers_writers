// lib/supabase-project-actions.ts
// Supabase-based project operations (replaces GitHub storage)

'use server';

import { supabase, isSupabaseConfigured, getSupabaseUserByGoogleId } from './supabase';
import { updateCurrentProject as updateConfigCurrentProject } from './supabase-config-actions';

export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get user's UUID from google_id
 */
async function getUserId(googleId: string): Promise<string | null> {
  const user = await getSupabaseUserByGoogleId(googleId);
  return user?.id || null;
}

/**
 * List all projects for a user
 */
export async function listProjects(googleId: string): Promise<Project[]> {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, returning empty projects');
    return [];
  }

  const userId = await getUserId(googleId);
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase!
    .from('projects')
    .select('id, name, created_at, updated_at')
    .eq('user_id', userId)
    .order('name');

  if (error) {
    throw new Error(`Failed to list projects: ${error.message}`);
  }

  return data || [];
}

/**
 * Create a new project
 */
export async function createProject(googleId: string, projectName: string): Promise<Project> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const userId = await getUserId(googleId);
  if (!userId) {
    throw new Error('User not found in Supabase');
  }

  const cleanName = projectName.trim();
  if (!cleanName) {
    throw new Error('Project name is required');
  }

  // Insert project into database
  const { data, error } = await supabase!
    .from('projects')
    .insert({
      user_id: userId,
      name: cleanName,
    })
    .select('id, name, created_at, updated_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Project "${cleanName}" already exists`);
    }
    throw new Error(`Failed to create project: ${error.message}`);
  }

  // Auto-select the new project
  await updateConfigCurrentProject(googleId, cleanName, data.id);

  return data;
}

/**
 * Delete a project and all its files
 */
export async function deleteProject(googleId: string, projectId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const userId = await getUserId(googleId);
  if (!userId) {
    throw new Error('User not found in Supabase');
  }

  // Get project name for storage cleanup
  const { data: project, error: fetchError } = await supabase!
    .from('projects')
    .select('name')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !project) {
    throw new Error('Project not found');
  }

  // Delete all files in storage for this project
  const storagePath = `${googleId}/${project.name}`;
  const { data: files } = await supabase!.storage
    .from('author-files')
    .list(storagePath);

  if (files && files.length > 0) {
    const filePaths = files.map(f => `${storagePath}/${f.name}`);
    await supabase!.storage.from('author-files').remove(filePaths);
  }

  // Delete project from database (book_metadata will cascade delete)
  const { error: deleteError } = await supabase!
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId);

  if (deleteError) {
    throw new Error(`Failed to delete project: ${deleteError.message}`);
  }
}

/**
 * Select a project (update current_project in config)
 */
export async function selectProject(googleId: string, projectName: string, projectId: string): Promise<void> {
  await updateConfigCurrentProject(googleId, projectName, projectId);
}

/**
 * Get project by name
 */
export async function getProjectByName(googleId: string, projectName: string): Promise<Project | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const userId = await getUserId(googleId);
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase!
    .from('projects')
    .select('id, name, created_at, updated_at')
    .eq('user_id', userId)
    .eq('name', projectName)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

// ============================================
// FILE OPERATIONS (author-files bucket)
// ============================================

export interface ProjectFile {
  name: string;
  id: string;
  size: number;
  updated_at: string;
}

/**
 * List files in a project folder
 */
export async function listProjectFiles(googleId: string, projectName: string): Promise<ProjectFile[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const storagePath = `${googleId}/${projectName}`;
  const { data, error } = await supabase!.storage
    .from('author-files')
    .list(storagePath);

  if (error) {
    throw new Error(`Failed to list files: ${error.message}`);
  }

  // Filter out .emptyFolderPlaceholder if present
  return (data || [])
    .filter(f => f.name !== '.emptyFolderPlaceholder')
    .map(f => ({
      name: f.name,
      id: f.id || f.name,
      size: (f.metadata as Record<string, unknown>)?.['size'] as number || 0,
      updated_at: f.updated_at || '',
    }));
}

/**
 * Upload a file to a project
 */
export async function uploadFileToProject(
  googleId: string,
  projectName: string,
  fileName: string,
  content: ArrayBuffer | string
): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const storagePath = `${googleId}/${projectName}/${fileName}`;

  // Convert string to Uint8Array if needed
  const fileContent = typeof content === 'string'
    ? new TextEncoder().encode(content)
    : new Uint8Array(content);

  const { error } = await supabase!.storage
    .from('author-files')
    .upload(storagePath, fileContent, { upsert: true });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Download a file from a project (returns ArrayBuffer)
 */
export async function downloadFile(
  googleId: string,
  projectName: string,
  fileName: string
): Promise<ArrayBuffer> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const storagePath = `${googleId}/${projectName}/${fileName}`;
  const { data, error } = await supabase!.storage
    .from('author-files')
    .download(storagePath);

  if (error) {
    throw new Error(`Failed to download file: ${error.message}`);
  }

  return await data.arrayBuffer();
}

/**
 * Read a text file from a project (returns string)
 */
export async function readTextFile(
  googleId: string,
  projectName: string,
  fileName: string
): Promise<string> {
  const content = await downloadFile(googleId, projectName, fileName);
  return new TextDecoder('utf-8').decode(content);
}

/**
 * Delete a file from a project
 */
export async function deleteProjectFile(
  googleId: string,
  projectName: string,
  fileName: string
): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const storagePath = `${googleId}/${projectName}/${fileName}`;
  const { error } = await supabase!.storage
    .from('author-files')
    .remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Check if specific files exist in a project
 */
export async function checkFilesExist(
  googleId: string,
  projectName: string,
  fileNames: string[]
): Promise<Record<string, boolean>> {
  if (!isSupabaseConfigured()) {
    return Object.fromEntries(fileNames.map(f => [f, false]));
  }

  const files = await listProjectFiles(googleId, projectName);
  const fileSet = new Set(files.map(f => f.name));

  return Object.fromEntries(
    fileNames.map(name => [name, fileSet.has(name)])
  );
}

// ============================================
// DIRECT UPLOAD (signed URLs for large files)
// ============================================

interface SignedUploadUrlResult {
  success: boolean;
  signedUrl?: string;
  path?: string;
  token?: string;
  error?: string;
}

/**
 * Create a signed upload URL for direct client-to-Supabase upload.
 * Bypasses Vercel's 4.5MB serverless function limit.
 *
 * @param googleId - User's Google ID
 * @param projectName - Project folder name
 * @param fileName - File name to upload
 */
export async function createSignedUploadUrlForProject(
  googleId: string,
  projectName: string,
  fileName: string
): Promise<SignedUploadUrlResult> {
  console.log(`[createSignedUploadUrlForProject] Generating signed URL for "${fileName}"...`);

  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const storagePath = `${googleId}/${projectName}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('author-files')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error('Failed to create signed URL:', error);
      return { success: false, error: `Failed to create upload URL: ${error?.message}` };
    }

    return {
      success: true,
      signedUrl: data.signedUrl,
      path: data.path,
      token: data.token,
    };
  } catch (error) {
    console.error('Error creating signed upload URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
