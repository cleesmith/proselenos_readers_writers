// app/ai-tools/ToolProgressIndicator.tsx

'use client';

import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';

interface ToolProgressIndicatorProps {
  toolExecuting: boolean;
  elapsedTime: number;
  theme: ThemeConfig;
  toolResult?: string;
  onReportClick?: () => void;
  onOneByOneClick?: () => void;
  showOneByOneButton?: boolean;
}

export default function ToolProgressIndicator({
  toolExecuting,
  elapsedTime,
  theme,
  toolResult,
  onReportClick,
  onOneByOneClick,
  showOneByOneButton
}: ToolProgressIndicatorProps) {
  
  if (!toolExecuting && elapsedTime === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{
        fontSize: '11px',
        color: '#22c55e',
        marginLeft: '8px',
        fontFamily: 'monospace'
      }}>
        {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{(elapsedTime % 60).toString().padStart(2, '0')}
      </span>
      
      {/* Report button appears only when tool is finished and has results */}
      {!toolExecuting && elapsedTime > 0 && toolResult && (
        <div style={{ display: 'flex', gap: '4px' }}>

          {onReportClick && (
            <StyledSmallButton
              onClick={onReportClick}
              theme={theme}
              styleOverrides={{ fontSize: '10px', padding: '2px 8px', fontWeight: 'bold' }}
            >
              Report
            </StyledSmallButton>
          )}
          {showOneByOneButton && onOneByOneClick && (
            <StyledSmallButton
              onClick={onOneByOneClick}
              theme={theme}
              styleOverrides={{ fontSize: '10px', padding: '2px 8px', fontWeight: 'bold' }}
            >
              One-by-one
            </StyledSmallButton>
          )}
        </div>
      )}
    </div>
  );
}
