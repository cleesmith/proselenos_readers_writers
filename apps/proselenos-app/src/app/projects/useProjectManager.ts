// Project Manager Hook - Local-first version
// Only handles: DOCX export and local DOCX import

import { useState, useMemo, useCallback } from 'react';
import { showAlert } from '../shared/alerts';
import { loadManuscript } from '@/services/manuscriptStorage';
import { convertManuscriptToDocx } from '@/lib/txt-to-docx-utils';

interface ProjectManagerState {
  // Status
  uploadStatus: string;

  // Export state
  isTxtConverting: boolean;

  // Local DOCX import state
  showLocalDocxImportModal: boolean;
}

interface ProjectManagerActions {
  // Status
  setUploadStatus: (status: string) => void;

  // TXT export (manuscript.txt → .docx download)
  handleExport: (isDarkMode: boolean) => Promise<void>;

  // Local DOCX import
  handleLocalDocxImport: (isDarkMode: boolean) => void;
  setShowLocalDocxImportModal: (show: boolean) => void;
  handleLocalDocxConversionComplete: (fileName: string) => void;
}

export function useProjectManager(): [ProjectManagerState, ProjectManagerActions] {
  const [uploadStatus, setUploadStatus] = useState('');
  const [isTxtConverting, setIsTxtConverting] = useState(false);
  const [showLocalDocxImportModal, setShowLocalDocxImportModal] = useState(false);

  // TXT export (manuscript.txt → .docx download)
  const handleExport = useCallback(
    async (isDarkMode: boolean) => {
      setIsTxtConverting(true);
      setUploadStatus('Exporting manuscript.txt to DOCX...');

      try {
        // Load manuscript.txt from IndexedDB
        const text = await loadManuscript();
        if (!text) {
          showAlert('No manuscript.txt found. Please add your manuscript first.', 'warning', undefined, isDarkMode);
          setUploadStatus('');
          return;
        }

        // Convert to DOCX (client-side)
        const blob = await convertManuscriptToDocx(text);

        // Trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'manuscript.docx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setUploadStatus('✅ Downloaded manuscript.docx');
        showAlert('Downloaded manuscript.docx', 'success', undefined, isDarkMode);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setUploadStatus(`❌ Export failed: ${errorMsg}`);
        showAlert(`Export failed: ${errorMsg}`, 'error', undefined, isDarkMode);
      } finally {
        setIsTxtConverting(false);
      }
    },
    []
  );

  // Handle local DOCX import button click
  const handleLocalDocxImport = useCallback((_isDarkMode: boolean) => {
    setShowLocalDocxImportModal(true);
  }, []);

  // Handle local DOCX conversion completion
  const handleLocalDocxConversionComplete = useCallback((fileName: string) => {
    setUploadStatus(`✅ Local DOCX converted: ${fileName}`);
    setShowLocalDocxImportModal(false);
  }, []);

  const state: ProjectManagerState = {
    uploadStatus,
    isTxtConverting,
    showLocalDocxImportModal,
  };

  const actions: ProjectManagerActions = useMemo(
    () => ({
      setUploadStatus,
      handleExport,
      handleLocalDocxImport,
      setShowLocalDocxImportModal,
      handleLocalDocxConversionComplete,
    }),
    [handleExport, handleLocalDocxImport, handleLocalDocxConversionComplete]
  );

  return [state, actions];
}
