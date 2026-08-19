// src/features/legal/PrivacyPage.tsx
import LegalLayout, {
  Section,
  Clause,
  List,
  OPERATOR_NAME,
  CONTACT_EMAIL,
  JURISDICTION,
} from './LegalLayout';

/**
 * Drafted to Quebec's Act respecting the protection of personal information in
 * the private sector as amended by Law 25, and to PIPEDA. Every factual
 * assertion here describes the system as built — the categories in clause 3
 * are the columns in `supabase/migrations/`, and clause 5 is what
 * `src/lib/analytics.ts` and `0009_app_events.sql` actually record.
 *
 * If the schema changes, this document is part of the change. A privacy policy
 * that describes a previous version of the database is a misrepresentation,
 * not merely stale documentation.
 */
export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <Section title="1. Introduction and Scope">
        <Clause n="1.1">
          This Privacy Policy (the &ldquo;Policy&rdquo;) governs the collection, use,
          communication, retention and destruction of personal information by {OPERATOR_NAME} (the
          &ldquo;Operator&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) in connection with the Schedule
          Matcher application and any associated websites and services (collectively, the
          &ldquo;Service&rdquo;).
        </Clause>
        <Clause n="1.2">
          This Policy is issued in accordance with the Act respecting the protection of personal
          information in the private sector (Quebec), as amended by the Act to modernize legislative
          provisions as regards the protection of personal information (&ldquo;Law 25&rdquo;), and
          the Personal Information Protection and Electronic Documents Act (Canada).
        </Clause>
        <Clause n="1.3">
          By creating an account or otherwise using the Service, you acknowledge that you have read
          and understood this Policy. Where your consent is required by applicable law, that consent
          is sought separately and may be withdrawn in accordance with clause 10.
        </Clause>
        <Clause n="1.4">
          This Policy applies solely to the Service. It does not apply to any third-party service,
          website or application that may be accessed through the Service, each of which is governed
          by its own privacy practices.
        </Clause>
      </Section>

      <Section title="2. Person Accountable">
        <Clause n="2.1">
          The Operator is the enterprise responsible for the personal information collected through
          the Service and determines the purposes and means of its processing.
        </Clause>
        <Clause n="2.2">
          Inquiries, requests and complaints concerning personal information may be addressed to the
          person accountable for the protection of personal information at {CONTACT_EMAIL}. Requests
          submitted under clause 10 are answered within the delays prescribed by applicable law.
        </Clause>
      </Section>

      <Section title="3. Categories of Personal Information Collected">
        <Clause n="3.1">
          <strong>Account and authentication information.</strong> Authentication is performed by a
          third-party identity provider (Google) through Supabase Auth. Upon authentication we
          receive your email address, your unique account identifier with that provider, and the
          display name and profile image associated with that account. We do not receive, process or
          store your password or authentication credentials at any time.
        </Clause>
        <Clause n="3.2">
          <strong>Profile information.</strong> A username selected by you, an optional display
          name, a profile image, a system-generated invite code, an optional educational institution,
          and optional appearance preferences applied to how your profile is displayed to other
          users.
        </Clause>
        <Clause n="3.3">
          <strong>Course schedule information.</strong> For each course record you create or accept:
          course name, course code, section, instructor name, room designation, days of the week on
          which the course meets, and start and end times.
        </Clause>
        <Clause n="3.4">
          <strong>Connection information.</strong> The identity of users to whom you have sent
          connection requests, from whom you have received them, and the status and timestamps of
          each such request.
        </Clause>
        <Clause n="3.5">
          <strong>Rate-limiting records.</strong> A timestamp recorded each time the schedule
          extraction facility is invoked, retained solely to enforce usage limits. No image data and
          no course content is retained in these records.
        </Clause>
        <Clause n="3.6">
          <strong>Aggregate usage events.</strong> As described in clause 5.
        </Clause>
        <Clause n="3.7">
          We do not collect geolocation data, contact lists, device identifiers, advertising
          identifiers, or biometric information. The Service contains no advertising and no
          third-party advertising or tracking technology.
        </Clause>
      </Section>

      <Section title="4. Processing of Uploaded Images">
        <Clause n="4.1">
          Where you elect to upload a screenshot of a course schedule, the Service first attempts to
          extract the text from that image locally on your device. Where extraction succeeds locally,
          the image is not transmitted to us or to any third party.
        </Clause>
        <Clause n="4.2">
          Where local extraction does not succeed, the image is transmitted through our server
          function to Google&rsquo;s Gemini application programming interface for the sole purpose of
          text extraction. The image is used for that single request and is not retained by us. The
          processing of that request by Google is governed by the terms applicable to that interface.
        </Clause>
        <Clause n="4.3">
          The Service does not operate image storage. No uploaded image is written to any database or
          storage bucket under our control.
        </Clause>
        <Clause n="4.4">
          <strong>Automated processing.</strong> Text extraction is performed by optical character
          recognition and by an automated language model. This processing produces a proposed
          transcription only. It is presented to you for review and correction before it is recorded,
          and it does not render any decision producing legal effects concerning you or otherwise
          significantly affecting you.
        </Clause>
      </Section>

      <Section title="5. Aggregate Usage Events">
        <Clause n="5.1">
          The Service records a limited set of usage events for the purposes of measuring retention
          and informing product and pricing decisions. Each event consists of your account
          identifier, an event type, an optional count of the number of connections included in a
          comparison, and a timestamp.
        </Clause>
        <Clause n="5.2">
          These records expressly exclude usernames, the identity of any other user, course content,
          device information and network address information. An event records that a comparison of a
          given size occurred; it does not record the identity of the persons compared.
        </Clause>
        <Clause n="5.3">
          These records are not accessible to any user of the Service and are not communicated to any
          third party.
        </Clause>
      </Section>

      <Section title="6. Purposes of Collection and Use">
        <Clause n="6.1">Personal information is collected and used solely to:</Clause>
        <List>
          <li>establish, authenticate and maintain your account;</li>
          <li>enable you to record, correct and display your course schedule;</li>
          <li>
            enable you to establish connections with other users and to compare schedules with those
            users who have accepted a connection;
          </li>
          <li>enforce usage limits and protect the integrity and security of the Service;</li>
          <li>measure aggregate usage as described in clause 5;</li>
          <li>respond to your inquiries and requests; and</li>
          <li>comply with applicable legal obligations.</li>
        </List>
        <Clause n="6.2">
          Personal information is not used for any purpose incompatible with those set out above
          without first obtaining your consent, save where such use is authorised or required by law.
        </Clause>
        <Clause n="6.3">
          We do not sell personal information, and we do not communicate personal information to
          third parties for consideration or for their own commercial purposes.
        </Clause>
      </Section>

      <Section title="7. Accessibility to Other Users">
        <Clause n="7.1">
          <strong>Course schedules are restricted.</strong> Your course schedule is accessible only
          to you and to those users whose connection requests you have accepted. This restriction is
          enforced at the database level by access control policies and not solely within the
          application interface.
        </Clause>
        <Clause n="7.2">
          <strong>Profile information is accessible to authenticated users.</strong> Your username,
          display name, profile image, educational institution and appearance preferences are
          accessible to any authenticated user of the Service, this being necessary for the username
          search facility to function. You should not enter information into these fields that you do
          not wish to be accessible to persons unknown to you.
        </Clause>
        <Clause n="7.3">
          <strong>Invite codes.</strong> Your invite code is accessible to any person to whom you
          transmit your invite link. A person holding that code may send you a connection request,
          which you remain free to decline.
        </Clause>
        <Clause n="7.4">
          <strong>Withdrawal of access.</strong> Removing a connection terminates that user&rsquo;s
          access to your course schedule immediately and without further action on your part.
        </Clause>
      </Section>

      <Section title="8. Service Providers and Transfers Outside Quebec">
        <Clause n="8.1">
          We engage the following service providers, each of which processes personal information on
          our behalf and on our instructions: Supabase (database hosting and authentication), Vercel
          (application hosting and delivery), and Google (identity provision and, where clause 4.2
          applies, text extraction).
        </Clause>
        <Clause n="8.2">
          These service providers may store or process personal information outside the Province of
          Quebec, including in the United States. Personal information so held may be subject to the
          laws of the jurisdiction in which it is held, including lawful access by public authorities
          of that jurisdiction.
        </Clause>
        <Clause n="8.3">
          Prior to communicating personal information outside Quebec we conduct the assessment
          required by applicable law as to whether the information would receive adequate protection,
          having regard in particular to the sensitivity of the information, the purposes for which
          it is to be used, and the legal framework applicable in the receiving jurisdiction.
        </Clause>
      </Section>

      <Section title="9. Retention and Destruction">
        <Clause n="9.1">
          Profile information, course schedule information and connection information are retained
          until deleted by you or until the destruction of your account, whichever occurs first.
        </Clause>
        <Clause n="9.2">
          Replacing a course schedule overwrites the previous record. Prior versions are not
          retained.
        </Clause>
        <Clause n="9.3">
          Rate-limiting records cease to have operative effect after the applicable limitation
          period.
        </Clause>
        <Clause n="9.4">
          Upon destruction of your account, your profile, course schedule, connection records and
          authentication record are deleted, together with all records referencing them by way of
          cascading deletion. Destruction is irreversible and we are unable to restore deleted
          information.
        </Clause>
      </Section>

      <Section title="10. Your Rights">
        <Clause n="10.1">
          Subject to the conditions and exceptions provided by applicable law, you have the right to:
        </Clause>
        <List>
          <li>
            <strong>access</strong> the personal information we hold concerning you, and to obtain a
            copy of it;
          </li>
          <li>
            <strong>rectify</strong> personal information that is inaccurate, incomplete or
            equivocal;
          </li>
          <li>
            <strong>withdraw your consent</strong> to the collection, use or communication of your
            personal information, subject to the consequence that the Service may no longer be
            capable of being provided to you;
          </li>
          <li>
            <strong>obtain the destruction</strong> of your personal information where it is no
            longer necessary for the purposes for which it was collected, or where its collection,
            use or communication is not in accordance with law;
          </li>
          <li>
            <strong>receive computerised personal information</strong> you have provided to us in a
            structured, commonly used technological format, and to require its communication to
            another person or body so authorised by law; and
          </li>
          <li>
            <strong>be informed</strong> of the sources of the personal information we hold
            concerning you and of the categories of persons having access to it within our
            enterprise.
          </li>
        </List>
        <Clause n="10.2">
          You may exercise the rights of access, rectification and destruction directly within the
          Service, or by written request to {CONTACT_EMAIL}. We may require information reasonably
          necessary to verify your identity before giving effect to a request.
        </Clause>
        <Clause n="10.3">
          Where a request is refused in whole or in part, we will state the reasons for the refusal
          and inform you of your right of review.
        </Clause>
      </Section>

      <Section title="11. Security Safeguards">
        <Clause n="11.1">
          We maintain security safeguards appropriate to the sensitivity of the personal information
          held, including access control policies enforced at the database level, encryption of
          personal information in transit, and restriction of administrative access.
        </Clause>
        <Clause n="11.2">
          No method of transmission or storage is entirely secure. While we take the measures
          described above, we do not warrant absolute security, and you should not record within the
          Service any information the disclosure of which would cause you serious prejudice.
        </Clause>
        <Clause n="11.3">
          <strong>Confidentiality incidents.</strong> In the event of a confidentiality incident
          involving personal information which presents a risk of serious injury, we will notify the
          Commission d&rsquo;acc&egrave;s &agrave; l&rsquo;information and the persons concerned with
          diligence, and will keep a register of such incidents, in each case as required by
          applicable law.
        </Clause>
      </Section>

      <Section title="12. Technologies Stored on Your Device">
        <Clause n="12.1">
          The Service stores information in the local storage facilities of your browser or device
          for the purposes of maintaining your authenticated session and of avoiding duplicate
          counting of the usage events described in clause 5. These technologies are strictly
          necessary to the operation of the Service.
        </Clause>
        <Clause n="12.2">
          The Service does not employ cookies or equivalent technologies for advertising, profiling
          or cross-site tracking purposes.
        </Clause>
      </Section>

      <Section title="13. Minors">
        <Clause n="13.1">
          The Service is directed to students at post-secondary educational institutions. It is not
          directed to, and may not be used by, persons under the age of 14 years.
        </Clause>
        <Clause n="13.2">
          Under applicable Quebec law, consent to the collection of personal information concerning a
          minor under 14 years of age must be given by the person having parental authority. We do
          not knowingly collect personal information from such persons.
        </Clause>
        <Clause n="13.3">
          Where we become aware that personal information concerning a person under 14 years of age
          has been collected without the required consent, we will destroy it without delay. Any
          person having parental authority may notify us at {CONTACT_EMAIL}.
        </Clause>
      </Section>

      <Section title="14. Amendment of this Policy">
        <Clause n="14.1">
          We may amend this Policy from time to time. The date of the most recent amendment appears
          at the head of this document.
        </Clause>
        <Clause n="14.2">
          Where an amendment materially affects the manner in which your personal information is
          collected, used or communicated, we will give notice within the Service before the
          amendment takes effect and, where required by law, will obtain your consent.
        </Clause>
      </Section>

      <Section title="15. Governing Law and Recourse">
        <Clause n="15.1">
          This Policy is governed by and construed in accordance with the laws of {JURISDICTION}.
        </Clause>
        <Clause n="15.2">
          Nothing in this Policy limits any right or recourse available to you under applicable law,
          including your right to submit a complaint to the Commission d&rsquo;acc&egrave;s &agrave;
          l&rsquo;information du Qu&eacute;bec or to the Office of the Privacy Commissioner of Canada.
        </Clause>
        <Clause n="15.3">
          All communications concerning this Policy shall be addressed to {OPERATOR_NAME} at{' '}
          {CONTACT_EMAIL}.
        </Clause>
      </Section>
    </LegalLayout>
  );
}
