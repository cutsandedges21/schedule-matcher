import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import RequireAuth from '@/features/auth/RequireAuth';
import AppShell from '@/components/AppShell';
import SchoolThemeEffect from '@/features/theme/SchoolThemeEffect';
import Spinner from '@/components/Spinner';
import LoginPage from '@/features/auth/LoginPage';
import SchedulePage from '@/features/schedule/SchedulePage';
import NotFoundPage from '@/features/error/NotFoundPage';
// Eager, unlike the lazy routes below: /wifi is the first paint for every
// poster scan, and a lazy chunk costs a network round trip at exactly the
// moment it hurts most. Static JSX with no images, so it barely moves the
// main bundle.
import WifiPage from '@/features/marketing/WifiPage';

const OnboardingPage = lazy(() => import('@/features/auth/OnboardingPage'));
const SettingsPage = lazy(() => import('@/features/auth/SettingsPage'));
const CustomizationPage = lazy(() => import('@/features/auth/CustomizationPage'));
const UploadPage = lazy(() => import('@/features/upload/UploadPage'));
const FriendsPage = lazy(() => import('@/features/friends/FriendsPage'));
const FriendSchedulePage = lazy(() => import('@/features/friends/FriendSchedulePage'));
const InvitePage = lazy(() => import('@/features/friends/InvitePage'));
const ComparePage = lazy(() => import('@/features/compare/ComparePage'));
const GroupComparePage = lazy(() => import('@/features/compare/GroupComparePage'));
const PrivacyPage = lazy(() => import('@/features/legal/PrivacyPage'));
const TermsPage = lazy(() => import('@/features/legal/TermsPage'));

/**
 * Dev-only viewer for onboarding: the prologue, the three questions and the
 * payoff, played by the real components, with controls to jump straight to any
 * of the four payoff bands. See OnboardingPreview.tsx.
 *
 * Onboarding is otherwise unreachable without a fresh account — it mounts only
 * while a signed-in user has no `profiles` row — so there is no way to look at
 * a change to it short of deleting your own. It replaced `/__preview-intro`,
 * which showed the prologue alone and predated the questions entirely.
 *
 * The earlier routes of this kind (`/__preview-upload`, `/__preview-intro`)
 * were deleted once they had done their job; do the same with this one.
 *
 * The DEV check is inside the loader, not just on the `<Route>` below, and that
 * is the whole point of the shape. Guarding only the route leaves the
 * `import()` standing in the module graph, and Rollup emits and preloads the
 * chunk for it regardless of whether anything renders it — the harness would be
 * sitting on the CDN, fetchable, in every production deploy. Here Vite replaces
 * the check with `false`, the branch dies, and the import dies with it: no
 * chunk. `npm run build && grep -r OnboardingPreview dist/assets/*.js` is the
 * check, and it has to come back empty.
 */
const OnboardingPreview = lazy<ComponentType>(async () => {
  if (!import.meta.env.DEV) return { default: () => null };
  return import('@/features/auth/OnboardingPreview');
});

const shell = (element: ReactNode) => (
  <RequireAuth><AppShell>{element}</AppShell></RequireAuth>
);

/** Everything except the legal pages. */
function AppRoutes() {
  return (
    <AuthProvider>
      <SchoolThemeEffect />
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
          <Route path="/invite/:username" element={<RequireAuth><InvitePage /></RequireAuth>} />
          <Route path="/" element={shell(<SchedulePage />)} />
          <Route path="/upload" element={<RequireAuth><UploadPage /></RequireAuth>} />
          <Route path="/friends" element={shell(<FriendsPage />)} />
          <Route path="/settings" element={shell(<SettingsPage />)} />
          <Route path="/settings/customization" element={shell(<CustomizationPage />)} />
          {/* The tab was called Profile until the settings rename; old links,
              bookmarks and home-screen shortcuts still point here. */}
          <Route path="/profile" element={<Navigate to="/settings" replace />} />
          <Route path="/u/:username" element={shell(<FriendSchedulePage />)} />
          <Route path="/compare" element={shell(<GroupComparePage />)} />
          <Route path="/compare/:username" element={shell(<ComparePage />)} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default function App() {
  // The legal pages are deliberately outside AuthProvider: a privacy policy
  // or a set of terms has to be readable before you have an account, or it
  // isn't much use to anyone. /wifi — the poster landing page — sits in the
  // same bucket for the same reason, and reads no session state at all.
  // `/*` covers every other route.
  return (
    <BrowserRouter>
      <Suspense fallback={<Spinner />}>
        <Routes>
          {import.meta.env.DEV && (
            <Route path="/__preview-onboarding" element={<OnboardingPreview />} />
          )}
          <Route path="/wifi" element={<WifiPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
