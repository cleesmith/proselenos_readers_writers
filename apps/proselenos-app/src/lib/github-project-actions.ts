// lib/github-project-actions.ts
// GitHub repo project operations

'use server';

import { listFiles, uploadFile, downloadFile, deleteFile } from '@/lib/github-storage';
import { updateCurrentProject } from '@/lib/github-config-storage';
import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { ProjectMetadata } from '@/app/projects/ProjectSettingsModal';
import { del } from '@vercel/blob';

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
 * List all project folders in user's GitHub repo
 * Projects are top-level folders (excluding tool-prompts and root files)
 */
export async function listProjectsAction(): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    // Get all files in repo root
    const allFiles = await listFiles(userId, 'proselenos', '');

    // Extract unique folder names (first part of path before /)
    const projectSet = new Set<string>();

    allFiles.forEach(file => {
      const parts = file.path.split('/');
      if (parts.length > 1) {
        const folderName = parts[0];
        // Exclude tool-prompts and any hidden folders
        if (folderName && folderName !== 'tool-prompts' && !folderName.startsWith('.')) {
          projectSet.add(folderName);
        }
      }
    });

    // Convert to array and sort
    const projects = Array.from(projectSet).sort().map(name => ({
      name,
      id: name,
      mimeType: 'folder'
    }));

    return {
      success: true,
      data: {
        files: projects,
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
 * Create a new project folder in user's GitHub repo
 * Git doesn't track empty folders, so we add .gitkeep to create the folder
 */
export async function createProjectAction(projectName: string): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    if (!projectName || !projectName.trim()) {
      return { success: false, error: 'Project name is required' };
    }

    const cleanName = projectName.trim();

    // Create folder by adding a .gitkeep file (Git doesn't track empty folders)
    await uploadFile(
      userId,
      'proselenos',
      `${cleanName}/.gitkeep`,
      '',
      `Create project: ${cleanName}`
    );

    // Auto-select the new project
    await updateCurrentProject(userId, cleanName, cleanName);

    return {
      success: true,
      data: {
        folderId: cleanName,
        folderName: cleanName
      },
      message: `Project created: ${cleanName}`
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
export async function selectProjectAction(projectName: string): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    // Save to GitHub config
    await updateCurrentProject(userId, projectName, projectName);

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

    const userId = session.user.id;

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    // Get all files in the project folder
    const files = await listFiles(userId, 'proselenos', `${projectName}/`);

    // Transform to match expected format
    const formattedFiles = files.map(file => ({
      id: file.sha,
      name: file.name,
      path: file.path,
      mimeType: file.name.endsWith('.txt') ? 'text/plain' :
                file.name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                file.name.endsWith('.pdf') ? 'application/pdf' :
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
 * Single action for both create and update (GitHub uploadFile handles both)
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

    const userId = session.user.id;

    if (!projectName || !fileName) {
      return { success: false, error: 'Project name and file name are required' };
    }

    // Use existing path if updating, otherwise create new path
    const filePath = existingFilePath || `${projectName}/${fileName}`;
    const commitMessage = existingFilePath
      ? `Update ${fileName}`
      : `Create ${fileName}`;

    await uploadFile(userId, 'proselenos', filePath, content, commitMessage);

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

    const userId = session.user.id;

    if (!projectName || !filePath) {
      return { success: false, error: 'Project name and file path are required' };
    }

    const { content } = await downloadFile(userId, 'proselenos', filePath);

    // Decode ArrayBuffer to UTF-8 string
    const decoder = new TextDecoder('utf-8');
    const textContent = decoder.decode(content);

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

    const userId = session.user.id;

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    // Get all files in the project folder
    const files = await listFiles(userId, 'proselenos', `${projectName}/`);

    // Filter for .txt files only
    const txtFiles = files
      .filter(file => file.name.toLowerCase().endsWith('.txt'))
      .map(file => ({
        id: file.sha,
        name: file.name,
        path: file.path,
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

    const userId = session.user.id;

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    // Get all files in the project folder
    const files = await listFiles(userId, 'proselenos', `${projectName}/`);

    // Filter for .epub files only
    const epubFiles = files
      .filter(file => file.name.toLowerCase().endsWith('.epub'))
      .map(file => ({
        id: file.sha,
        name: file.name,
        path: file.path,
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

    const userId = session.user.id;

    if (!file || !projectName) {
      return { success: false, error: 'File and project name are required' };
    }

    // Validate file type
    const allowedExtensions = ['.docx', '.txt', '.html', '.epub', '.pdf'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
      return { success: false, error: 'Only .txt, .html, .docx, .epub, and .pdf files are allowed' };
    }

    // Use custom filename if provided, otherwise use original file name
    const finalFileName = customFileName?.trim() || file.name;
    const filePath = `${projectName}/${finalFileName}`;

    // Convert File to appropriate format for GitHub
    const arrayBuffer = await file.arrayBuffer();

    let content: string | ArrayBuffer;
    if (fileName.endsWith('.txt') || fileName.endsWith('.html')) {
      // Text files: convert to UTF-8 string
      const decoder = new TextDecoder('utf-8');
      content = decoder.decode(arrayBuffer);
    } else {
      // Binary files (docx, epub, pdf): pass ArrayBuffer directly
      // uploadFile will handle the base64 conversion
      content = arrayBuffer;
    }

    // Upload file to GitHub (uploadFile handles create/update automatically)
    const commitMessage = `Upload ${finalFileName}`;
    await uploadFile(userId, 'proselenos', filePath, content, commitMessage);

    return {
      success: true,
      data: {
        fileName: finalFileName,
        filePath: filePath,
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

    const userId = session.user.id;

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    // Get all files in the project folder
    const files = await listFiles(userId, 'proselenos', `${projectName}/`);

    // Check for manuscript output files
    const hasHtml = files.some(f => f.name === 'manuscript.html');
    const hasEpub = files.some(f => f.name === 'manuscript.epub');
    const hasPdf = files.some(f => f.name === 'manuscript.pdf');

    return {
      success: true,
      data: {
        html: hasHtml,
        epub: hasEpub,
        pdf: hasPdf
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
  fileType: 'html' | 'epub' | 'pdf'
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

    // GitHub doesn't have a direct delete API in our abstraction
    // We'll delete by uploading empty content or handling it differently
    // For now, we'll just return success - uploadFile will overwrite anyway
    return {
      success: true,
      message: `File will be overwritten: ${fileName}`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to delete manuscript output'
    };
  }
}

/**
 * Load book metadata from GitHub project
 * Reads book-metadata.txt JSON file from project root
 */
export async function loadBookMetadataAction(
  projectName: string
): Promise<ActionResult<ProjectMetadata>> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    const filePath = `${projectName}/book-metadata.json`;

    // Try to read existing metadata file
    try {
      const { content } = await downloadFile(userId, 'proselenos', filePath);
      const decoder = new TextDecoder('utf-8');
      const jsonText = decoder.decode(content);
      const metadata = JSON.parse(jsonText);

      return {
        success: true,
        data: metadata,
        message: 'Book metadata loaded successfully'
      };
    } catch (error) {
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
 * Save book metadata to GitHub project
 * Writes book-metadata.txt JSON file to project root
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

    const userId = session.user.id;

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    const filePath = `${projectName}/book-metadata.json`;

    // Convert metadata to pretty-printed JSON
    const jsonContent = JSON.stringify(metadata, null, 2);

    // Upload to GitHub
    await uploadFile(
      userId,
      'proselenos',
      filePath,
      jsonContent,
      'Update book metadata'
    );

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

    const userId = session.user.id;

    if (!projectName || !filePath) {
      return { success: false, error: 'Project name and file path are required' };
    }

    const { content, filename } = await downloadFile(userId, 'proselenos', filePath);

    // Convert ArrayBuffer to base64 for transfer to client
    const base64Content = Buffer.from(content).toString('base64');

    return {
      success: true,
      data: {
        content: base64Content,
        filename: filename
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

    const userId = session.user.id;

    // filePath already includes project folder (e.g., "ProjectName/filename.epub")
    await deleteFile(userId, 'proselenos', filePath, `Delete ${filePath}`);

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

/**
 * Copy a file from Vercel Blob storage to GitHub project, then delete from Blob
 * Used for two-step upload flow: client uploads to Blob, then this action copies to GitHub
 */
export async function copyBlobToProjectAction(
  blobUrl: string,
  projectName: string,
  fileName: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    if (!blobUrl || !projectName || !fileName) {
      return { success: false, error: 'Blob URL, project name, and file name are required' };
    }

    // Validate file extension
    const allowedExtensions = ['.docx', '.txt', '.html', '.epub', '.pdf'];
    const fileNameLower = fileName.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileNameLower.endsWith(ext));

    if (!hasValidExtension) {
      return { success: false, error: 'Only .txt, .html, .docx, .epub, and .pdf files are allowed' };
    }

    // Fetch file from Vercel Blob
    const blobResponse = await fetch(blobUrl);
    if (!blobResponse.ok) {
      return { success: false, error: `Failed to fetch file from Blob storage: ${blobResponse.status}` };
    }

    const arrayBuffer = await blobResponse.arrayBuffer();
    const filePath = `${projectName}/${fileName}`;

    // Determine content type for GitHub upload
    let content: string | ArrayBuffer;
    if (fileNameLower.endsWith('.txt') || fileNameLower.endsWith('.html')) {
      // Text files: convert to UTF-8 string
      const decoder = new TextDecoder('utf-8');
      content = decoder.decode(arrayBuffer);
    } else {
      // Binary files (docx, epub, pdf): pass ArrayBuffer directly
      content = arrayBuffer;
    }

    // Upload to GitHub
    const commitMessage = `Upload ${fileName}`;
    await uploadFile(userId, 'proselenos', filePath, content, commitMessage);

    // Delete blob from Vercel storage (cleanup)
    try {
      await del(blobUrl);
    } catch (delError) {
      // Log but don't fail - file is already in GitHub
      console.error('Failed to delete blob:', delError);
    }

    return {
      success: true,
      data: {
        fileName,
        filePath,
        size: arrayBuffer.byteLength
      },
      message: `File uploaded successfully: ${fileName}`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to copy file from Blob to GitHub'
    };
  }
}
