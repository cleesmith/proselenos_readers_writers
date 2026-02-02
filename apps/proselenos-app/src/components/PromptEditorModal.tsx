// components/PromptEditorModal.tsx
// Full-screen modal for editing AI prompts (Writing Assistant + Editing Tools)

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ThemeConfig } from '@/app/shared/theme';
import { showAlert } from '@/app/shared/alerts';
import StyledSmallButton from '@/components/StyledSmallButton';
import {
  // Tool prompts
  loadToolPromptsData,
  getToolPrompt,
  updateToolPrompt,
  resetToolPrompt,
  isToolPromptCustomized,
  isUserCreatedPrompt,
  addUserPrompt,
  deleteUserPrompt,
  resetAllToolPrompts,
  getPromptCategories,
  getOriginalToolPrompt,
  // Writing Assistant prompts
  getWritingAssistantPrompt,
  saveWritingAssistantPrompt,
  resetWritingAssistantPrompt,
  isWritingAssistantPromptCustomized,
  getWritingAssistantDefaultPrompt,
  getWritingAssistantStepIds,
  resetAllWritingAssistantPrompts,
} from '@/services/manuscriptStorage';
import Swal from 'sweetalert2';

// Helper to strip Markdown formatting (copied from EditorModal.tsx)
function stripMarkdown(md: string, inputOptions: Record<string, boolean> = {}): string {
  const options = {
    listUnicodeChar: inputOptions.listUnicodeChar ?? false,
    stripListLeaders: inputOptions.stripListLeaders ?? true,
    gfm: inputOptions.gfm ?? true,
    useImgAltText: inputOptions.useImgAltText ?? true,
    preserveBlockSpacing: inputOptions.preserveBlockSpacing ?? true,
  };

  let output = md || '';
  // Remove horizontal rules
  output = output.replace(/^(-\s*?|\*\s*?|_\s*?){3,}\s*$/gm, '');
  try {
    // Handle list markers
    if (options.stripListLeaders) {
      if (options.listUnicodeChar) {
        output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, '• $1');
      } else {
        output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, '$1');
      }
    }
    // Handle Markdown features
    if (options.gfm) {
      output = output
        .replace(/\n={2,}/g, '\n')
        .replace(/~{3}.*\n/g, '')
        .replace(/(`{3,})([\s\S]*?)\1/gm, function (_match: string, _p1: string, p2: string) {
          return p2.trim() + '%%CODEBLOCK_END%%\n';
        })
        .replace(/~~/g, '');
    }
    // Process main markdown elements
    output = output
      .replace(/<[^>]*>/g, '')
      .replace(/^[=\-]{2,}\s*$/g, '')
      .replace(/\[\^.+?\](\: .*?$)?/g, '')
      .replace(/\s{0,2}\[.*?\]: .*?$/g, '')
      .replace(/!\[(.*?)\][\[(].*?[\])]/g, options.useImgAltText ? '$1' : '')
      .replace(/\[(.*?)\][\[(].*?[\])]/g, '$1')
      .replace(/^\s*>+\s?/gm, function () {
        return options.preserveBlockSpacing ? '\n' : '';
      })
      .replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, '$1')
      .replace(/^\s{1,2}\[(.*?)\]: (\S+)( ".*?")?\s*$/g, '')
      .replace(/^(\n)?\s{0,}#{1,6}\s+| {0,}(\n)?\s{0,}#{0,} {0,}(\n)?\s{0,}$/gm, '$1$2$3')
      .replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, '$2')
      .replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, '$2')
      .replace(/`(.+?)`/g, '$1');
    // Final cleanup and spacing
    output = output
      .replace(/%%CODEBLOCK_END%%\n/g, '\n\n\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/\n{3}/g, '\n\n')
      .trim();
    return output;
  } catch (_error) {
    return md;
  }
}

// Sanitize prompt text - strips HTML and Markdown
function sanitizePromptText(text: string): string {
  let output = text || '';
  // Strip HTML tags
  output = output.replace(/<[^>]*>/g, '');
  // Strip Markdown
  output = stripMarkdown(output);
  return output.trim();
}

interface PromptInfo {
  id: string;
  name: string;
  isCustomized: boolean;
  isUserCreated: boolean;
}

interface PromptEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeConfig;
  isDarkMode: boolean;
}

export default function PromptEditorModal({
  isOpen,
  onClose,
  theme,
  isDarkMode,
}: PromptEditorModalProps) {
  // State
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [promptsList, setPromptsList] = useState<PromptInfo[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [editorContent, setEditorContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isCustomized, setIsCustomized] = useState<boolean>(false);
  const [isUserCreated, setIsUserCreated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [showAddDialog, setShowAddDialog] = useState<boolean>(false);
  const [newPromptName, setNewPromptName] = useState<string>('');

  // Track if content has changed from what was loaded
  useEffect(() => {
    setHasUnsavedChanges(editorContent !== originalContent);
  }, [editorContent, originalContent]);

  // Load categories on mount
  const loadCategories = useCallback(async () => {
    const cats = await getPromptCategories();
    setCategories(cats);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen, loadCategories]);

  // Load prompts for selected category
  const loadPromptsForCategory = useCallback(async (category: string) => {
    setIsLoading(true);
    const prompts: PromptInfo[] = [];

    try {
      if (category === 'AI Writing') {
        // Load AI Writing prompts
        const stepIds = getWritingAssistantStepIds();
        for (const stepId of stepIds) {
          const isCustom = await isWritingAssistantPromptCustomized(stepId);
          prompts.push({
            id: `wa:${stepId}`,
            name: stepId.charAt(0).toUpperCase() + stepId.slice(1),
            isCustomized: isCustom,
            isUserCreated: false,
          });
        }
      } else {
        // Load tool prompts for this category
        const data = await loadToolPromptsData();
        if (data) {
          const toolIds = data.toolOrder || Object.keys(data.originals);
          for (const toolId of toolIds) {
            if (toolId.startsWith(category + '/')) {
              const name = toolId.split('/')[1]?.replace('.txt', '') || toolId;
              const isCustom = await isToolPromptCustomized(toolId);
              const isUser = await isUserCreatedPrompt(toolId);
              prompts.push({
                id: toolId,
                name,
                isCustomized: isCustom,
                isUserCreated: isUser,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading prompts:', error);
    }

    setPromptsList(prompts);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      setSelectedPromptId('');
      setEditorContent('');
      setOriginalContent('');
      loadPromptsForCategory(selectedCategory);
    }
  }, [selectedCategory, loadPromptsForCategory]);

  // Load prompt content
  const loadPromptContent = async (promptId: string) => {
    setIsLoading(true);
    setSelectedPromptId(promptId);

    try {
      let content: string = '';
      let isCustom = false;
      let isUser = false;

      if (promptId.startsWith('wa:')) {
        // AI Writing prompt
        const stepId = promptId.substring(3);
        content = await getWritingAssistantPrompt(stepId);
        isCustom = await isWritingAssistantPromptCustomized(stepId);
        isUser = false;
      } else {
        // Tool prompt
        content = await getToolPrompt(promptId) || '';
        isCustom = await isToolPromptCustomized(promptId);
        isUser = await isUserCreatedPrompt(promptId);
      }

      setEditorContent(content);
      setOriginalContent(content);
      setIsCustomized(isCustom);
      setIsUserCreated(isUser);
    } catch (error) {
      console.error('Error loading prompt:', error);
      showAlert('Error loading prompt', 'error', undefined, isDarkMode);
    }

    setIsLoading(false);
  };


  // Handle category change
  const handleCategoryChange = (category: string) => {
    if (hasUnsavedChanges) {
      Swal.fire({
        title: 'Unsaved Changes',
        text: 'You have unsaved changes. Discard them?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Discard',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        background: isDarkMode ? '#222' : '#fff',
        color: isDarkMode ? '#fff' : '#333',
        customClass: {
          container: 'swal-above-modal'
        },
      }).then((result) => {
        if (result.isConfirmed) {
          setSelectedCategory(category);
          setHasUnsavedChanges(false);
        }
      });
    } else {
      setSelectedCategory(category);
    }
  };

  // Handle prompt selection change
  const handlePromptChange = (promptId: string) => {
    if (hasUnsavedChanges) {
      Swal.fire({
        title: 'Unsaved Changes',
        text: 'You have unsaved changes. Discard them?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Discard',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        background: isDarkMode ? '#222' : '#fff',
        color: isDarkMode ? '#fff' : '#333',
        customClass: {
          container: 'swal-above-modal'
        },
      }).then((result) => {
        if (result.isConfirmed) {
          loadPromptContent(promptId);
          setHasUnsavedChanges(false);
        }
      });
    } else {
      loadPromptContent(promptId);
    }
  };

  // Save handler
  const handleSave = async () => {
    if (!selectedPromptId) return;

    setIsSaving(true);
    try {
      // Sanitize content before saving
      const sanitized = sanitizePromptText(editorContent);

      if (selectedPromptId.startsWith('wa:')) {
        const stepId = selectedPromptId.substring(3);
        await saveWritingAssistantPrompt(stepId, sanitized);
      } else {
        await updateToolPrompt(selectedPromptId, sanitized);
      }

      // Update state
      setEditorContent(sanitized);
      setOriginalContent(sanitized);
      setHasUnsavedChanges(false);

      // Check if now customized
      if (selectedPromptId.startsWith('wa:')) {
        const stepId = selectedPromptId.substring(3);
        setIsCustomized(await isWritingAssistantPromptCustomized(stepId));
      } else {
        setIsCustomized(await isToolPromptCustomized(selectedPromptId));
      }

      // Refresh prompts list to update badges
      await loadPromptsForCategory(selectedCategory);

      showAlert('Prompt saved', 'success', undefined, isDarkMode);
    } catch (error) {
      console.error('Error saving prompt:', error);
      showAlert('Error saving prompt', 'error', undefined, isDarkMode);
    }
    setIsSaving(false);
  };

  // Restore default handler
  const handleRestoreDefault = async () => {
    if (!selectedPromptId || isUserCreated) return;

    const result = await Swal.fire({
      title: 'Restore Default?',
      text: 'This will reset the prompt to its original content.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Restore',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      background: isDarkMode ? '#222' : '#fff',
      color: isDarkMode ? '#fff' : '#333',
      customClass: {
        container: 'swal-above-modal'
      },
    });

    if (!result.isConfirmed) return;

    setIsLoading(true);
    try {
      let content: string = '';

      if (selectedPromptId.startsWith('wa:')) {
        const stepId = selectedPromptId.substring(3);
        await resetWritingAssistantPrompt(stepId);
        content = getWritingAssistantDefaultPrompt(stepId);
      } else {
        await resetToolPrompt(selectedPromptId);
        content = await getOriginalToolPrompt(selectedPromptId) || '';
      }

      setEditorContent(content);
      setOriginalContent(content);
      setIsCustomized(false);
      setHasUnsavedChanges(false);

      // Refresh prompts list
      await loadPromptsForCategory(selectedCategory);

      showAlert('Prompt restored to default', 'success', undefined, isDarkMode);
    } catch (error) {
      console.error('Error restoring prompt:', error);
      showAlert('Error restoring prompt', 'error', undefined, isDarkMode);
    }
    setIsLoading(false);
  };

  // Add new prompt handler (User Tools only)
  const handleAddNew = async () => {
    if (!newPromptName.trim()) {
      showAlert('Please enter a prompt name', 'warning', undefined, isDarkMode);
      return;
    }

    // Validate name (alphanumeric, spaces, dashes, underscores)
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(newPromptName)) {
      showAlert('Name can only contain letters, numbers, spaces, dashes, and underscores', 'warning', undefined, isDarkMode);
      return;
    }

    setIsLoading(true);
    try {
      const defaultContent = 'Enter your custom prompt here.\n\nThis prompt will be used when you run this tool on your manuscript.';
      const toolId = await addUserPrompt(newPromptName.trim(), defaultContent);

      // Refresh prompts list
      await loadPromptsForCategory(selectedCategory);

      // Select the new prompt
      loadPromptContent(toolId);

      setShowAddDialog(false);
      setNewPromptName('');
      showAlert(`Created "${newPromptName}"`, 'success', undefined, isDarkMode);
    } catch (error) {
      console.error('Error adding prompt:', error);
      showAlert((error as Error).message || 'Error adding prompt', 'error', undefined, isDarkMode);
    }
    setIsLoading(false);
  };

  // Delete prompt handler (User Tools only)
  const handleDelete = async () => {
    if (!selectedPromptId || !isUserCreated) return;

    const promptName = promptsList.find(p => p.id === selectedPromptId)?.name || selectedPromptId;

    const result = await Swal.fire({
      title: 'Delete Prompt?',
      text: `Are you sure you want to delete "${promptName}"? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      background: isDarkMode ? '#222' : '#fff',
      color: isDarkMode ? '#fff' : '#333',
      customClass: {
        container: 'swal-above-modal'
      },
    });

    if (!result.isConfirmed) return;

    setIsLoading(true);
    try {
      await deleteUserPrompt(selectedPromptId);

      // Clear selection
      setSelectedPromptId('');
      setEditorContent('');
      setOriginalContent('');

      // Refresh prompts list
      await loadPromptsForCategory(selectedCategory);

      showAlert(`Deleted "${promptName}"`, 'success', undefined, isDarkMode);
    } catch (error) {
      console.error('Error deleting prompt:', error);
      showAlert((error as Error).message || 'Error deleting prompt', 'error', undefined, isDarkMode);
    }
    setIsLoading(false);
  };

  // Restore all defaults handler
  const handleRestoreAllDefaults = async () => {
    const result = await Swal.fire({
      title: 'Restore All Defaults?',
      text: 'This will reset ALL built-in prompts to their original content. User-created prompts will be preserved.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Restore All',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      background: isDarkMode ? '#222' : '#fff',
      color: isDarkMode ? '#fff' : '#333',
      customClass: {
        container: 'swal-above-modal'
      },
    });

    if (!result.isConfirmed) return;

    setIsLoading(true);
    try {
      const toolResetCount = await resetAllToolPrompts();
      const waResetCount = await resetAllWritingAssistantPrompts();
      const totalReset = toolResetCount + waResetCount;

      // Reload current prompt if it was customized
      if (selectedPromptId) {
        await loadPromptContent(selectedPromptId);
      }

      // Refresh prompts list
      await loadPromptsForCategory(selectedCategory);

      showAlert(`Reset ${totalReset} prompt${totalReset !== 1 ? 's' : ''} to defaults`, 'success', undefined, isDarkMode);
    } catch (error) {
      console.error('Error restoring all defaults:', error);
      showAlert('Error restoring defaults', 'error', undefined, isDarkMode);
    }
    setIsLoading(false);
  };

  // Close handler with unsaved changes check
  const handleClose = () => {
    if (hasUnsavedChanges) {
      Swal.fire({
        title: 'Unsaved Changes',
        text: 'You have unsaved changes. Discard them?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Discard',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        background: isDarkMode ? '#222' : '#fff',
        color: isDarkMode ? '#fff' : '#333',
        customClass: {
          container: 'swal-above-modal'
        },
      }).then((result) => {
        if (result.isConfirmed) {
          onClose();
        }
      });
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Get display name for current prompt
  const currentPromptInfo = promptsList.find(p => p.id === selectedPromptId);

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 1100,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'auto',
        backgroundColor: theme.modalBg,
        color: theme.text,
        padding: '0.5rem',
      }}
    >
      {/* Header bar - single row with all controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0.5rem',
          borderBottom: `1px solid ${theme.border}`,
          gap: '0.75rem',
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Prompts</span>

        {/* Category dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={{ fontSize: '12px', color: theme.textSecondary }}>Category:</label>
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            disabled={isLoading}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: isDarkMode ? '#343a40' : '#f8f9fa',
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <option value="">Category...</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Prompt dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={{ fontSize: '12px', color: theme.textSecondary }}>Prompt:</label>
          <select
            value={selectedPromptId}
            onChange={(e) => handlePromptChange(e.target.value)}
            disabled={isLoading || promptsList.length === 0}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: isDarkMode ? '#343a40' : '#f8f9fa',
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
              minWidth: '150px',
            }}
          >
            <option value="">
              {!selectedCategory ? 'Select category...' : promptsList.length === 0 ? 'No prompts' : 'Prompt...'}
            </option>
            {promptsList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.isCustomized ? ' (modified)' : ''}{p.isUserCreated ? ' (custom)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Status badges */}
        {currentPromptInfo?.isCustomized && !currentPromptInfo?.isUserCreated && (
          <span style={{
            fontSize: '11px',
            color: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            padding: '2px 6px',
            borderRadius: '4px',
          }}>
            modified
          </span>
        )}
        {currentPromptInfo?.isUserCreated && (
          <span style={{
            fontSize: '11px',
            color: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            padding: '2px 6px',
            borderRadius: '4px',
          }}>
            custom
          </span>
        )}
        {hasUnsavedChanges && (
          <span style={{
            fontSize: '11px',
            color: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            padding: '2px 6px',
            borderRadius: '4px',
          }}>
            unsaved
          </span>
        )}

        {isLoading && <span style={{ fontSize: '12px', color: theme.textSecondary }}>Loading...</span>}

        {/* Spacer to push Close to right */}
        <div style={{ flex: 1 }} />

        <StyledSmallButton
          onClick={handleClose}
          theme={theme}
        >
          Close
        </StyledSmallButton>
      </div>

      {/* Editor body */}
      <div style={{ position: 'relative', marginTop: '0.5rem' }}>
        <textarea
          className="editor-textarea"
          value={editorContent}
          onChange={(e) => setEditorContent(e.target.value)}
          placeholder={selectedPromptId ? 'Edit prompt content...' : 'Select a prompt to edit'}
          disabled={isLoading || !selectedPromptId}
          style={{
            width: '100%',
            height: typeof window !== 'undefined' ? window.innerHeight - 180 : 400,
            fontSize: '14px',
            lineHeight: '1.6',
            fontFamily: 'monospace',
            padding: '0.5rem',
            border: `1px solid ${theme.border}`,
            borderRadius: '4px',
            backgroundColor: isDarkMode ? '#343a40' : '#f8f9fa',
            color: theme.text,
            resize: 'vertical',
            boxSizing: 'border-box',
            whiteSpace: 'pre-wrap',
          }}
        />
      </div>

      {/* Footer bar with action buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem',
          marginTop: '0.5rem',
          borderTop: `1px solid ${theme.border}`,
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        {/* Left group: Primary actions */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Save button - always visible */}
          <StyledSmallButton
            onClick={handleSave}
            disabled={isSaving || isLoading || !selectedPromptId || !hasUnsavedChanges}
            title="Save prompt changes"
            theme={theme}
            styleOverrides={{
              backgroundColor: hasUnsavedChanges ? '#dc3545' : undefined,
              color: hasUnsavedChanges ? '#fff' : undefined,
            }}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </StyledSmallButton>

          {/* Restore Default - visible when customized and not user-created */}
          {isCustomized && !isUserCreated && (
            <StyledSmallButton
              onClick={handleRestoreDefault}
              disabled={isLoading}
              title="Reset to original prompt"
              theme={theme}
            >
              Restore Default
            </StyledSmallButton>
          )}

          {/* Add New - visible only for User Tools */}
          {selectedCategory === 'User Tools' && (
            <StyledSmallButton
              onClick={() => setShowAddDialog(true)}
              disabled={isLoading}
              title="Add a new custom prompt"
              theme={theme}
              styleOverrides={{
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
              }}
            >
              + Add New
            </StyledSmallButton>
          )}

          {/* Delete - visible only for user-created prompts */}
          {isUserCreated && (
            <StyledSmallButton
              onClick={handleDelete}
              disabled={isLoading}
              title="Delete this custom prompt"
              theme={theme}
              styleOverrides={{
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
              }}
            >
              Delete
            </StyledSmallButton>
          )}
        </div>

        {/* Right group: Restore All */}
        <StyledSmallButton
          onClick={handleRestoreAllDefaults}
          disabled={isLoading}
          title="Reset all built-in prompts to defaults"
          theme={theme}
          styleOverrides={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
          }}
        >
          Restore All Defaults
        </StyledSmallButton>
      </div>

      {/* Add New Dialog */}
      {showAddDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
          }}
        >
          <div
            style={{
              backgroundColor: isDarkMode ? '#2c3035' : '#ffffff',
              border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '400px',
              width: '90%',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: theme.text }}>
              Add New Prompt
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>
                Prompt Name:
              </label>
              <input
                type="text"
                value={newPromptName}
                onChange={(e) => setNewPromptName(e.target.value)}
                placeholder="e.g., My Custom Tool"
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  backgroundColor: isDarkMode ? '#343a40' : '#f8f9fa',
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddNew();
                  if (e.key === 'Escape') {
                    setShowAddDialog(false);
                    setNewPromptName('');
                  }
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <StyledSmallButton
                onClick={() => {
                  setShowAddDialog(false);
                  setNewPromptName('');
                }}
                theme={theme}
              >
                Cancel
              </StyledSmallButton>
              <StyledSmallButton
                onClick={handleAddNew}
                disabled={!newPromptName.trim()}
                theme={theme}
                styleOverrides={{
                  backgroundColor: '#22c55e',
                  color: '#fff',
                }}
              >
                Create
              </StyledSmallButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
