// Project Manager Hook
// Extracted from app/page.tsx - handles all project-related state and operations

import { useState, useMemo, useCallback } from 'react';
import { showAlert, showConfirm } from '../shared/alerts';
import {
  listProjectsAction,
  createProjectAction,
  selectProjectAction,
  listProjectFilesAction,
  listTxtFilesAction,
  checkManuscriptFilesExistAction,
} from '@/lib/github-project-actions';
import { createSignedUploadUrlForProject } from '@/lib/supabase-project-actions';
import { convertTxtToDocxActionGitHub } from '@/lib/docx-conversion-actions';

// Manuscript file types - only 1 of each allowed, renamed to manuscript.{ext}
const MANUSCRIPT_EXTENSIONS = ['.epub', '.pdf', '.html'];

/**
 * Sanitize filename for .txt and .docx files to avoid URL issues
 * Removes leading underscores, replaces special chars with underscores
 */
function sanitizeFilename(name: string): string {
  const ext = name.slice(name.lastIndexOf('.'));
  const base = name.slice(0, name.lastIndexOf('.'));
  const sanitized = base
    .replace(/^_+/, '')              // Remove leading underscores
    .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace special chars (periods, spaces, etc.)
    .replace(/_+/g, '_')             // Collapse multiple underscores
    .replace(/^_|_$/g, '');          // Remove leading/trailing underscores
  return (sanitized || 'file') + ext; // Fallback to 'file' if empty
}

