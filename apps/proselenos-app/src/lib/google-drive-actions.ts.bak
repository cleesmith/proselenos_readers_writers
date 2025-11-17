// lib/google-drive-actions.ts

'use server';

// Session is now passed as accessToken parameter
import { Readable } from 'stream';
import {
  getAuthClient,
  getDriveClient,
  ensureProselenosProjectsFolder,
  uploadManuscript,
  readTextFile,
  listFilesAndFolders,
  getFolderInfo,
  createProjectFolder,
  getproselenosConfig,
  updateCurrentProject,
  updateProviderAndModel,
  updateSelectedModel,
  validateCurrentProject,
  loadProjectMetadata,
  saveProjectMetadata,
  ProjectMetadata,
} from '@/lib/googleDrive';
import { installToolPrompts, checkToolPromptsInstallation } from '@/lib/tool-prompts-installer-server';

type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

async function getAuthenticatedClients(accessToken: string, rootFolderId: string) {
  if (!accessToken) {
    return { error: 'Not authenticated' };
  }

  if (!rootFolderId) {
    return { error: 'Root folder ID is required' };
  }

  const authClient = await getAuthClient(accessToken);
  const drive = await getDriveClient(authClient);
  
  // Use the provided root folder ID (already ensured to exist in fastInitServer)
  const rootFolder = { id: rootFolderId, name: 'proselenos_projects' };
  
  return {
    authClient,
    drive,
    rootFolder
  };
}

export async function listGoogleDriveFilesAction(accessToken: string, rootFolderId: string, folderId?: string): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken, rootFolderId);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { drive, rootFolder } = clients;
    const targetFolderId = folderId || rootFolder.id;
    const files = await listFilesAndFolders(drive, targetFolderId);
    
    // Get current folder info for breadcrumbs
    let currentFolder = { name: rootFolder.name, id: rootFolder.id };
    if (folderId && folderId !== rootFolder.id) {
      currentFolder = await getFolderInfo(drive, folderId);
    }
    
    return { 
      success: true, 
      data: {
        files,
        currentFolder,
        rootFolder
      },
      message: `Found ${files.length} items` 
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to list files' };
  }
}

export async function readGoogleDriveFileAction(
    accessToken: string,
    rootFolderId: string,
    fileId: string
  ): Promise<ActionResult> {
    try {
      const clients = await getAuthenticatedClients(accessToken, rootFolderId);
      if ('error' in clients) {
        return { success: false, error: clients.error };
      }

      const { drive } = clients;

      if (!fileId) {
        return { success: false, error: 'File ID is required' };
      }

      // Reject non-downloadable Google Workspace files
      const fileInfo = await drive.files.get({
        fileId,
        fields: 'mimeType'
      });
      const mimeType = fileInfo.data.mimeType || '';
      if (mimeType.startsWith('application/vnd.google-apps.')) {
        return {
          success: false,
          error:
            'Google Workspace files are not supported. Please export to a downloadable format (.txt file) and try again.'
        };
      }

      // Only support directly downloadable files
      const fileContent = await readTextFile(drive, fileId);

      return {
        success: true,
        data: { content: fileContent },
        message: 'File read successfully'
      };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to read file' };
    }
  }

export async function createGoogleDriveFileAction(accessToken: string, rootFolderId: string, content: string, fileName: string, folderId?: string): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken, rootFolderId);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { drive, rootFolder } = clients;
    const targetFolderId = folderId || rootFolder.id;
    const file = await uploadManuscript(
      drive, 
      content, 
      targetFolderId, 
      fileName
    );
    
    return { 
      success: true, 
      data: {
        fileId: file.id,
        fileName: file.name
      },
      message: 'File created successfully' 
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create file' };
  }
}

export async function updateGoogleDriveFileAction(accessToken: string, rootFolderId: string, fileId: string, content: string): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken, rootFolderId);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }
    
    const { drive } = clients;
    
    if (!fileId) {
      return { success: false, error: 'File ID is required' };
    }

    // Update the existing file using the Drive API
    const media = {
      mimeType: 'text/plain',
      body: content
    };

    const response = await drive.files.update({
      fileId: fileId,
      media: media,
      fields: 'id, name, modifiedTime'
    });

    return { 
      success: true, 
      data: {
        fileId: response.data.id,
        fileName: response.data.name,
        modifiedTime: response.data.modifiedTime
      },
      message: 'File updated successfully' 
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update file' };
  }
}

