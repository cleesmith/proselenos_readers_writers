// lib/project-actions.ts
// Project operations with auth wrapper

'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { ProjectMetadata } from '@/app/projects/ProjectSettingsModal';
import {
  listProjects,
  createProject,
  selectProject,
  getProjectByName,
  listProjectFiles,
  uploadFileToProject,
  downloadFile as supabaseDownloadFile,
  readTextFile,
  deleteProjectFile,
  checkFilesExist,
} from './project-storage';

interface ExtendedSession {
  user: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
  };
  accessToken?: string;
}

type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

/**
 * List all projects from Supabase
 */
export async function listProjectsAction(): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const projects = await listProjects(session.user.id);

    // Transform to match expected format
    const formattedProjects = projects.map(p => ({
      name: p.name,
      id: p.id,
      mimeType: 'folder'
    }));

    return {
      success: true,
      data: {
        files: formattedProjects,
        currentFolder: { name: 'Projects', id: 'root' },
        rootFolder: { name: 'Projects', id: 'root' }
      },
      message: `Found ${projects.length} projects`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to list projects'
    };
  }
}

/**
 * Create a new project in Supabase
 */
export async function createProjectAction(projectName: string): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!projectName || !projectName.trim()) {
      return { success: false, error: 'Project name is required' };
    }

    const project = await createProject(session.user.id, projectName);

    return {
      success: true,
      data: {
        folderId: project.id,
        folderName: project.name
      },
      message: `Project created: ${project.name}`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to create project'
    };
  }
}

/**
 * Select a project (save to config)
 */
export async function selectProjectAction(projectName: string, projectId?: string): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    // If no projectId provided, look it up by name
    let id = projectId;
    if (!id) {
      const project = await getProjectByName(session.user.id, projectName);
      id = project?.id || projectName;
    }

    await selectProject(session.user.id, projectName, id);

    return {
      success: true,
      message: 'Project selected successfully'
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to select project'
    };
  }
}

/**
 * List files within a specific project folder
 */
export async function listProjectFilesAction(projectName: string): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    const files = await listProjectFiles(session.user.id, projectName);

    // Transform to match expected format
    const formattedFiles = files.map(file => ({
      id: file.id,
      name: file.name,
      path: `${projectName}/${file.name}`,
      mimeType: file.name.endsWith('.txt') ? 'text/plain' :
                file.name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                file.name.endsWith('.epub') ? 'application/epub+zip' :
                file.name.endsWith('.html') ? 'text/html' :
                'application/octet-stream'
    }));

    return {
      success: true,
      data: {
        files: formattedFiles,
        currentFolder: { name: projectName, id: projectName },
        rootFolder: { name: 'Projects', id: 'root' }
      },
      message: `Found ${files.length} files in ${projectName}`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to list project files'
    };
  }
}

/**
 * Create or update a file in a project folder
 * Uses Supabase storage (upsert)
 */
export async function createOrUpdateFileAction(
  projectName: string,
  fileName: string,
  content: string,
  existingFilePath?: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!projectName || !fileName) {
      return { success: false, error: 'Project name and file name are required' };
    }

    await uploadFileToProject(session.user.id, projectName, fileName, content);

    const filePath = existingFilePath || `${projectName}/${fileName}`;
    return {
      success: true,
      data: { filePath, fileName },
      message: existingFilePath ? 'File updated' : 'File created'
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to save file'
    };
  }
}

/**
 * Read a text file from a project folder
 */
export async function readFileAction(
  projectName: string,
  filePath: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!projectName || !filePath) {
      return { success: false, error: 'Project name and file path are required' };
    }

    // Extract filename from path (e.g., "ProjectName/file.txt" -> "file.txt")
    const fileName = filePath.includes('/') ? filePath.split('/').pop()! : filePath;
    const textContent = await readTextFile(session.user.id, projectName, fileName);

    return {
      success: true,
      data: { content: textContent },
      message: 'File read successfully'
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to read file'
    };
  }
}

/**
 * List only TXT files in a project folder
 */
export async function listTxtFilesAction(projectName: string): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    const files = await listProjectFiles(session.user.id, projectName);

    // Filter for .txt files only
    const txtFiles = files
      .filter(file => file.name.toLowerCase().endsWith('.txt'))
      .map(file => ({
        id: file.id,
        name: file.name,
        path: `${projectName}/${file.name}`,
        mimeType: 'text/plain'
      }));

    return {
      success: true,
      data: {
        files: txtFiles,
        currentFolder: { name: projectName, id: projectName },
        rootFolder: { name: 'Projects', id: 'root' }
      },
      message: `Found ${txtFiles.length} text files in ${projectName}`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to list text files'
    };
  }
}

/**
 * List only EPUB files in a project folder
 */