// Get max upload size from env (default 30MB)
const MAX_FILE_SIZE_MB = parseInt(process.env['NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB'] || '30', 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface ProjectManagerState {
  // Project state
  currentProject: string | null;
  currentProjectId: string | null;
  uploadStatus: string;

  // Modal states
  showModal: boolean;
  showDocxSelector: boolean;
  showTxtSelector: boolean;
  showFilenameDialog: boolean;
  showTxtFilenameDialog: boolean;

  // Modal data
  modalFiles: any[];
  currentFolderId: string;
  breadcrumbs: any[];
  newProjectName: string;
  isProjectFilesBrowser: boolean;

  // DOCX conversion state
  docxFiles: any[];
  selectedDocxFile: any | null;
  outputFileName: string;
  isConverting: boolean;

  // TXT conversion state
  txtFiles: any[];
  selectedTxtFile: any | null;
  txtOutputFileName: string;
  isConvertingTxt: boolean;

  // Upload state
  showUploadModal: boolean;
  selectedUploadFile: File | null;
  uploadFileName: string;
  isUploading: boolean;

  // Local DOCX import state
  showLocalDocxImportModal: boolean;
  isLocalDocxConverting: boolean;
}

interface ProjectManagerActions {
  // Status updates
  setUploadStatus: (status: string) => void;
  setCurrentProject: (project: string | null) => void;
  setCurrentProjectId: (id: string | null) => void;

  // Project operations
  openProjectSelector: (session: any, isDarkMode: boolean) => Promise<void>;
  selectProject: (
    session: any,
    folder: any,
    setIsStorageOperationPending: (loading: boolean) => void,
    clearSelectedManuscript: () => void
  ) => Promise<void>;
  createNewProject: (
    session: any,
    setIsStorageOperationPending: (loading: boolean) => void,
    isDarkMode: boolean,
    toolsActions?: any
  ) => Promise<void>;
  browseProjectFiles: (session: any, isDarkMode: boolean) => Promise<void>;

  // Modal controls
  closeModal: () => void;
  setNewProjectName: (name: string) => void;

  // Navigation
  navigateToFolder: (
    projectName?: string,
    setIsStorageOperationPending?: (loading: boolean) => void
  ) => Promise<void>;

  // DOCX import (now via LocalDocxImportModal component)

  // TXT export
  handleTxtExport: (
    session: any,
    isDarkMode: boolean,
    setIsStorageOperationPending: (loading: boolean) => void
  ) => Promise<void>;
  selectTxtFile: (file: any) => void;
  performTxtConversion: (session: any, isDarkMode: boolean) => Promise<void>;

  // Modal state setters
  setShowFilenameDialog: (show: boolean) => void;
  setShowTxtFilenameDialog: (show: boolean) => void;
  setShowDocxSelector: (show: boolean) => void;
  setShowTxtSelector: (show: boolean) => void;
  setOutputFileName: (name: string) => void;
  setTxtOutputFileName: (name: string) => void;
  setSelectedDocxFile: (file: any | null) => void;
  setSelectedTxtFile: (file: any | null) => void;

  // Upload operations
  handleFileUpload: (
    isDarkMode: boolean,
    setIsStorageOperationPending: (loading: boolean) => void
  ) => void;
  selectUploadFile: (file: File, isDarkMode: boolean) => void;
  setSelectedUploadFile: (file: File | null) => void;
  setUploadFileName: (name: string) => void;
  performFileUpload: (session: any, isDarkMode: boolean) => Promise<void>;
  setShowUploadModal: (show: boolean) => void;

  // Local DOCX import operations
  handleLocalDocxImport: (isDarkMode: boolean) => void;
  setShowLocalDocxImportModal: (show: boolean) => void;
  handleLocalDocxConversionComplete: (fileName: string) => void;
}

export function useProjectManager(): [ProjectManagerState, ProjectManagerActions] {
  // Project state
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDocxSelector, setShowDocxSelector] = useState(false);
  const [showTxtSelector, setShowTxtSelector] = useState(false);
  const [showFilenameDialog, setShowFilenameDialog] = useState(false);
  const [showTxtFilenameDialog, setShowTxtFilenameDialog] = useState(false);

  // Modal data
  const [modalFiles, setModalFiles] = useState<any[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [isProjectFilesBrowser, setIsProjectFilesBrowser] = useState(false);

  // DOCX conversion state
  const [docxFiles, _setDocxFiles] = useState<any[]>([]);
  const [selectedDocxFile, setSelectedDocxFile] = useState<any | null>(null);
  const [outputFileName, setOutputFileName] = useState('');
  const [isConverting, _setIsConverting] = useState(false);

  // TXT conversion state
  const [txtFiles, setTxtFiles] = useState<any[]>([]);
  const [selectedTxtFile, setSelectedTxtFile] = useState<any | null>(null);
  const [txtOutputFileName, setTxtOutputFileName] = useState('');
  const [isConvertingTxt, setIsConvertingTxt] = useState(false);

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Local DOCX import state
  const [showLocalDocxImportModal, setShowLocalDocxImportModal] = useState(false);
  const [isLocalDocxConverting, _setIsLocalDocxConverting] = useState(false);

  // Navigate to folder (GitHub version)
  const navigateToFolder = useCallback(
    async (
      projectName?: string,
      setIsStorageOperationPending?: (loading: boolean) => void
    ) => {
      setUploadStatus('Loading projects...');
      if (setIsStorageOperationPending) setIsStorageOperationPending(true);

      try {
        // If projectName provided, list files in that project; otherwise list all projects
        const result = projectName
          ? await listProjectFilesAction(projectName)
          : await listProjectsAction();

        if (result.success) {
          setModalFiles(result.data?.files || []);
          setCurrentFolderId(result.data?.currentFolder.id);

          // Build breadcrumbs
          const newBreadcrumbs = [
            { name: result.data?.rootFolder.name, id: result.data?.rootFolder.id }
          ];
          if (result.data?.currentFolder.id !== result.data?.rootFolder.id) {
            newBreadcrumbs.push({
              name: result.data?.currentFolder.name,
              id: result.data?.currentFolder.id
            });
          }
          setBreadcrumbs(newBreadcrumbs);

          setUploadStatus(`Found ${result.data?.files?.length || 0} items`);
        } else {
          setUploadStatus(`❌ Error: ${result.error}`);
        }
      } catch (error) {
        setUploadStatus(`❌ Error: ${error}`);
      } finally {
        if (setIsStorageOperationPending) setIsStorageOperationPending(false);
      }
    },
    []
  );

  // Open project selector modal
  const openProjectSelector = useCallback(
    async (session: any, isDarkMode: boolean) => {
      if (!session) {
        showAlert('You must sign in first!', 'error', undefined, isDarkMode);
        return;
      }

      setIsProjectFilesBrowser(false);
      setNewProjectName('');
      await navigateToFolder(); // List all projects
      setShowModal(true);
    },
    [navigateToFolder]
  );

  // Select project from modal (only folders/projects)
  const selectProject = useCallback(
    async (
      _session: any,
      folder: any,
      setIsStorageOperationPending: (loading: boolean) => void,
      clearSelectedManuscript: () => void
    ) => {
      setCurrentProject(folder.name);
      setCurrentProjectId(folder.id);
      setShowModal(false);
      setUploadStatus(`Selecting project: ${folder.name}...`);
      setIsStorageOperationPending(true);

      // Clear selected manuscript when project changes
      clearSelectedManuscript();

      // Save to GitHub config
      try {
        const result = await selectProjectAction(folder.name);

        if (result.success) {
          setUploadStatus(`✅ Project selected: ${folder.name}`);
        } else {
          setUploadStatus(`⚠️ Project selected locally but config save failed`);
        }
      } catch (error) {
        setUploadStatus(`⚠️ Project selected locally but config save failed`);
      } finally {
        setIsStorageOperationPending(false);
      }
    },
    []
  );

  // Browse files within the current project folder
  const browseProjectFiles = useCallback(
    async (session: any, isDarkMode: boolean) => {
      if (!session || !currentProject) {
        showAlert('Select a project first!', 'info', undefined, isDarkMode);
        return;
      }

      setIsProjectFilesBrowser(true);
      await navigateToFolder(currentProject); // List files in project
      setShowModal(true);
    },
    [currentProject, navigateToFolder]
  );

  // Create new project folder
  const createNewProject = useCallback(
    async (
      session: any,
      setIsStorageOperationPending: (loading: boolean) => void,
      isDarkMode: boolean,
      toolsActions?: any
    ) => {
      if (!session || !newProjectName.trim()) {
        showAlert('Enter a project name!', 'error', undefined, isDarkMode);
        return;
      }

      setUploadStatus('Creating new project...');
      setIsStorageOperationPending(true);

      try {
        const result = await createProjectAction(newProjectName.trim());

        if (result.success) {
          // Select the newly created project
          setCurrentProject(newProjectName.trim());
          setCurrentProjectId(result.data?.folderId);
          setNewProjectName('');
          setShowModal(false);
          setUploadStatus(`✅ Project created: ${newProjectName.trim()}`);

          // Tools are already in GitHub repo, no need to load them
          if (toolsActions && !toolsActions.toolsReady) {
            setUploadStatus('Loading tools...');
            try {
              await toolsActions.loadAvailableTools(isDarkMode);
              setUploadStatus(`✅ Project and tools ready!`);
            } catch (toolError) {
              console.error('Tool loading failed:', toolError);
              setUploadStatus(`✅ Project created, but tool loading failed`);
            }
          }
        } else {
          setUploadStatus(`❌ Error: ${result.error}`);
        }
      } catch (error) {
        setUploadStatus(`❌ Error: ${error}`);
      } finally {
        setIsStorageOperationPending(false);
      }
    },
    [newProjectName]
  );

  // DOCX import now handled by LocalDocxImportModal component

  // GitHub-based TXT export (TXT to DOCX conversion)
  const handleTxtExport = useCallback(
    async (
      session: any,
      isDarkMode: boolean,
      setIsStorageOperationPending: (loading: boolean) => void
    ) => {
      if (!session || !currentProject) {
        showAlert('Please select a project first.', 'warning', undefined, isDarkMode);
        return;
      }

      setIsStorageOperationPending(true);
      setUploadStatus('Loading TXT files...');

      try {
        const result = await listTxtFilesAction(currentProject);

        if (result.success && result.data) {
          setTxtFiles(result.data.files);
          setShowTxtSelector(true);
          setUploadStatus('');
        } else {
          showAlert(result.error || 'Failed to load TXT files', 'error', undefined, isDarkMode);
          setUploadStatus(`❌ ${result.error}`);
        }
      } catch (error: any) {
        showAlert(`Error loading TXT files: ${error.message}`, 'error', undefined, isDarkMode);
        setUploadStatus(`❌ ${error.message}`);
      } finally {
        setIsStorageOperationPending(false);
      }
    },
    [currentProject]
  );

  // Select TXT file for export
  const selectTxtFile = useCallback((file: any) => {
    setSelectedTxtFile(file);
    // Set default output filename (replace .txt with .docx)
    const defaultFileName = file.name.replace(/\.txt$/i, '.docx');
    setTxtOutputFileName(defaultFileName);
    setShowTxtSelector(false);
    setShowTxtFilenameDialog(true);
  }, []);

  // Perform TXT to DOCX conversion
  const performTxtConversion = useCallback(
    async (_session: any, isDarkMode: boolean) => {
      if (!selectedTxtFile || !txtOutputFileName.trim() || !currentProject) {
        showAlert('Missing required information', 'error', undefined, isDarkMode);
        return;
      }

      setIsConvertingTxt(true);
      setUploadStatus(`Converting ${selectedTxtFile.name} to DOCX...`);

      try {
        const result = await convertTxtToDocxActionGitHub(
          currentProject,
          selectedTxtFile.path,
          txtOutputFileName.trim()
        );

        if (!result.success) {
          throw new Error(result.error || 'Conversion failed');
        }

        // Decode base64 buffer
        const base64Buffer = result.data!.docxBuffer;
        const binaryString = atob(base64Buffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Create blob and trigger download
        const blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.data!.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setUploadStatus(`✅ Conversion complete: ${result.data!.fileName}`);
        showAlert(
          `Conversion complete!\n\nOutput: ${result.data!.fileName}\nParagraphs: ${result.data!.paragraphCount}\nChapters: ${result.data!.chapterCount}`,
          'success',
          'TXT to DOCX Conversion',
          isDarkMode
        );

        // Reset state
        setSelectedTxtFile(null);
        setTxtOutputFileName('');
        setShowTxtFilenameDialog(false);
      } catch (error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setUploadStatus(`❌ Conversion failed: ${errorMsg}`);
        showAlert(`Conversion error: ${errorMsg}`, 'error', undefined, isDarkMode);
      } finally {
        setIsConvertingTxt(false);
      }
    },
    [selectedTxtFile, txtOutputFileName, currentProject]
  );

  // Handle file upload button click
  const handleFileUpload = (
    isDarkMode: boolean,
    _setIsStorageOperationPending: (loading: boolean) => void
  ) => {
    if (!currentProject || !currentProjectId) {
      showAlert('Please select a project first.', 'warning', undefined, isDarkMode);
      return;
    }
    setShowUploadModal(true);
  };

  // Handle file selection for upload
  const selectUploadFile = useCallback((file: File, isDarkMode: boolean) => {
    // Validate file size using env var (default 30MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      showAlert(`File too large (${sizeMB}MB). Maximum is ${MAX_FILE_SIZE_MB}MB.`, 'error', undefined, isDarkMode);
      return;
    }

    setSelectedUploadFile(file);
  }, []);

  // Perform the actual file upload to Supabase Storage (direct upload via signed URL)
  const performFileUpload = useCallback(
    async (session: any, isDarkMode: boolean) => {
      if (!selectedUploadFile || !currentProject) {
        showAlert('No file selected or no project selected', 'error', undefined, isDarkMode);
        return;
      }

      if (!session?.user?.id) {
        showAlert('Not authenticated', 'error', undefined, isDarkMode);
        return;
      }

      // Determine file extension and type
      const originalName = selectedUploadFile.name;
      const ext = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();
      const isManuscriptType = MANUSCRIPT_EXTENSIONS.includes(ext);

      let targetFileName: string;

      if (isManuscriptType) {
        // Manuscript files: always named manuscript.{ext}
        targetFileName = `manuscript${ext}`;

        // Check if manuscript file already exists
        const existsResult = await checkManuscriptFilesExistAction(currentProject);
        if (existsResult.success && existsResult.data) {
          const extKey = ext.slice(1) as 'epub' | 'pdf' | 'html';
          if (existsResult.data[extKey]) {
            // File exists - warn user
            const confirmed = await showConfirm(
              `A ${targetFileName} already exists in this project.\n\nDo you want to replace it?`,
              isDarkMode,
              'Replace Existing File?',
              'Replace',
              'Cancel'
            );
            if (!confirmed) {
              return; // User cancelled
            }
          }
        }
      } else {
        // Regular files (.txt, .docx): sanitize original name
        targetFileName = sanitizeFilename(originalName);
      }

      setIsUploading(true);
      setUploadStatus(`Uploading ${targetFileName}...`);

      try {
        console.log(`[performFileUpload] Starting DIRECT upload for "${targetFileName}" (bypasses Vercel limit)...`);

        // 1. Get signed URL from server
        const urlResult = await createSignedUploadUrlForProject(
          session.user.id,
          currentProject,
          targetFileName
        );

        if (!urlResult.success || !urlResult.signedUrl) {
          throw new Error(urlResult.error || 'Failed to get upload URL');
        }

        console.log('[performFileUpload] Got signed URL, uploading directly to Supabase...');

        // 2. Read file as ArrayBuffer
        const fileData = await selectedUploadFile.arrayBuffer();

        // 3. Upload directly to Supabase via signed URL
        const response = await fetch(urlResult.signedUrl, {
          method: 'PUT',
          body: fileData,
          headers: { 'Content-Type': selectedUploadFile.type || 'application/octet-stream' },
        });

        if (!response.ok) {
          throw new Error(`Upload failed with status: ${response.status}`);
        }

        console.log(`[performFileUpload] SUCCESS: "${targetFileName}" uploaded via direct signed URL`);

        // If we get here, the upload succeeded
        setUploadStatus(`✅ File uploaded: ${targetFileName}`);
        showAlert(
          `File uploaded successfully: ${targetFileName}`,
          'success',
          undefined,
          isDarkMode
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        showAlert(`Upload error: ${errorMsg}`, 'error', undefined, isDarkMode);
        setUploadStatus(`❌ Upload error: ${errorMsg}`);
      } finally {
        setIsUploading(false);
        setSelectedUploadFile(null);
        setUploadFileName('');
      }
    },
    [selectedUploadFile, uploadFileName, currentProject]
  );

  const closeModal = useCallback(() => setShowModal(false), []);

  // Handle local DOCX import button click
  const handleLocalDocxImport = (isDarkMode: boolean) => {
    if (!currentProject || !currentProjectId) {
      showAlert('Please select a project first.', 'warning', undefined, isDarkMode);
      return;
    }
    setShowLocalDocxImportModal(true);
  };

  // Handle local DOCX conversion completion
  const handleLocalDocxConversionComplete = useCallback((fileName: string) => {
    setUploadStatus(`✅ Local DOCX converted: ${fileName}`);
    setShowLocalDocxImportModal(false);
  }, []);

  const state: ProjectManagerState = {
    currentProject,
    currentProjectId,
    uploadStatus,
    showModal,
    showDocxSelector,
    showTxtSelector,
    showFilenameDialog,
    showTxtFilenameDialog,
    modalFiles,
    currentFolderId,
    breadcrumbs,
    newProjectName,
    isProjectFilesBrowser,
    docxFiles,
    selectedDocxFile,
    outputFileName,
    isConverting,
    txtFiles,
    selectedTxtFile,
    txtOutputFileName,
    isConvertingTxt,
    showUploadModal,
    selectedUploadFile,
    uploadFileName,
    isUploading,
    showLocalDocxImportModal,
    isLocalDocxConverting
  };

  const actions: ProjectManagerActions = useMemo(
    () => ({
      setUploadStatus,
      setCurrentProject,
      setCurrentProjectId,
      openProjectSelector,
      selectProject,
      createNewProject,
      browseProjectFiles,
      closeModal,
      setNewProjectName,
      navigateToFolder,
      handleTxtExport,
      selectTxtFile,
      performTxtConversion,
      setShowFilenameDialog,
      setShowTxtFilenameDialog,
      setShowDocxSelector,
      setShowTxtSelector,
      setOutputFileName,
      setTxtOutputFileName,
      setSelectedDocxFile,
      setSelectedTxtFile,
      handleFileUpload,
      selectUploadFile,
      setSelectedUploadFile,
      setUploadFileName,
      performFileUpload,
      setShowUploadModal,
      handleLocalDocxImport,
      setShowLocalDocxImportModal,
      handleLocalDocxConversionComplete
    }),
    [
      openProjectSelector,
      selectProject,
      createNewProject,
      browseProjectFiles,
      closeModal,
      navigateToFolder,
      selectTxtFile,
      selectUploadFile,
      performFileUpload,
      handleTxtExport,
      performTxtConversion,
      handleLocalDocxConversionComplete,
      currentProject,
      currentProjectId
    ]
  );

  return [state, actions];
}

