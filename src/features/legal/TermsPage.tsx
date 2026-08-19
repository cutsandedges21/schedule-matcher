// src/features/legal/TermsPage.tsx
import { Link } from 'react-router-dom';
import LegalLayout, {
  Section,
  P,
  Clause,
  List,
  OPERATOR_NAME,
  CONTACT_EMAIL,
  JURISDICTION,
} from './LegalLayout';

/**
 * Two Quebec-specific constraints shape this document and should not be
 * "tidied away" by a later edit:
 *
 * Clause 13.4 — the Consumer Protection Act prohibits a merchant from
 * excluding the legal warranty and restricts limitations of liability against
 * a consumer. A limitation clause drafted as though it were unqualified is not
 * merely unenforceable in part; it misleads the reader about rights they
 * actually hold. The carve-out is the clause that makes the rest honest.
 *
 * Clause 18 — the Charter of the French Language requires that a contract of
 * adhesion be drawn up in French, an English version being available only
 * where the parties so agree after the French version has been remitted. The
 * French version does not yet exist. The clause states the position as it is
 * rather than asserting a compliance that has not been achieved; producing it
 * is tracked in §8.2 of the monetization spec.
 */
export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <Section title="1. Agreement">
        <Clause n="1.1">
          These Terms of Service (the &ldquo;Terms&rdquo;) constitute a binding agreement between
          you and {OPERATOR_NAME} (the &ldquo;Operator&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
          governing your access to and use of the Schedule Matcher application and any associated
          websites and services (collectively, the &ldquo;Service&rdquo;).
        </Clause>
        <Clause n="1.2">
          By creating an account or otherwise accessing the Service, you accept these Terms in their
          entirety. If you do not accept them, you must not access or use the Service.
        </Clause>
        <Clause n="1.3">
          The collection and use of personal information in connection with the Service is governed
          by our{' '}
          <Link to="/privacy" className="font-medium text-slate-900">
            Privacy Policy
          </Link>
          , which forms part of these Terms.
        </Clause>
      </Section>

      <Section title="2. Definitions">
        <Clause n="2.1">
          <strong>&ldquo;User Content&rdquo;</strong> means any information submitted to the Service
          by you, including course schedule information, profile information and uploaded images.
        </Clause>
        <Clause n="2.2">
          <strong>&ldquo;Connection&rdquo;</strong> means another user of the Service whose
          connection request you have accepted or whose acceptance you have received.
        </Clause>
        <Clause n="2.3">
          <strong>&ldquo;Extraction Facility&rdquo;</strong> means the automated function of the
          Service which proposes a transcription of course schedule information from an uploaded
          image.
        </Clause>
      </Section>

      <Section title="3. Eligibility">
        <Clause n="3.1">
          You must be at least 14 years of age to use the Service, and must have the legal capacity
          to enter into these Terms. Where you are a minor, you represent that your use of the
          Service has been consented to by the person having parental authority over you to the
          extent required by law.
        </Clause>
        <Clause n="3.2">
          The Service is intended for students at post-secondary educational institutions.
        </Clause>
        <Clause n="3.3">You may maintain no more than one account.</Clause>
      </Section>

      <Section title="4. Account Registration and Security">
        <Clause n="4.1">
          Access to the Service requires authentication through a third-party identity provider. You
          are responsible for maintaining the security and confidentiality of the credentials used
          to authenticate.
        </Clause>
        <Clause n="4.2">
          You are responsible for all activity occurring under your account. You must notify us at{' '}
          {CONTACT_EMAIL} without delay upon becoming aware of any unauthorised use of your account.
        </Clause>
        <Clause n="4.3">
          You must not transfer your account to another person or permit another person to use it.
        </Clause>
      </Section>

      <Section title="5. Licence to Use the Service">
        <Clause n="5.1">
          Subject to your compliance with these Terms, we grant you a limited, personal,
          non-exclusive, non-transferable, revocable licence to access and use the Service for your
          own personal, non-commercial purposes.
        </Clause>
        <Clause n="5.2">
          All right, title and interest in and to the Service, including its software, interface,
          design and marks, remains vested in the Operator or its licensors. No right is granted
          except as expressly set out in clause 5.1.
        </Clause>
      </Section>

      <Section title="6. User Content">
        <Clause n="6.1">
          You retain all right, title and interest in and to your User Content. These Terms transfer
          no ownership of it to us.
        </Clause>
        <Clause n="6.2">
          You grant us a non-exclusive, royalty-free, worldwide licence to host, store, reproduce and
          transmit your User Content solely to the extent necessary to operate and provide the
          Service to you and to display it to your Connections in accordance with your settings. This
          licence terminates upon deletion of the User Content or destruction of your account, save
          in respect of copies retained in routine backup media pending their scheduled expiry.
        </Clause>
        <Clause n="6.3">
          You represent and warrant that you hold all rights necessary to submit your User Content
          and that its submission does not contravene the rights of any third party, the policies of
          your educational institution, or any applicable law.
        </Clause>
        <Clause n="6.4">
          We do not systematically review User Content. We reserve the right, without obligation, to
          remove User Content which we consider in our reasonable judgment to contravene these Terms.
        </Clause>
      </Section>

      <Section title="7. Acceptable Use">
        <Clause n="7.1">You must not, and must not attempt to:</Clause>
        <List>
          <li>
            impersonate any person, or register an account in the name of another person or entity;
          </li>
          <li>
            reproduce, publish, transmit or otherwise redistribute the course schedule of another
            user outside the Service, whether or not that user is a Connection;
          </li>
          <li>
            access or attempt to access any account, data or portion of the Service to which you have
            not been granted access;
          </li>
          <li>
            circumvent, disable or interfere with any security, authentication, access control or
            usage limitation feature of the Service;
          </li>
          <li>
            employ any automated means to access the Service, to extract data from it, or to create
            accounts;
          </li>
          <li>
            submit content which is unlawful, defamatory, harassing, hateful, obscene, or which
            infringes the rights of any person;
          </li>
          <li>
            impose an unreasonable or disproportionate load upon the infrastructure of the Service;
            or
          </li>
          <li>use the Service for any commercial purpose without our prior written consent.</li>
        </List>
        <Clause n="7.2">
          Course schedule information concerning another person is disclosed to you for the sole
          purpose of coordinating with that person. Its onward disclosure is a breach of these Terms
          and may also engage your liability at law.
        </Clause>
      </Section>

      <Section title="8. The Extraction Facility Is Not Authoritative">
        <Clause n="8.1">
          The Extraction Facility operates by optical character recognition and by an automated
          language model. Such processes are inherently imperfect: times may be transcribed
          incorrectly, courses may be omitted, and names, codes and rooms may be misread.
        </Clause>
        <Clause n="8.2">
          Output of the Extraction Facility is presented to you as a proposal for your review and
          correction. You are solely responsible for verifying it against the official schedule
          issued by your educational institution before relying upon it.
        </Clause>
        <Clause n="8.3">
          <strong>
            The Service is a convenience and is not a system of record. It must not be relied upon as
            the sole basis for determining whether a class, examination, or other obligation occurs.
          </strong>{' '}
          Subject to clause 13.4, we accept no liability for any missed class, examination, deadline
          or other obligation arising from reliance upon the Service.
        </Clause>
      </Section>

      <Section title="9. Availability and Modification of the Service">
        <Clause n="9.1">
          The Service is provided on an &ldquo;as available&rdquo; basis. We do not warrant that it
          will be available without interruption or free from error.
        </Clause>
        <Clause n="9.2">
          We may at any time modify, suspend or discontinue the Service or any feature of it. Where
          such a change is material and we hold a means of contacting you, we will endeavour to give
          reasonable notice.
        </Clause>
        <Clause n="9.3">
          We may impose usage limits upon any feature of the Service, including limits upon the
          frequency with which the Extraction Facility may be invoked.
        </Clause>
      </Section>

      <Section title="10. Fees">
        <Clause n="10.1">
          The Service is presently provided without charge. Features presently available without
          charge are described as such at the time they are used.
        </Clause>
        <Clause n="10.2">
          We may in future introduce paid features. No charge will be levied against you without your
          prior express agreement to the applicable price and terms, given at the time of purchase.
          Nothing in these Terms authorises a charge to which you have not so agreed.
        </Clause>
      </Section>

      <Section title="11. Third-Party Services">
        <Clause n="11.1">
          The Service depends upon third-party providers for authentication, hosting and text
          extraction. Their acts and omissions are not within our control.
        </Clause>
        <Clause n="11.2">
          Your use of a third-party service accessed through the Service is governed by that
          provider&rsquo;s own terms and privacy practices, and not by these Terms.
        </Clause>
      </Section>

      <Section title="12. Suspension and Termination">
        <Clause n="12.1">
          You may terminate this agreement at any time by destroying your account within the Service.
          Destruction is irreversible and operates as described in the Privacy Policy.
        </Clause>
        <Clause n="12.2">
          We may suspend or terminate your access to the Service, with notice where practicable,
          where you have contravened these Terms, where required by law, or where necessary to
          protect the Service or its users from material harm.
        </Clause>
        <Clause n="12.3">
          Clauses 6.1, 8, 13, 14, 15 and 16 survive the termination of this agreement by either
          party.
        </Clause>
      </Section>

      <Section title="13. Disclaimer of Warranties">
        <Clause n="13.1">
          To the fullest extent permitted by applicable law, the Service is provided &ldquo;as
          is&rdquo; and &ldquo;as available&rdquo;, without warranty of any kind, whether express,
          implied or statutory.
        </Clause>
        <Clause n="13.2">
          We do not warrant that the Service will meet your requirements, that it will operate
          without interruption or error, or that any defect will be corrected.
        </Clause>
        <Clause n="13.3">
          We do not warrant the accuracy, completeness or reliability of any output of the Extraction
          Facility, or of any course schedule information submitted by another user.
        </Clause>
        <Clause n="13.4">
          <strong>
            Nothing in these Terms excludes, restricts or modifies any warranty, condition,
            guarantee, right or remedy conferred upon you by applicable law which may not lawfully be
            excluded, restricted or modified.
          </strong>{' '}
          Where you are a consumer within the meaning of the Consumer Protection Act (Quebec), the
          legal warranty provided by that Act applies notwithstanding any provision of these Terms,
          and clauses 13 and 14 apply only to the extent that statute permits.
        </Clause>
      </Section>

      <Section title="14. Limitation of Liability">
        <Clause n="14.1">
          Subject always to clause 13.4, and to the fullest extent permitted by applicable law, the
          Operator shall not be liable for any indirect, incidental, special, consequential,
          exemplary or punitive damages, nor for any loss of profits, revenue, data, goodwill or
          opportunity, howsoever arising and whether or not the possibility of such loss was known to
          us.
        </Clause>
        <Clause n="14.2">
          Subject always to clause 13.4, the aggregate liability of the Operator arising out of or in
          connection with these Terms or the Service, whether in contract, extra-contractual
          liability or otherwise, shall not exceed the greater of the total amount paid by you to us
          in the twelve months preceding the event giving rise to the claim, or fifty Canadian
          dollars (CAD $50).
        </Clause>
        <Clause n="14.3">
          The allocation of risk set out in this clause 14 is an essential element of the basis upon
          which the Service is made available without charge.
        </Clause>
      </Section>

      <Section title="15. Indemnity">
        <Clause n="15.1">
          To the extent permitted by applicable law, you agree to indemnify and hold harmless the
          Operator from and against any claim, demand, loss or expense, including reasonable legal
          fees, arising out of your contravention of these Terms, your User Content, or your
          contravention of the rights of any third party.
        </Clause>
        <Clause n="15.2">
          This clause does not apply to any liability arising from our own fault, and does not apply
          to the extent that you are a consumer and applicable consumer protection legislation
          prohibits such an indemnity.
        </Clause>
      </Section>

      <Section title="16. Governing Law and Forum">
        <Clause n="16.1">
          These Terms are governed by and construed in accordance with the laws of {JURISDICTION},
          without regard to conflict of laws principles.
        </Clause>
        <Clause n="16.2">
          Any dispute arising out of or in connection with these Terms shall be submitted to the
          exclusive jurisdiction of the courts of the district of Montreal, Province of Quebec.
        </Clause>
        <Clause n="16.3">
          Where you are a consumer, nothing in clause 16.2 deprives you of the right to bring
          proceedings before the court of the district of your own domicile, that right being
          conferred by applicable consumer protection legislation.
        </Clause>
      </Section>

      <Section title="17. Amendment of these Terms">
        <Clause n="17.1">
          We may amend these Terms from time to time. The date of the most recent amendment appears
          at the head of this document.
        </Clause>
        <Clause n="17.2">
          Where an amendment materially affects your rights or obligations, we will give notice
          within the Service before it takes effect. Your continued use of the Service after that
          date constitutes acceptance of the amended Terms. Where you do not accept them, your
          recourse is to cease using the Service and to destroy your account.
        </Clause>
      </Section>

      <Section title="18. Language">
        <Clause n="18.1">
          These Terms are presently available in English only. A French version is in preparation
          and will be made available within the Service upon completion.
        </Clause>
        <Clause n="18.2">
          Nothing in this clause derogates from any right you hold under the Charter of the French
          Language. Upon request to {CONTACT_EMAIL} we will provide such French-language version of
          these Terms as is then available.
        </Clause>
      </Section>

      <Section title="19. General">
        <Clause n="19.1">
          <strong>Severability.</strong> Where any provision of these Terms is held invalid or
          unenforceable, that provision shall be severed and the remaining provisions shall continue
          in full force.
        </Clause>
        <Clause n="19.2">
          <strong>No waiver.</strong> Our failure to enforce any provision shall not constitute a
          waiver of it or of any other provision.
        </Clause>
        <Clause n="19.3">
          <strong>Assignment.</strong> You may not assign these Terms. We may assign them in
          connection with a reorganisation, merger or transfer of the Service, subject to the
          assignee being bound by obligations no less protective of you.
        </Clause>
        <Clause n="19.4">
          <strong>Entire agreement.</strong> These Terms, together with the Privacy Policy,
          constitute the entire agreement between you and the Operator concerning the Service and
          supersede all prior communications concerning its subject matter.
        </Clause>
      </Section>

      <Section title="20. Contact">
        <P>
          Notices and inquiries under these Terms shall be addressed to {OPERATOR_NAME} at{' '}
          {CONTACT_EMAIL}.
        </P>
      </Section>
    </LegalLayout>
  );
}
