import React from 'react';
import { useLocation, Link } from 'wouter';
import { LayoutDashboard, Plus, History, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationCenter } from '@/components/NotificationCenter';
import { UserMenu } from '@/components/UserMenu';

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
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-white/20 selection:text-white">
      {/* Header with notifications and user menu */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-md mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">Trace-9</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="flex-1 pb-24 pt-4 max-w-md mx-auto w-full relative">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
