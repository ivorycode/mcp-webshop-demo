# WebMCP-Abschlussdemo (Musterlösung)

Die kumulative Abschlusslösung des Workshops: klassischer Webshop, Web-API, AI-Chat, MCP-Server, MCP Apps und WebMCP in einem Node-Prozess unter derselben Origin. Sie enthält die Lösungen aller vorherigen Übungen der Hauptkette.

```bash
npm ci
cp .env.example .env        # AI_PROVIDER und API-Key eintragen
npm run dev                 # http://localhost:3052, benötigt den Mock-Katalog aus 01-mock-api
npm test                    # Build + Node-Tests
npm run typecheck
npm run check               # Prettier + ESLint
```

Der Aufbau der Anwendung und die Aufrufwege der drei KI-Zugänge sind in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) beschrieben. Deployment auf Fly.io steht in [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md), die Browser- und MCP-Tests in [docs/TESTING.md](./docs/TESTING.md).

## Was diese Stufe ergänzt: WebMCP

Die Seite registriert `searchProducts`, `getCart`, `addToCart`, `removeFromCart` und `checkout` imperativ über `document.modelContext.registerTool()` für das im Browser ausgewählte Demo-Konto. Die Tools rufen die Web-API mit der Browser-Session auf und senden danach Shop-Events, damit Suche, Warenkorb und Bestellungen ohne Reload nachziehen. Das sichtbare Suchformular bleibt normale Benutzeroberfläche und wird nicht als zusätzliches Tool registriert; der deklarative Ansatz ist in `01-hello-webmcp` demonstriert.

Relevante Dateien: [`src/features/webmcp/webmcp-tools.ts`](./src/features/webmcp/webmcp-tools.ts) (Tool-Definitionen), [`WebMCPProvider.tsx`](./src/features/webmcp/WebMCPProvider.tsx) (Registrierung und Abmeldung per `AbortController`), [`ToolConsole.tsx`](./src/features/webmcp/ToolConsole.tsx) (Dev-Panel unten rechts).

Aufgabenstellung: [Starter](../02-webshop-webmcp/EXERCISE.md). Alle Übungsschritte sind implementiert.

### Manueller Smoke im Browser

1. In Chrome `chrome://flags/#enable-webmcp-testing` aktivieren und Chrome neu starten.
2. App öffnen, eines der drei Demo-Konten auswählen und die WebMCP Tool-Konsole unten rechts öffnen.
3. Registrierung mit `await document.modelContext.getTools()` prüfen.
4. `searchProducts`, `addToCart`, `getCart` und `checkout` ausführen; Suche, Warenkorb und Bestellverlauf müssen sofort nachziehen.
5. Alternativ die Extension «WebMCP - Model Context Tool Inspector» öffnen und dieselben Tools im Side Panel ausführen.

Es wird weder ein Origin-Trial-Token noch ein produktiver WebMCP-Fallback eingebaut; diese Stufe setzt einen Browser mit aktivierter experimenteller API voraus.

### WebMCP-Tools über die DevTools-Konsole aufrufen

Chrome liefert `inputSchema` über `getTools()` als JSON-String. Auch die Argumente für `executeTool()` müssen in der aktuell verwendeten Chrome-Version als JSON-String übergeben werden:

```js
const callWebMcpTool = async (name, args) => {
  const tool = (await document.modelContext.getTools()).find(
    (candidate) => candidate.name === name,
  )
  if (!tool) throw new Error(`WebMCP-Tool nicht gefunden: ${name}`)
  const raw = await document.modelContext.executeTool(
    tool,
    JSON.stringify(args),
  )
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

await callWebMcpTool('searchProducts', { term: 'Milch' })
await callWebMcpTool('addToCart', { articleNumber: '022600', quantity: 2 })
await callWebMcpTool('getCart', {})
```

Für die Warenkorb-Tools zuerst im Webshop eines der Demo-Konten auswählen.

## Native WebMCP-E2E-Tests

```bash
# Falls Google Chrome noch nicht installiert ist:
npx playwright install chrome
npm run test:webmcp:native
# Optional mit sichtbarem Browser:
npm run test:webmcp:native -- --headed
```

Diese separate Suite verwendet echtes Chrome mit `WebMCPTesting` und ruft
`document.modelContext.executeTool()` auf. Vier Tests prüfen Registrierung,
Suche, Anmeldefehler, Kontowechsel, Warenkorb, Checkout, ungültige Eingaben sowie
die eingebaute Tool-Konsole nach einem Reload. Resultate und sichtbare
Shop-Änderungen werden gemeinsam geprüft, ohne `modelContext` oder `fetch` zu ersetzen.

