import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type UserTargets, type UpdateUserTargets } from "@/lib/api";
import { useNotifications } from "@/hooks/useNotifications";

export function useTargets() {
  const notify = useNotifications();
  const queryClient = useQueryClient();

  const { data: targets, isLoading, error } = useQuery({
    queryKey: ["targets"],
    queryFn: api.getTargets,
  });

  const handleUnauthorized = () => {
    localStorage.removeItem('auth_token');
    window.dispatchEvent(new Event('trace:auth:logout'));
  };

  const updateMutation = useMutation({
    mutationFn: (data: UpdateUserTargets) => api.updateTargets(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["targets"] });
      notify.success("Targets updated", "Your targets have been saved successfully.");
    },
    onError: (error: Error) => {
      notify.apiError(error, {
        fallbackTitle: "Error",
        fallbackDescription: "Failed to update targets. Please try again.",
        onUnauthorized: handleUnauthorized,
      });
    },
  });

  return {
    targets,
    isLoading,
    error,
    updateTargets: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
