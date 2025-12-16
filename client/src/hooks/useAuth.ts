import { useQuery } from "@tanstack/react-query";

// Development bypass
const isDev = import.meta.env.DEV;
const mockUser = {
  id: "dev-user-123",
  email: "dev@example.com",
  firstName: "Dev",
  lastName: "User"
};

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: !isDev, // Skip query in development
  });

  // Use mock user in development
  if (isDev) {
    return {
      user: mockUser,
      isLoading: false,
      isAuthenticated: true,
    };
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
