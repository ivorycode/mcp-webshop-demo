# MCP-Server testen

## Deterministische Integrationstests

`npm run test:mcp` startet isolierte Server und Mock-Kataloge und verbindet echte
MCP-SDK-Clients über Streamable HTTP und stdio. Es sind weder ein laufender
Dev-Server noch ein API-Key nötig. In MCP-App-Stufen baut der Befehl vorher die
HTML-Resources. Die Tests laufen auch als Teil von `npm test`.

`test/mcp-smoke.test.mjs` prüft Tool-Registrierung, stufenspezifische Metadaten
und den gemeinsamen Zustand von HTTP-MCP und Web-API. Die lokale Hilfsdatei
`test/mcp-tool-contract.mjs` ergänzt für **beide Transporte** je acht Subtests:

- Suche mit und ohne Konto, echte Mock-Produkte, maximal fünf Treffer und Textantwort.
- Einkauf nur aus `content`: Produkt anhand der Bezeichnung auswählen, Artikelnummer,
  Preis und Verkaufseinheit lesen, zwei Einheiten hinzufügen und Warenkorb prüfen.
- Erfolg mit leerer Trefferliste bei unbekanntem Suchbegriff.
- Unbekannte Konten bei allen sechs Tools samt Hinweisen auf gültige Konten.
- Schemafehler: fehlende Pflichtfelder, leere Strings, falsche Typen und Mengengrenzen.
- Beschreibungen, Konto-Schemas, Standardmenge und Änderungsannotationen.
- Add mit Standardmenge, Mehrfach-Add, Get, erfolgreiches Remove, Checkout und
  `getOrders`: Mengen, Beträge, Kontentrennung, neue Cart-ID und Textantworten.
- Fachliche Fehler bei leerem Checkout, fehlendem Artikel und Überschreiten der
  kumulierten Höchstmenge; fehlgeschlagene Aktionen verändern den Zustand nicht.

Im MCP-Server-Starter prüft `npm run test:mcp` weiterhin das vorbereitete Gerüst.
Erst `npm run test:exercise` aktiviert dort die vollständige Abnahme; vor dem
Ausfüllen ist sie absichtlich rot. In allen nachfolgenden Stufen sind die
MCP-Callbacks bereits gelöst und werden immer vollständig getestet. Die Starter
für MCP Apps und WebMCP behalten ihre eigenen, späteren Übungslücken.

## Modellkontext und MCP Apps

Jedes Tool liefert in `content` eine Kurzmeldung und einen zweiten Textblock mit
JSON-Ergebnisdaten. `structuredContent` enthält dieselben Daten für Clients und
MCP Apps. So bleiben Artikelnummern, Bezeichnungen, Preise, Verkaufseinheiten und
Warenkorbpositionen auch für Hosts verfügbar, die nur `content` ans Modell geben.
Die Suche liefert weiterhin höchstens fünf Artikel.

Der Regressionstest wertet für die Produktauswahl und Folgeaufrufe ausschliesslich
`content` aus. Er verwendet keinen LLM und ersetzt keinen manuellen Abnahmetest in
Claude Desktop. Nach einem Deployment dort in einer neuen Unterhaltung prüfen:
«Verwende das Demo-Konto restaurant-baeren. Suche Zutaten für Omeletten im
Transgourmet Webshop und lege sie in meinen Warenkorb. Schliesse keine Bestellung ab.»

## LLM-Evaluation über einen echten MCP-Client

```bash
# In der lokalen .env genau einen Provider samt API-Key konfigurieren:
# AI_PROVIDER, AI_MODEL und den passenden Key aus .env.example.
npm run test:mcp:llm

# Optional nur den Einkaufsablauf und mehrere Durchläufe auswerten:
MCP_LLM_SCENARIO=cart MCP_LLM_TRIALS=3 npm run test:mcp:llm
```

Der Befehl verwendet den vorhandenen Vercel-AI-SDK-Provider aus
`src/features/chat/server/provider.server.ts`: OpenAI, Anthropic oder Google.
Er lädt die lokale `.env` und führt **echte, kostenpflichtige Modellaufrufe** aus.
Fehlende Provider-Konfiguration ergibt einen Fehler, keinen übersprungenen Test.
Es sind keine zusätzlichen Pakete, kein laufender Dev-Server, kein Deployment und
kein MCP-App-Build nötig.

`test/mcp-llm.eval.mjs` liegt bewusst ausserhalb des `*.test.mjs`-Musters von
`npm test`. Der kleine Client in `test/support/mcp-llm-client.mjs` lädt die Tools
über `tools/list`, reicht Beschreibungen und JSON-Schemas an das Modell weiter
und führt dessen Aufrufe über **stdio-MCP** aus. Das Modell erhält `content`,
`structuredContent` und `isError` als Tool-Ergebnis; HTML-Resources und UI-Metadaten
werden nicht verwendet. «Textbasiert» bedeutet hier MCP ohne App-Oberfläche, nicht
den Verzicht auf strukturierte Tool-Daten. HTTP bleibt durch die deterministischen
MCP-Integrationstests abgedeckt.

