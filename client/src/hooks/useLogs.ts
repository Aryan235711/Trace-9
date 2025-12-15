import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type DailyLog, type CreateDailyLog } from "@/lib/api";
import { useNotifications } from "@/hooks/useNotifications";
import { isUnauthorizedError } from "@/lib/authUtils";

export function useLogs(startDate?: string, endDate?: string) {
  const notify = useNotifications();
  const queryClient = useQueryClient();

  const enabled = Boolean(startDate || endDate);

  const { data: logs = [], isLoading, isFetching, error } = useQuery({
    queryKey: ["logs", startDate, endDate],
    queryFn: () => api.getLogs(startDate, endDate),
    enabled,
  });

  const handleUnauthorized = () => {
    localStorage.removeItem('auth_token');
    window.dispatchEvent(new Event('trace:auth:logout'));
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateDailyLog) => api.createLog(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      notify.success("Log saved", "Your daily log has been saved successfully.");
    },
    onError: (error: Error) => {
      notify.apiError(error, {
        fallbackTitle: "Error",
        fallbackDescription: "Failed to save log. Please try again.",
        onUnauthorized: handleUnauthorized,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ date, data }: { date: string; data: Partial<CreateDailyLog> }) =>
      api.updateLog(date, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      notify.success("Log updated", "Your daily log has been updated successfully.");
    },
    onError: (error: Error) => {
      notify.apiError(error, {
        fallbackTitle: "Error",
        fallbackDescription: "Failed to update log. Please try again.",
        onUnauthorized: handleUnauthorized,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (date: string) => api.deleteLog(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      notify.success("Log deleted", "Your daily log has been deleted.");
    },
    onError: (error: Error) => {
      notify.apiError(error, {
        fallbackTitle: "Error",
        fallbackDescription: "Failed to delete log. Please try again.",
        onUnauthorized: handleUnauthorized,
      });
    },
  });

  return {
    logs,
    isLoading,
    isFetching,
    error,
    createLog: createMutation.mutate,
    createLogAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateLog: updateMutation.mutate,
    updateLogAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteLog: deleteMutation.mutate,
    deleteLogAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}

export function useLog(date: string) {
  const { data: log, isLoading, error } = useQuery({
    queryKey: ["log", date],
    queryFn: () => api.getLog(date),
    retry: false,
  });

  return {
    log,
    isLoading,
    error,
  };
}
