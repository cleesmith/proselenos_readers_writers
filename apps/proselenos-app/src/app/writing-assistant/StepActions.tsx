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
  
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {/* Run Button - Always visible */}
      <StyledSmallButton
        onClick={onExecute}
        disabled={isExecuting || isAnyStepExecuting}
        theme={theme}
      >
        {isExecuting ? 'Running...' : 'Run'}
      </StyledSmallButton>

      {/* Chat Button - Only for brainstorm step */}
      {step.id === 'brainstorm' && onOpenChatForBrainstorm && (
        <StyledSmallButton
          onClick={() => onOpenChatForBrainstorm(onClose)}
          disabled={isExecuting || isAnyStepExecuting}
          theme={theme}
        >
          Chat
        </StyledSmallButton>
      )}
    </div>
  );
}
