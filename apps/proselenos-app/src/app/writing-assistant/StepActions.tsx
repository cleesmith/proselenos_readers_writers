// app/writing-assistant/StepActions.tsx

'use client';

import { StepActionsProps } from './types';
import StyledSmallButton from '@/components/StyledSmallButton';

export default function StepActions({
  step,
  onExecute,
  onView: _onView,
  onRedo: _onRedo,
  isExecuting,
  isAnyStepExecuting,
  theme,
  onClose,
  onOpenChatForBrainstorm // Add this new prop
}: StepActionsProps) {
  
  const isBrainstorm = step.id === 'brainstorm';
  const smallStyle = isBrainstorm ? { padding: '2px 6px', fontSize: '10px' } : {};

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      {/* Run Button - Always visible */}
      <StyledSmallButton
        onClick={onExecute}
        disabled={isExecuting || isAnyStepExecuting}
        theme={theme}
        styleOverrides={smallStyle}
      >
        {isExecuting ? '...' : 'Run'}
      </StyledSmallButton>

      {/* Chat Button - Only for brainstorm step */}
      {isBrainstorm && onOpenChatForBrainstorm && (
        <StyledSmallButton
          onClick={() => onOpenChatForBrainstorm(onClose)}
          disabled={isExecuting || isAnyStepExecuting}
          theme={theme}
          styleOverrides={smallStyle}
        >
          Chat
        </StyledSmallButton>
      )}
    </div>
  );
}
