// components/StyledSmallButton.tsx

'use client';

import React from 'react';
import { ThemeConfig } from '@/app/shared/theme';
interface StyledSmallButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  theme: ThemeConfig;
  styleOverrides?: React.CSSProperties;
}

export default function StyledSmallButton({
  children,
  onClick,
  disabled = false,
  title,
  theme,
  styleOverrides = {},
  ...rest
}: StyledSmallButtonProps) {
  const baseStyle: React.CSSProperties = {
    padding: '3px 8px',
    backgroundColor: disabled ? '#6c757d' : theme.modalBg,
    color: disabled ? '#999' : theme.text,
    border: `1px solid ${theme.border}`,
    borderRadius: '9999px',
    fontSize: '11px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    marginRight: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    ...styleOverrides,
  };

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      style={baseStyle}
      {...rest}
    >
      {children}
    </button>
  );
}
