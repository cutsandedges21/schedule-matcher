// src/features/legal/PrivacyPage.tsx
import LegalLayout, {
  Section,
  Clause,
  List,
  OPERATOR_NAME,
  CONTACT_EMAIL,
  JURISDICTION,
  JURISDICTION_FR,
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
 * not merely stale documentation. That obligation now applies twice:
 * `PrivacyEn` and `PrivacyFr` below carry identical clause numbers and must be
 * edited together — a clause changed in one language and not the other is a
 * document disagreeing with itself, and clause 16.1 tells the reader the
 * French text is the one that governs. Section 16 (Language) is additive at
 * the end, mirroring `TermsPage.tsx` clause 18, and exists for the same
 * reason: LegalLayout's LAST_UPDATED_EN/LAST_UPDATED_FR move together.
 */
function PrivacyEn() {
  return (
    <>
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

      <Section title="16. Language">
        <Clause n="16.1">
          This Policy is available in English and in French. In the event of any inconsistency or
          conflict between the two versions, the French version prevails, in accordance with the
          Charter of the French Language.
        </Clause>
        <Clause n="16.2">
          You may switch between the English and French versions of this Policy at any time using
          the language control at the top of this page.
        </Clause>
      </Section>
    </>
  );
}

function PrivacyFr() {
  return (
    <>
      <Section title="1. Introduction et portée">
        <Clause n="1.1">
          La présente politique de confidentialité (la « Politique ») régit la collecte,
          l&rsquo;utilisation, la communication, la conservation et la destruction des renseignements
          personnels par {OPERATOR_NAME} (l&rsquo;« Exploitant », « nous ») dans le cadre de
          l&rsquo;application Schedule Matcher et de tout site Web ou service qui y est associé
          (collectivement, le « Service »).
        </Clause>
        <Clause n="1.2">
          La présente Politique est établie conformément à la Loi sur la protection des
          renseignements personnels dans le secteur privé (Québec), telle que modifiée par la Loi
          modernisant des dispositions législatives en matière de protection des renseignements
          personnels (la « Loi 25 »), ainsi qu&rsquo;à la Loi sur la protection des renseignements
          personnels et les documents électroniques (Canada).
        </Clause>
        <Clause n="1.3">
          En créant un compte ou en utilisant autrement le Service, vous reconnaissez avoir lu et
          compris la présente Politique. Lorsque votre consentement est exigé par la loi applicable,
          celui-ci est sollicité séparément et peut être retiré conformément à la clause 10.
        </Clause>
        <Clause n="1.4">
          La présente Politique s&rsquo;applique uniquement au Service. Elle ne s&rsquo;applique à
          aucun service, site Web ou application de tiers auquel il est possible d&rsquo;accéder par
          l&rsquo;entremise du Service, chacun étant régi par ses propres pratiques de
          confidentialité.
        </Clause>
      </Section>

      <Section title="2. Personne responsable">
        <Clause n="2.1">
          L&rsquo;Exploitant est l&rsquo;entreprise responsable des renseignements personnels
          recueillis par l&rsquo;entremise du Service et détermine les fins et les moyens de leur
          traitement.
        </Clause>
        <Clause n="2.2">
          Les demandes de renseignements, demandes et plaintes concernant les renseignements
          personnels peuvent être adressées à la personne responsable de la protection des
          renseignements personnels, à {CONTACT_EMAIL}. Les demandes présentées en vertu de la clause
          10 font l&rsquo;objet d&rsquo;une réponse dans les délais prescrits par la loi applicable.
        </Clause>
      </Section>

      <Section title="3. Catégories de renseignements personnels recueillis">
        <Clause n="3.1">
          <strong>Renseignements de compte et d&rsquo;authentification.</strong> L&rsquo;authentification
          est effectuée par un fournisseur d&rsquo;identité tiers (Google) par l&rsquo;entremise de
          Supabase Auth. Lors de l&rsquo;authentification, nous recevons votre adresse courriel, votre
          identifiant de compte unique auprès de ce fournisseur, ainsi que le nom d&rsquo;affichage et
          l&rsquo;image de profil associés à ce compte. Nous ne recevons, ne traitons ni ne conservons
          votre mot de passe ou vos identifiants d&rsquo;authentification, à aucun moment.
        </Clause>
        <Clause n="3.2">
          <strong>Renseignements de profil.</strong> Un nom d&rsquo;utilisateur que vous choisissez,
          un nom d&rsquo;affichage facultatif, une image de profil, un code d&rsquo;invitation généré
          par le système, un établissement d&rsquo;enseignement facultatif, et des préférences
          d&rsquo;apparence facultatives appliquées à la façon dont votre profil est affiché aux
          autres utilisateurs.
        </Clause>
        <Clause n="3.3">
          <strong>Renseignements relatifs à l&rsquo;horaire de cours.</strong> Pour chaque cours que
          vous créez ou acceptez : le nom du cours, le code de cours, la section, le nom du chargé de
          cours, la désignation du local, les jours de la semaine où le cours a lieu, ainsi que les
          heures de début et de fin.
        </Clause>
        <Clause n="3.4">
          <strong>Renseignements relatifs aux Contacts.</strong> L&rsquo;identité des utilisateurs à
          qui vous avez envoyé des demandes de mise en relation, de qui vous en avez reçu, ainsi que
          le statut et l&rsquo;horodatage de chacune de ces demandes.
        </Clause>
        <Clause n="3.5">
          <strong>Registres de limitation d&rsquo;utilisation.</strong> Un horodatage enregistré
          chaque fois que l&rsquo;outil d&rsquo;extraction d&rsquo;horaire est sollicité, conservé
          uniquement aux fins de l&rsquo;application des limites d&rsquo;utilisation. Aucune donnée
          d&rsquo;image ni aucun contenu de cours n&rsquo;est conservé dans ces registres.
        </Clause>
        <Clause n="3.6">
          <strong>Événements d&rsquo;utilisation agrégés.</strong> Tel que décrit à la clause 5.
        </Clause>
        <Clause n="3.7">
          Nous ne recueillons pas de données de géolocalisation, de listes de contacts,
          d&rsquo;identifiants d&rsquo;appareil, d&rsquo;identifiants publicitaires, ni de
          renseignements biométriques. Le Service ne contient aucune publicité ni aucune technologie
          publicitaire ou de suivi de tiers.
        </Clause>
      </Section>

      <Section title="4. Traitement des images téléversées">
        <Clause n="4.1">
          Lorsque vous choisissez de téléverser une capture d&rsquo;écran d&rsquo;un horaire de cours,
          le Service tente d&rsquo;abord d&rsquo;en extraire le texte localement sur votre appareil.
          Lorsque l&rsquo;extraction réussit localement, l&rsquo;image ne nous est pas transmise, ni à
          aucun tiers.
        </Clause>
        <Clause n="4.2">
          Lorsque l&rsquo;extraction locale échoue, l&rsquo;image est transmise par l&rsquo;entremise
          de notre fonction serveur à l&rsquo;interface de programmation Gemini de Google, dans le
          seul but d&rsquo;en extraire le texte. L&rsquo;image n&rsquo;est utilisée que pour cette
          seule requête et n&rsquo;est pas conservée par nous. Le traitement de cette requête par
          Google est régi par les conditions applicables à cette interface.
        </Clause>
        <Clause n="4.3">
          Le Service n&rsquo;exploite aucun espace de stockage d&rsquo;images. Aucune image téléversée
          n&rsquo;est enregistrée dans une base de données ou un espace de stockage sous notre
          contrôle.
        </Clause>
        <Clause n="4.4">
          <strong>Traitement automatisé.</strong> L&rsquo;extraction de texte est effectuée par
          reconnaissance optique de caractères et au moyen d&rsquo;un modèle de langage automatisé. Ce
          traitement ne produit qu&rsquo;une proposition de transcription. Elle vous est présentée aux
          fins de révision et de correction avant d&rsquo;être enregistrée, et ne donne lieu à aucune
          décision produisant des effets juridiques à votre égard ou vous affectant de façon
          importante.
        </Clause>
      </Section>

      <Section title="5. Événements d'utilisation agrégés">
        <Clause n="5.1">
          Le Service enregistre un ensemble limité d&rsquo;événements d&rsquo;utilisation aux fins de
          mesurer la rétention et d&rsquo;éclairer les décisions relatives au produit et à la
          tarification. Chaque événement comprend votre identifiant de compte, un type
          d&rsquo;événement, un nombre facultatif de contacts inclus dans une comparaison, et un
          horodatage.
        </Clause>
        <Clause n="5.2">
          Ces registres excluent expressément les noms d&rsquo;utilisateur, l&rsquo;identité de tout
          autre utilisateur, le contenu des cours, les renseignements sur l&rsquo;appareil et les
          renseignements relatifs à l&rsquo;adresse réseau. Un événement enregistre qu&rsquo;une
          comparaison d&rsquo;une taille donnée a eu lieu; il n&rsquo;enregistre pas l&rsquo;identité
          des personnes comparées.
        </Clause>
        <Clause n="5.3">
          Ces registres ne sont accessibles à aucun utilisateur du Service et ne sont communiqués à
          aucun tiers.
        </Clause>
      </Section>

      <Section title="6. Fins de la collecte et de l'utilisation">
        <Clause n="6.1">Les renseignements personnels sont recueillis et utilisés uniquement aux fins suivantes :</Clause>
        <List>
          <li>établir, authentifier et maintenir votre compte;</li>
          <li>vous permettre d&rsquo;enregistrer, de corriger et d&rsquo;afficher votre horaire de cours;</li>
          <li>
            vous permettre d&rsquo;établir des contacts avec d&rsquo;autres utilisateurs et de
            comparer les horaires avec les utilisateurs ayant accepté une mise en relation;
          </li>
          <li>faire respecter les limites d&rsquo;utilisation et protéger l&rsquo;intégrité et la sécurité du Service;</li>
          <li>mesurer l&rsquo;utilisation agrégée, tel que décrit à la clause 5;</li>
          <li>répondre à vos demandes de renseignements et à vos demandes; et</li>
          <li>nous conformer aux obligations légales applicables.</li>
        </List>
        <Clause n="6.2">
          Les renseignements personnels ne sont pas utilisés à une fin incompatible avec celles
          énoncées ci-dessus sans que votre consentement ne soit préalablement obtenu, sauf lorsque
          une telle utilisation est autorisée ou exigée par la loi.
        </Clause>
        <Clause n="6.3">
          Nous ne vendons pas de renseignements personnels et nous n&rsquo;en communiquons pas à des
          tiers moyennant contrepartie ou à leurs propres fins commerciales.
        </Clause>
      </Section>

      <Section title="7. Accessibilité aux autres utilisateurs">
        <Clause n="7.1">
          <strong>Les horaires de cours sont restreints.</strong> Votre horaire de cours
          n&rsquo;est accessible qu&rsquo;à vous-même et aux utilisateurs dont vous avez accepté les
          demandes de mise en relation. Cette restriction est appliquée au niveau de la base de
          données au moyen de politiques de contrôle d&rsquo;accès, et non uniquement dans
          l&rsquo;interface de l&rsquo;application.
        </Clause>
        <Clause n="7.2">
          <strong>Les renseignements de profil sont accessibles aux utilisateurs authentifiés.</strong>{' '}
          Votre nom d&rsquo;utilisateur, votre nom d&rsquo;affichage, votre image de profil, votre
          établissement d&rsquo;enseignement et vos préférences d&rsquo;apparence sont accessibles à
          tout utilisateur authentifié du Service, cela étant nécessaire au fonctionnement de
          l&rsquo;outil de recherche par nom d&rsquo;utilisateur. Vous ne devriez inscrire dans ces
          champs aucun renseignement que vous ne souhaitez pas voir accessible à des personnes qui
          vous sont inconnues.
        </Clause>
        <Clause n="7.3">
          <strong>Codes d&rsquo;invitation.</strong> Votre code d&rsquo;invitation est accessible à
          toute personne à qui vous transmettez votre lien d&rsquo;invitation. Une personne détenant
          ce code peut vous envoyer une demande de mise en relation, que vous demeurez libre de
          refuser.
        </Clause>
        <Clause n="7.4">
          <strong>Retrait de l&rsquo;accès.</strong> La suppression d&rsquo;un contact met fin
          immédiatement à l&rsquo;accès de cet utilisateur à votre horaire de cours, sans autre
          intervention de votre part.
        </Clause>
      </Section>

      <Section title="8. Prestataires de services et transferts hors Québec">
        <Clause n="8.1">
          Nous faisons appel aux prestataires de services suivants, chacun traitant des renseignements
          personnels pour notre compte et selon nos instructions : Supabase (hébergement de la base de
          données et authentification), Vercel (hébergement et diffusion de l&rsquo;application), et
          Google (fourniture d&rsquo;identité et, lorsque la clause 4.2 s&rsquo;applique, extraction de
          texte).
        </Clause>
        <Clause n="8.2">
          Ces prestataires de services peuvent conserver ou traiter des renseignements personnels à
          l&rsquo;extérieur de la province de Québec, y compris aux États-Unis. Les renseignements
          personnels ainsi conservés peuvent être assujettis aux lois du ressort où ils sont
          conservés, y compris à l&rsquo;accès licite par les autorités publiques de ce ressort.
        </Clause>
        <Clause n="8.3">
          Avant de communiquer des renseignements personnels à l&rsquo;extérieur du Québec, nous
          procédons à l&rsquo;évaluation exigée par la loi applicable quant à savoir si les
          renseignements bénéficieraient d&rsquo;une protection adéquate, en tenant compte notamment
          de la sensibilité des renseignements, des fins pour lesquelles ils seront utilisés, et du
          cadre juridique applicable dans le ressort destinataire.
        </Clause>
      </Section>

      <Section title="9. Conservation et destruction">
        <Clause n="9.1">
          Les renseignements de profil, les renseignements relatifs à l&rsquo;horaire de cours et les
          renseignements relatifs aux Contacts sont conservés jusqu&rsquo;à ce que vous les supprimiez
          ou jusqu&rsquo;à la destruction de votre compte, selon la première éventualité.
        </Clause>
        <Clause n="9.2">
          Le remplacement d&rsquo;un horaire de cours écrase l&rsquo;enregistrement précédent. Les
          versions antérieures ne sont pas conservées.
        </Clause>
        <Clause n="9.3">
          Les registres de limitation d&rsquo;utilisation cessent d&rsquo;avoir effet à
          l&rsquo;expiration de la période de limitation applicable.
        </Clause>
        <Clause n="9.4">
          Dès la destruction de votre compte, votre profil, votre horaire de cours, vos registres de
          Contacts et votre registre d&rsquo;authentification sont supprimés, de même que tous les
          registres qui y font référence, par suppression en cascade. La destruction est irréversible
          et nous ne sommes pas en mesure de restaurer les renseignements supprimés.
        </Clause>
      </Section>

      <Section title="10. Vos droits">
        <Clause n="10.1">
          Sous réserve des conditions et exceptions prévues par la loi applicable, vous avez le
          droit :
        </Clause>
        <List>
          <li>
            <strong>d&rsquo;accéder</strong> aux renseignements personnels que nous détenons à votre
            sujet et d&rsquo;en obtenir une copie;
          </li>
          <li>
            <strong>de faire rectifier</strong> les renseignements personnels qui sont inexacts,
            incomplets ou équivoques;
          </li>
          <li>
            <strong>de retirer votre consentement</strong> à la collecte, à l&rsquo;utilisation ou à
            la communication de vos renseignements personnels, sous réserve que le Service puisse
            alors ne plus pouvoir vous être fourni;
          </li>
          <li>
            <strong>d&rsquo;obtenir la destruction</strong> de vos renseignements personnels lorsque
            ceux-ci ne sont plus nécessaires aux fins pour lesquelles ils ont été recueillis, ou
            lorsque leur collecte, leur utilisation ou leur communication n&rsquo;est pas conforme à
            la loi;
          </li>
          <li>
            <strong>de recevoir les renseignements personnels informatisés</strong> que vous nous
            avez fournis dans un format technologique structuré et couramment utilisé, et
            d&rsquo;exiger leur communication à une autre personne ou à un autre organisme ainsi
            autorisé par la loi; et
          </li>
          <li>
            <strong>d&rsquo;être informé</strong> des sources des renseignements personnels que nous
            détenons à votre sujet et des catégories de personnes y ayant accès au sein de notre
            entreprise.
          </li>
        </List>
        <Clause n="10.2">
          Vous pouvez exercer les droits d&rsquo;accès, de rectification et de destruction directement
          à même le Service, ou par demande écrite à {CONTACT_EMAIL}. Nous pouvons exiger les
          renseignements raisonnablement nécessaires pour vérifier votre identité avant de donner
          suite à une demande.
        </Clause>
        <Clause n="10.3">
          Lorsqu&rsquo;une demande est refusée en tout ou en partie, nous en indiquerons les motifs et
          vous informerons de votre droit de révision.
        </Clause>
      </Section>

      <Section title="11. Mesures de sécurité">
        <Clause n="11.1">
          Nous maintenons des mesures de sécurité proportionnées à la sensibilité des renseignements
          personnels détenus, y compris des politiques de contrôle d&rsquo;accès appliquées au niveau
          de la base de données, le chiffrement des renseignements personnels en transit, et la
          restriction de l&rsquo;accès administratif.
        </Clause>
        <Clause n="11.2">
          Aucune méthode de transmission ou de conservation n&rsquo;est entièrement sécuritaire. Bien
          que nous prenions les mesures décrites ci-dessus, nous ne garantissons pas une sécurité
          absolue, et vous ne devriez inscrire dans le Service aucun renseignement dont la
          divulgation vous causerait un préjudice sérieux.
        </Clause>
        <Clause n="11.3">
          <strong>Incidents de confidentialité.</strong> En cas d&rsquo;incident de confidentialité
          touchant des renseignements personnels qui présente un risque de préjudice sérieux, nous en
          aviserons avec diligence la Commission d&rsquo;acc&egrave;s &agrave; l&rsquo;information
          ainsi que les personnes concernées, et tiendrons un registre de ces incidents, le tout tel
          qu&rsquo;exigé par la loi applicable.
        </Clause>
      </Section>

      <Section title="12. Technologies conservées sur votre appareil">
        <Clause n="12.1">
          Le Service conserve des renseignements dans les espaces de stockage local de votre
          navigateur ou de votre appareil, aux fins de maintenir votre session authentifiée et
          d&rsquo;éviter le comptage en double des événements d&rsquo;utilisation décrits à la clause
          5. Ces technologies sont strictement nécessaires au fonctionnement du Service.
        </Clause>
        <Clause n="12.2">
          Le Service n&rsquo;utilise aucun témoin ni technologie équivalente à des fins publicitaires,
          de profilage ou de suivi intersite.
        </Clause>
      </Section>

      <Section title="13. Mineurs">
        <Clause n="13.1">
          Le Service s&rsquo;adresse aux étudiants d&rsquo;établissements d&rsquo;enseignement
          postsecondaire. Il ne s&rsquo;adresse pas aux personnes âgées de moins de 14 ans et ne peut
          être utilisé par elles.
        </Clause>
        <Clause n="13.2">
          En vertu de la loi québécoise applicable, le consentement à la collecte de renseignements
          personnels concernant un mineur de moins de 14 ans doit être donné par le titulaire de
          l&rsquo;autorité parentale. Nous ne recueillons pas sciemment de renseignements personnels
          auprès de telles personnes.
        </Clause>
        <Clause n="13.3">
          Lorsque nous prenons connaissance que des renseignements personnels concernant une personne
          de moins de 14 ans ont été recueillis sans le consentement requis, nous les détruirons sans
          délai. Toute personne titulaire de l&rsquo;autorité parentale peut nous en aviser à{' '}
          {CONTACT_EMAIL}.
        </Clause>
      </Section>

      <Section title="14. Modification de la présente Politique">
        <Clause n="14.1">
          Nous pouvons modifier la présente Politique de temps à autre. La date de la plus récente
          modification figure au haut du présent document.
        </Clause>
        <Clause n="14.2">
          Lorsqu&rsquo;une modification touche de façon importante la manière dont vos renseignements
          personnels sont recueillis, utilisés ou communiqués, nous en donnerons avis à même le
          Service avant son entrée en vigueur et, lorsque la loi l&rsquo;exige, obtiendrons votre
          consentement.
        </Clause>
      </Section>

      <Section title="15. Droit applicable et recours">
        <Clause n="15.1">
          La présente Politique est régie et interprétée conformément aux lois de {JURISDICTION_FR}.
        </Clause>
        <Clause n="15.2">
          Rien dans la présente Politique ne limite un droit ou un recours dont vous disposez en vertu
          de la loi applicable, y compris votre droit de déposer une plainte auprès de la Commission
          d&rsquo;acc&egrave;s &agrave; l&rsquo;information du Qu&eacute;bec ou du Commissariat à la
          protection de la vie privée du Canada.
        </Clause>
        <Clause n="15.3">
          Toute communication concernant la présente Politique doit être adressée à {OPERATOR_NAME}, à{' '}
          {CONTACT_EMAIL}.
        </Clause>
      </Section>

      <Section title="16. Langue">
        <Clause n="16.1">
          La présente Politique est disponible en anglais et en français. En cas d&rsquo;incohérence
          ou de divergence entre les deux versions, la version française prévaut, conformément à la
          Charte de la langue française.
        </Clause>
        <Clause n="16.2">
          Vous pouvez passer de la version anglaise à la version française de la présente Politique,
          et inversement, en tout temps au moyen du sélecteur de langue situé au haut de cette page.
        </Clause>
      </Section>
    </>
  );
}

export default function PrivacyPage() {
  return (
    <LegalLayout titleEn="Privacy Policy" titleFr="Politique de confidentialité">
      {(lang) => (lang === 'fr' ? <PrivacyFr /> : <PrivacyEn />)}
    </LegalLayout>
  );
}
