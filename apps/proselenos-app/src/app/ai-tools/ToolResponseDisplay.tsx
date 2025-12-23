// Tool Response Display Component
// Extracted from app/page.tsx lines 1287-1309 (Tool Results section)

'use client';

import { ThemeConfig } from '../shared/theme';

interface ToolResponseDisplayProps {
  toolResult: string;
  theme: ThemeConfig;
}

export default function ToolResponseDisplay({
  toolResult,
  theme
}: ToolResponseDisplayProps) {
  
  if (!toolResult) return null;

  return (
    <div style={{
      marginTop: '12px',
      padding: '8px',
      backgroundColor: theme.statusBg,
      border: `1px solid ${theme.border}`,
      borderRadius: '4px',
      fontSize: '12px',
      color: theme.text,
      maxHeight: '200px',
      overflowY: 'auto'
    }}>
      <strong>Tool Result:</strong>
      <pre style={{ 
        whiteSpace: 'pre-wrap', 
        fontFamily: 'inherit',
        margin: '4px 0 0 0'
      }}>
        {toolResult}
      </pre>
    </div>
  );
}