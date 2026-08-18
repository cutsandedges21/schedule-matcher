// src/components/AppShell.tsx
import type { ReactNode } from 'react';
import BottomNav from './BottomNav';
import DesktopNav from './DesktopNav';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh pb-20 lg:pb-0">
      <DesktopNav />
      {/* The max-width keeps the full-week grid and card lists at a readable
          line length on a wide monitor instead of stretching edge to edge;
          individual pages keep their own px-4 for the phone layout. */}
      <div className="lg:mx-auto lg:max-w-5xl lg:px-6 lg:py-6">{children}</div>
      <BottomNav />
    </div>
  );
}
