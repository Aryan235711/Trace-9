import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type UserTargets, type UpdateUserTargets } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export function useTargets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: targets, isLoading, error } = useQuery({
    queryKey: ["targets"],
    queryFn: api.getTargets,
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateUserTargets) => api.updateTargets(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["targets"] });
      toast({
        title: "Targets updated",
        description: "Your targets have been saved successfully.",
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
        description: "Failed to update targets. Please try again.",
        variant: "destructive",
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
