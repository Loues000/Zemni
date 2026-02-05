"use client";

export default function WiderrufPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <div className="legal-placeholder-banner">
          <strong>Platzhalter / Entwurf.</strong>
          Diese Seite ist noch nicht rechtsverbindlich. Keine kommerzielle Nutzung, keine Verkaeufe, keine Abos.
        </div>
        <h1>Widerrufsbelehrung (Platzhalter)</h1>

        <section className="legal-section">
          <h2>Hinweis</h2>
          <p>
            Derzeit werden keine Waren, Abos oder digitalen Leistungen verkauft. Ein Widerrufsrecht fuer Kaufvertraege ist damit aktuell nicht einschlaegig.
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
        <h1>Widerrufsbelehrung</h1>
        
        <section className="legal-section">
          <h2>Widerrufsrecht</h2>
          <p>
            Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.
          </p>
          <p>
            Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses.
          </p>
          <p>
            Um Ihr Widerrufsrecht auszuüben, müssen Sie uns ([Dein Name/Firma], [Adresse], E-Mail: [E-Mail]) 
            mittels einer eindeutigen Erklärung (z.B. ein mit der Post versandter Brief oder E-Mail) über 
            Ihren Entschluss, diesen Vertrag zu widerrufen, informieren.
          </p>
          <p>
            Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.
          </p>
          <p>
            Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des 
            Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
          </p>
        </section>

        <section className="legal-section">
          <h2>Folgen des Widerrufs</h2>
          <p>
            Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, 
            einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass 
            Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), 
            unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung 
            über Ihren Widerruf dieses Vertrags bei uns eingegangen ist.
          </p>
          <p>
            Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion 
            eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall 
            werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.
          </p>
        </section>

        <section className="legal-section">
          <h2>Besondere Hinweise</h2>
          <p>
            <strong>Hinweis auf vorzeitigen Erlöschen des Widerrufsrechts bei digitalen Inhalten:</strong>
          </p>
          <p>
            Bei Verträgen zur Erbringung von digitalen Inhalten (z.B. Software-as-a-Service, Online-Dienste) 
            erlischt Ihr Widerrufsrecht vorzeitig, wenn wir mit der Ausführung des Vertrags begonnen haben, 
            nachdem Sie ausdrücklich zugestimmt haben, dass wir mit der Ausführung vor Ablauf der Widerrufsfrist 
            beginnen, und Sie Ihre Kenntnis davon bestätigt haben, dass Sie durch Ihre Zustimmung mit Beginn der 
            Ausführung des Vertrags Ihr Widerrufsrecht verlieren.
          </p>
          <p>
            <em>
              Durch Abschluss eines kostenpflichtigen Abonnements stimmen Sie ausdrücklich zu, dass wir mit der 
              Erbringung der Dienstleistung vor Ablauf der Widerrufsfrist beginnen. Sie bestätigen, dass Sie 
              Kenntnis davon haben, dass Sie durch diese Zustimmung Ihr Widerrufsrecht verlieren, sobald die 
              Dienstleistung vollständig erbracht ist.
            </em>
          </p>
        </section>

        <section className="legal-section">
          <h2>Muster-Widerrufsformular</h2>
          <div className="muster-formular">
            <p><strong>Wenn Sie den Vertrag widerrufen wollen, füllen Sie bitte dieses Formular aus und senden Sie es zurück an:</strong></p>
            <p>
              [Dein Name/Firma]<br />
              [Straße Hausnummer]<br />
              [PLZ Ort]<br />
              E-Mail: [E-Mail-Adresse]
            </p>
            <p>
              Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der 
              folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*):
            </p>
            <p>_____________________________________________________</p>
            <p>Bestellt am (*)/erhalten am (*):</p>
            <p>_____________________________________________________</p>
            <p>Name des/der Verbraucher(s):</p>
            <p>_____________________________________________________</p>
            <p>Anschrift des/der Verbraucher(s):</p>
            <p>_____________________________________________________</p>
            <p>_____________________________________________________</p>
            <p>Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):</p>
            <p>_____________________________________________________</p>
            <p>Datum:</p>
            <p>_____________________________________________________</p>
            <p>(*) Unzutreffendes streichen</p>
          </div>
        </section>

        <div className="legal-footer">
          <a href="/">← Zurück zur Startseite</a>
        </div>        */}

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
        
        .legal-section p {
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 12px;
        }
        
        .muster-formular {
          background: var(--bg-primary);
          padding: 24px;
          border-radius: 8px;
          border: 1px solid var(--border);
          margin-top: 16px;
        }
        
        .muster-formular p {
          margin-bottom: 16px;
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
          
          .muster-formular {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}


