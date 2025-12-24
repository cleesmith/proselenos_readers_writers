import { useRouter } from 'next/navigation';
import { useEnv } from '@/context/EnvContext';
import { deleteUser } from '@/libs/user';
import { eventDispatcher } from '@/utils/event';
import { saveSysSettings } from '@/helpers/settings';
import { navigateToResetPassword } from '@/utils/nav';

export const useUserActions = () => {
  const router = useRouter();
  const { envConfig } = useEnv();

  const handleLogout = () => {
    window.location.href = '/';
    saveSysSettings(envConfig, 'keepLogin', false);
  };

  const handleResetPassword = () => {
    navigateToResetPassword(router);
  };

  const handleConfirmDelete = async (errorMessage: string) => {
    try {
      await deleteUser();
      handleLogout();
    } catch (error) {
      console.error('Error deleting user:', error);
      eventDispatcher.dispatch('toast', {
        type: 'error',
        message: errorMessage,
      });
    }
  };

  return {
    handleLogout,
    handleResetPassword,
    handleConfirmDelete,
  };
};
