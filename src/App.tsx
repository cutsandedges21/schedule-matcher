import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import RequireAuth from '@/features/auth/RequireAuth';
import AppShell from '@/components/AppShell';
import SchoolThemeEffect from '@/features/theme/SchoolThemeEffect';
import Spinner from '@/components/Spinner';
import { ToastProvider } from '@/components/Toast';
import { ConfirmProvider } from '@/components/ConfirmDialog';
import { NotificationsProvider } from '@/features/notifications/NotificationsProvider';
import LoginPage from '@/features/auth/LoginPage';
import HomePage from '@/features/home/HomePage';
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
const SpacesPage = lazy(() => import('@/features/spaces/SpacesPage'));
const CreateSpacePage = lazy(() => import('@/features/spaces/CreateSpacePage'));
const JoinSpacePage = lazy(() => import('@/features/spaces/JoinSpacePage'));
const SpaceLayout = lazy(() => import('@/features/spaces/SpaceLayout'));
const SpaceOverviewPage = lazy(() => import('@/features/spaces/SpaceOverviewPage'));
const SpaceMembersPage = lazy(() => import('@/features/spaces/SpaceMembersPage'));
const SpaceSettingsPage = lazy(() => import('@/features/spaces/SpaceSettingsPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));
const NotificationSettingsPage = lazy(() => import('@/features/notifications/NotificationSettingsPage'));
const AvailabilitySettingsPage = lazy(() => import('@/features/availability/AvailabilitySettingsPage'));
const FindTimePage = lazy(() => import('@/features/availability/FindTimePage'));
const SpaceCalendarPage = lazy(() => import('@/features/calendar/SpaceCalendarPage'));
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'));
const EventFormPage = lazy(() => import('@/features/events/EventFormPage'));
const EventDetailPage = lazy(() => import('@/features/events/EventDetailPage'));
const SpaceTasksPage = lazy(() => import('@/features/tasks/SpaceTasksPage'));
const MyTasksPage = lazy(() => import('@/features/tasks/MyTasksPage'));
const PollsPage = lazy(() => import('@/features/polls/PollsPage'));
const NewPollPage = lazy(() => import('@/features/polls/NewPollPage'));
const PollDetailPage = lazy(() => import('@/features/polls/PollDetailPage'));
const ResourcesPage = lazy(() => import('@/features/resources/ResourcesPage'));

const shell = (element: ReactNode) => (
  <RequireAuth><AppShell>{element}</AppShell></RequireAuth>
);

/** Everything except the legal pages. */
function AppRoutes() {
  return (
    <AuthProvider>
      <SchoolThemeEffect />
      <NotificationsProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Suspense fallback={<Spinner />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
                <Route path="/invite/:username" element={<RequireAuth><InvitePage /></RequireAuth>} />
                <Route path="/join/:code" element={<RequireAuth><JoinSpacePage /></RequireAuth>} />
                <Route path="/" element={shell(<HomePage />)} />
                <Route path="/schedule" element={shell(<SchedulePage />)} />
                <Route path="/schedule/availability" element={shell(<AvailabilitySettingsPage />)} />
                <Route path="/calendar" element={shell(<CalendarPage />)} />
                <Route path="/tasks" element={shell(<MyTasksPage />)} />
                <Route path="/upload" element={<RequireAuth><UploadPage /></RequireAuth>} />
                <Route path="/friends" element={shell(<FriendsPage />)} />
                <Route path="/spaces" element={shell(<SpacesPage />)} />
                <Route path="/spaces/new" element={shell(<CreateSpacePage />)} />
                <Route path="/spaces/:spaceId" element={shell(<SpaceLayout />)}>
                  <Route index element={<SpaceOverviewPage />} />
                  <Route path="availability" element={<FindTimePage />} />
                  <Route path="calendar" element={<SpaceCalendarPage />} />
                  <Route path="events/new" element={<EventFormPage />} />
                  <Route path="events/:eventId" element={<EventDetailPage />} />
                  <Route path="events/:eventId/edit" element={<EventFormPage />} />
                  <Route path="tasks" element={<SpaceTasksPage />} />
                  <Route path="polls" element={<PollsPage />} />
                  <Route path="polls/new" element={<NewPollPage />} />
                  <Route path="polls/:pollId" element={<PollDetailPage />} />
                  <Route path="resources" element={<ResourcesPage />} />
                  <Route path="members" element={<SpaceMembersPage />} />
                  <Route path="settings" element={<SpaceSettingsPage />} />
                </Route>
                <Route path="/notifications" element={shell(<NotificationsPage />)} />
                <Route path="/settings" element={shell(<SettingsPage />)} />
                <Route path="/settings/customization" element={shell(<CustomizationPage />)} />
                <Route path="/settings/notifications" element={shell(<NotificationSettingsPage />)} />
                {/* The tab was called Profile until the settings rename; old links,
                    bookmarks and home-screen shortcuts still point here. */}
                <Route path="/profile" element={<Navigate to="/settings" replace />} />
                <Route path="/u/:username" element={shell(<FriendSchedulePage />)} />
                <Route path="/compare" element={shell(<GroupComparePage />)} />
                <Route path="/compare/:username" element={shell(<ComparePage />)} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </ConfirmProvider>
        </ToastProvider>
      </NotificationsProvider>
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
          <Route path="/wifi" element={<WifiPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
