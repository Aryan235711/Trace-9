import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type DailyLog, type CreateDailyLog } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export function useLogs(startDate?: string, endDate?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading, error } = useQuery({
    queryKey: ["logs", startDate, endDate],
    queryFn: () => api.getLogs(startDate, endDate),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDailyLog) => api.createLog(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      toast({
        title: "Log saved",
        description: "Your daily log has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to save log. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ date, data }: { date: string; data: Partial<CreateDailyLog> }) =>
      api.updateLog(date, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      toast({
        title: "Log updated",
        description: "Your daily log has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update log. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (date: string) => api.deleteLog(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      toast({
        title: "Log deleted",
        description: "Your daily log has been deleted.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete log. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    logs,
    isLoading,
    error,
    createLog: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateLog: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteLog: deleteMutation.mutate,
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
