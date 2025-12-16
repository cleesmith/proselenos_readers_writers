// app/ai-tools/ToolProgressIndicator.tsx

'use client';

import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';

// Read thresholds from env vars (client-side) - must be set in .env.local
const TIMER_WARNING_SECS = parseInt(process.env['NEXT_PUBLIC_TIMER_WARNING_SECS']!, 10);
const TIMER_DANGER_SECS = parseInt(process.env['NEXT_PUBLIC_TIMER_DANGER_SECS']!, 10);

// Timer color changes as timeout approaches (stoplight: green → yellow → red)
function getTimerColor(elapsed: number): string {
  if (elapsed >= TIMER_DANGER_SECS) return '#dc3545';   // Red - danger zone
  if (elapsed >= TIMER_WARNING_SECS) return '#ffc107';  // Yellow - warning zone
  return '#28a745'; // Green - normal
}

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
        color: getTimerColor(elapsedTime),
        marginLeft: '8px',
        fontFamily: 'monospace',
        fontWeight: elapsedTime >= TIMER_DANGER_SECS ? 'bold' : 'normal'
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
