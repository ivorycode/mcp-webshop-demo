# Native WebMCP-E2E-Tests

`npm run test:webmcp:native` prüft die fünf Webshop-Tools über die **echte
Chrome-API `document.modelContext.executeTool()`**. Playwright bedient den Shop,
ruft die Tools im Seitenkontext auf und prüft Resultate sowie sichtbare Änderungen.
Es werden weder `document.modelContext` noch `fetch` oder Tool-Callbacks ersetzt.
Der externe Produktkatalog wird durch den vorhandenen lokalen Katalog-Mock ersetzt.

## Starten

Im Verzeichnis dieses Projekts:

```bash
npm ci
# Falls Google Chrome noch nicht installiert ist:
npx playwright install chrome
npm run test:webmcp:native
```

Die Suite verwendet das installierte **Google Chrome** (`channel: 'chrome'`),
standardmässig headless. `npx playwright install chromium` allein installiert
nicht diesen Browserkanal. Erfolgreich geprüft mit Chrome **152.0.7977.77**.
Die verwendete Chrome-Version wird als Testannotation aufgezeichnet.
Die experimentelle API kann sich zwischen Chrome-Versionen ändern.

Die Konfiguration setzt `--enable-features=WebMCPTesting` beim Browserstart.
Eine manuelle Änderung in `chrome://flags`, eine Extension, ein Origin-Trial-Token,
eine `.env` oder ein LLM-API-Key sind für diese Suite nicht erforderlich.

Zum sichtbaren Mitverfolgen oder für einen einzelnen Test:

```bash
npm run test:webmcp:native -- --headed
npm run test:webmcp:native -- --grep "native cart"
```

Playwright startet und beendet zwei eigene Dienste:

| Dienst       | Adresse                  |
| ------------ | ------------------------ |
| Webshop      | `http://127.0.0.1:43556` |
| Katalog-Mock | `http://127.0.0.1:43557` |

Diese Ports müssen frei sein. Laufende Workshop-Dienste auf `3051`/`3052` und
`4040` sowie der MCP-App-Host auf `43552`/`43553` können weiterlaufen. Die native
Suite startet keinen MCP-App-Host. Starter und Musterlösung verwenden dieselben
nativen Testports; führe ihre Suiten nacheinander aus.

## Was wird geprüft?

| Test                                   | Beobachtbares Verhalten                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native Registrierung und anonyme Suche | Genau fünf Tools mit Eingabeschemas ohne `loginId`; die Suche liefert höchstens fünf der mehr als fünf Milch-Treffer und aktualisiert die sichtbare Suche. Alle vier Warenkorb-/Checkout-Tools liefern ohne Anmeldung einen Anmeldefehler.                                                                                                                                                                |
| Tool-Konsole nach Reload               | Nach einem vollständigen Reload sind wieder genau fünf Tools verfügbar. Ein über das eingebaute Panel ausgeführter Suchaufruf liefert ein erfolgreiches Resultat und aktualisiert die Suche.                                                                                                                                                                                                              |
| Warenkorb und Bestellung               | Anmeldung und Kontowechsel erfolgen über die UI. Hinzufügen, Lesen, Entfernen und Checkout laufen über die native API. UI und Tools teilen die aktuelle Cookie-Session; eine manuelle Mengenänderung ist beim nächsten Tool-Aufruf sichtbar. Die Konten bleiben getrennt. Checkout leert den Warenkorb und zeigt die neue Bestellung ohne Reload. Ein erneuter Checkout erzeugt keine weitere Bestellung. |
| Fehler ohne Zustandsänderung           | Menge `0` wird als ungültig zurückgewiesen. Eine unbekannte Artikelnummer liefert einen API-Fehler. Warenkorb und sichtbare Positionen bleiben unverändert.                                                                                                                                                                                                                                               |

Jeder Test erhält einen neuen Browserkontext. Die Cart-Tests räumen die benötigten
Demo-Warenkörbe über die UI auf; ein einzelner Worker vermeidet konkurrierende
Änderungen am gemeinsamen Serverzustand. Die Suite bestellt ausschliesslich
Demo-Produkte beim isolierten Test-Webshop.

## Wie erfolgt der native Aufruf?

Die Implementierung steht in
[`test/webmcp-native/webshop.spec.ts`](../test/webmcp-native/webshop.spec.ts),
die Konfiguration in
[`playwright.webmcp.config.ts`](../playwright.webmcp.config.ts).
Der Aufruf hat folgendes Muster:

```ts
const result = await page.evaluate(async () => {
  const context = document.modelContext!
  const tool = (await context.getTools()).find(
    (candidate) => candidate.name === 'searchProducts',
  )
  if (!tool) throw new Error('searchProducts fehlt')
  const raw = await context.executeTool(tool, JSON.stringify({ term: 'Milch' }))
  if (raw === null) throw new Error('Unerwartete Navigation')
  return JSON.parse(raw)
})
expect(result.ok).toBe(true)
await expect(page.locator('input[name="query"]')).toHaveValue('Milch')
```

Entdecken und Ausführen geschehen innerhalb desselben `page.evaluate`-Aufrufs:
Der native Tool-Deskriptor enthält eine `Window`-Referenz und bleibt im Browser.
Nur das serialisierbare Ergebnis geht an Playwright zurück. Danach warten
Locator-Assertions auf die sichtbare UI-Aktualisierung, ohne die Seite neu zu laden.

**Chrome 152 erwartet die Eingabe als JSON-String.** Die lokalen Typen und die
Tool-Konsole verwenden deshalb dieselbe Signatur. Der Spezifikationsentwurf mit
Objekt-Eingaben entspricht noch nicht dieser getesteten Chrome-Schnittstelle.
Es gibt keinen automatischen Wiederholungsversuch mit einer anderen Signatur;
insbesondere werden mutierende Aufrufe nicht auf Verdacht erneut ausgeführt.

## Ergebnis und Abgrenzung

In der Musterlösung und nach dem Ausfüllen des Starters müssen **vier Tests grün**
sein. Der unausgefüllte Starter scheitert absichtlich an der erwarteten Liste von
fünf Tools. Die Meldung verweist auf die Übungsschritte 1–5. Fehlendes Chrome,
eine fehlende native API oder inkompatible Tool-Aufrufe führen zu einem Fehler;
Tests werden nicht stillschweigend übersprungen und verwenden keinen Fallback.

Die Suite läuft ausschliesslich über `test:webmcp:native`. Die bisherigen
`npm test`- und allgemeinen Playwright-Befehle führen sie nicht mit aus und können
im unausgefüllten Starter weiterhin grün sein. Die Node-Übungstests mit
Testdoubles bleiben als schnelle Prüfung von Tool-Logik und Abort-Cleanup erhalten.

Der native Reload-Test prüft die Registrierung im neuen Dokument. Er erzwingt
keinen React-Unmount im selben Dokument und ersetzt damit nicht den gezielten
Node-Test des Abort-Cleanups. Agentenentscheidungen, die Chrome-DevTools-Oberfläche
und die Inspector-Extension werden ebenfalls nicht automatisiert geprüft; diese
zusätzlichen Zugänge kannst du weiterhin manuell ausprobieren.

Bei Fehlern liegen Traces unter `test-results/webmcp-native/`:

```bash
npx playwright show-trace test-results/webmcp-native/<testverzeichnis>/trace.zip
```

Ersetze `<testverzeichnis>` durch den im Fehlerbericht ausgegebenen Ordner.
