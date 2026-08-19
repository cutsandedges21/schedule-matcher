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
  JURISDICTION_FR,
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
 * where the parties so agree after the French version has been remitted.
 * `TermsEn` and `TermsFr` below now both exist, with byte-identical clause
 * numbering, so a citation ("clause 9.2") means the same provision in either
 * language. Clause 18.1 states that the French text governs in case of
 * conflict — that sentence is the substance of the compliance, not
 * decoration, so it must survive even if the two versions read as equivalent
 * today. If either version's wording changes, the other must change with it
 * in the same edit, and LegalLayout's LAST_UPDATED_EN/LAST_UPDATED_FR must
 * both move.
 */
function TermsEn() {
  return (
    <>
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
          These Terms are available in English and in French. In the event of any inconsistency or
          conflict between the two versions, the French version prevails, in accordance with the
          Charter of the French Language.
        </Clause>
        <Clause n="18.2">
          You may switch between the English and French versions of these Terms at any time using
          the language control at the top of this page. Nothing in this clause derogates from any
          right you hold under the Charter of the French Language.
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
    </>
  );
}

function TermsFr() {
  return (
    <>
      <Section title="1. Entente">
        <Clause n="1.1">
          Les présentes conditions d&rsquo;utilisation (les « Conditions ») constituent une entente
          qui vous lie à {OPERATOR_NAME} (l&rsquo;« Exploitant », « nous ») et qui régit votre accès
          à l&rsquo;application Schedule Matcher ainsi qu&rsquo;à tout site Web ou service qui y est
          associé (collectivement, le « Service »), de même que votre utilisation de ceux-ci.
        </Clause>
        <Clause n="1.2">
          En créant un compte ou en accédant autrement au Service, vous acceptez les présentes
          Conditions dans leur intégralité. Si vous ne les acceptez pas, vous ne devez pas accéder au
          Service ni l&rsquo;utiliser.
        </Clause>
        <Clause n="1.3">
          La collecte et l&rsquo;utilisation de renseignements personnels dans le cadre du Service
          sont régies par notre{' '}
          <Link to="/privacy" className="font-medium text-slate-900">
            Politique de confidentialité
          </Link>
          , laquelle fait partie intégrante des présentes Conditions.
        </Clause>
      </Section>

      <Section title="2. Définitions">
        <Clause n="2.1">
          <strong>« Contenu utilisateur »</strong> désigne tout renseignement que vous soumettez au
          Service, y compris les renseignements relatifs à l&rsquo;horaire de cours, les
          renseignements de profil et les images téléversées.
        </Clause>
        <Clause n="2.2">
          <strong>« Contact »</strong> désigne un autre utilisateur du Service dont vous avez accepté
          la demande de mise en relation, ou dont vous avez reçu l&rsquo;acceptation d&rsquo;une telle
          demande.
        </Clause>
        <Clause n="2.3">
          <strong>« Outil d&rsquo;extraction »</strong> désigne la fonction automatisée du Service qui
          propose une transcription des renseignements relatifs à l&rsquo;horaire de cours à partir
          d&rsquo;une image téléversée.
        </Clause>
      </Section>

      <Section title="3. Admissibilité">
        <Clause n="3.1">
          Vous devez être âgé d&rsquo;au moins 14 ans pour utiliser le Service et posséder la capacité
          juridique de conclure les présentes Conditions. Si vous êtes mineur, vous déclarez que votre
          utilisation du Service a été consentie par le titulaire de l&rsquo;autorité parentale à
          votre égard, dans la mesure exigée par la loi.
        </Clause>
        <Clause n="3.2">
          Le Service est destiné aux étudiants d&rsquo;établissements d&rsquo;enseignement
          postsecondaire.
        </Clause>
        <Clause n="3.3">Vous ne pouvez détenir qu&rsquo;un seul compte.</Clause>
      </Section>

      <Section title="4. Inscription du compte et sécurité">
        <Clause n="4.1">
          L&rsquo;accès au Service exige une authentification par l&rsquo;entremise d&rsquo;un
          fournisseur d&rsquo;identité tiers. Vous êtes responsable de préserver la sécurité et la
          confidentialité des identifiants utilisés à des fins d&rsquo;authentification.
        </Clause>
        <Clause n="4.2">
          Vous êtes responsable de toute activité se produisant sous votre compte. Vous devez nous
          aviser sans délai à {CONTACT_EMAIL} dès que vous prenez connaissance d&rsquo;une utilisation
          non autorisée de votre compte.
        </Clause>
        <Clause n="4.3">
          Vous ne devez pas transférer votre compte à une autre personne ni permettre à une autre
          personne de l&rsquo;utiliser.
        </Clause>
      </Section>

      <Section title="5. Licence d'utilisation du Service">
        <Clause n="5.1">
          Sous réserve du respect des présentes Conditions, nous vous accordons une licence limitée,
          personnelle, non exclusive, incessible et révocable vous permettant d&rsquo;accéder au
          Service et de l&rsquo;utiliser à des fins personnelles et non commerciales.
        </Clause>
        <Clause n="5.2">
          Tous les droits, titres et intérêts afférents au Service, y compris ses logiciels, son
          interface, sa conception et ses marques, demeurent la propriété de l&rsquo;Exploitant ou de
          ses concédants de licence. Aucun droit n&rsquo;est accordé, sauf ceux expressément prévus à
          la clause 5.1.
        </Clause>
      </Section>

      <Section title="6. Contenu utilisateur">
        <Clause n="6.1">
          Vous conservez tous les droits, titres et intérêts afférents à votre Contenu utilisateur.
          Les présentes Conditions ne nous transfèrent aucun droit de propriété à cet égard.
        </Clause>
        <Clause n="6.2">
          Vous nous accordez une licence non exclusive, libre de redevances et mondiale nous
          permettant d&rsquo;héberger, de conserver, de reproduire et de transmettre votre Contenu
          utilisateur, dans la seule mesure nécessaire pour exploiter et vous fournir le Service,
          ainsi que pour l&rsquo;afficher à vos Contacts conformément à vos paramètres. Cette licence
          prend fin dès la suppression du Contenu utilisateur ou la suppression de votre compte, sous
          réserve des copies conservées dans les supports de sauvegarde courants jusqu&rsquo;à leur
          péremption prévue.
        </Clause>
        <Clause n="6.3">
          Vous déclarez et garantissez que vous détenez tous les droits nécessaires pour soumettre
          votre Contenu utilisateur et que cette soumission ne contrevient ni aux droits d&rsquo;un
          tiers, ni aux politiques de votre établissement d&rsquo;enseignement, ni à une loi
          applicable.
        </Clause>
        <Clause n="6.4">
          Nous ne révisons pas systématiquement le Contenu utilisateur. Nous nous réservons le droit,
          sans y être tenus, de retirer tout Contenu utilisateur que nous jugeons raisonnablement
          contraire aux présentes Conditions.
        </Clause>
      </Section>

      <Section title="7. Utilisation acceptable">
        <Clause n="7.1">Vous ne devez pas, et ne devez pas tenter de :</Clause>
        <List>
          <li>
            usurper l&rsquo;identité d&rsquo;une personne, ou créer un compte au nom d&rsquo;une autre
            personne ou entité;
          </li>
          <li>
            reproduire, publier, transmettre ou autrement redistribuer l&rsquo;horaire de cours
            d&rsquo;un autre utilisateur en dehors du Service, que cet utilisateur soit ou non un
            Contact;
          </li>
          <li>
            accéder ou tenter d&rsquo;accéder à un compte, à des données ou à une partie du Service
            auxquels l&rsquo;accès ne vous a pas été accordé;
          </li>
          <li>
            contourner, désactiver ou entraver une fonction de sécurité, d&rsquo;authentification, de
            contrôle d&rsquo;accès ou de limitation d&rsquo;utilisation du Service;
          </li>
          <li>
            utiliser un moyen automatisé pour accéder au Service, en extraire des données ou créer des
            comptes;
          </li>
          <li>
            soumettre un contenu illégal, diffamatoire, harcelant, haineux, obscène ou qui porte
            atteinte aux droits d&rsquo;une personne;
          </li>
          <li>imposer une charge déraisonnable ou disproportionnée à l&rsquo;infrastructure du Service; ou</li>
          <li>utiliser le Service à des fins commerciales sans notre consentement écrit préalable.</li>
        </List>
        <Clause n="7.2">
          Les renseignements relatifs à l&rsquo;horaire de cours d&rsquo;une autre personne vous sont
          communiqués dans le seul but de vous coordonner avec cette personne. Leur communication
          ultérieure constitue une violation des présentes Conditions et peut également engager votre
          responsabilité en droit.
        </Clause>
      </Section>

      <Section title="8. L'Outil d'extraction n'a pas valeur officielle">
        <Clause n="8.1">
          L&rsquo;Outil d&rsquo;extraction fonctionne par reconnaissance optique de caractères et au
          moyen d&rsquo;un modèle de langage automatisé. Ces procédés sont intrinsèquement imparfaits :
          les heures peuvent être transcrites incorrectement, des cours peuvent être omis, et les
          noms, codes et locaux peuvent être mal interprétés.
        </Clause>
        <Clause n="8.2">
          Le résultat produit par l&rsquo;Outil d&rsquo;extraction vous est présenté à titre de
          proposition, aux fins de votre révision et de votre correction. Vous êtes seul responsable
          de le vérifier par rapport à l&rsquo;horaire officiel délivré par votre établissement
          d&rsquo;enseignement avant de vous y fier.
        </Clause>
        <Clause n="8.3">
          <strong>
            Le Service constitue un outil pratique et non un système de référence officiel. Il ne
            doit pas être le seul fondement sur lequel vous vous appuyez pour déterminer la tenue
            d&rsquo;un cours, d&rsquo;un examen ou de toute autre obligation.
          </strong>{' '}
          Sous réserve de la clause 13.4, nous déclinons toute responsabilité pour un cours, un
          examen, une échéance ou une autre obligation manqués en raison d&rsquo;une confiance
          accordée au Service.
        </Clause>
      </Section>

      <Section title="9. Disponibilité et modification du Service">
        <Clause n="9.1">
          Le Service est fourni « selon sa disponibilité ». Nous ne garantissons pas qu&rsquo;il sera
          accessible sans interruption ni exempt d&rsquo;erreurs.
        </Clause>
        <Clause n="9.2">
          Nous pouvons en tout temps modifier, suspendre ou mettre fin au Service ou à l&rsquo;une de
          ses fonctionnalités. Lorsqu&rsquo;un tel changement est important et que nous disposons
          d&rsquo;un moyen de vous joindre, nous nous efforcerons de vous donner un préavis
          raisonnable.
        </Clause>
        <Clause n="9.3">
          Nous pouvons imposer des limites d&rsquo;utilisation à toute fonctionnalité du Service, y
          compris des limites quant à la fréquence à laquelle l&rsquo;Outil d&rsquo;extraction peut
          être sollicité.
        </Clause>
      </Section>

      <Section title="10. Frais">
        <Clause n="10.1">
          Le Service est présentement offert sans frais. Les fonctionnalités présentement offertes
          sans frais sont désignées comme telles au moment de leur utilisation.
        </Clause>
        <Clause n="10.2">
          Nous pourrions ultérieurement offrir des fonctionnalités payantes. Aucuns frais ne vous
          seront imposés sans votre consentement exprès préalable au prix et aux conditions
          applicables, donné au moment de l&rsquo;achat. Rien dans les présentes Conditions
          n&rsquo;autorise des frais auxquels vous n&rsquo;avez pas ainsi consenti.
        </Clause>
      </Section>

      <Section title="11. Services de tiers">
        <Clause n="11.1">
          Le Service dépend de fournisseurs tiers pour l&rsquo;authentification, l&rsquo;hébergement
          et l&rsquo;extraction de texte. Leurs actes et omissions échappent à notre contrôle.
        </Clause>
        <Clause n="11.2">
          Votre utilisation d&rsquo;un service tiers accessible par l&rsquo;entremise du Service est
          régie par les conditions et pratiques de confidentialité propres à ce fournisseur, et non
          par les présentes Conditions.
        </Clause>
      </Section>

      <Section title="12. Suspension et résiliation">
        <Clause n="12.1">
          Vous pouvez résilier la présente entente en tout temps en supprimant votre compte à même le
          Service. La suppression est irréversible et s&rsquo;effectue de la manière décrite dans la
          Politique de confidentialité.
        </Clause>
        <Clause n="12.2">
          Nous pouvons suspendre ou résilier votre accès au Service, avec préavis lorsque cela est
          possible, si vous avez contrevenu aux présentes Conditions, si la loi l&rsquo;exige, ou si
          cela est nécessaire pour protéger le Service ou ses utilisateurs d&rsquo;un préjudice
          important.
        </Clause>
        <Clause n="12.3">
          Les clauses 6.1, 8, 13, 14, 15 et 16 survivent à la résiliation de la présente entente par
          l&rsquo;une ou l&rsquo;autre des parties.
        </Clause>
      </Section>

      <Section title="13. Exclusion de garanties">
        <Clause n="13.1">
          Dans toute la mesure permise par la loi applicable, le Service est fourni « tel quel » et «
          selon sa disponibilité », sans garantie d&rsquo;aucune sorte, expresse, implicite ou légale.
        </Clause>
        <Clause n="13.2">
          Nous ne garantissons pas que le Service répondra à vos besoins, qu&rsquo;il fonctionnera
          sans interruption ni erreur, ou que toute défectuosité sera corrigée.
        </Clause>
        <Clause n="13.3">
          Nous ne garantissons pas l&rsquo;exactitude, l&rsquo;exhaustivité ou la fiabilité d&rsquo;un
          résultat produit par l&rsquo;Outil d&rsquo;extraction, ni des renseignements relatifs à
          l&rsquo;horaire de cours soumis par un autre utilisateur.
        </Clause>
        <Clause n="13.4">
          <strong>
            Rien dans les présentes Conditions n&rsquo;exclut, ne restreint ni ne modifie une
            garantie, condition, assurance, un droit ou un recours qui vous est conféré par la loi
            applicable et qui ne peut légalement être exclu, restreint ou modifié.
          </strong>{' '}
          Si vous êtes un consommateur au sens de la Loi sur la protection du consommateur (Québec),
          la garantie légale prévue par cette loi s&rsquo;applique malgré toute disposition des
          présentes Conditions, et les clauses 13 et 14 ne s&rsquo;appliquent que dans la mesure
          permise par cette loi.
        </Clause>
      </Section>

      <Section title="14. Limitation de responsabilité">
        <Clause n="14.1">
          Sous réserve en tout temps de la clause 13.4, et dans toute la mesure permise par la loi
          applicable, l&rsquo;Exploitant ne peut être tenu responsable de dommages indirects,
          accessoires, particuliers, consécutifs, exemplaires ou punitifs, ni d&rsquo;une perte de
          profits, de revenus, de données, d&rsquo;achalandage ou d&rsquo;occasions d&rsquo;affaires,
          peu importe la manière dont ils surviennent et que nous ayons ou non été informés de la
          possibilité d&rsquo;une telle perte.
        </Clause>
        <Clause n="14.2">
          Sous réserve en tout temps de la clause 13.4, la responsabilité totale de l&rsquo;Exploitant
          découlant des présentes Conditions ou du Service, ou s&rsquo;y rapportant, que ce soit sur
          le plan contractuel, extracontractuel ou autre, ne peut excéder le plus élevé des montants
          suivants : le total des sommes que vous nous avez versées au cours des douze mois précédant
          l&rsquo;événement à l&rsquo;origine de la réclamation, ou cinquante dollars canadiens
          (50 $ CA).
        </Clause>
        <Clause n="14.3">
          La répartition des risques prévue à la présente clause 14 constitue un élément essentiel du
          fondement sur lequel le Service est offert sans frais.
        </Clause>
      </Section>

      <Section title="15. Indemnisation">
        <Clause n="15.1">
          Dans la mesure permise par la loi applicable, vous acceptez d&rsquo;indemniser
          l&rsquo;Exploitant et de le tenir à couvert de toute réclamation, demande, perte ou dépense,
          y compris les frais juridiques raisonnables, découlant de votre contravention aux présentes
          Conditions, de votre Contenu utilisateur, ou de votre atteinte aux droits d&rsquo;un tiers.
        </Clause>
        <Clause n="15.2">
          La présente clause ne s&rsquo;applique pas à une responsabilité découlant de notre propre
          faute, ni dans la mesure où vous êtes un consommateur et où la loi applicable en matière de
          protection du consommateur interdit une telle indemnisation.
        </Clause>
      </Section>

      <Section title="16. Droit applicable et tribunal compétent">
        <Clause n="16.1">
          Les présentes Conditions sont régies et interprétées conformément aux lois de{' '}
          {JURISDICTION_FR}, sans égard aux principes relatifs aux conflits de lois.
        </Clause>
        <Clause n="16.2">
          Tout différend découlant des présentes Conditions ou s&rsquo;y rapportant sera soumis à la
          compétence exclusive des tribunaux du district de Montréal, province de Québec.
        </Clause>
        <Clause n="16.3">
          Si vous êtes un consommateur, rien à la clause 16.2 ne vous prive du droit d&rsquo;intenter
          une procédure devant le tribunal du district de votre propre domicile, ce droit vous étant
          conféré par la loi applicable en matière de protection du consommateur.
        </Clause>
      </Section>

      <Section title="17. Modification des présentes Conditions">
        <Clause n="17.1">
          Nous pouvons modifier les présentes Conditions de temps à autre. La date de la plus récente
          modification figure au haut du présent document.
        </Clause>
        <Clause n="17.2">
          Lorsqu&rsquo;une modification touche de façon importante vos droits ou obligations, nous en
          donnerons avis à même le Service avant son entrée en vigueur. La poursuite de votre
          utilisation du Service après cette date constitue une acceptation des Conditions modifiées.
          Si vous ne les acceptez pas, votre seul recours consiste à cesser d&rsquo;utiliser le
          Service et à supprimer votre compte.
        </Clause>
      </Section>

      <Section title="18. Langue">
        <Clause n="18.1">
          Les présentes Conditions sont disponibles en anglais et en français. En cas
          d&rsquo;incohérence ou de divergence entre les deux versions, la version française prévaut,
          conformément à la Charte de la langue française.
        </Clause>
        <Clause n="18.2">
          Vous pouvez passer de la version anglaise à la version française des présentes Conditions,
          et inversement, en tout temps au moyen du sélecteur de langue situé au haut de cette page.
          Rien dans la présente clause ne porte atteinte à un droit dont vous bénéficiez en vertu de
          la Charte de la langue française.
        </Clause>
      </Section>

      <Section title="19. Dispositions générales">
        <Clause n="19.1">
          <strong>Divisibilité.</strong> Si une disposition des présentes Conditions est jugée
          invalide ou inapplicable, cette disposition sera dissociée et les autres dispositions
          demeureront pleinement en vigueur.
        </Clause>
        <Clause n="19.2">
          <strong>Absence de renonciation.</strong> Le fait pour nous de ne pas exiger
          l&rsquo;exécution d&rsquo;une disposition ne constitue pas une renonciation à celle-ci ni à
          toute autre disposition.
        </Clause>
        <Clause n="19.3">
          <strong>Cession.</strong> Vous ne pouvez céder les présentes Conditions. Nous pouvons les
          céder dans le cadre d&rsquo;une réorganisation, d&rsquo;une fusion ou d&rsquo;un transfert
          du Service, à condition que le cessionnaire soit lié par des obligations offrant une
          protection au moins équivalente à la vôtre.
        </Clause>
        <Clause n="19.4">
          <strong>Entente complète.</strong> Les présentes Conditions, avec la Politique de
          confidentialité, constituent l&rsquo;entente complète entre vous et l&rsquo;Exploitant à
          l&rsquo;égard du Service et remplacent toute communication antérieure portant sur son objet.
        </Clause>
      </Section>

      <Section title="20. Coordonnées">
        <P>
          Tout avis ou toute demande de renseignements relatif aux présentes Conditions doit être
          adressé à {OPERATOR_NAME}, à {CONTACT_EMAIL}.
        </P>
      </Section>
    </>
  );
}

export default function TermsPage() {
  return (
    <LegalLayout titleEn="Terms of Service" titleFr="Conditions d'utilisation">
      {(lang) => (lang === 'fr' ? <TermsFr /> : <TermsEn />)}
    </LegalLayout>
  );
}
