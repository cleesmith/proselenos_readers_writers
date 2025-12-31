// app/writing-assistant/WorkflowStep.tsx

'use client';

import { WorkflowStepProps } from './types';
import StyledSmallButton from '@/components/StyledSmallButton';

export default function WorkflowStep({
  step,
  isActive: _isActive,
  onExecute,
  onView,
  onRedo: _onRedo,
  onEditPrompt,
  isExecuting,
  isAnyStepExecuting,
  isLoadingPrompt,
  theme,
  onClose,
  onOpenChatForBrainstorm // Add this new prop
}: WorkflowStepProps) {
  const getStepBorderColor = () => {
    switch (step.status) {
      case 'completed': return '#28a745';
      case 'executing': 
      case 'ready': return '#ffc107';
      case 'error': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStepBackgroundColor = () => {
    switch (step.status) {
      case 'completed': return 'rgba(40, 167, 69, 0.1)';
      case 'executing':
      case 'ready': return 'rgba(255, 193, 7, 0.1)';
      case 'error': return 'rgba(220, 53, 69, 0.1)';
      default: return theme.surface || 'rgba(255, 255, 255, 0.05)';
    }
  };

  const getStepNumberColor = () => {
    switch (step.status) {
      case 'completed': return { bg: '#28a745', text: 'white' };
      case 'executing':
      case 'ready': return { bg: '#ffc107', text: 'black' };
      case 'error': return { bg: '#dc3545', text: 'white' };
      default: return { bg: '#6c757d', text: 'white' };
    }
  };

  const stepNumber = ['brainstorm', 'outline', 'world', 'chapters'].indexOf(step.id) + 1;
  const numberColors = getStepNumberColor();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
        backgroundColor: getStepBackgroundColor(),
        borderRadius: '6px',
        borderLeft: `4px solid ${getStepBorderColor()}`,
        border: `1px solid ${theme.border}`,
        marginBottom: '12px'
      }}
    >
      {/* Step Number */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: numberColors.bg,
          color: numberColors.text,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
          flexShrink: 0
        }}
      >
        {step.status === 'executing' ? '⏳' : stepNumber}
      </div>

      {/* Step Info */}
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px'
          }}
        >
          <span
            style={{
              fontWeight: 'bold',
              fontSize: '14px',
              color: theme.text
            }}
          >
            {step.name}
          </span>
          <StyledSmallButton
            onClick={() => onEditPrompt(step.id)}
            disabled={isAnyStepExecuting || isLoadingPrompt}
            theme={theme}
            styleOverrides={{ padding: '2px 6px', fontSize: '9px' }}
          >
            {isLoadingPrompt ? '...' : 'Prompt'}
          </StyledSmallButton>
          {/* Run button */}
          <StyledSmallButton
            onClick={() => onExecute(step.id)}
            disabled={isExecuting || isAnyStepExecuting}
            theme={theme}
            styleOverrides={{ padding: '2px 6px', fontSize: '9px' }}
          >
            {isExecuting ? '...' : 'Run'}
          </StyledSmallButton>
          {/* Chat button - Brainstorm only */}
          {step.id === 'brainstorm' && onOpenChatForBrainstorm && (
            <StyledSmallButton
              onClick={() => onOpenChatForBrainstorm(onClose)}
              disabled={isExecuting || isAnyStepExecuting}
              theme={theme}
              styleOverrides={{ padding: '2px 6px', fontSize: '9px' }}
            >
              Chat
            </StyledSmallButton>
          )}
          {/* File button for completed steps (not for chapters - they're in sidebar) */}
          {step.status === 'completed' && step.fileName && step.id !== 'chapters' && (
            <StyledSmallButton
              onClick={() => onView(step.id)}
              disabled={isAnyStepExecuting}
              theme={theme}
              styleOverrides={{ padding: '2px 4px', fontSize: '8px' }}
            >
              {step.fileName}
            </StyledSmallButton>
          )}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: theme.textSecondary,
            lineHeight: '1.4'
          }}
        >
          {step.description}
        </div>
        {step.error && (
          <div
            style={{
              fontSize: '11px',
              color: '#dc3545',
              marginTop: '4px'
            }}
          >
            Error: {step.error}
          </div>
        )}
      </div>

      {/* Status Badge and Timer */}
      {step.status === 'executing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
          <span style={{
            fontSize: '11px',
            color: '#666',
          }}>
            Running...
          </span>
          <span style={{
            fontSize: '11px',
            color: theme.textMuted,
            fontFamily: 'monospace'
          }}>
            {Math.floor((step.elapsedTime || 0) / 60).toString().padStart(2, '0')}:{((step.elapsedTime || 0) % 60).toString().padStart(2, '0')}
          </span>
        </div>
      )}
      
      {/* Show failed badge for error status */}
      {step.status === 'error' && (
        <div
          style={{
            fontSize: '11px',
            padding: '4px 8px',
            borderRadius: '3px',
            backgroundColor: getStepBorderColor(),
            color: 'white',
            marginLeft: '12px'
          }}
        >
          Failed
        </div>
      )}
    </div>
  );
}
