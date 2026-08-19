import { lazy, Suspense, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import RequireAuth from '@/features/auth/RequireAuth';
import AppShell from '@/components/AppShell';
import SchoolThemeEffect from '@/features/theme/SchoolThemeEffect';
import Spinner from '@/components/Spinner';
import LoginPage from '@/features/auth/LoginPage';
import SchedulePage from '@/features/schedule/SchedulePage';
import NotFoundPage from '@/features/error/NotFoundPage';

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
const AboutIntro = lazy(() => import('@/features/auth/AboutIntro'));

/**
 * Dev-only viewer for the onboarding intro.
 *
 * The intro is otherwise unreachable without a fresh account — it mounts only
 * while a signed-in user has no `profiles` row — so there is no way to look at
 * a change to it short of deleting your account. Loops instead of calling on
 * to the username step, because the point is to watch it more than once.
 *
 * Guarded by `import.meta.env.DEV`, so it is not in the production bundle. The
 * previous route of this kind (`/__preview-upload`) was deleted once it had
 * done its job; do the same with this one.
 */
function IntroPreview() {
  const [run, setRun] = useState(0);
  return <AboutIntro key={run} onDone={() => setRun((n) => n + 1)} />;
}

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
          <Route path="/invite/:code" element={<RequireAuth><InvitePage /></RequireAuth>} />
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
  // isn't much use to anyone. `/*` covers every other route.
  return (
    <BrowserRouter>
      <Suspense fallback={<Spinner />}>
        <Routes>
          {import.meta.env.DEV && (
            <Route path="/__preview-intro" element={<IntroPreview />} />
          )}
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
