export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer mt-16 px-4 pb-14 pt-10 text-[var(--sea-ink-soft)]">
      <div className="page-wrap flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <p className="m-0 text-sm">
          &copy; {year} Demo Web Shop für die Transgourmet-Integration.
        </p>
        <p className="island-kicker m-0">
          Mit serverseitigem Warenkorb im Speicher
        </p>
      </div>
      <div className="mt-5 flex justify-center gap-3 sm:justify-start">
        <a
          href="https://tanstack.com/start/latest/docs/framework/react/overview"
          target="_blank"
          rel="noreferrer"
          className="footer-icon rounded-md border border-[var(--line)] p-2 text-[var(--sea-ink-soft)] no-underline"
        >
          <span className="sr-only">TanStack-Start-Dokumentation öffnen</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" width="32" height="32">
            <path
              fill="currentColor"
              d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zm5 16H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7z"
            />
          </svg>
        </a>
        <a
          href="https://web.transgourmet.ch/de/webshop/resources/articles/228001/detail"
          target="_blank"
          rel="noreferrer"
          className="footer-icon rounded-md border border-[var(--line)] p-2 text-[var(--sea-ink-soft)] no-underline"
        >
          <span className="sr-only">Beispiel für Detail-Endpunkt öffnen</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" width="32" height="32">
            <path
              fill="currentColor"
              d="M6 4h12l-1 5H7L6 4zm1.2 7h9.45l1.23-6.15A1 1 0 0 0 16.9 3H5.82l-.2-1.06A1 1 0 0 0 4.64 1H3v2h.8l1.86 9.3A2 2 0 0 0 7.62 14h8.88v-2H7.62l-.42-1zM7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
            />
          </svg>
        </a>
      </div>
    </footer>
  )
}
