'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Fetch sw.js to extract version from comment
        fetch('/sw.js')
          .then((res) => res.text())
          .then((text) => {
            const match = text.match(/Version: ([a-f0-9]+)/);
            const version = match ? match[1] : 'unknown';
            console.log(`Service Worker offline cache: everythingebooks-${version}`);
          });

        // Check for updates periodically (every hour when online)
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });
  }, []);

  return null;
}
