// src/features/auth/ProfilePage.tsx
import { useAuth } from './AuthProvider';
import Button from '@/components/Button';

export default function ProfilePage() {
  const { profile, signOut } = useAuth();

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Profile</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="font-semibold">@{profile?.username}</p>
        {profile?.displayName && <p className="text-sm text-slate-500">{profile.displayName}</p>}
      </div>
      <Button variant="secondary" onClick={() => void signOut()} className="w-full">Sign out</Button>
    </main>
  );
}
