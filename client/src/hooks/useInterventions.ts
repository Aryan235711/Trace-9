import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Intervention, type CreateIntervention } from "@/lib/api";
import { useNotifications } from "@/hooks/useNotifications";

export function useInterventions() {
  const notify = useNotifications();
  const queryClient = useQueryClient();

  const { data: interventions = [], isLoading, error } = useQuery({
    queryKey: ["interventions"],
    queryFn: api.getInterventions,
  });

  const handleUnauthorized = () => {
    localStorage.removeItem('auth_token');
    window.dispatchEvent(new Event('trace:auth:logout'));
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateIntervention) => api.createIntervention(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["activeIntervention"] });
      notify.success("Intervention started", "Your 7-day intervention has been created.");
    },
    onError: (error: Error) => {
      notify.apiError(error, {
        fallbackTitle: "Error",
        fallbackDescription: "Failed to create intervention. Please try again.",
        onUnauthorized: handleUnauthorized,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateIntervention> & { result?: string; completedAt?: string } }) =>
      api.updateIntervention(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["activeIntervention"] });
      notify.success("Intervention updated", "Your intervention has been updated successfully.");
    },
    onError: (error: Error) => {
      notify.apiError(error, {
        fallbackTitle: "Error",
        fallbackDescription: "Failed to update intervention. Please try again.",
        onUnauthorized: handleUnauthorized,
      });
    },
  });

  const checkInMutation = useMutation({
    mutationFn: ({ id, result }: { id: string; result: 'Yes' | 'No' | 'Partial' }) => api.checkInIntervention(id, result),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["activeIntervention"] });
      notify.success("Outcome saved", "Your intervention outcome has been logged.");
    },
    onError: (error: Error) => {
      notify.apiError(error, {
        fallbackTitle: "Error",
        fallbackDescription: "Failed to save outcome. Please try again.",
        onUnauthorized: handleUnauthorized,
      });
    },
  });

  return {
    interventions,
    isLoading,
    error,
    createIntervention: createMutation.mutate,
    createInterventionAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateIntervention: updateMutation.mutate,
    updateInterventionAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    checkInIntervention: checkInMutation.mutate,
    checkInInterventionAsync: checkInMutation.mutateAsync,
    isCheckingIn: checkInMutation.isPending,
  };
}

export function useActiveIntervention() {
  const { data: activeIntervention, isLoading, error } = useQuery({
    queryKey: ["activeIntervention"],
    queryFn: api.getActiveIntervention,
  });

  return {
    activeIntervention,
    isLoading,
    error,
  };
}
