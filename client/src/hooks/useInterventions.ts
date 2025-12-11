import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Intervention, type CreateIntervention } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export function useInterventions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: interventions = [], isLoading, error } = useQuery({
    queryKey: ["interventions"],
    queryFn: api.getInterventions,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateIntervention) => api.createIntervention(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["activeIntervention"] });
      toast({
        title: "Intervention started",
        description: "Your 7-day intervention has been created.",
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
        description: "Failed to create intervention. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateIntervention> & { result?: string; completedAt?: string } }) =>
      api.updateIntervention(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["activeIntervention"] });
      toast({
        title: "Intervention updated",
        description: "Your intervention has been updated successfully.",
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
        description: "Failed to update intervention. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    interventions,
    isLoading,
    error,
    createIntervention: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateIntervention: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}

export function useActiveIntervention() {
  const { data: activeIntervention, isLoading, error } = useQuery({
    queryKey: ["activeIntervention"],
    queryFn: api.getActiveIntervention,
    retry: false,
  });

  return {
    activeIntervention,
    isLoading,
    error,
  };
}
