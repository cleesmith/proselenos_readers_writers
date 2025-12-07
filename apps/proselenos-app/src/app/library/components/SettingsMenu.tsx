import clsx from 'clsx';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import { PiUserCircleCheck, PiGear, PiSignIn, PiPencil, PiStorefront, PiTrash } from 'react-icons/pi';
import { PiSun, PiMoon } from 'react-icons/pi';
import { clearAllUserEbooks } from '@/app/actions/ebook-actions';
import { showConfirm, showAlert } from '@/app/shared/alerts';
import { TbSunMoon } from 'react-icons/tb';
import { VscRepo } from 'react-icons/vsc';

import { isDesktopAppPlatform } from '@/services/environment';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { setAboutDialogVisible } from '@/components/AboutWindow';
import { saveSysSettings } from '@/helpers/settings';
import { invoke } from '@/utils/desktop-stubs';
import UserAvatar from '@/components/UserAvatar';
import MenuItem from '@/components/MenuItem';
import Menu from '@/components/Menu';

interface SettingsMenuProps {
  setIsDropdownOpen?: (isOpen: boolean) => void;
  onOpenBookRepo?: () => void;
}

// No Desktop - permissions removed
interface Permissions {
  postNotification: string;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ setIsDropdownOpen, onOpenBookRepo }) => {
  const _ = useTranslation();
  const router = useRouter();
  const { envConfig, appService } = useEnv();
  const { data: session } = useSession();
  const user = session?.user;
  const { themeMode, setThemeMode } = useThemeStore();
  const { settings, setSettingsDialogOpen } = useSettingsStore();
    const [isAutoCheckUpdates, setIsAutoCheckUpdates] = useState(settings.autoCheckUpdates);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(settings.alwaysOnTop);
  const [isAlwaysShowStatusBar, setIsAlwaysShowStatusBar] = useState(settings.alwaysShowStatusBar);
    const [isOpenLastBooks, setIsOpenLastBooks] = useState(settings.openLastBooks);
  const [isAutoImportBooksOnOpen, setIsAutoImportBooksOnOpen] = useState(
    settings.autoImportBooksOnOpen,
  );
  const [alwaysInForeground, setAlwaysInForeground] = useState(settings.alwaysInForeground);
  const [savedBookCoverForLockScreen, setSavedBookCoverForLockScreen] = useState(
    settings.savedBookCoverForLockScreen || '',
  );
  const iconSize = useResponsiveSize(16);

  const showAboutProselenosebooks = () => {
    setAboutDialogVisible(true);
    setIsDropdownOpen?.(false);
  };

  const handleSignIn = () => {
    signIn('google');
    setIsDropdownOpen?.(false);
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
    setIsDropdownOpen?.(false);
  };

  const cycleThemeMode = () => {
    const nextMode = themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto';
    setThemeMode(nextMode);
  };

  const handleFullScreen = () => {
    // No Desktop - fullscreen removed
    setIsDropdownOpen?.(false);
  };

  const toggleOpenInNewWindow = () => {
    saveSysSettings(envConfig, 'openBookInNewWindow', !settings.openBookInNewWindow);
    setIsDropdownOpen?.(false);
  };

  const toggleAlwaysOnTop = () => {
    const newValue = !settings.alwaysOnTop;
    saveSysSettings(envConfig, 'alwaysOnTop', newValue);
    setIsAlwaysOnTop(newValue);
    // No Desktop - always on top removed
    setIsDropdownOpen?.(false);
  };

  const toggleAlwaysShowStatusBar = () => {
    const newValue = !settings.alwaysShowStatusBar;
    saveSysSettings(envConfig, 'alwaysShowStatusBar', newValue);
    setIsAlwaysShowStatusBar(newValue);
  };

  const toggleAutoImportBooksOnOpen = () => {
    const newValue = !settings.autoImportBooksOnOpen;
    saveSysSettings(envConfig, 'autoImportBooksOnOpen', newValue);
    setIsAutoImportBooksOnOpen(newValue);
  };

  const toggleAutoCheckUpdates = () => {
    const newValue = !settings.autoCheckUpdates;
    saveSysSettings(envConfig, 'autoCheckUpdates', newValue);
    setIsAutoCheckUpdates(newValue);
  };

  const toggleOpenLastBooks = () => {
    const newValue = !settings.openLastBooks;
    saveSysSettings(envConfig, 'openLastBooks', newValue);
    setIsOpenLastBooks(newValue);
  };

  const handleSetRootDir = () => {
    // No Desktop - migrate data feature removed
    setIsDropdownOpen?.(false);
  };

  const openSettingsDialog = () => {
    setIsDropdownOpen?.(false);
    setSettingsDialogOpen(true);
  };

  const openBookRepoModal = () => {
    setIsDropdownOpen?.(false);
    onOpenBookRepo?.();
  };

  const switchToAuthorsMode = () => {
    setIsDropdownOpen?.(false);
    // router.push('/authors'); // Navigate to authors page

    // open in a new tab ('_blank') instead of navigating in the current window
    // window.open('/authors', '_blank');

    // force the browser to reuse the existing tab if it's already open:
    window.open('/authors', 'proselenos_authors_mode');
  };

  const openBookstore = () => {
    setIsDropdownOpen?.(false);
    router.push('/store');
  };

  const handleResetLibrary = async () => {
    const isDark = themeMode === 'dark' || (themeMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const confirmed = await showConfirm(
      'This will permanently delete ALL ebooks from your local library AND from Private Ebooks. This cannot be undone!',
      isDark,
      'Reset Library?',
      'Yes, Delete Everything',
      'Cancel'
    );

    if (!confirmed) return;

    setIsDropdownOpen?.(false);

    try {
      // 1. Clear Private Ebooks (Supabase)
      if (user) {
        const result = await clearAllUserEbooks();
        if (!result.success) {
          console.error('Failed to clear Private Ebooks:', result.error);
        }
      }

      // 2. Clear local storage
      localStorage.clear();
      sessionStorage.clear();

      // 3. Delete IndexedDB databases and wait for completion
      const deleteDB = (name: string) => new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => {
          console.log(`IndexedDB '${name}' deleted`);
          resolve();
        };
        request.onerror = () => {
          console.error(`Failed to delete IndexedDB '${name}'`);
          resolve(); // Continue anyway
        };
        request.onblocked = () => {
          console.warn(`IndexedDB '${name}' delete blocked`);
          resolve(); // Continue anyway
        };
      });

      // Delete the ebook storage database
      await deleteDB('AppFileSystem');

      // 4. Reload the page
      window.location.reload();
    } catch (error) {
      console.error('Reset library error:', error);
      showAlert('Failed to reset library. Please try again.', 'error', 'Error', isDark);
    }
  };

  const handleSetSavedBookCoverForLockScreen = () => {
    const newValue = settings.savedBookCoverForLockScreen ? '' : 'default';
    saveSysSettings(envConfig, 'savedBookCoverForLockScreen', newValue);
    setSavedBookCoverForLockScreen(newValue);
  };

  const toggleAlwaysInForeground = async () => {
    const requestAlwaysInForeground = !settings.alwaysInForeground;

    if (requestAlwaysInForeground) {
      let permission = await invoke<Permissions>('plugin:native-tts|checkPermissions');
      if (permission.postNotification !== 'granted') {
        permission = await invoke<Permissions>('plugin:native-tts|requestPermissions', {
          permissions: ['postNotification'],
        });
      }
      if (permission.postNotification !== 'granted') return;
    }

    saveSysSettings(envConfig, 'alwaysInForeground', requestAlwaysInForeground);
    setAlwaysInForeground(requestAlwaysInForeground);
  };

  const avatarUrl = user?.image;
  const userFullName = user?.name;
  const userDisplayName = userFullName ? userFullName.split(' ')[0] : null;
  const themeModeLabel =
    themeMode === 'dark'
      ? _('Dark Mode')
      : themeMode === 'light'
        ? _('Light Mode')
        : _('Auto Mode');

  return (
    <Menu
      className={clsx(
        'settings-menu dropdown-content no-triangle border-base-100',
        'z-20 mt-2 max-w-[90vw] shadow-2xl',
      )}
    >
      {user ? (
        <MenuItem
          label={
            userDisplayName
              ? _('Logged in as {{userDisplayName}}', { userDisplayName })
              : _('Logged in')
          }
          labelClass='!max-w-40'
          Icon={
            avatarUrl ? (
              <UserAvatar url={avatarUrl} size={iconSize} DefaultIcon={PiUserCircleCheck} />
            ) : (
              PiUserCircleCheck
            )
          }
        >
          <ul className='flex flex-col'>
            <MenuItem label={_('Sign Out')} noIcon onClick={handleSignOut} />
          </ul>
        </MenuItem>
      ) : (
        <MenuItem label={_('Sign In with Google')} Icon={PiSignIn} onClick={handleSignIn} />
      )}
            {user && <MenuItem label={_('Private Ebooks')} Icon={VscRepo} onClick={openBookRepoModal} />}
      {isDesktopAppPlatform() && !appService?.isMobile && (
        <MenuItem
          label={_('Auto Import on File Open')}
          toggled={isAutoImportBooksOnOpen}
          onClick={toggleAutoImportBooksOnOpen}
        />
      )}
      {isDesktopAppPlatform() && (
        <MenuItem
          label={_('Open Last Book on Start')}
          toggled={isOpenLastBooks}
          onClick={toggleOpenLastBooks}
        />
      )}
      {appService?.hasUpdater && (
        <MenuItem
          label={_('Check Updates on Start')}
          toggled={isAutoCheckUpdates}
          onClick={toggleAutoCheckUpdates}
        />
      )}
      <hr aria-hidden='true' className='border-base-200 my-1' />
      {appService?.hasWindow && (
        <MenuItem
          label={_('Open Book in New Window')}
          toggled={settings.openBookInNewWindow}
          onClick={toggleOpenInNewWindow}
        />
      )}
      {appService?.hasWindow && <MenuItem label={_('Fullscreen')} onClick={handleFullScreen} />}
      {appService?.hasWindow && (
        <MenuItem label={_('Always on Top')} toggled={isAlwaysOnTop} onClick={toggleAlwaysOnTop} />
      )}
      {appService?.isMobileApp && (
        <MenuItem
          label={_('Always Show Status Bar')}
          toggled={isAlwaysShowStatusBar}
          onClick={toggleAlwaysShowStatusBar}
        />
      )}
      <MenuItem
        label={_('Public Ebooks')}
        description={_('browse and import ebooks')}
        Icon={PiStorefront}
        buttonClass='bg-green-600/20 hover:!bg-green-600/30'
        onClick={openBookstore}
      />
            {appService?.isAndroidApp && (
        <MenuItem
          label={_(_('Background Read Aloud'))}
          toggled={alwaysInForeground}
          onClick={toggleAlwaysInForeground}
        />
      )}
            <MenuItem
        label={themeModeLabel}
        Icon={themeMode === 'dark' ? PiMoon : themeMode === 'light' ? PiSun : TbSunMoon}
        onClick={cycleThemeMode}
      />
      {user && (
        <MenuItem
          label={_('Reset Library')}
          description={_('clear local & Private Ebooks')}
          Icon={PiTrash}
          buttonClass='bg-red-900/20 hover:!bg-red-900/30'
          onClick={handleResetLibrary}
        />
      )}
      <MenuItem label={_('Settings')} Icon={PiGear} onClick={openSettingsDialog} />
      <hr aria-hidden='true' className='border-base-200 my-1' />
      {user && (
        <MenuItem
          label={_('Authors')}
          description={_('use AI and non-AI tools to help with editing, writing, and publishing your manuscripts')}
          Icon={PiPencil}
          buttonClass='bg-blue-600/20 hover:!bg-blue-600/30'
          onClick={switchToAuthorsMode}
        />
      )}
      {appService?.canCustomizeRootDir && (
        <>
          <hr aria-hidden='true' className='border-base-200 my-1' />
          <MenuItem label={_('Advanced Settings')}>
            <ul className='flex flex-col'>
              <MenuItem
                label={_('Change Data Location')}
                noIcon={!appService?.isAndroidApp}
                onClick={handleSetRootDir}
              />
              {appService?.isAndroidApp && (
                <MenuItem
                  label={_('Save Book Cover')}
                  tooltip={_('Auto-save last book cover')}
                  description={savedBookCoverForLockScreen ? '💾 Images/last-book-cover.png' : ''}
                  toggled={!!savedBookCoverForLockScreen}
                  onClick={handleSetSavedBookCoverForLockScreen}
                />
              )}
            </ul>
          </MenuItem>
        </>
      )}
      <hr aria-hidden='true' className='border-base-200 my-1' />
      <MenuItem label={_('About')} onClick={showAboutProselenosebooks} />
    </Menu>
  );
};

export default SettingsMenu;
