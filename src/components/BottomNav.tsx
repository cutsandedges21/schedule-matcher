// src/components/BottomNav.tsx
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Schedule' },
  { to: '/friends', label: 'Friends' },
  { to: '/settings', label: 'Settings' },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="flex">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex min-h-touch items-center justify-center py-3 text-sm font-medium ${
                  isActive ? 'text-slate-900' : 'text-slate-400'
                }`
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
