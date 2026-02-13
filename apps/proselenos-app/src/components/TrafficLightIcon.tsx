// components/TrafficLightIcon.tsx
// Shared traffic light indicator showing backup urgency: green (0 changes), yellow (1), red (2+)

'use client';

import React from 'react';

interface TrafficLightIconProps {
  changeCount: number;       // 0=green, 1=yellow, 2+=red
  isDarkMode: boolean;
  onClick: () => void;
  tooltip: string;
}

export default function TrafficLightIcon({ changeCount, isDarkMode, onClick, tooltip }: TrafficLightIconProps) {
  const housing = isDarkMode ? '#2a2a2a' : '#d0d0d0';
  const inactive = isDarkMode ? '#3a3a3a' : '#c0c0c0';

  const green = '#22c55e';
  const yellow = '#eab308';
  const red = '#ef4444';

  // Determine which light is active
  const activeLight: 'green' | 'yellow' | 'red' =
    changeCount === 0 ? 'green' : changeCount === 1 ? 'yellow' : 'red';

  const activeColor = activeLight === 'green' ? green : activeLight === 'yellow' ? yellow : red;
  const filterId = 'traffic-glow';

  return (
    <svg
      width="12"
      height="24"
      viewBox="0 0 12 24"
      onClick={onClick}
      style={{ cursor: 'pointer', flexShrink: 0 }}
      role="img"
      aria-label={tooltip}
    >
      <title>{tooltip}</title>
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Housing */}
      <rect x="0" y="0" width="12" height="24" rx="3" ry="3" fill={housing} />
      {/* Red light (top) */}
      <circle
        cx="6"
        cy="5"
        r="3"
        fill={activeLight === 'red' ? activeColor : inactive}
        filter={activeLight === 'red' ? `url(#${filterId})` : undefined}
      />
      {/* Yellow light (middle) */}
      <circle
        cx="6"
        cy="12"
        r="3"
        fill={activeLight === 'yellow' ? activeColor : inactive}
        filter={activeLight === 'yellow' ? `url(#${filterId})` : undefined}
      />
      {/* Green light (bottom) */}
      <circle
        cx="6"
        cy="19"
        r="3"
        fill={activeLight === 'green' ? activeColor : inactive}
        filter={activeLight === 'green' ? `url(#${filterId})` : undefined}
      />
    </svg>
  );
}