export async function createProjectFolderAction(accessToken: string, rootFolderId: string, folderName: string): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken, rootFolderId);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { drive, rootFolder } = clients;
    
    if (!folderName) {
      return { success: false, error: 'Folder name is required' };
    }

    const newFolder = await createProjectFolder(drive, folderName, rootFolder.id);
    
    // Auto-select the new project
    await updateCurrentProject(drive, rootFolder.id, folderName, newFolder.id);
    
    return { 
      success: true, 
      data: {
        folderId: newFolder.id,
        folderName: newFolder.name
      },
      message: 'Project folder created successfully' 
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create project folder' };
  }
}

export async function getproselenosConfigAction(accessToken: string, rootFolderId: string): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken, rootFolderId);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { rootFolder } = clients;
    const config = await getproselenosConfig(clients.drive, rootFolder.id);
    
    // Also check if tool-prompts folder exists
    const toolPromptsExists = await checkToolPromptsInstallation(
      accessToken,
      rootFolder.id
    );
    
    return { 
      success: true, 
      data: {
        config,
        toolPromptsExists
      },
      message: 'Config loaded successfully' 
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to get config' };
  }
}

export async function selectProjectAction(accessToken: string, rootFolderId: string, projectName: string, projectFolderId: string): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken, rootFolderId);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { drive, rootFolder } = clients;
    
    if (!projectName || !projectFolderId) {
      return { success: false, error: 'Project name and folder ID are required' };
    }

    await updateCurrentProject(drive, rootFolder.id, projectName, projectFolderId);
    
    return { 
      success: true, 
      message: 'Project selected successfully' 
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to select project' };
  }
}

export async function validateCurrentProjectAction(accessToken: string, rootFolderId: string): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken, rootFolderId);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { drive, rootFolder } = clients;
    const isValid = await validateCurrentProject(drive, rootFolder.id);
    
    return { 
      success: true, 
      data: { isValid },
      message: isValid ? 'Project is valid' : 'Project no longer exists' 
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to validate project' };
  }
}

export async function installToolPromptsAction(accessToken: string, rootFolderId: string): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken, rootFolderId);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { rootFolder } = clients;
    const result = await installToolPrompts(
      accessToken,
      rootFolder.id
    );
    
    return result;
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to install tool prompts' };
  }
}

export async function updateProviderAndModelAction(accessToken: string, rootFolderId: string, provider: string, model: string): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken, rootFolderId);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { rootFolder } = clients;
    await updateProviderAndModel(clients.drive, rootFolder.id, provider, model);
    
    return { success: true, message: 'Provider and model settings updated' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update provider and model settings' };
  }
}

export async function updateSelectedModelAction(accessToken: string, rootFolderId: string, model: string): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken, rootFolderId);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { rootFolder } = clients;
    await updateSelectedModel(clients.drive, rootFolder.id, model);
    
    return { success: true, message: 'AI model updated successfully' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update AI model' };
  }
}

// Project Metadata Actions

export async function loadProjectMetadataAction(accessToken: string, rootFolderId: string, projectFolderId: string): Promise<ActionResult<ProjectMetadata>> {
  try {
    const clients = await getAuthenticatedClients(accessToken, rootFolderId);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { drive } = clients;
    const metadata = await loadProjectMetadata(drive, projectFolderId);
    
    return { 
      success: true, 
      data: metadata,
      message: 'Project metadata loaded successfully' 
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to load project metadata' };
  }
}

export async function saveProjectMetadataAction(accessToken: string, rootFolderId: string, projectFolderId: string, metadata: ProjectMetadata): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken, rootFolderId);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { drive } = clients;
    await saveProjectMetadata(drive, projectFolderId, metadata);
    
    return { 
      success: true, 
      message: 'Project metadata saved successfully' 
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to save project metadata' };
  }
}

