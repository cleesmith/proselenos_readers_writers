import clsx from 'clsx';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PiGear, PiPencil, PiTrash, PiArrowClockwise, PiDatabase, PiInfo } from 'react-icons/pi';
import { PiSun, PiMoon } from 'react-icons/pi';
import { showConfirm, showAlert } from '@/app/shared/alerts';
import { TbSunMoon } from 'react-icons/tb';

import { isDesktopAppPlatform } from '@/services/environment';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { setAboutDialogVisible } from '@/components/AboutWindow';
import { setStorageDialogVisible } from '@/components/StorageWindow';
import { saveSysSettings } from '@/helpers/settings';
import { invoke } from '@/utils/desktop-stubs';
import MenuItem from '@/components/MenuItem';
import Menu from '@/components/Menu';

interface SettingsMenuProps {
  setIsDropdownOpen?: (isOpen: boolean) => void;
}

// No Desktop - permissions removed
interface Permissions {
  postNotification: string;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ setIsDropdownOpen }) => {
  const router = useRouter();
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
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

  const showAboutProselenosebooks = () => {
    setAboutDialogVisible(true);
    setIsDropdownOpen?.(false);
  };

  const showStorageInfo = () => {
    setStorageDialogVisible(true);
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

  const switchToAuthorsMode = () => {
    setIsDropdownOpen?.(false);

    // If Authors tab that opened this Library is still open, just show message
    if (window.opener && !window.opener.closed) {
      const isDark = themeMode === 'dark' || (themeMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      showAlert('Authors is already open in another tab', 'info', undefined, isDark);
      return;
    }

    // Otherwise navigate to Authors in this tab
    router.push('/authors');
  };

  const handleResetLibrary = async () => {
    const isDark = themeMode === 'dark' || (themeMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const confirmed = await showConfirm(
      'This will permanently delete ALL ebooks from your Library AND clear your current ebook writing in Authors. This cannot be undone!',
      isDark,
      'Reset Library & Authors?',
      'Yes, Delete Everything',
      'Cancel'
    );

    if (!confirmed) return;

    setIsDropdownOpen?.(false);

    try {
      // 1. Clear local storage
      localStorage.clear();
      sessionStorage.clear();

      // 2. Delete IndexedDB databases and wait for completion
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

      // Delete the ebook storage database and Authors database
      await deleteDB('AppFileSystem');
      await deleteDB('ProselenosLocal');

      // 3. Reload the page
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
        'z-20 mt-2 min-w-80 max-w-[90vw] shadow-2xl',
      )}
    >
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
      {appService?.isAndroidApp && (
        <MenuItem
          label={_(_('Background Read Aloud'))}
          toggled={alwaysInForeground}
          onClick={toggleAlwaysInForeground}
        />
      )}
      <MenuItem
        label={_('Reload Page')}
        Icon={PiArrowClockwise}
        onClick={() => window.location.reload()}
      />
      <MenuItem
        label={themeModeLabel}
        Icon={themeMode === 'dark' ? PiMoon : themeMode === 'light' ? PiSun : TbSunMoon}
        onClick={cycleThemeMode}
      />
      <MenuItem label={_('Settings')} Icon={PiGear} onClick={openSettingsDialog} />
      <hr aria-hidden='true' className='border-base-200 my-1' />
      <MenuItem
        label={_('Authors')}
        description={_('use AI and non-AI tools to help with editing, writing, and publishing your manuscripts')}
        Icon={PiPencil}
        buttonClass='bg-blue-600/20 hover:!bg-blue-600/30'
        onClick={switchToAuthorsMode}
      />
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
      <MenuItem label={_('Storage')} Icon={PiDatabase} onClick={showStorageInfo} />
      <MenuItem
        label={_('Reset Library & Authors')}
        description={_('clear all local data')}
        Icon={PiTrash}
        buttonClass='bg-red-900/20 hover:!bg-red-900/30'
        onClick={handleResetLibrary}
      />
      <MenuItem label={_('About')} Icon={PiInfo} onClick={showAboutProselenosebooks} />
    </Menu>
  );
};

export default SettingsMenu;
