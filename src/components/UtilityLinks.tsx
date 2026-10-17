// src/components/UtilityLinks.tsx
import { NavLink } from 'react-router-dom';
import { UTILITY_LINKS, type NavTab } from '@/domain/navTabs';
import { useNotifications } from '@/features/notifications/NotificationsProvider';
import Icon from './Icon';

/**
 * Friends, Notifications and Settings as icon buttons — the phone top bar
 * shows all three, the desktop header the last two (Friends is a full tab
 * there). Each carries a real label for screen readers and a tooltip, since
 * an icon alone is a guess.
 */
export default function UtilityLinks({ links = UTILITY_LINKS }: { links?: readonly NavTab[] }) {
  const { unread } = useNotifications();

  return (
    <ul className="flex items-center gap-1">
      {links.map((link) => {
        const badge = link.to === '/notifications' && unread > 0;
        const label = badge ? `${link.label}, ${unread} unread` : link.label;
        return (
          <li key={link.to}>
            <NavLink
              to={link.to}
              aria-label={label}
              title={link.label}
              className={({ isActive }) =>
                `relative flex min-h-touch min-w-touch items-center justify-center rounded-full transition-colors ${
                  isActive ? 'bg-accent text-accent-fg' : 'text-slate-600 active:bg-slate-100'
                }`
              }
            >
              <Icon name={link.icon} className="h-[22px] w-[22px]" />
              {badge && (
                <span
                  aria-hidden
                  className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white"
                >
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}