export async function listEpubFilesAction(projectName: string): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    const files = await listProjectFiles(session.user.id, projectName);

    // Filter for .epub files only
    const epubFiles = files
      .filter(file => file.name.toLowerCase().endsWith('.epub'))
      .map(file => ({
        id: file.id,
        name: file.name,
        path: `${projectName}/${file.name}`,
        mimeType: 'application/epub+zip'
      }));

    return {
      success: true,
      data: {
        files: epubFiles,
        currentFolder: { name: projectName, id: projectName },
        rootFolder: { name: 'Projects', id: 'root' }
      },
      message: `Found ${epubFiles.length} EPUB files in ${projectName}`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to list EPUB files'
    };
  }
}

/**
 * Upload a file to a project folder (supports txt, docx, epub, pdf)
 */
export async function uploadFileToProjectAction(
  file: File,
  projectName: string,
  customFileName?: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!file || !projectName) {
      return { success: false, error: 'File and project name are required' };
    }

    // Validate file type
    const allowedExtensions = ['.docx', '.txt', '.html', '.epub'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
      return { success: false, error: 'Only .txt, .html, .docx, and .epub files are allowed' };
    }

    // Use custom filename if provided, otherwise use original file name
    const finalFileName = customFileName?.trim() || file.name;
    const arrayBuffer = await file.arrayBuffer();

    await uploadFileToProject(session.user.id, projectName, finalFileName, arrayBuffer);

    return {
      success: true,
      data: {
        fileName: finalFileName,
        filePath: `${projectName}/${finalFileName}`,
        size: file.size
      },
      message: `File uploaded successfully: ${finalFileName}`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to upload file'
    };
  }
}

/**
 * Check if manuscript output files exist in a project folder
 * Used by Publishing Assistant to determine file states
 */
export async function checkManuscriptFilesExistAction(projectName: string): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    const exists = await checkFilesExist(session.user.id, projectName, [
      'manuscript.html',
      'manuscript.epub'
    ]);

    return {
      success: true,
      data: {
        html: exists['manuscript.html'],
        epub: exists['manuscript.epub']
      },
      message: 'File existence check completed'
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to check manuscript files'
    };
  }
}

/**
 * Delete a manuscript output file from a project folder
 * Used by Publishing Assistant before regenerating files
 */
export async function deleteManuscriptOutputAction(
  projectName: string,
  fileType: 'html' | 'epub'
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!projectName || !fileType) {
      return { success: false, error: 'Project name and file type are required' };
    }

    const fileName = `manuscript.${fileType}`;

    try {
      await deleteProjectFile(session.user.id, projectName, fileName);
    } catch {
      // File might not exist, that's OK
    }

    return {
      success: true,
      message: `File deleted: ${fileName}`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to delete manuscript output'
    };
  }
}

/**
 * Load book metadata from project
 * Reads book-metadata.json file from project folder
 */
export async function loadBookMetadataAction(
  projectName: string
): Promise<ActionResult<ProjectMetadata>> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    // Try to read existing metadata file
    try {
      const jsonText = await readTextFile(session.user.id, projectName, 'book-metadata.json');
      const metadata = JSON.parse(jsonText);

      return {
        success: true,
        data: metadata,
        message: 'Book metadata loaded successfully'
      };
    } catch {
      // File doesn't exist - return empty metadata
      const defaultMetadata: ProjectMetadata = {
        title: '',
        author: '',
        publisher: '',
        buyUrl: '',
        aboutAuthor: ''
      };

      return {
        success: true,
        data: defaultMetadata,
        message: 'No metadata file found, using defaults'
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to load book metadata'
    };
  }
}

/**
 * Save book metadata to project
 * Writes book-metadata.json file to project folder
 */
export async function saveBookMetadataAction(
  projectName: string,
  metadata: ProjectMetadata
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    // Convert metadata to pretty-printed JSON
    const jsonContent = JSON.stringify(metadata, null, 2);

    await uploadFileToProject(session.user.id, projectName, 'book-metadata.json', jsonContent);

    return {
      success: true,
      message: 'Book metadata saved successfully'
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to save book metadata'
    };
  }
}

/**
 * Download a file from a project for browser download
 * Returns base64-encoded content for client-side download
 */
export async function downloadFileForBrowserAction(
  projectName: string,
  filePath: string
): Promise<ActionResult<{ content: string; filename: string }>> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!projectName || !filePath) {
      return { success: false, error: 'Project name and file path are required' };
    }

    // Extract filename from path
    const fileName = filePath.includes('/') ? filePath.split('/').pop()! : filePath;
    const content = await supabaseDownloadFile(session.user.id, projectName, fileName);

    // Convert ArrayBuffer to base64 for transfer to client
    const base64Content = Buffer.from(content).toString('base64');

    return {
      success: true,
      data: {
        content: base64Content,
        filename: fileName
      },
      message: 'File downloaded successfully'
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to download file'
    };
  }
}

/**
 * Delete a file from a project folder
 */
export async function deleteProjectFileAction(
  projectName: string,
  filePath: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!projectName || !filePath) {
      return { success: false, error: 'Project name and file path are required' };
    }

    // Extract filename from path
    const fileName = filePath.includes('/') ? filePath.split('/').pop()! : filePath;
    await deleteProjectFile(session.user.id, projectName, fileName);

    return {
      success: true,
      message: `File deleted: ${filePath}`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to delete file'
    };
  }
}
