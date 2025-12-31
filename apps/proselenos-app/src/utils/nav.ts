import { useRouter, redirect } from 'next/navigation';
import { isPWA, isWebAppPlatform } from '@/services/environment';
import { BOOK_IDS_SEPARATOR } from '@/services/constants';
import { AppService } from '@/types/system';

// No Desktop - desktop window creation removed
export const showReaderWindow = (_appService: AppService, _bookIds: string[]) => {
  // No Desktop - desktop window feature removed
};

export const showLibraryWindow = (_appService: AppService, _filenames: string[]) => {
  // No Desktop - desktop window feature removed
};

export const navigateToReader = (
  router: ReturnType<typeof useRouter>,
  bookIds: string[],
  queryParams?: string,
  navOptions?: { scroll?: boolean },
) => {
  const ids = bookIds.join(BOOK_IDS_SEPARATOR);
  if (isWebAppPlatform() && !isPWA()) {
    router.push(`/reader/${ids}${queryParams ? `?${queryParams}` : ''}`, navOptions);
  } else {
    const params = new URLSearchParams(queryParams || '');
    params.set('ids', ids);
    router.push(`/reader?${params.toString()}`, navOptions);
  }
};

export const navigateToLogin = (router: ReturnType<typeof useRouter>) => {
  // Redirect to homepage where auth is handled
  router.push('/');
};

export const navigateToProfile = (router: ReturnType<typeof useRouter>) => {
  router.push('/user');
};

export const navigateToLibrary = (
  router: ReturnType<typeof useRouter>,
  queryParams?: string,
  navOptions?: { scroll?: boolean },
) => {
  router.replace(`/library${queryParams ? `?${queryParams}` : ''}`, navOptions);
};

export const redirectToLibrary = () => {
  redirect('/library');
};

export const navigateToResetPassword = (router: ReturnType<typeof useRouter>) => {
  router.push('/');
};
