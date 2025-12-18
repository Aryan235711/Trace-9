import { toast } from 'sonner';
import { isUnauthorizedError } from '@/lib/authUtils';

type ApiErrorOptions = {
  fallbackTitle?: string;
  fallbackDescription?: string;
  onUnauthorized?: () => void;
};

export function useNotifications() {
  const info = (title: string, description?: string) => {
    toast.info(title, { description });
  };

  const success = (title: string, description?: string) => {
    toast.success(title, { description });
  };

  const error = (title: string, description?: string) => {
    toast.error(title, { description });
  };

  const warning = (title: string, description?: string) => {
    toast.warning(title, { description });
  };

  const apiError = (errorValue: unknown, options?: ApiErrorOptions) => {
    const defaultTitle = 'Something went wrong';
    const message =
      errorValue instanceof Error
        ? errorValue.message
        : typeof errorValue === 'string'
        ? errorValue
        : options?.fallbackTitle || defaultTitle;

    if (options?.onUnauthorized && errorValue instanceof Error && isUnauthorizedError(errorValue)) {
      options.onUnauthorized();
    }

    toast.error(message, {
      description: options?.fallbackDescription,
    });
  };

  return {
    info,
    success,
    error,
    warning,
    apiError,
  };
