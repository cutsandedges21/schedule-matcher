// src/features/theme/SchoolThemeEffect.tsx
import { useEffect } from 'react';
import { schoolById, themeVariables } from '@/domain/schools';
import { useAuth } from '@/features/auth/AuthProvider';

/**
 * Renders nothing. Paints the signed-in student's school colours onto :root as
 * the custom properties every `accent` Tailwind class resolves against.
 *
 * Mounted inside AuthProvider, so /login and the legal pages — which sit
 * outside it — keep the default slate declared in index.css.
 */
export default function SchoolThemeEffect() {
  const { profile } = useAuth();
  const school = schoolById(profile?.school);

  useEffect(() => {
    const root = document.documentElement;
    for (const [property, value] of Object.entries(themeVariables(school))) {
      root.style.setProperty(property, value);
    }

    // The Android URL bar and the iOS standalone status bar read this tag, not
    // our CSS. Without this the chrome around the app stays slate while the app
    // itself turns red, which reads as a rendering bug rather than a theme.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', school.accent);
  }, [school]);

  return null;
}
