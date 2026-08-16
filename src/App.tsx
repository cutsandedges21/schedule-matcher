import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import RequireAuth from '@/features/auth/RequireAuth';
import LoginPage from '@/features/auth/LoginPage';
import OnboardingPage from '@/features/auth/OnboardingPage';
import UploadPage from '@/features/upload/UploadPage';
import AppShell from '@/components/AppShell';
import SchedulePage from '@/features/schedule/SchedulePage';
import FriendsPage from '@/features/friends/FriendsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/onboarding"
            element={
              <RequireAuth>
                <OnboardingPage />
              </RequireAuth>
            }
          />
          <Route path="/upload" element={<RequireAuth><UploadPage /></RequireAuth>} />
          <Route path="/" element={<RequireAuth><AppShell><SchedulePage /></AppShell></RequireAuth>} />
          <Route path="/friends" element={<RequireAuth><AppShell><FriendsPage /></AppShell></RequireAuth>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
