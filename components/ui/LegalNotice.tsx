"use client";

import Link from "next/link";

/**
 * Render a legal notice containing links to AGB, Datenschutzerklärung, and Widerrufsbelehrung.
 *
 * @param showCheckbox - Whether to include a consent checkbox next to the notice; default is `false`.
 */
export function LegalNotice({ showCheckbox = false }: { showCheckbox?: boolean }) {
  return (
    <div className="legal-notice">
      <p className="legal-notice-text">
        Mit der Registrierung akzeptierst du unsere{" "}
        <Link href="/legal/agb" className="legal-notice-link">
          AGB
        </Link>{" "}
        und bestätigst, dass du die{" "}
        <Link href="/legal/datenschutz" className="legal-notice-link">
          Datenschutzerklärung
        </Link>{" "}
        gelesen hast.
      </p>
      <p className="legal-notice-hint">
        Für kostenpflichtige Abos gilt: Durch den Kauf stimmst du zu, dass die 
        Dienstleistung sofort beginnt und du dein Widerrufsrecht verlierst, sobald 
        die Dienstleistung vollständig erbracht wurde ({" "}
        <Link href="/legal/widerruf" className="legal-notice-link">
          Widerrufsbelehrung
        </Link>
        ).
      </p>

      <style jsx>{`
        .legal-notice {
          margin-top: 16px;
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: 8px;
          border: 1px solid var(--border);
        }
        
        .legal-notice-text {
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0 0 8px 0;
        }
        
        .legal-notice-hint {
          font-size: 0.75rem;
          color: var(--text-muted);
          line-height: 1.4;
          margin: 0;
        }
        
        .legal-notice-link {
          color: var(--primary);
          text-decoration: underline;
          transition: color 0.2s;
        }
        
        .legal-notice-link:hover {
          color: var(--primary-hover);
        }
        
        @media (max-width: 640px) {
          .legal-notice {
            padding: 10px;
          }
          
          .legal-notice-text {
            font-size: 0.75rem;
          }
          
          .legal-notice-hint {
            font-size: 0.7rem;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Compact legal notice suitable for tight layouts.
 *
 * @returns A React element that renders a small, centered notice containing links to the AGB and Datenschutzerklärung.
 */
export function LegalNoticeCompact() {
  return (
    <div className="legal-notice-compact">
      <p>
        Mit der Anmeldung akzeptierst du die{" "}
        <Link href="/legal/agb">AGB</Link> und{" "}
        <Link href="/legal/datenschutz">Datenschutzerklärung</Link>.
      </p>

      <style jsx>{`
        .legal-notice-compact {
          margin-top: 12px;
          text-align: center;
        }
        
        .legal-notice-compact p {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin: 0;
        }
        
        .legal-notice-compact a {
          color: var(--primary);
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}