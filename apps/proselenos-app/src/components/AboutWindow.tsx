import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { parseWebViewInfo } from '@/utils/ua';
import { getAppVersion } from '@/utils/version';
import SupportLinks from './SupportLinks';
import LegalLinks from './LegalLinks';
import Dialog from './Dialog';
import Link from './Link';

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
  const { data: session } = useSession();
  const _ = useTranslation();
  const { appService } = useEnv();
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
    setIsOpen(false);
  };

  return (
    <Dialog
      id='about_window'
      isOpen={isOpen}
      title={_('About Proselenos')}
      onClose={handleClose}
      boxClassName='sm:!w-[480px] sm:!max-w-screen-sm sm:h-auto'
    >
      {isOpen && (
        <div className='about-content flex h-full flex-col items-center justify-center gap-4 pb-10 sm:pb-0'>
          <div className='flex flex-1 flex-col items-center justify-end gap-2 px-8 py-2'>
            <div className='mb-2 mt-6'>
              <Image src='/icon.png' alt='App Logo' className='h-20 w-20' width={64} height={64} />
            </div>
            <div className='flex select-text flex-col items-center'>
              <h2 className='mb-2 text-2xl font-bold'>Proselenos</h2>
              <p className='text-neutral-content text-center text-sm'>
                {_('Version {{version}}', { version: getAppVersion() })} {`(${browserInfo})`}
              </p>
            </div>

            {session?.user?.name && session?.user?.email && (
              <>
                <hr className='border-base-300 my-4 w-full' />
                <div className='flex items-center gap-3'>
                  {session.user.image && (
                    <Image
                      src={session.user.image}
                      alt='User profile'
                      className='rounded-full'
                      width={48}
                      height={48}
                    />
                  )}
                  <div className='text-neutral-content text-sm font-medium'>
                    <p className='mb-0'>Welcome, {session.user.name}</p>
                    <p className='mb-0'>of {session.user.email}</p>
                    <p className='mb-0'>with Google Id of</p>
                    <p className='mb-0'>{session.user.id}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <hr className='border-base-300 my-12 w-full sm:my-4' />

          <div
            className='flex flex-1 flex-col items-center justify-start gap-2 px-4 text-center'
            dir='ltr'
          >
            <p className='text-neutral-content text-sm'>
              © {new Date().getFullYear()} slipthetrap.com All rights reserved.
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
            <p className='text-neutral-content text-xs'>
              Source code is available at{' '}
              <Link href='https://github.com/proselenosebooks' className='text-blue-500 underline'>
                GitHub
              </Link>
              .
            </p>

            <LegalLinks />
          </div>
          <SupportLinks />
        </div>
      )}
    </Dialog>
  );
};
