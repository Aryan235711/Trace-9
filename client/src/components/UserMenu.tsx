import React from 'react';
import { Crown, LogOut, Star, User as UserIcon } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';

function getInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

export function UserMenu() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    logout();
  };

  const handleUpgrade = () => {
    window.location.href = '/upgrade';
  };

  const handleLeaveReview = () => {
    const reviewUrl = (import.meta as any).env?.VITE_REVIEW_URL as string | undefined;
    if (!reviewUrl) {
      alert('Review link not configured');
      return;
    }
    window.open(reviewUrl, '_blank', 'noopener,noreferrer');
  };

  const displayName = user.name || user.email || 'User';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{getInitials(displayName)}</AvatarFallback>
          </Avatar>
          <span className="sr-only">Open user menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-1">
          <div className="text-sm font-medium leading-none">{displayName}</div>
          {user.email ? <div className="text-xs text-muted-foreground">{user.email}</div> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2">
          <UserIcon className="h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleUpgrade} className="gap-2">
          <Crown className="h-4 w-4" />
          Upgrade to Premium
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLeaveReview} className="gap-2">
          <Star className="h-4 w-4" />
          Leave a review
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout} className="gap-2">
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}