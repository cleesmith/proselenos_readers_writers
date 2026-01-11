'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { checkForAppUpdates, checkAppReleaseNotes } from '@/utils/desktop-stubs';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import Reader from './components/Reader';

// This is only used for the Desktop app in the app router
export default function Page() {
  const _ = useTranslation();
  const { appService } = useEnv();
  const { settings } = useSettingsStore();
  const router = useRouter();

  // Prefetch other routes for offline support
  useEffect(() => {
    router.prefetch('/library');
    router.prefetch('/library/xray');
    router.prefetch('/authors');
  }, [router]);

  useEffect(() => {
    const doCheckAppUpdates = async () => {
      if (appService?.hasUpdater && settings.autoCheckUpdates) {
        await checkForAppUpdates(_);
      } else if (appService?.hasUpdater === false) {
        checkAppReleaseNotes();
      }
    };
    doCheckAppUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appService?.hasUpdater, settings.autoCheckUpdates]);

  return <Reader />;
}