Die Suite startet Shop und Katalog-Mock selbst auf `43556`/`43557`. Sie benötigt
keinen Modell-Key und keine Extension. Die bisherigen Tests bleiben separat.
In dieser Musterlösung sollen alle vier Tests erfolgreich sein.
Voraussetzungen, Testablauf und Grenzen: [docs/WEBMCP-TESTING.md](docs/WEBMCP-TESTING.md).

## Zwei Chat-Modi

- **Assistant** als schwebender Chat im Webshop: Text-Chat als Fernsteuerung der Shop-Oberfläche. Tool-Aufrufe aktualisieren Suche, Warenkorb und Bestellungen im Shop; im Chat erscheinen keine Widgets. Checkout wird mit einer Eingabe von **Ja** oder **Nein** freigegeben.
- **Workspace** auf der Route `/chat`: Tool-Resultate erscheinen als Widgets direkt im Chat. Die Buttons «In den Warenkorb» und «Bestellung abschliessen» rufen die Web-API direkt auf, ohne Umweg über das Modell. Checkout verwendet den Bestätigungsdialog.

Beide Modi verwenden dieselbe Chat-Route, dieselben Tools und die Browser-Session. Der Client sendet `mode` mit; der Server wählt nur die Modellanweisungen.

Der Chat-Guard übergibt standardmässig höchstens die letzten 15 Nachrichten an das Modell (`CHAT_MAX_MESSAGES`). Führende Nachrichten vor der ersten Nutzernachricht im Ausschnitt werden zusätzlich entfernt; ohne Nutzernachricht wird die Anfrage mit HTTP 400 abgewiesen. Der sichtbare Chat-Verlauf bleibt erhalten.

## MCP und MCP Apps

Der Endpunkt `/mcp` bietet dieselben fünf Tools plus `getOrders` für externe Agenten an. Ohne Browser-Session nennt der Agent das Demo-Konto ausdrücklich als `loginId`. Jedes Tool verweist auf eine der beiden HTML-Resources `ui://webshop/search-ui.html` und `ui://webshop/cart-ui.html`, die ein geeigneter Host als MCP App rendert.

```bash
npm run inspector      # MCP Inspector mit den Zielen aus inspector.json
npm run start:stdio    # derselbe Server über stdio, eigener Prozess und Zustand
```

Die MCP Apps prüfen vor Kontextmeldungen und Chat-Nachrichten die Host-Capabilities. Im MCP Inspector fehlen `updateModelContext` und `message`; Hinzufügen, Entfernen und Checkout funktionieren dort ohne diese optionalen Benachrichtigungen. Fehler einer Benachrichtigung werden nur in der Konsole protokolliert und ändern den erfolgreichen Shop-Vorgang nicht.

Gültige Demo-Konten sind `restaurant-baeren`, `hotel-alpenblick` und `kantine-campus`. Warenkörbe und Bestellungen liegen nur im Speicher des Serverprozesses.

### MCP Apps manuell im lokalen Host öffnen

Jeweils in einem eigenen Terminal starten; Umgebungsvariablen oder ein LLM-Key
sind dafür bei unveränderten Defaults nicht erforderlich:

```bash
# Im Verzeichnis 01-mock-api:
npm start                   # Mock-Katalog auf Port 4040

# Im Verzeichnis dieser Musterlösung:
npm run dev                 # Webshop und MCP auf Port 3052

# Ebenfalls in dieser Musterlösung, in einem weiteren Terminal:
npm run dev:mcp-host
```

Danach [http://127.0.0.1:43552](http://127.0.0.1:43552) öffnen, App auswählen
und «App laden» klicken. Der Befehl startet den Host auf Port 43552 und seine
Sandbox auf Port 43553; er verbindet sich standardmässig mit `http://localhost:3052/mcp`.
Der Host verwendet damit dieselben Warenkörbe wie dein Dev-Webshop. Browser-DevTools
können zur Inspektion der Frames und Nachrichten verwendet werden.

Nach Änderungen an den MCP Apps `npm run build:apps` ausführen und die App im
Host neu laden. Ein anderes MCP-Ziel lässt sich ohne Umgebungsvariable angeben:

```bash
npm run dev:mcp-host -- --mcp-origin http://127.0.0.1:43554
```

Playwright setzt dieses Ziel automatisch für seinen isolierten Test-Webshop.
Die Testports 43554 (Webshop) und 43555 (Mock-Katalog) sind für den manuellen
Dev-Start nicht nötig. Manuellen Host vor einem E2E-Lauf beenden, da Host und
Sandbox dieselben Ports verwenden.

Nur den MCP-Server prüfen: `npm run test:mcp`. Mit einem echten LLM: `npm run test:mcp:llm`
(Provider und API-Key erforderlich). Szenarien, Limits und Berichte stehen in
[docs/MCP-TESTING.md](docs/MCP-TESTING.md).
