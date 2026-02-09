"use client";

/**
 * Render the placeholder terms and conditions page.
 */
export default function AGBPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <div className="legal-placeholder-banner">
          <strong>Platzhalter / Entwurf.</strong>
          Diese Seite ist noch nicht rechtsverbindlich. Keine kommerzielle Nutzung, keine Verkaeufe, keine Abos.
        </div>
        <h1>Allgemeine Geschaeftsbedingungen (Platzhalter)</h1>

        <section className="legal-section">
          <h2>Hinweis</h2>
          <p>
            Zemni befindet sich in einer nicht-kommerziellen Testphase. Es gibt derzeit keine kostenpflichtigen Angebote, keinen Checkout und keine Abonnements.
          </p>
        </section>

        <section className="legal-section">
          <h2>Platzhaltertext</h2>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
          </p>
        </section>

        <section className="legal-section">
          <h2>Kontakt (Platzhalter)</h2>
          <p>
            [Kontakt folgt]
          </p>
        </section>

        <div className="legal-footer">
          <a href="/">Zurueck zur Startseite</a>
        </div>

        {/* ORIGINAL LEGAL TEXT (commented for later restore)
        <h1>Allgemeine Geschäftsbedingungen (AGB)</h1>
        
        <section className="legal-section">
          <h2>§ 1 Geltungsbereich</h2>
          <p>
            Diese Allgemeinen Geschäftsbedingungen (nachfolgend "AGB") gelten für alle Nutzungsverhältnisse 
            zwischen [Luis Leineweber] (nachfolgend "Anbieter") und den Nutzern der Webanwendung 
            Zemni (nachfolgend "Nutzer").
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 2 Vertragsgegenstand</h2>
          <p>
            (1) Der Anbieter stellt dem Nutzer eine Online-Plattform zur Verfügung, mit der PDF-Dokumente 
            und andere Textdateien hochgeladen und mittels Künstlicher Intelligenz in Zusammenfassungen, 
            Lernkarten und Quizfragen umgewandelt werden können.
          </p>
          <p>
            (2) Die Nutzung der Basisfunktionen ist kostenlos. Erweiterte Funktionen sind über kostenpflichtige 
            Abonnements verfügbar ("Plus" und "Pro" Tarife).
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 3 Registrierung und Account</h2>
          <p>
            (1) Für die Nutzung ist eine Registrierung erforderlich. Der Nutzer muss hierbei eine gültige 
            E-Mail-Adresse angeben.
          </p>
          <p>
            (2) Der Nutzer ist verpflichtet, seine Zugangsdaten geheim zu halten und vor dem Zugriff 
            Dritter zu schützen.
          </p>
          <p>
            (3) Bei Verdacht auf missbräuchliche Nutzung kann der Anbieter den Account sperren oder löschen.
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 4 Leistungsbeschreibung</h2>
          <p>
            (1) Der Anbieter erbringt folgende Leistungen:
          </p>
          <ul>
            <li>Upload von PDF- und Textdateien</li>
            <li>Automatische Textextraktion und -analyse</li>
            <li>Generierung von Zusammenfassungen mittels KI</li>
            <li>Erstellung von Lernkarten (Flashcards)</li>
            <li>Generierung von Quizfragen</li>
            <li>Speicherung der erstellten Inhalte (Account-basiert)</li>
          </ul>
          <p>
            (2) Die KI-generierten Inhalte dienen als Lernhilfe. Der Anbieter übernimmt keine Gewähr 
            für die Richtigkeit, Vollständigkeit oder Angemessenheit der generierten Inhalte.
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 5 Preise und Zahlung</h2>
          <p>
            (1) Die aktuellen Preise für kostenpflichtige Abonnements sind auf der Website ersichtlich 
            und zum Zeitpunkt des Vertragsschlusses maßgeblich.
          </p>
          <p>
            (2) Die Zahlung erfolgt über den Zahlungsdienstleister Polar. Es gelten die AGB von Polar.
          </p>
          <p>
            (3) Abonnements verlängern sich automatisch um den vereinbarten Zeitraum, sofern sie nicht 
            rechtzeitig gekündigt werden.
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 6 Widerrufsrecht</h2>
          <p>
            (1) Verbrauchern steht ein Widerrufsrecht nach Maßgabe der gesetzlichen Bestimmungen zu.
          </p>
          <p>
            (2) Details zum Widerrufsrecht finden sich in der gesonderten Widerrufsbelehrung.
          </p>
          <p>
            (3) Hinweis: Bei digitalen Inhalten kann das Widerrufsrecht vorzeitig erlöschen, wenn der 
            Nutzer ausdrücklich zustimmt, dass die Ausführung vor Ablauf der Widerrufsfrist beginnt.
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 7 Vertragsschluss bei Abonnements</h2>
          <p>
            (1) Die Darstellung der Produkte auf der Website stellt kein bindendes Angebot dar.
          </p>
          <p>
            (2) Durch Anklicken des Buttons "Jetzt upgraden" oder ähnlicher Bezeichnung gibt der Nutzer 
            ein verbindliches Angebot zum Abschluss eines Abonnement-Vertrags ab.
          </p>
          <p>
            (3) Der Vertrag kommt zustande, wenn der Anbieter das Angebot annimmt (Zugangsbestätigung 
            oder Beginn der Leistungserbringung).
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 8 Kündigung</h2>
          <p>
            (1) Kostenlose Accounts können jederzeit vom Nutzer gelöscht werden.
          </p>
          <p>
            (2) Kostenpflichtige Abonnements können monatlich gekündigt werden. Die Kündigung ist bis 
            zum letzten Tag des aktuellen Abrechnungszeitraums möglich.
          </p>
          <p>
            (3) Die Kündigung erfolgt über die Account-Einstellungen oder durch E-Mail an [E-Mail-Adresse].
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 9 Haftung</h2>
          <p>
            (1) Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für 
            die Verletzung von Leben, Körper und Gesundheit.
          </p>
          <p>
            (2) Für einfache Fahrlässigkeit haftet der Anbieter nur bei der Verletzung vertragswesentlicher 
            Pflichten (Kardinalpflichten). Die Haftung ist auf den vertragstypischen, vorhersehbaren Schaden begrenzt.
          </p>
          <p>
            (3) Die Haftung für Datenverlust ist auf den Aufwand der Wiederherstellung aus einer 
            Datensicherung begrenzt, sofern der Nutzer nicht nachweist, dass keine Sicherung vorhanden ist.
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 10 Datenschutz</h2>
          <p>
            Informationen zum Datenschutz finden sich in der separaten Datenschutzerklärung unter 
            <a href="/legal/datenschutz">/legal/datenschutz</a>.
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 11 Schlussbestimmungen</h2>
          <p>
            (1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
          </p>
          <p>
            (2) Gerichtsstand ist [Ort], sofern der Nutzer Kaufmann, juristische Person des öffentlichen 
            Rechts oder öffentlich-rechtliches Sondervermögen ist oder keinen allgemeinen Gerichtsstand in 
            Deutschland hat.
          </p>
          <p>
            (3) Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt der Vertrag 
            im Übrigen wirksam. An die Stelle der unwirksamen Bestimmung tritt eine wirksame Regelung, 
            die dem wirtschaftlichen Zweck der unwirksamen Bestimmung am nächsten kommt.
          </p>
        </section>

        <section className="legal-section">
          <h2>Stand</h2>
          <p>Diese AGB sind gültig ab: [Datum einfügen]</p>
        </section>

        <div className="legal-footer">
          <a href="/">← Zurück zur Startseite</a>
        </div>        */}

      </div>

      <style jsx>{`
        .legal-page {
          min-height: 100vh;
          background: var(--bg-primary);
          padding: 48px 24px;
        }
        
        .legal-container {
          max-width: 800px;
          margin: 0 auto;
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 48px;
          border: 1px solid var(--border);
        }

        .legal-placeholder-banner {
          border: 1px dashed var(--border);
          background: var(--bg-primary);
          color: var(--text-primary);
          padding: 16px;
          border-radius: 10px;
          margin-bottom: 24px;
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .legal-placeholder-banner strong {
          display: block;
          margin-bottom: 6px;
        }


        
        h1 {
          font-size: 2rem;
          margin-bottom: 32px;
          color: var(--text-primary);
        }
        
        .legal-section {
          margin-bottom: 32px;
        }
        
        .legal-section h2 {
          font-size: 1.25rem;
          margin-bottom: 16px;
          color: var(--text-primary);
        }
        
        .legal-section p, .legal-section ul {
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 12px;
        }
        
        .legal-section ul {
          padding-left: 24px;
        }
        
        .legal-section li {
          margin-bottom: 8px;
        }
        
        .legal-section a {
          color: var(--primary);
          text-decoration: underline;
        }
        
        .legal-footer {
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px solid var(--border);
        }
        
        .legal-footer a {
          color: var(--primary);
          text-decoration: none;
        }
        
        .legal-footer a:hover {
          text-decoration: underline;
        }
        
        @media (max-width: 640px) {
          .legal-container {
            padding: 24px;
          }
          
          h1 {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}


