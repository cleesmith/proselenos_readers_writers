import clsx from 'clsx';
import React, { useState, useEffect } from 'react';
import { PiDotsThreeVerticalBold } from 'react-icons/pi';

import { Insets } from '@/types/misc';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';

interface FloatingBarToggleProps {
  bookKey: string;
  gridInsets: Insets;
}

const FloatingBarToggle: React.FC<FloatingBarToggleProps> = ({ bookKey, gridInsets }) => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const { hoveredBookKey, setHoveredBookKey } = useReaderStore();
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Detect touch-primary devices (covers iPad in browser, phones, etc.)
  useEffect(() => {
    const checkTouchDevice = () => {
      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const isMobile = appService?.isMobile || false;
      setIsTouchDevice(hasCoarsePointer || isMobile);
    };

    checkTouchDevice();

    // Re-check on window resize (e.g., desktop touch simulation)
    window.addEventListener('resize', checkTouchDevice);
    return () => window.removeEventListener('resize', checkTouchDevice);
  }, [appService?.isMobile]);

  // Don't render on non-touch devices
  if (!isTouchDevice) return null;

  const barsVisible = hoveredBookKey === bookKey;

  const handleToggle = () => {
    if (barsVisible) {
      setHoveredBookKey('');
    } else {
      setHoveredBookKey(bookKey);
    }
  };

  // Position with safe area + extra padding to avoid browser chrome
  const leftOffset = gridInsets.left + 4; // Tight to left edge, in margin
  const bottomOffset = gridInsets.bottom + 20; // Just above iOS home indicator

  return (
    <button
      className={clsx(
        'fixed z-30 flex h-11 w-7 items-center justify-center rounded-md',
        'bg-base-300/50 shadow-lg backdrop-blur-sm',
        'transition-opacity duration-300',
        'active:bg-base-300/70',
        barsVisible ? 'opacity-70' : 'opacity-40',
      )}
      style={{
        left: `${leftOffset}px`,
        bottom: `${bottomOffset}px`,
      }}
      onClick={handleToggle}
      aria-label={_(barsVisible ? 'Hide reader controls' : 'Show reader controls')}
      title={_(barsVisible ? 'Hide reader controls' : 'Show reader controls')}
    >
      <PiDotsThreeVerticalBold
        className='text-base-content'
        size={20}
      />
    </button>
  );
};

export default FloatingBarToggle;
