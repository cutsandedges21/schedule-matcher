// src/features/legal/TermsPage.tsx
import { Link } from 'react-router-dom';
import LegalLayout, { Section, P, List, OPERATOR_NAME, CONTACT_EMAIL, JURISDICTION } from './LegalLayout';

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <P>
        These terms are an agreement between you and {OPERATOR_NAME} covering your use of Schedule
        Matcher ("the app"). By signing in you accept them. If you do not accept them, do not use
        the app.
      </P>

      <Section title="Who can use it">
        <P>
          You must be at least 13 years old and able to enter into this agreement. You are
          responsible for everything done through your account, so keep your Google sign-in secure.
          One account per person.
        </P>
      </Section>

      <Section title="What the app does">
        <P>
          The app reads a screenshot of your class schedule, lets you correct it, and shows it
          alongside the schedules of friends you have connected with so you can find hours you are
          all free.
        </P>
      </Section>

      <Section title="The schedule reader is not authoritative">
        <P>
          Schedules are extracted automatically, partly by optical character recognition and partly
          by an AI model. Both make mistakes: times can be off, classes can be missed, and names can
          be misread. You are asked to review what it produces, and you are responsible for checking
          it against your institution's official schedule.
        </P>
        <P>
          Do not rely on this app alone to decide whether you have a class. We are not responsible
          for a missed class, exam, or deadline.
        </P>
      </Section>

      <Section title="Your content">
        <P>
          Your schedule, your profile and anything else you enter remain yours. You grant us only
          the permission needed to run the app: to store your content, process it, and show it to
          the friends you have accepted. We do not claim ownership and we do not sell it.
        </P>
        <P>
          You confirm you have the right to upload what you upload, and that doing so does not
          breach your institution's rules.
        </P>
      </Section>

      <Section title="Acceptable use">
        <P>You agree not to:</P>
        <List>
          <li>impersonate another student, or create an account in someone else's name;</li>
          <li>
            share, republish or otherwise redistribute another student's schedule outside the app
            without their permission;
          </li>
          <li>
            use the app to harass, stalk, or track anyone's whereabouts — accepting a friend request
            is not consent to be followed;
          </li>
          <li>upload anything unlawful, abusive, or that infringes someone else's rights;</li>
          <li>
            attempt to access accounts or data that are not yours, probe or circumvent our security,
            or automate access to the app at scale;
          </li>
          <li>put deliberately false or misleading information into a shared schedule.</li>
        </List>
      </Section>

      <Section title="Availability">
        <P>
          The app is provided free of charge and is offered as-is. We may change it, suspend it, or
          discontinue it at any time. Automated schedule reading depends on a third-party service
          with usage limits, so it may be rate-limited or temporarily unavailable; you can always
          enter your classes manually instead.
        </P>
      </Section>

      <Section title="Ending your use">
        <P>
          You can delete your account at any time from Settings, which permanently removes your
          data. We may suspend or terminate an account that breaches these terms. Sections that by
          their nature should survive termination — disclaimers, limits of liability and governing
          law — do so.
        </P>
      </Section>

      <Section title="No warranty">
        <P>
          To the fullest extent permitted by law, the app is provided "as is" and "as available",
          without warranties of any kind, express or implied, including any warranty of
          merchantability, fitness for a particular purpose, accuracy, or non-infringement. We do
          not warrant that the app will be uninterrupted, error-free, or that extracted schedules
          will be correct.
        </P>
      </Section>

      <Section title="Limitation of liability">
        <P>
          To the fullest extent permitted by law, {OPERATOR_NAME} is not liable for any indirect,
          incidental, special, consequential or punitive damages, or for any loss of data, missed
          classes, missed opportunities, or academic consequences arising from your use of the app.
          Some jurisdictions do not allow these exclusions, in which case they apply to you only so
          far as the law permits.
        </P>
      </Section>

      <Section title="Privacy">
        <P>
          Our{' '}
          <Link to="/privacy" className="font-medium underline underline-offset-2">
            Privacy Policy
          </Link>{' '}
          explains what we collect and who can see it, and forms part of these terms.
        </P>
      </Section>

      <Section title="Changes to these terms">
        <P>
          We may update these terms. When we do we will change the date at the top of this page, and
          for material changes we will notify you in the app. Continuing to use the app after a
          change means you accept the updated terms.
        </P>
      </Section>

      <Section title="Governing law">
        <P>
          These terms are governed by the laws of {JURISDICTION}, without regard to its conflict of
          law rules. Questions: {CONTACT_EMAIL}.
        </P>
      </Section>
    </LegalLayout>
  );
}