Jedes Szenario und jeder Durchlauf startet einen eigenen MCP-Prozess und einen
Mock-Katalog auf einem freien Port. Warenkörbe und Bestellungen liegen nur im
isolierten Testprozess. Der Test erreicht weder den Live-Katalog noch den laufenden
Workshop-Shop.

| Szenario          | Modellauftrag und geprüfte Ergebnisse                                                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cart`            | Milch suchen, zwei Einheiten ins Konto kantine-campus legen, ohne zu bestellen; im Folgeauftrag entfernen. Artikelnummer muss aus einer vorherigen Suche stammen. Menge, Betrag, Remove-Aufruf und ausbleibender Checkout werden geprüft. |
| `checkout`        | Ein über MCP vorbereiteter Warenkorb wird ausdrücklich zur Bestellung freigegeben. Genau ein Checkout, unveränderte Positionen, richtiger Betrag, leerer Warenkorb und echte Bestellnummer in der Modellantwort.                          |
| `missing-account` | Einkauf ohne Kontoangabe. Das Modell soll nach dem Konto fragen; kein gültiges Konto darf erraten oder verändert werden.                                                                                                                  |
| `unknown-account` | Einkauf mit unbekanntem Konto. Rückfrage statt Wechsel auf ein erfundenes gültiges Konto; alle Konten bleiben unverändert.                                                                                                                |

Die Auswertung prüft Tool-Aufrufe und den tatsächlichen Zustand über MCP.
Eine reine Erfolgsbehauptung des Modells genügt nicht. Die Kontorückfrage wird mit
einer einfachen Textprüfung erkannt; sprachliche Qualität wird nicht umfassend
bewertet. Der Test bewertet die Kombination aus Modell, Testclient, Prompt und
MCP-Server, unabhängig von den Chat-Modi des Webshops.

### Grenzen, Wiederholungen und Berichte

- Standard: alle vier Szenarien, ein Durchlauf. `MCP_LLM_SCENARIO` wählt eines aus;
  `MCP_LLM_TRIALS` erlaubt ein bis fünf Durchläufe.
- Pro Nutzernachricht höchstens sechs Modellschritte, zwölf ausgeführte Tool-Aufrufe
  und 2048 Ausgabetokens pro Modellschritt; automatische Provider-Retries sind aus.
- Pro Nutzernachricht gilt ein Zeitlimit von 60 Sekunden. `MCP_LLM_TIMEOUT_MS`
  erlaubt 1000 bis 180000 Millisekunden. Der Einkaufsablauf enthält zwei
  Nutzernachrichten. Das ist kein exaktes Geldbudget: Eingabetokens und Preise
  hängen vom Provider und Modell ab.
- Unter `test-results/mcp-llm-*/` entstehen ein JSON-Bericht pro Szenario/Durchlauf
  und `summary.json` mit Erfolgszahlen. Gespeichert werden Modell-ID, Prompt,
  Tool-Schemas, Modelltexte, Tool-Aufrufe/-Ergebnisse, Tokenverbrauch, Laufzeiten
  und Zustände, auch bei fehlgeschlagenen Prüfungen. Keine API-Keys oder
  Provider-Request-Header. Das Verzeichnis wird von Git ignoriert.
- Jeder fehlgeschlagene Durchlauf lässt den Befehl fehlschlagen. Mehrere Durchläufe
  liefern eine Erfolgsquote; es gibt keinen Retry, der einen Fehler verdeckt.

### Den Testclient ohne Provider prüfen

`test/mcp-llm-client.test.mjs` verwendet das SDK-Testmodell, aber den echten
MCP-Server und Mock-Katalog. Neun deterministische Tests prüfen alle Szenarien,
Tool-Discovery, Weitergabe von Ergebnissen und Gesprächskontext, vorgetäuschten
Erfolg, unerlaubten Checkout sowie Schritt-, Tool- und Zeitlimits. Sie laufen in
`npm test` ohne Schlüssel oder Modellkosten.

Im MCP-Server-Starter bleiben diese neun Prüfungen bis zum Ausfüllen der Callbacks
übersprungen. `npm run test:exercise` aktiviert sie zusammen mit der MCP-Abnahme.
Der ausdrücklich gestartete LLM-Lauf verlangt ebenfalls fertige Callbacks und
prüft diese vor dem ersten Modellaufruf. Die späteren Starter enthalten bereits
die gelösten MCP-Callbacks und führen die deterministischen Clienttests immer aus.

Hintergrund: [AI SDK Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
und [Anthropic: Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents).
