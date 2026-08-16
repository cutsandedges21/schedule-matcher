import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import RequireAuth from '@/features/auth/RequireAuth';
import AppShell from '@/components/AppShell';
import Spinner from '@/components/Spinner';
import LoginPage from '@/features/auth/LoginPage';
import SchedulePage from '@/features/schedule/SchedulePage';

const OnboardingPage = lazy(() => import('@/features/auth/OnboardingPage'));
const ProfilePage = lazy(() => import('@/features/auth/ProfilePage'));
const UploadPage = lazy(() => import('@/features/upload/UploadPage'));
const FriendsPage = lazy(() => import('@/features/friends/FriendsPage'));
const FriendSchedulePage = lazy(() => import('@/features/friends/FriendSchedulePage'));
const InvitePage = lazy(() => import('@/features/friends/InvitePage'));
const ComparePage = lazy(() => import('@/features/compare/ComparePage'));

const shell = (element: ReactNode) => (
  <RequireAuth><AppShell>{element}</AppShell></RequireAuth>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
            <Route path="/invite/:code" element={<RequireAuth><InvitePage /></RequireAuth>} />
            <Route path="/" element={shell(<SchedulePage />)} />
            <Route path="/upload" element={<RequireAuth><UploadPage /></RequireAuth>} />
            <Route path="/friends" element={shell(<FriendsPage />)} />
            <Route path="/profile" element={shell(<ProfilePage />)} />
            <Route path="/u/:username" element={shell(<FriendSchedulePage />)} />
            <Route path="/compare/:username" element={shell(<ComparePage />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
