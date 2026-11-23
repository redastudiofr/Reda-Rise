export const metadata = { title: 'Hors-ligne' };

export default function OfflinePage() {
  return (
    <main className="login">
      <div className="login-box" style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 620, margin: '0 0 8px' }}>Hors-ligne</h1>
        <p className="sub">
          Cette page n&apos;a pas encore été mise en cache. Reviens à l&apos;accueil, les données
          déjà enregistrées restent accessibles.
        </p>
        <div style={{ marginTop: 18 }}>
          <a className="btn" href="/">
            Retour à l&apos;accueil
          </a>
        </div>
      </div>
    </main>
  );
}
