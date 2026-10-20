# Fly.io-Deployment der Abschlussdemo

Alle Befehle im Verzeichnis `30-webmcp/02-webshop-webmcp-solution` ausführen. Fly liest den App-Namen aus der dortigen `fly.toml`; `--app` ist deshalb nicht nötig.

Nur diese Musterlösung enthält Deployment-Artefakte (`Dockerfile`, `fly.toml`, `server.mjs`). Als Region ist Frankfurt (`fra`) vorkonfiguriert.

Die öffentliche Demo verwendet den read-only Live-Katalog. Checkout schreibt ausschliesslich in den lokalen In-Memory-State. Genau eine Machine ist vorgesehen; Warenkörbe, Konten und Bestellungen gehen bei Deploy, Neustart oder Stop verloren.

## Einmalig einrichten

Voraussetzung: [Fly CLI](https://fly.io/docs/flyctl/install/) installiert. Ist der App-Name bereits vergeben, einen eindeutigen Namen wählen und `app` in `fly.toml` sowie die URL von `webshop-remote` in `inspector.json` anpassen. Beim Anlegen denselben Namen verwenden:

```bash
fly auth login
fly apps create mcp-webshop-demo
fly secrets set GOOGLE_GENERATIVE_AI_API_KEY="<key>"
```

Bestehende Anmeldung, App oder Secrets können weiterverwendet werden; die entsprechenden Schritte entfallen. Bei Bedarf die Organisation mit `--org <organisation>` beim Anlegen angeben.

## Deployen

Für das erste Deployment und spätere Updates:

```bash
fly deploy --ha=false
```

`--ha=false` verhindert beim ersten Deploy eine zusätzliche Machine. Ein anschliessendes `fly scale count 1` ist dann überflüssig. Hat eine bestehende App bereits mehrere Machines, einmalig mit `fly scale count 1` reduzieren.

Bei Bedarf prüfen oder im Browser öffnen:

```bash
fly status
fly apps open
fly logs
```

Google ist in `fly.toml` voreingestellt. Für OpenAI oder Anthropic dort `AI_PROVIDER` und `AI_MODEL` ändern und das passende Secret (`OPENAI_API_KEY` bzw. `ANTHROPIC_API_KEY`) setzen. Provider, Modell sowie Chat- und MCP-Limits sind nicht geheim und stehen unter `[env]`. Die Chat-Limits sind immer aktiv. `ENABLE_PUBLIC_MCP_GUARDS=true` aktiviert zusätzlich Body- und Ratenlimits nur für den öffentlichen MCP-Endpunkt; stdio und lokale Übungen bleiben unbeeinflusst.

## Optional: Produktion lokal prüfen

Der Healthcheck `/health` prüft nur den eigenen Node-Prozess. Lokal lässt sich derselbe Produktionsweg prüfen:

```bash
npm ci
npm run build
PORT=3000 NODE_ENV=production CATALOG_MODE=live ENABLE_PUBLIC_MCP_GUARDS=true npm start
```

In einem zweiten Terminal:

```bash
curl --fail http://localhost:3000/health
```

## Smoke-Test nach dem Deploy

Über `https://<app>.fly.dev` prüfen (für die Demo `https://mcp-webshop-demo.fly.dev`):

1. `/health` liefert `{"status":"ok"}`.
2. Die Website lädt; eine Produktsuche liefert Daten und Bilder aus dem Live-Katalog.
3. `/chat` beantwortet eine Anfrage und kann ein Shop-Tool aufrufen.
4. Ein MCP-Client oder der Inspector verbindet sich mit `/mcp`, listet Tools und führt `searchProducts` aus.
5. Die MCP-App-Resources werden im Inspector angezeigt.
6. Im vorbereiteten Browser mit WebMCP-Flag registriert die Website ihre Tools.

## MCP Inspector gegen die Fly-App

Die deployte App hat **einen** öffentlichen Streamable-HTTP-Endpunkt: `https://mcp-webshop-demo.fly.dev/mcp`. Darüber liefert der Server die MCP-Tools und die beiden MCP-App-Resources **Webshop Produktsuche** (`ui://webshop/search-ui.html`) und **Webshop Warenkorb** (`ui://webshop/cart-ui.html`). WebMCP läuft ausschliesslich im Browser und kann nicht mit dem Inspector verbunden werden.

Die mitgelieferte [`inspector.json`](../inspector.json) enthält `webshop-local` für `http://localhost:3052/mcp` und `webshop-remote` für die Fly-App. Beide verwenden `protocolEra: "modern"`, weil der Server die MCP-Revision 2026-07-28 verwendet.

```bash
npm run inspector
```

Im Inspector `webshop-remote` auswählen und verbinden. Falls die App auf null Machines skaliert wurde, zuerst mit `fly deploy --ha=false` wieder deployen.

**Produktsuche:** `searchProducts` mit `{ "term": "Vollmilch", "loginId": "restaurant-baeren" }` aufrufen. Das Resultat muss `ok: true` und Produktkarten enthalten; im MCP-App-Bereich erscheint die Produktsuche.

**Warenkorb:** `addToCart` mit `{ "loginId": "restaurant-baeren", "articleNumber": "022600", "quantity": 2 }`, anschliessend `getCart` mit `{ "loginId": "restaurant-baeren" }`. Das Resultat enthält die Position mit `quantity: 2`; im MCP-App-Bereich erscheint die Warenkorbansicht.

Vollständig deaktivieren und später wieder mit genau einer Machine aktivieren:

```bash
fly scale count 0       # Alle Machines entfernen
fly deploy --ha=false  # Wieder mit einer Machine deployen
```
