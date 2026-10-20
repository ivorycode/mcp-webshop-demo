# Tests

## Node-Tests

`npm test` baut die App (die MCP Apps werden als Resources aus `dist/` gelesen) und führt dann die Node-Tests aus:

- `src/**/*.test.ts`: Shop-Zustand und Mengenregel, Chat-Guard, WebMCP-Tools, Katalogkonfiguration, MCP-Guard, Shop-Events.
- `test/mcp-smoke.test.mjs`: echter MCP-Client über Streamable HTTP und stdio; prüft Tools, Resources, Kontotrennung und dass Web-API und MCP denselben Zustand teilen.
- `test/prod-process.test.mjs`: Produktionsstart über `server.mjs` mit Healthcheck, Assets und MCP-Resources.

Nur MCP: `npm run test:mcp`. Die vollständige Tool-Abdeckung über beide Transporte
und der separat gestartete LLM-Test (`npm run test:mcp:llm`) sind in [MCP-TESTING.md](MCP-TESTING.md) beschrieben.

Module, die unter `node --test` laufen, importieren mit expliziter Dateiendung; deshalb tragen alle Imports im Projekt die Endung.

## E2E-Tests mit Playwright

```bash
npx playwright install chromium
npm run test:e2e                 # alle vier Projects
npm run test:e2e:webshop         # Webshop und Chat, Desktop/Mobil
npm run test:e2e:mcp-apps        # MCP Apps, Desktop/Mobil
npm run test:e2e -- --project webshop-desktop --headed
```

| Project            | Testverzeichnis      | Inhalt                                                                                  |
| ------------------ | -------------------- | --------------------------------------------------------------------------------------- |
| `webshop-desktop`  | `test/e2e/webshop/`  | Klassischer Shop mit und ohne WebMCP, beide Chat-Modi, Ja/Nein-Freigabe, Widget-Buttons |
| `webshop-mobile`   | `test/e2e/webshop/`  | dieselben Tests mit Pixel-7-Emulation                                                   |
| `mcp-apps-desktop` | `test/e2e/mcp-apps/` | Such- und Warenkorb-App im lokalen Testhost                                             |
| `mcp-apps-mobile`  | `test/e2e/mcp-apps/` | dieselben Tests mit Pixel-7-Emulation                                                   |

Die Chat-Tests simulieren den AI-SDK-Nachrichtenstream und brauchen keinen Modellanbieter. Echte Modellaufrufe werden separat mit `npm run test:mcp:llm` gegen den MCP-Server geprüft.

Playwright startet automatisch vier lokale Dienste; die Ports müssen frei sein:

| Dienst          | Adresse                      |
| --------------- | ---------------------------- |
| Mock-Katalog    | `http://127.0.0.1:43555`     |
| Webshop mit MCP | `http://127.0.0.1:43554/mcp` |
| Testhost        | `http://127.0.0.1:43552`     |
| Sandbox         | `http://127.0.0.1:43553`     |

Alle Projects verwenden einen Worker, weil die Demo-Konten ihren Zustand im Serverprozess teilen. Vor jedem MCP-App-Test werden die Demo-Warenkörbe über MCP geleert. Bei Fehlern speichert Playwright Traces unter `test-results/`; öffnen mit `npx playwright show-trace <pfad>/trace.zip`.

## Native WebMCP-Aufrufe mit Chrome

```bash
# Falls Google Chrome noch nicht installiert ist:
npx playwright install chrome
npm run test:webmcp:native
```

Die eigenständige Konfiguration `playwright.webmcp.config.ts` führt vier Tests in
`test/webmcp-native/` aus. Sie prüft echte `document.modelContext.executeTool()`-Aufrufe,
Browser-Session und sichtbare Shop-Änderungen. Shop und Mock-Katalog laufen dafür
auf `43556` und `43557`; ein MCP-App-Host wird nicht gestartet.

Diese Suite ist nicht Teil der vier oben aufgeführten Projects. Deren
WebMCP-Einbindungstests verwenden weiterhin ein Testdouble bzw. prüfen den Shop
ohne experimentelle API. Die native Suite benötigt ein kompatibles installiertes
Chrome und schlägt bei fehlender Unterstützung fehl. Details und Grenzen stehen
in [WEBMCP-TESTING.md](WEBMCP-TESTING.md).

### Testhost für die MCP Apps

Der kleine Host in [`test/support/mcp-host/`](../test/support/mcp-host/) folgt dem offiziellen [`basic-host`](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host). Er lädt die gebauten HTML-Resources über den echten MCP-Endpunkt und verbindet sie über `AppBridge` mit dem Server. Die App läuft in einem inneren iframe mit opaker Origin; ein äusserer iframe auf einer separaten Origin vermittelt Nachrichten und prüft deren Absender. Der Host ist eine lokale Testhilfe, kein vollständiger MCP-App-Host, und wird nicht in den Produktionsbuild eingebunden.

Für die manuelle Nutzung mit dem normalen Dev-Webshop: `npm run dev:mcp-host`.
Die [Startanleitung](../README.md#mcp-apps-manuell-im-lokalen-host-öffnen) verwendet
die Standardports 4040 und 3052. Playwright übergibt automatisch
`--mcp-origin http://127.0.0.1:43554` für den isolierten Test-Webshop.

Die Warenkorb-Abläufe (Hinzufügen, Entfernen und Checkout) laufen mit drei Host-Varianten: unterstützte Benachrichtigungen, fehlende `updateModelContext`-/`message`-Capabilities wie im MCP Inspector und fehlschlagende Aufrufe trotz gemeldeter Unterstützung. Die Tests prüfen persistierte Änderungen, ausbleibende UI-Fehler und unbehandelte Promise-Fehler sowie die Benachrichtigungen bei unterstützenden Hosts. Die Varianten des lokalen Testhosts sind über `?notifications=supported`, `?notifications=unsupported` und `?notifications=reject` erreichbar.
