import useStore from '../store/useStore';

const AUTH_TIMEOUT_MS = 2 * 60 * 1000;

export const triggerGoogleAuth = () => {
  return new Promise((resolve) => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open('/api/google/auth/start', 'GoogleLogin', `width=${width},height=${height},left=${left},top=${top}`);

    if (!popup) {
      resolve(false);
      return;
    }

    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(authTimeout);
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== popup) return;
      if (event.data?.type !== 'google_auth') return;

      if (!event.data.success) {
        finish(false);
        return;
      }

      const connected = await useStore.getState().checkGoogleSession();

      if (connected) {
        window.dispatchEvent(new Event('google_interactive_login'));
      }

      finish(connected);
    };

    window.addEventListener('message', handleMessage);

    const authTimeout = setTimeout(() => {
      finish(false);
    }, AUTH_TIMEOUT_MS);
  });
};
