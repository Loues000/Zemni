"use client";

export default function DatenschutzPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <div className="legal-placeholder-banner">
          <strong>Platzhalter / Entwurf.</strong>
          Diese Seite ist noch nicht rechtsverbindlich. Keine kommerzielle Nutzung, keine Verkaeufe, keine Abos.
        </div>
        <h1>Datenschutzerklaerung (Platzhalter)</h1>

        <section className="legal-section">
          <h2>Hinweis</h2>
          <p>
            Diese Datenschutzerklaerung ist ein Platzhalter. Die Anwendung ist nicht kommerziell und bietet derzeit keine kostenpflichtigen Abos oder Produkte an.
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
        <h1>Datenschutzerklärung</h1>
        
        <section className="legal-section">
          <h2>1. Datenschutz auf einen Blick</h2>
          <h3>Allgemeine Hinweise</h3>
          <p>
            Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten 
            passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie 
            persönlich identifiziert werden können.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Verantwortlicher</h2>
          <p>
            <strong>[Luis Leineweber]</strong><br />
            [Mühlenstr. 10]<br />
            [10117 Berlin]<br />
            E-Mail: [luis@luisleineweber.de]
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Datenerfassung auf dieser Website</h2>
          
          <h3>3.1 Wie erfassen wir Ihre Daten?</h3>
          <p>
            Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Hierbei kann es sich 
            z.B. um Daten handeln, die Sie in ein Kontaktformular eingeben.
          </p>
          <p>
            Andere Daten werden automatisch oder nach Ihrer Einwilligung beim Besuch der Website durch unsere 
            IT-Systeme erfasst. Das sind vor allem technische Daten (z.B. Internetbrowser, Betriebssystem oder 
            Uhrzeit des Seitenaufrufs).
          </p>

          <h3>3.2 Welche Daten erfassen wir?</h3>
          <ul>
            <li><strong>Account-Daten:</strong> E-Mail-Adresse, Name (bei Registrierung)</li>
            <li><strong>Nutzungsdaten:</strong> Hochgeladene PDFs (werden verarbeitet, nicht dauerhaft gespeichert)</li>
            <li><strong>Technische Daten:</strong> IP-Adresse, Browser-Informationen, Zeitstempel</li>
            <li><strong>Zahlungsdaten:</strong> Bei Abo-Abschluss via Polar (Polar speichert diese)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>4. Dienste von Drittanbietern</h2>
          
          <h3>4.1 Clerk (Authentifizierung)</h3>
          <p>
            Wir nutzen Clerk für die Benutzerauthentifizierung. Clerk verarbeitet Ihre Login-Daten.
            <br />
            Anbieter: Clerk Inc., USA<br />
            Datenschutzerklärung: <a href="https://clerk.com/legal/privacy" target="_blank" rel="noopener noreferrer">clerk.com/legal/privacy</a>
          </p>

          <h3>4.2 Convex (Datenbank)</h3>
          <p>
            Ihre Dokumente und Account-Daten werden in Convex gespeichert.
            <br />
            Anbieter: Convex Software Inc., USA<br />
            Datenschutzerklärung: <a href="https://www.convex.dev/legal/privacy" target="_blank" rel="noopener noreferrer">convex.dev/legal/privacy</a>
          </p>

          <h3>4.3 Polar (Zahlungen)</h3>
          <p>
            Bei Zahlungen nutzen wir Polar. Polar verarbeitet Ihre Zahlungsinformationen.
            <br />
            Anbieter: Polar Software, Inc., USA<br />
            Datenschutzerklärung: <a href="https://polar.sh/legal/privacy" target="_blank" rel="noopener noreferrer">polar.sh/legal/privacy</a>
          </p>

          <h3>4.4 OpenRouter (KI-Modelle)</h3>
          <p>
            Textverarbeitung erfolgt über OpenRouter, der verschiedene KI-Modelle anbindet.
            <br />
            Anbieter: OpenRouter Inc., USA<br />
            Datenschutzerklärung: <a href="https://openrouter.ai/privacy" target="_blank" rel="noopener noreferrer">openrouter.ai/privacy</a>
          </p>

          <h3>4.5 Sentry (Fehleranalyse)</h3>
          <p>
            Wir nutzen Sentry zur Fehleranalyse und -behebung.
            <br />
            Anbieter: Functional Software Inc., USA<br />
            Datenschutzerklärung: <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer">sentry.io/privacy</a>
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Ihre Rechte</h2>
          <p>Sie haben folgende Rechte bezüglich Ihrer personenbezogenen Daten:</p>
          <ul>
            <li>Recht auf Auskunft (Art. 15 DSGVO)</li>
            <li>Recht auf Berichtigung (Art. 16 DSGVO)</li>
            <li>Recht auf Löschung (Art. 17 DSGVO)</li>
            <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
            <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>Widerspruchsrecht (Art. 21 DSGVO)</li>
          </ul>
          <p>
            Kontaktieren Sie uns unter [E-Mail-Adresse] zur Ausübung Ihrer Rechte.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Speicherdauer</h2>
          <p>
            Wir speichern Ihre personenbezogenen Daten nur so lange, wie dies zur Erfüllung der Zwecke erforderlich 
            ist, für die sie erhoben wurden, oder wie es gesetzliche Aufbewahrungspflichten vorsehen.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Cookies</h2>
          <p>
            Diese Website verwendet Cookies für die Authentifizierung (Clerk) und die Benutzererfahrung. 
            Sie können Ihren Browser so einstellen, dass Sie über das Setzen von Cookies informiert werden 
            und Cookies nur im Einzelfall erlauben.
          </p>
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
        
        .legal-section h3 {
          font-size: 1.1rem;
          margin-bottom: 12px;
          margin-top: 16px;
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


