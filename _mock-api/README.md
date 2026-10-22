# Mock API

Ein dependency-freier Node-Server (Node >= 22), der die Teile der Transgourmet-Webshop-API
nachbildet, die das Demo `webshop-with-ai` tatsächlich verwendet. Damit läuft das Demo
komplett ohne die echte Transgourmet-API.

## Starten

```bash
cd _mock-api
npm ci
cp .env.example .env # optional
npm start            # http://localhost:4040
npm test             # node --test
```

Env-Variablen: `PORT` (Default 4040), `MOCK_DELAY_MS` (simulierte Latenz, Default 150).
Ohne `.env` erscheint keine Meldung dazu. Ist die Datei vorhanden, werden die Namen
der eingelesenen Variablen ausgegeben. Bereits gesetzte Umgebungsvariablen haben Vorrang.

## Demo auf den Mock umstellen

In der lokalen Konfiguration des Webshops:

```
TRANSGOURMET_API_ORIGIN=http://localhost:4040
```

Dann den Webshop unabhängig starten. Die Bilder und Icons werden im Mock-Modus aus
`data/assets` geladen und vom Mock-Server unter denselben Pfaden wie beim echten CDN
ausgeliefert. Damit gibt es im Browser keine Media-Requests an Transgourmet.

## Welche API-Calls macht das Demo?

Alle Calls laufen serverseitig über `src/lib/transgourmet.server.ts` (Client → eigene
API-Routen → Transgourmet). Es werden genau **zwei** GET-Endpunkte verwendet, ohne
Authentifizierung, Header `accept: application/json`:

| Endpoint                                                      | Aufgerufen von                                                                                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `GET /de/webshop/resources/articles/search?searchTerm=<term>` | `searchArticles()` ← `/api/search`, Chat-Tool `searchArticles`                                                                      |
| `GET /de/webshop/resources/articles/<articleNumber>/detail`   | `getArticleDetail()` ← `/api/article/$articleNumber`, `/api/cart/items` (beim In-den-Warenkorb-Legen), Chat-Tool `getArticleDetail` |

### Request

- Suche: Query-Parameter `searchTerm` (URL-encoded). Der Mock akzeptiert zusätzlich `page`
  (0-basiert) und `pageSize` (Default 100, wie die echte API).
- Detail: Artikelnummer als Pfadsegment (6-stellig, z. B. `228001`).

### Response – verwendete Felder

Die echte API liefert deutlich mehr Felder; das Demo mappt nur diese (`src/lib/types.ts`):

**Suche** (`data.searchTerm`, `data.searchResponse.{articles,totalCount,itemCount,page,pageSize}`),
pro Artikel → `SearchArticle`:
`articleNumber`, `celumId` (Bild-ID), `icons[{id,imgSrc,title}]`, `description`, `brand`,
`unitText`, `price`, `oldPrice`, `sellAmount`, `sellUnit`, `status`

**Detail** (`data.article`) → `ArticleDetail`: zusätzlich
`descriptionLong`, `pricePerSellUnit`, `orderEndTimesText`, `durability`, `foodFact`,
`ingredients`, `nutritionFact{energyKj,energyKcal,fat,…}`, `allergenContains[{id,text}]`,
`allergenMayContains`, `specialDiet`, `hergestellt`

Fehlende Felder werden im Demo defensiv auf `null`/`[]` gemappt; nicht-2xx-Status wirft
`Transgourmet request failed with <status>` (der Mock antwortet bei unbekannter
Artikelnummer mit 404).

## Mock-Daten

`data/articles.json` ist ein Snapshot echter API-Antworten (94 Artikel zu den Suchbegriffen
tomaten, käse, pouletbrust, olivenöl, mehl, pasta, reis, butter, milch, schokolade, lachs,
kaffee, eier und den Zutaten für die folgenden Gerichte – jeweils Such-Treffer **und** Detail):

- Omeletten: Eier, Milch, Butter, Mehl, Salz und Pfeffer
- Spaghetti mit Tomatensauce: Spaghetti, Pelati, Zwiebeln, Knoblauch, Basilikum, Parmesan,
  Olivenöl, Salz und Pfeffer
- Karottencake: Karotten, Eier, Mehl, Zucker, gemahlene Mandeln, Zitrone, Backpulver, Zimt,
  Nelken, Puderzucker und Salz

Das Eier-Sortiment umfasst Bodenhaltungs-, Freiland- und Bio-Eier, Wachteleier sowie gekochte
und flüssige Eiprodukte. Die Suche im Mock ist eine case-/umlaut-insensitive UND-Suche über
Beschreibung, Marke und Artikelnummer.

Weitere Artikel hinzufügen: Objekt in `searchArticles` ergänzen und den Detail-Datensatz unter
`details[<articleNumber>]` ablegen. Anschliessend die dazugehörigen Assets aktualisieren:

```bash
npm run download-assets
```

Der Test prüft, dass für jede `celumId` und jede `imgSrc` im Datensatz eine lokale Datei
vorhanden ist.
