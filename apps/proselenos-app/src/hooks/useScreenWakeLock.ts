import { useEffect, useRef } from 'react';

export const useScreenWakeLock = (lock: boolean) => {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');

          wakeLockRef.current.addEventListener('release', () => {
            wakeLockRef.current = null;
          });

          console.log('Wake lock acquired');
        }
      } catch (err) {
        console.info('Failed to acquire wake lock:', err);
      }
    };

    const releaseWakeLock = () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Wake lock released');
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        releaseWakeLock();
      } else {
        requestWakeLock();
      }
    };

    if (lock) {
      requestWakeLock();
    } else if (wakeLockRef.current) {
      releaseWakeLock();
    }

    // No Desktop - web-only wake lock
    if (lock) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      releaseWakeLock();
      if (lock) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [lock]);
};
