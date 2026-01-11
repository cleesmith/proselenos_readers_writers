// apps/proselenos-app/src/components/AboutWindow.tsx
// About for ereader Library page

import React, { useEffect, useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { parseWebViewInfo } from '@/utils/ua';
import { getAppVersion } from '@/utils/version';
import SupportLinks from './SupportLinks';
import LegalLinks from './LegalLinks';
import Dialog from './Dialog';
import Link from './Link';
import { RELEASE_HASH } from '@/generated/release';

export const setAboutDialogVisible = (visible: boolean) => {
  const dialog = document.getElementById('about_window');
  if (dialog) {
    const event = new CustomEvent('setDialogVisibility', {
      detail: { visible },
    });
    dialog.dispatchEvent(event);
  }
};

export const AboutWindow = () => {
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const [browserInfo, setBrowserInfo] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setBrowserInfo(parseWebViewInfo(appService));

    const handleCustomEvent = (event: CustomEvent) => {
      setIsOpen(event.detail.visible);
    };

    const el = document.getElementById('about_window');
    if (el) {
      el.addEventListener('setDialogVisibility', handleCustomEvent as EventListener);
    }

    return () => {
      if (el) {
        el.removeEventListener('setDialogVisibility', handleCustomEvent as EventListener);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsOpen(false);
  };

  return (
    <Dialog
      id='about_window'
      isOpen={isOpen}
      title={_('EverythingEbooks')}
      onClose={handleClose}
      boxClassName='sm:!w-[480px] sm:!max-w-screen-sm sm:h-auto'
    >
      {isOpen && (
        <div className='about-content flex h-full flex-col items-center justify-center gap-4 pb-10 sm:pb-0'>
          <div className='flex flex-1 flex-col items-center justify-end gap-2 px-8 py-2'>
            <div className='mb-2 mt-6'>
              <img src='/icon.png' alt='App Logo' className='h-20 w-20' width={64} height={64} />
            </div>
            <div className='flex select-text flex-col items-center'>
              <h2 className='mb-1 text-2xl font-bold'>EverythingEbooks</h2>
              <p className='mb-2 text-sm italic tracking-wide text-neutral-content'>Readers and Writers</p>
              <p className='text-neutral-content text-center text-sm'>
                {_('Version {{version}}', { version: getAppVersion() })} {`(${browserInfo})`}
              </p>
              {settings.hideWelcomeModal && (
                <button
                  className='btn btn-xs btn-ghost text-blue-500 mt-2'
                  onClick={() => {
                    const newSettings = { ...settings, hideWelcomeModal: false };
                    setSettings(newSettings);
                    saveSettings(envConfig, newSettings);
                  }}
                >
                  {_('Show Welcome again')}
                </button>
              )}
            </div>

          </div>

          <hr className='border-base-300 my-12 w-full sm:my-4' />

          <div
            className='flex flex-1 flex-col items-center justify-start gap-2 px-4 text-center'
            dir='ltr'
          >
            <p className='text-neutral-content text-sm'>
              © {new Date().getFullYear()}{' '}
              <Link href='https://www.slipthetrap.com/' className='text-blue-500 underline'>
                slipthetrap.com
              </Link>{' '}
              All rights reserved.
            </p>

            <p className='text-neutral-content text-xs'>
              This software is licensed under the{' '}
              <Link
                href='https://www.gnu.org/licenses/agpl-3.0.html'
                className='text-blue-500 underline'
              >
                GNU Affero General Public License v3.0
              </Link>
              . You are free to use, modify, and distribute this software under the terms of the
              AGPL v3 license. Please see the license for more details.
            </p>
            <p className='text-neutral-content text-xs italic'>
              EverythingEbooks is compatible with{' '}
              <Link href='https://readest.com/' className='text-blue-500 underline'>
                Readest
              </Link>
              , an open-source ebook reader for immersive reading.
              <br />
              For a more robust ebook reader, definitely use Readest.
            </p>

            <LegalLinks />
          </div>
          <SupportLinks />
          <p className='text-neutral-content text-xs mt-4' style={{ opacity: 0.5 }}>
            Release: {RELEASE_HASH}
          </p>
        </div>
      )}
    </Dialog>
  );
};
