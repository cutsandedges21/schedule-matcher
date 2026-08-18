import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import RequireAuth from '@/features/auth/RequireAuth';
import AppShell from '@/components/AppShell';
import SchoolThemeEffect from '@/features/theme/SchoolThemeEffect';
import Spinner from '@/components/Spinner';
import LoginPage from '@/features/auth/LoginPage';
import SchedulePage from '@/features/schedule/SchedulePage';

const OnboardingPage = lazy(() => import('@/features/auth/OnboardingPage'));
const SettingsPage = lazy(() => import('@/features/auth/SettingsPage'));
const UploadPage = lazy(() => import('@/features/upload/UploadPage'));
const FriendsPage = lazy(() => import('@/features/friends/FriendsPage'));
const FriendSchedulePage = lazy(() => import('@/features/friends/FriendSchedulePage'));
const InvitePage = lazy(() => import('@/features/friends/InvitePage'));
const ComparePage = lazy(() => import('@/features/compare/ComparePage'));
const GroupComparePage = lazy(() => import('@/features/compare/GroupComparePage'));
const PrivacyPage = lazy(() => import('@/features/legal/PrivacyPage'));
const TermsPage = lazy(() => import('@/features/legal/TermsPage'));

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
          {/* The tab was called Profile until the settings rename; old links,
              bookmarks and home-screen shortcuts still point here. */}
          <Route path="/profile" element={<Navigate to="/settings" replace />} />
          <Route path="/u/:username" element={shell(<FriendSchedulePage />)} />
          <Route path="/compare" element={shell(<GroupComparePage />)} />
          <Route path="/compare/:username" element={shell(<ComparePage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
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
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
