import { toast } from 'sonner';

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

  return {
    info,
    success,
    error,
    warning,
  };
}