export async function uploadFileToProjectAction(accessToken: string, rootFolderId: string, file: File, projectFolderId: string): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken, rootFolderId);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { drive } = clients;
    
    if (!file || !projectFolderId) {
      return { success: false, error: 'File and project folder ID are required' };
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/epub+zip',
      'application/pdf'
    ];
    const allowedExtensions = ['.docx', '.txt', '.epub', '.pdf'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!allowedTypes.includes(file.type) && !hasValidExtension) {
      return { success: false, error: 'Only .txt, .docx, .epub, and .pdf files are allowed' };
    }

    // Convert File to buffer and then to readable stream
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Helper function to create readable stream from buffer
    const bufferToStream = (buffer: Buffer): Readable => {
      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      return readable;
    };
    
    // Check if file already exists in the project folder
    const existingQuery = `name='${file.name}' and '${projectFolderId}' in parents and trashed=false`;
    const existingFiles = await drive.files.list({
      q: existingQuery,
      fields: 'files(id)'
    });

    const computedMimeType = file.type || (
      fileName.endsWith('.txt') ? 'text/plain' :
      fileName.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
      fileName.endsWith('.epub') ? 'application/epub+zip' :
      fileName.endsWith('.pdf') ? 'application/pdf' :
      'application/octet-stream'
    );

    const media = {
      mimeType: computedMimeType,
      body: bufferToStream(buffer)
    };

    let result;
    if (existingFiles.data.files && existingFiles.data.files.length > 0 && existingFiles.data.files[0].id) {
      // Update existing file
      result = await drive.files.update({
        fileId: existingFiles.data.files[0].id,
        media,
        fields: 'id,name,size,mimeType'
      });
    } else {
      // Create new file
      result = await drive.files.create({
        requestBody: {
          name: file.name,
          parents: [projectFolderId]
        },
        media,
        fields: 'id,name,size,mimeType'
      });
    }
    
    return { 
      success: true, 
      data: {
        fileId: result.data.id,
        fileName: result.data.name,
        size: result.data.size,
        mimeType: result.data.mimeType
      },
      message: `File uploaded successfully: ${result.data.name}` 
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to upload file' };
  }
}

export async function checkManuscriptFilesExistAction(
  accessToken: string, 
  rootFolderId: string,
  projectFolderId: string
): Promise<ActionResult<{html: boolean, epub: boolean, pdf: boolean}>> {
  try {
    const clients = await getAuthenticatedClients(accessToken, rootFolderId);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { drive } = clients;
    
    // Check for manuscript.html, manuscript.epub, manuscript.pdf
    const filenames = ['manuscript.html', 'manuscript.epub', 'manuscript.pdf'];
    const results: {html: boolean, epub: boolean, pdf: boolean} = {
      html: false,
      epub: false,
      pdf: false
    };
    
    for (let i = 0; i < filenames.length; i++) {
      const filename = filenames[i];
      const query = `name='${filename}' and '${projectFolderId}' in parents and trashed=false`;
      const existingFiles = await drive.files.list({
        q: query,
        fields: 'files(id)'
      });
      
      const exists = !!(existingFiles.data.files && existingFiles.data.files.length > 0);
      if (filename === 'manuscript.html') results.html = exists;
      else if (filename === 'manuscript.epub') results.epub = exists;
      else if (filename === 'manuscript.pdf') results.pdf = exists;
    }
    
    return { 
      success: true, 
      data: results,
      message: 'File existence check completed' 
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to check file existence' };
  }
}

// Delete a generated manuscript output file by type (html | epub | pdf)
export async function deleteManuscriptOutputAction(
  accessToken: string,
  rootFolderId: string,
  projectFolderId: string,
  fileType: 'html' | 'epub' | 'pdf'
): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken, rootFolderId);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { drive } = clients;
    const fileName = fileType === 'html' ? 'manuscript.html' : fileType === 'epub' ? 'manuscript.epub' : 'manuscript.pdf';
    const query = `name='${fileName}' and '${projectFolderId}' in parents and trashed=false`;
    const existing = await drive.files.list({ q: query, fields: 'files(id,name)' });

    if (existing.data.files && existing.data.files.length > 0) {
      for (const file of existing.data.files) {
        if (file.id) {
          await drive.files.delete({ fileId: file.id });
        }
      }
      return { success: true, message: `${fileName} deleted` };
    }
    // Nothing to delete is still a success
    return { success: true, message: `${fileName} not found` };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete output file' };
  }
}
