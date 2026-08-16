import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import RequireAuth from '@/features/auth/RequireAuth';
import LoginPage from '@/features/auth/LoginPage';
import OnboardingPage from '@/features/auth/OnboardingPage';
import UploadPage from '@/features/upload/UploadPage';

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
          <Route
            path="/"
            element={
              <RequireAuth>
                <div className="p-4">Signed in</div>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
