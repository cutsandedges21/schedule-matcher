// src/components/AppShell.tsx
import type { ReactNode } from 'react';
import BottomNav from './BottomNav';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh pb-20 lg:pb-0">
      {children}
      <BottomNav />
    </div>
  );
}
