"use client";

import Link from "next/link";

/**
 * Render a horizontal list of footer links to legal pages.
 *
 * @param className - Optional additional CSS class names appended to the root container
 * @returns The rendered container element with links to Impressum, Datenschutz, AGB, and Widerruf
 */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`legal-links ${className}`}>
      <Link href="/legal/impressum" className="legal-link">
        Impressum
      </Link>
      <span className="legal-separator">·</span>
      <Link href="/legal/datenschutz" className="legal-link">
        Datenschutz
      </Link>
      <span className="legal-separator">·</span>
      <Link href="/legal/agb" className="legal-link">
        AGB
      </Link>
      <span className="legal-separator">·</span>
      <Link href="/legal/widerruf" className="legal-link">
        Widerruf
      </Link>

      <style jsx>{`
        .legal-links {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
          margin-bottom: 12px;
        }
        
        .legal-link {
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 0.875rem;
          transition: color 0.2s;
        }
        
        .legal-link:hover {
          color: var(--text-primary);
          text-decoration: underline;
        }
        
        .legal-separator {
          color: var(--text-muted);
          font-size: 0.875rem;
        }
        
        @media (max-width: 480px) {
          .legal-links {
            gap: 4px;
          }
          
          .legal-link {
            font-size: 0.8rem;
          }
          
          .legal-separator {
            font-size: 0.8rem;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Renders a compact horizontal list of legal page links suitable for tight spaces.
 *
 * @param className - Optional additional CSS class name(s) applied to the container.
 * @returns The rendered compact legal links element containing Impressum, Datenschutz, and AGB links.
 */
export function LegalLinksCompact({ className = "" }: { className?: string }) {
  return (
    <div className={`legal-links-compact ${className}`}>
      <Link href="/legal/impressum" className="legal-link-compact">
        Impressum
      </Link>
      <span className="legal-separator-compact">|</span>
      <Link href="/legal/datenschutz" className="legal-link-compact">
        Datenschutz
      </Link>
      <span className="legal-separator-compact">|</span>
      <Link href="/legal/agb" className="legal-link-compact">
        AGB
      </Link>

      <style jsx>{`
        .legal-links-compact {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        
        .legal-link-compact {
          color: var(--text-muted);
          text-decoration: none;
          font-size: 0.75rem;
          transition: color 0.2s;
        }
        
        .legal-link-compact:hover {
          color: var(--text-secondary);
          text-decoration: underline;
        }
        
        .legal-separator-compact {
          color: var(--text-muted);
          font-size: 0.75rem;
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}