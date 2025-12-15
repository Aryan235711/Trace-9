import React from 'react';
import { useLocation, Link } from 'wouter';
import { LayoutDashboard, Plus, History, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationCenter } from '@/components/NotificationCenter';
import { UserMenu } from '@/components/UserMenu';
import { useAuth } from '@/hooks/useAuth';

function getFirstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0] || 'there';
}

export function BottomNav() {
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-sm bg-card/80 backdrop-blur-xl border border-white/10 rounded-full z-50 h-16 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center px-2">
      <div className="flex w-full items-center justify-between px-6">
        <Link href="/">
          <div className={cn(
            "flex flex-col items-center justify-center gap-1 transition-all duration-300 cursor-pointer group",
            isActive('/') ? "text-white" : "text-muted-foreground hover:text-white"
          )}>
            <div className={cn("p-2 rounded-full transition-all", isActive('/') && "bg-white/10")}>
              <LayoutDashboard size={20} />
            </div>
          </div>
        </Link>

        <Link href="/log">
          <div className="flex items-center justify-center cursor-pointer -translate-y-6">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center border-4 border-background transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95",
              isActive('/log') ? "bg-white text-black rotate-90" : "bg-white text-black"
            )}>
              <Plus size={32} strokeWidth={2.5} />
            </div>
          </div>
        </Link>

        <Link href="/history">
          <div className={cn(
            "flex flex-col items-center justify-center gap-1 transition-all duration-300 cursor-pointer group",
            isActive('/history') ? "text-white" : "text-muted-foreground hover:text-white"
          )}>
             <div className={cn("p-2 rounded-full transition-all", isActive('/history') && "bg-white/10")}>
               <History size={20} />
             </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-white/20 selection:text-white">
      <main className="flex-1 pb-24 pt-16 max-w-5xl mx-auto w-full relative px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-x-4 sm:inset-x-6 lg:inset-x-8 top-4 z-40 flex items-center justify-between">
          <div className="text-lg sm:text-2xl font-black bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent tracking-tight" style={{fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'}}>
            Trace-9
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <UserMenu />
          </div>
        </div>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
