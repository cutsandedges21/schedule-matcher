// src/features/legal/PrivacyPage.tsx
import LegalLayout, { Section, P, List, OPERATOR_NAME, CONTACT_EMAIL, JURISDICTION } from './LegalLayout';

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <P>
        Schedule Matcher ("the app") is operated by {OPERATOR_NAME}. This policy explains what the
        app collects, why, who can see it, and how to get rid of it. It covers the app only, not any
        site it links to.
      </P>

      <Section title="What we collect">
        <List>
          <li>
            <strong>Account details.</strong> When you sign in with Google we receive your email
            address, your Google account identifier, and the name and profile picture on that
            account. Sign-in is handled by Supabase Auth; we never see your Google password.
          </li>
          <li>
            <strong>Your profile.</strong> The username you choose, an optional display name, your
            profile picture, and an invite code generated for you.
          </li>
          <li>
            <strong>Your schedule.</strong> For each class: its name, course code and section,
            instructor, room, the days it meets, and its start and end times.
          </li>
          <li>
            <strong>Your connections.</strong> Which friend requests you have sent, received,
            accepted or declined.
          </li>
          <li>
            <strong>Usage limits.</strong> A timestamp each time you use the schedule reader, so we
            can enforce a per-hour cap. No image and no schedule content is kept in this log.
          </li>
        </List>
        <P>
          There are no analytics, no advertising, and no third-party trackers in the app. We do not
          collect your location, contacts, or anything from your device beyond the screenshot you
          choose to upload.
        </P>
      </Section>

      <Section title="Schedule screenshots">
        <P>
          When you upload a screenshot, the app first tries to read it entirely on your device — in
          that case the image never leaves your phone at all.
        </P>
        <P>
          If your screenshot cannot be read on-device, the app sends it to Google's Gemini API
          through our server so the text can be extracted. It is used for that single request and
          then discarded. We do not save your screenshots, and there is no image storage in the app.
          Google's handling of that request is governed by their own terms for the Gemini API.
        </P>
      </Section>

      <Section title="Who can see your information">
        <List>
          <li>
            <strong>Your schedule is private by default.</strong> Only you and the friends whose
            requests you have accepted can see your classes. This is enforced in the database
            itself, not just in the app.
          </li>
          <li>
            <strong>Your username, display name and picture</strong> are visible to any signed-in
            user, because that is what makes username search work. Do not put anything in your
            display name you would not show a stranger.
          </li>
          <li>
            <strong>Your invite code</strong> is visible to anyone you send your invite link to.
            Anyone holding it can send you a friend request, which you are free to decline.
          </li>
          <li>
            <strong>Unfriending is immediate.</strong> Removing a friend removes their access to
            your schedule at once.
          </li>
        </List>
      </Section>

      <Section title="Where it is stored">
        <P>
          Data is stored with Supabase, which hosts our database and authentication, and the app
          itself is served by Vercel. Both act as processors on our behalf. Screenshots that need
          server-side reading pass through Google's Gemini API as described above. We do not sell
          your information, and we do not share it with anyone else.
        </P>
      </Section>

      <Section title="How long we keep it">
        <P>
          Your profile, schedule and connections are kept until you delete them or delete your
          account. Rate-limit timestamps are only meaningful for one hour. Replacing your schedule
          overwrites the previous one; the old version is not retained.
        </P>
      </Section>

      <Section title="Your choices">
        <List>
          <li>
            <strong>Edit or clear your schedule</strong> at any time by uploading a new one or
            editing your classes.
          </li>
          <li>
            <strong>Delete your account</strong> from Settings. This permanently removes your
            profile, your classes, your friend connections and your sign-in record. It cannot be
            undone, and we cannot recover it for you afterwards.
          </li>
          <li>
            <strong>Ask us anything about your data</strong> — including for a copy of it — at{' '}
            {CONTACT_EMAIL}.
          </li>
        </List>
      </Section>

      <Section title="Children">
        <P>
          The app is intended for students at post-secondary institutions and is not directed at
          children under 13. If you believe a child has given us information, contact us at{' '}
          {CONTACT_EMAIL} and we will delete it.
        </P>
      </Section>

      <Section title="Security">
        <P>
          Access to schedules is restricted at the database level by row-level security policies,
          and all traffic is encrypted in transit. No system is perfectly secure, so please do not
          store anything in the app you could not stand to have exposed.
        </P>
      </Section>

      <Section title="Changes">
        <P>
          If this policy changes materially we will update the date at the top of this page and,
          where the change affects how your information is used, tell you in the app before it takes
          effect.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          Questions or requests: {CONTACT_EMAIL}. This policy is governed by the laws of{' '}
          {JURISDICTION}.
        </P>
      </Section>
    </LegalLayout>
  );
}
