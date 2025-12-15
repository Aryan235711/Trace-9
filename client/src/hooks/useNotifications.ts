import type { ReactNode } from "react";

import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

type NotifyDescription = ReactNode;

type ApiErrorOptions = {
  fallbackTitle?: string;
  fallbackDescription?: string;
  unauthorizedTitle?: string;
  unauthorizedDescription?: string;
  onUnauthorized?: () => void;
};

function defaultUnauthorizedHandler() {
  localStorage.removeItem("auth_token");
  window.dispatchEvent(new Event("trace:auth:logout"));
}

function getErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) {
    const maybeMessage = (error as any).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }
  }
  return undefined;
}

export function useNotifications() {
  const { toast, dismiss } = useToast();

  const success = (title: string, description?: NotifyDescription) => {
    toast({ title, description });
  };

  const info = (title: string, description?: NotifyDescription) => {
    toast({ title, description });
  };

  const error = (title: string, description?: NotifyDescription) => {
    toast({ title, description, variant: "destructive" });
  };

  const apiError = (err: unknown, options: ApiErrorOptions = {}) => {
    const {
      fallbackTitle = "Error",
      fallbackDescription = "Something went wrong. Please try again.",
      unauthorizedTitle = "Unauthorized",
      unauthorizedDescription = "Session expired. Please sign in again.",
      onUnauthorized,
    } = options;

    if (isUnauthorizedError(err as any)) {
      error(unauthorizedTitle, unauthorizedDescription);
      (onUnauthorized ?? defaultUnauthorizedHandler)();
      return;
    }

    const message = getErrorMessage(err);
    error(fallbackTitle, message ?? fallbackDescription);
  };

  return {
    success,
    info,
    error,
    apiError,
    dismiss,
  };
}
