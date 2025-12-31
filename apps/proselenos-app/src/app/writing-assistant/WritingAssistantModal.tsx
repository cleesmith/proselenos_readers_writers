// app/writing-assistant/WritingAssistantModal.tsx

'use client';

import { useEffect } from 'react';
import Swal from 'sweetalert2';
import { WritingAssistantModalProps } from './types';
import { useWritingAssistant } from './useWritingAssistant';
import WorkflowStep from './WorkflowStep';
import StyledSmallButton from '@/components/StyledSmallButton';
import { deleteWorkflowFile } from '@/services/manuscriptStorage';

export default function WritingAssistantModal({
  isOpen,
  onClose,
  theme,
  isDarkMode,
  currentProvider,
  currentModel,
  session,
  onLoadFileIntoEditor,
  onModalCloseReopen,
  onOpenChat,
  onChapterAdded
}: WritingAssistantModalProps) {
  const { state, actions } = useWritingAssistant(
    currentProvider,
    currentModel,
    session,
    isDarkMode,
    onLoadFileIntoEditor,
    onModalCloseReopen,
    onOpenChat,
    onChapterAdded
  );

  // Handle modal open/close
  useEffect(() => {
    if (isOpen && !state.isModalOpen) {
      actions.openModal();
    }
  }, [isOpen, state.isModalOpen, actions.openModal]);

  // Handle Start Over - delete all workflow files
  const handleStartOver = async () => {
    const result = await Swal.fire({
      title: 'Start Over?',
      text: 'This will delete brainstorm.txt, outline.txt, and world.txt',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Start Over',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      background: isDarkMode ? '#222' : '#fff',
      color: isDarkMode ? '#fff' : '#333',
    });

    if (result.isConfirmed) {
      await deleteWorkflowFile('brainstorm.txt');
      await deleteWorkflowFile('outline.txt');
      await deleteWorkflowFile('world.txt');
      // Refresh modal to show reset state
      actions.openModal();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        style={{
          backgroundColor: theme.background || (isDarkMode ? '#222' : '#fff'),
          border: `1px solid ${theme.border}`,
          borderRadius: '8px',
          padding: '24px',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            paddingBottom: '12px',
            borderBottom: `1px solid ${theme.border}`
          }}
        >
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              margin: 0,
              color: theme.text
            }}
          >
            AI Writing
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <StyledSmallButton onClick={handleStartOver} theme={theme}>
              Start Over
            </StyledSmallButton>
            <StyledSmallButton
              onClick={() => {
                onClose();
                actions.closeModal();
              }}
              theme={theme}
            >
              Close
            </StyledSmallButton>
          </div>
        </div>

        {/* Loading State */}
        {state.isLoading && (
          <div
            style={{
              textAlign: 'center',
              padding: '20px',
              color: theme.textSecondary
            }}
          >
            Loading existing workflow files...
          </div>
        )}

        {/* Error State */}
        {state.error && (
          <div
            style={{
              backgroundColor: 'rgba(220, 53, 69, 0.1)',
              border: '1px solid rgba(220, 53, 69, 0.3)',
              borderRadius: '4px',
              padding: '12px',
              marginBottom: '20px',
              color: '#dc3545'
            }}
          >
            {state.error}
          </div>
        )}

        {/* Workflow Steps */}
        {!state.isLoading && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0px' // No gap since WorkflowStep has its own marginBottom
            }}
          >
            {state.steps.map((step, index) => (
              <WorkflowStep
                key={step.id}
                step={step}
                isActive={index === state.currentStep}
                onExecute={actions.executeStep}
                onView={actions.viewFile}
                onRedo={actions.redoStep}
                onEditPrompt={actions.editPrompt}
                isExecuting={step.status === 'executing'}
                isAnyStepExecuting={state.isAnyStepExecuting || false}
                isLoadingPrompt={state.isLoadingPrompt || false}
                theme={theme}
                onClose={() => {
                  onClose();
                  actions.closeModal();
                }}
                onOpenChatForBrainstorm={actions.openChatForBrainstorm}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
