import React from 'react';
import { useLocation, Link } from 'wouter';
import { LayoutDashboard, Plus, History } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm z-50 h-16 safe-area-bottom">
      <div className="flex h-full items-center justify-around max-w-md mx-auto px-4">
        <Link href="/">
          <div className={cn(
            "flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors cursor-pointer",
            isActive('/') ? "text-white" : "text-muted-foreground hover:text-white"
          )}>
            <LayoutDashboard size={20} />
            <span className="text-[10px] font-mono tracking-wider">DATA</span>
          </div>
        </Link>

        <Link href="/log">
          <div className="flex items-center justify-center -mt-6 cursor-pointer">
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center border-4 border-background transition-transform active:scale-95",
              isActive('/log') ? "bg-white text-black" : "bg-white text-black hover:bg-gray-200"
            )}>
              <Plus size={28} strokeWidth={2.5} />
            </div>
          </div>
        </Link>

        <Link href="/history">
          <div className={cn(
            "flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors cursor-pointer",
            isActive('/history') ? "text-white" : "text-muted-foreground hover:text-white"
          )}>
            <History size={20} />
            <span className="text-[10px] font-mono tracking-wider">LOGS</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-white selection:text-black">
      <main className="flex-1 pb-24 max-w-md mx-auto w-full relative">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
