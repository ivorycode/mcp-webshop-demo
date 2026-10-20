import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-14">
      <section className="panel rise-in rounded-xl px-6 py-10 sm:px-10 sm:py-14">
        <p className="island-kicker mb-3">Technische Hinweise</p>
        <h1 className="display-title mb-5 text-4xl leading-tight font-bold tracking-tight text-[var(--ink-strong)] sm:text-5xl">
          So funktioniert dieser Demo Web Shop.
        </h1>
        <p className="max-w-3xl text-base text-[var(--ink-soft)] sm:text-lg">
          Die App leitet die Such- und Artikel-Detail-Endpunkte von Transgourmet
          über lokale API-Routen weiter, speichert den Demo-Login in Cookies und
          verwaltet pro Demo-Konto einen Warenkorb in einem serverseitigen
          In-Memory-Store.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          [
            'Such-Proxy',
            'Client-Anfragen gehen an lokale API-Routen, die anschliessend die Transgourmet-JSON-Endpunkte auf dem Server abrufen.',
          ],
          [
            'Demo-Login',
            'Die Auswahl eines Demo-Kontos setzt ein HttpOnly-Cookie, damit jedes Konto einen separaten Warenkorb erhält.',
          ],
          [
            'Warenkorb-Ablauf',
            'Hinzufügen, ändern, entfernen, leeren und absenden laufen komplett über einen serverseitigen In-Memory-Store.',
          ],
        ].map(([title, desc], index) => (
          <article
            key={title}
            className="panel rise-in rounded-xl p-5"
            style={{ animationDelay: `${index * 90 + 60}ms` }}
          >
            <h2 className="mb-2 text-base font-semibold text-[var(--ink-strong)]">
              {title}
            </h2>
            <p className="m-0 text-sm text-[var(--ink-soft)]">{desc}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
