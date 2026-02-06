"use client";

export default function ImpressumPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <div className="legal-placeholder-banner">
          <strong>Platzhalter / Entwurf.</strong>
          Diese Seite ist noch nicht rechtsverbindlich. Keine kommerzielle Nutzung, keine Verkaeufe, keine Abos.
        </div>
        <h1>Impressum (Platzhalter)</h1>

        <section className="legal-section">
          <h2>Hinweis</h2>
          <p>
            Diese Seite ist ein Platzhalter fuer ein spaeteres Impressum. Es besteht keine kommerzielle Nutzung und es gibt keine bezahlten Angebote.
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
          <p>[Kontakt folgt]</p>
        </section>

        <div className="legal-footer">
          <a href="/">Zurueck zur Startseite</a>
        </div>
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
          margin-bottom: 12px;
          color: var(--text-primary);
        }
        
        .legal-section p {
          color: var(--text-secondary);
          line-height: 1.6;
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
