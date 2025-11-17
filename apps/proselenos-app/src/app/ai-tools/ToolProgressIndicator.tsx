// app/ai-tools/ToolProgressIndicator.tsx

'use client';

import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';

interface ToolProgressIndicatorProps {
  toolExecuting: boolean;
  elapsedTime: number;
  theme: ThemeConfig;
  toolResult?: string;
  onEditClick?: () => void;
}

export default function ToolProgressIndicator({
  toolExecuting,
  elapsedTime,
  theme,
  toolResult,
  onEditClick
}: ToolProgressIndicatorProps) {
  
  if (!toolExecuting && elapsedTime === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{
        fontSize: '11px',
        color: theme.textMuted,
        marginLeft: '8px',
        fontFamily: 'monospace'
      }}>
        {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{(elapsedTime % 60).toString().padStart(2, '0')}
      </span>
      
      {/* Edit button appears only when tool is finished and has results */}
      {!toolExecuting && elapsedTime > 0 && toolResult && (
        <div style={{ display: 'flex', gap: '4px' }}>

          {onEditClick && (
            <StyledSmallButton
              onClick={onEditClick}
              theme={theme}
              styleOverrides={{ fontSize: '10px', padding: '2px 8px', fontWeight: 'bold' }}
            >
              View-Edit
            </StyledSmallButton>
          )}
        </div>
      )}
    </div>
  );
}
