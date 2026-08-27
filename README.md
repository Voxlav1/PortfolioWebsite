# Portfolio-Website — Lichttechnik · Fotografie · Videografie

Eine schlanke, moderne Portfolio-Website ohne Build-Tools, Frameworks oder
Backend. Reines HTML, CSS und JavaScript — läuft auf jedem simplen Webspace.

- **Hell/Dunkel-Umschalter**, Wahl wird gespeichert (localStorage) und die
  Systemeinstellung wird beim ersten Besuch respektiert.
- **Eine Akzentfarbe** (helles Naturgrün), die die ganze Seite über
  CSS-Variablen einfärbt.
- **Neue Projekte ohne Programmieren hinzufügen**: alle Projekte liegen in
  `data/projects.json`. Die Startseite und die Projekt-Detailseite lesen
  diese Datei aus und bauen sich automatisch daraus zusammen.

---

## 1. Lokal testen

Projekte werden per `fetch()` aus `data/projects.json` geladen. Das
funktioniert **nicht**, wenn du `index.html` einfach per Doppelklick im
Browser öffnest (`file://…` blockiert diese Anfragen aus Sicherheitsgründen).
Starte stattdessen einen einfachen lokalen Server im Projektordner:

```bash
python3 -m http.server 8000
```

und öffne anschließend `http://localhost:8000`. Alternativ, falls Node.js
installiert ist:

```bash
npx serve .
```

Beim späteren Hochladen auf einen echten Webspace (siehe Abschnitt 7) ist
das nicht mehr nötig — dort funktioniert `fetch()` ganz normal.

---

## 2. Projektstruktur

```
index.html          Startseite (Hero inkl. Bereiche-Karten & Portrait, Projekt-Grid, Kontakt)
project.html         EIN Template für ALLE Projekt-Detailseiten (?id=…)
impressum.html        Rechtliche Vorlage — unbedingt anpassen, siehe Abschnitt 8
datenschutz.html       Rechtliche Vorlage — unbedingt anpassen, siehe Abschnitt 8
css/style.css          Gesamtes Styling inkl. aller Design-Variablen
js/theme.js             Hell/Dunkel-Umschalter
js/nav.js                Mobiles Ausklapp-Menü
js/site-content.js         Lädt data/site.json (Name, Hero, Bereiche-Karten, Kontakt, Footer, Rechtliches) auf jede Seite
js/main.js                   Baut das Projekt-Grid auf der Startseite + Filter
js/project.js                  Baut die Projekt-Detailseite inkl. Lightbox
data/projects.json              Alle Projekte — die Datei, die du am häufigsten bearbeitest
data/site.json                    Allgemeine Seiteninhalte (Name, Hero, Bereiche-Karten, Portrait, Kontakt, Footer, Rechtliches)
assets/images/                      Bilder (aktuell mit Platzhaltern befüllt)
assets/videos/                        Ordner für eigene, selbst gehostete Videodateien
editor/                                Visueller Editor für Projekte UND Seiteninhalte, siehe Abschnitt 4
```

---

## 3. Neues Projekt hinzufügen

Kein neues HTML nötig — `project.html` ist ein wiederverwendbares Template,
das sich anhand der URL (`project.html?id=dein-projekt`) selbst mit den
passenden Daten aus `projects.json` befüllt.

1. Bild(er) in `assets/images/` ablegen (oder ein eigenes Video in
   `assets/videos/`, bzw. eine YouTube-/Vimeo-Video-ID bereithalten).
2. In `data/projects.json` einen neuen Eintrag in das `projects`-Array
   kopieren und anpassen — zum Beispiel:

   ```json
   {
     "id": "mein-neues-projekt",
     "title": "Mein neues Projekt",
     "category": "fotografie",
     "date": "2026-08",
     "location": "Stadt, DE",
     "client": "Kundenname",
     "tags": ["Tag1", "Tag2"],
     "summary": "Ein Satz, der das Projekt kurz zusammenfasst.",
     "description": [
       "Erster Absatz der ausführlichen Projektbeschreibung.",
       "Optional ein zweiter Absatz."
     ],
     "cover": { "src": "assets/images/mein-bild.jpg", "alt": "Kurze Bildbeschreibung" },
     "media": [
       { "type": "image", "src": "assets/images/mein-bild.jpg", "alt": "Kurze Bildbeschreibung" },
       { "type": "image", "src": "assets/images/mein-bild-2.jpg", "alt": "Kurze Bildbeschreibung" }
     ]
   }
   ```

3. Speichern — fertig. Das Projekt erscheint automatisch im Grid auf der
   Startseite und ist unter `project.html?id=mein-neues-projekt` erreichbar.

### Felder im Überblick

| Feld | Pflicht | Beschreibung |
|---|---|---|
| `id` | ja | Eindeutiger, URL-tauglicher Kurzname (keine Leer-/Sonderzeichen). Wird in `project.html?id=…` verwendet. |
| `title` | ja | Projekttitel. |
| `categories` | ja | Array, mindestens ein Eintrag — z. B. `["fotografie", "videografie"]`. Gültige Werte: `fotografie`, `videografie`, `lichttechnik` (steuern die Filter-Buttons) oder frei erfundene weitere. Ein Projekt darf mehreren Kategorien angehören. |
| `date` | nein | Format `YYYY-MM`, wird als „Monat Jahr“ angezeigt. |
| `location` | nein | Ort, wird mit Pin-Icon angezeigt. |
| `client` | nein | Kunde/Auftraggeber, wird mit Koffer-Icon angezeigt. |
| `tags` | nein | Array von Schlagworten, erscheinen als kleine Chips. |
| `summary` | nein | Kurzer Teaser-Satz, erscheint auf der Detailseite direkt unter dem Titelbild. Fehlt `cover`, erscheint er stattdessen groß an dessen Stelle — siehe unten. |
| `description` | nein | Array von Absätzen (längerer Fließtext). |
| `cover` | nein | Titelbild für Kachel + linksbündiger Bereich oben auf der Detailseite — immer ein Bild (`{ "src": "…", "alt": "…" }`), kein Video. Für Videos: als normalen Eintrag in `media` anlegen — siehe unten. Fehlt `cover`, zeigt die Website an dieser Stelle automatisch `summary`. |
| `media` | nein | Array der Galerie-Einträge auf der Detailseite (siehe unten). Ein Eintrag, dessen `src` exakt dem Titelbild entspricht, wird automatisch nicht doppelt angezeigt. |
| `links` | nein | Array externer Links, z. B. `[{ "label": "Website", "url": "https://…" }]` — erscheinen als kleine Buttons unten auf der Detailseite. |
| `offline` | nein | `true`, um das Projekt von der echten Website zu verstecken (Kachel + Detailseite), ohne es zu löschen. Im Editor bleibt es weiterhin sichtbar und bearbeitbar. Standard: `false`/weggelassen = normal sichtbar. |

Ältere Projekte mit dem früheren, einzelnen Feld `"category": "…"` funktionieren
weiterhin (wird beim Anzeigen automatisch als `categories`-Array mit einem
Eintrag behandelt; der alte Wert `"video"` wird dabei als `"videografie"`
gelesen) — beim nächsten Speichern über den Editor wird automatisch auf
`categories` umgestellt.

### Neue Kategorie hinzufügen

Möchtest du z. B. eine vierte Kategorie „Event“ ergänzen: einen weiteren
Filter-Button in `index.html` (Abschnitt „Arbeiten“) mit
`data-filter="event"` einfügen und bei den betreffenden Projekten
`"event"` in die `categories`-Liste aufnehmen. Die Groß-/Kleinschreibung in
der Anzeige übernimmt automatisch CSS (`text-transform: capitalize`). Falls die neue
Kategorie auch eine eigene kleine Bereiche-Karte im Hero bekommen soll, dort
eine weitere `<a class="about-service-card" ... data-filter-jump="event" data-service="event">`
nach demselben Muster ergänzen (springt zu #arbeiten und filtert dort
automatisch, siehe js/main.js) und einen passenden Eintrag im `services`-Array
in `data/site.json` ergänzen (siehe Abschnitt 6).

### Bilder in der Galerie (`media`, `type: "image"`)

```json
{ "type": "image", "src": "assets/images/mein-bild.jpg", "alt": "Beschreibung" }
```

Bilder in der Galerie sind anklickbar und öffnen eine Lightbox
(Vollbildansicht mit Vor-/Zurück-Navigation, schließbar per Klick, „Esc“
oder Klick daneben).

**Hoch-/Querformat bleibt erhalten** (kein Zuschnitt): Jedes Bild landet in
einem Hochformat-Platz im Raster; ein Querformat-Bild belegt automatisch
zwei nebeneinanderliegende Plätze und nimmt so dessen Form an. Das erkennt
die Website selbst anhand der tatsächlichen Bildmaße — im Editor musst du
dafür nichts einstellen. Über „+ Bild“ im Editor lassen sich außerdem
mehrere Bilder auf einmal auswählen; jedes wird direkt als eigener,
fertiger Galerie-Eintrag angelegt, unabhängig vom Format.

Für ein einzelnes Bild, das exakt im Originalformat über die volle Breite
erscheinen soll (z. B. ein Panorama) statt ins Hoch-/Querformat-Raster
einsortiert zu werden: `"keepFormat": true` setzen (im Editor: Häkchen
„Format behalten“ am jeweiligen Galerie-Eintrag). Entfernt zusätzlich die
abgerundeten Ecken.

```json
{ "type": "image", "src": "assets/images/panorama.jpg", "alt": "Beschreibung", "keepFormat": true }
```

### Videos in der Galerie (`media`, `type: "video"`)

Zwei Varianten werden unterstützt:

**a) Eigene Videodatei** (Datei liegt in `assets/videos/`):

```json
{
  "type": "video",
  "provider": "file",
  "src": "assets/videos/mein-video.mp4",
  "poster": "assets/images/mein-video-poster.jpg",
  "alt": "Beschreibung"
}
```

**b) YouTube oder Vimeo** (kein eigenes Hosting nötig — meist die bessere
Wahl für größere Videos):

```json
{
  "type": "video",
  "provider": "youtube",
  "src": "https://www.youtube-nocookie.com/embed/DEINE-VIDEO-ID",
  "alt": "Beschreibung"
}
```

Für Vimeo entsprechend `"provider": "vimeo"` und
`"src": "https://player.vimeo.com/video/DEINE-VIDEO-ID"`. Die
`-nocookie`-Domain von YouTube setzt Cookies erst nach aktivem Abspielen —
das ist die datenschutzfreundlichere Standardvariante.

**Vorschaubild für eigene Videodateien (`poster`):** Beim Hochladen einer
eigenen Videodatei im Editor wird automatisch im Hintergrund ein
Vorschaubild aus einem frühen Frame des Videos erzeugt und als `poster`
gespeichert — du musst dich um nichts kümmern. Für bereits vorhandene
Video-Einträge ohne `poster` (z. B. wenn der Pfad von Hand eingetragen
wurde) gibt es zusätzlich den Button „Vorschaubild aus Video-Frame
erzeugen“, der das jederzeit nachträglich erledigt. Ein eigenes Vorschaubild
lässt sich wie gehabt auch manuell hochladen/verlinken — das hat immer
Vorrang und wird nicht automatisch überschrieben.

### Titelbild (`cover`)

Das Titelbild ist immer ein Bild — kein Video. Es erscheint als
Kachel-Vorschau auf der Startseite und links oben auf der Detailseite, dort
im Originalformat (ohne Zuschnitt) und begrenzt auf eine angemessene Größe.
Direkt darunter steht `summary`.

```json
"cover": { "src": "assets/images/mein-titelbild.jpg", "alt": "Beschreibung" }
```

**Welches Seitenverhältnis?** Kein festes nötig — das Originalformat bleibt
erhalten. Am besten sieht es mit einem querformatigen Foto aus (grob
zwischen 3:2 und 16:9), weil das Titelbild links neben viel Weißraum steht;
ein sehr hohes Hochformat wird zwar korrekt (nicht verzerrt) angezeigt,
wirkt neben dem Text aber schmal und hoch.

Willst du stattdessen ein Video prominent zeigen: als ersten Eintrag in
`media` anlegen (siehe oben) — es erscheint dann ganz normal, abspielbar,
in der Galerie.

### Projekt offline schalten (`offline`)

Ein Projekt, an dem du noch arbeitest oder das (noch) nicht öffentlich sein
soll, kannst du mit `"offline": true` von der echten Website ausblenden —
es taucht weder in der Projekt-Kachel-Übersicht noch über einen direkten
Link (`project.html?id=…`) auf. Im Editor bleibt es ganz normal in der
Liste stehen (mit einem kleinen „Offline“-Hinweis) und lässt sich dort
weiter bearbeiten. Zum Veröffentlichen einfach das Häkchen bei „Projekt
offline“ im Editor wieder entfernen bzw. `"offline"` aus der JSON-Datei
löschen oder auf `false` setzen.

### Externe Links (`links`)

Optionales Array für Website-, YouTube-, Instagram-Links etc., die als
kleine Buttons unten auf der Detailseite erscheinen und in einem neuen Tab
öffnen:

```json
"links": [
  { "label": "Website", "url": "https://beispiel.de" },
  { "label": "Making-of auf YouTube", "url": "https://youtu.be/…" }
]
```

**Tipp:** Statt `projects.json` von Hand zu bearbeiten, kannst du auch den
visuellen Editor benutzen — siehe Abschnitt 4.

---

## 4. Die ganze Website komfortabel bearbeiten (Editor)

Unter [`editor/index.html`](editor/index.html) liegt ein kleines, rein
lokales Werkzeug für **drei Dinge**: Projekte, die allgemeinen Seiteninhalte
(Name, Hero-Text, Bereiche-Karten, Kontakt, Footer) UND die Pflichtangaben
auf Impressum/Datenschutz — mit Live-Vorschau im echten Design der Website.
Die Seite ist bewusst nicht in der Navigation verlinkt; du erreichst sie nur
direkt über die URL.

```bash
python3 -m http.server 8000
```

dann `http://localhost:8000/editor/` öffnen (derselbe lokale Server wie in
Abschnitt 1 — kein separates Setup nötig). Oben wählst du per Tab zwischen
„Projekte“, „Seiteninhalte“ und „Rechtliches“.

**Einmal verbinden, danach automatisch speichern:**

Oben auf der Seite steht „Mit Projektordner verbinden“ (Chrome/Edge, per
File System Access API). Ein Klick darauf fragt **einmal pro Sitzung**
nach deinem Projektordner — danach schreibt jeder „Projekt speichern“- bzw.
„Seiteninhalte speichern“-Klick sofort in `data/projects.json` bzw.
`data/site.json`, inklusive aller neu hochgeladenen Bilder/Videos in
`assets/images`/`assets/videos`. Kein zusätzlicher Export-Schritt mehr
nötig. Du musst den Button nicht separat klicken — spätestens beim ersten
„speichern“ fragt der Browser automatisch danach.

Falls dein Browser das nicht unterstützt (z. B. Firefox/Safari) oder du
den Dialog abbrichst, bleiben Änderungen nur im Formular dieser Sitzung;
nutze dann ersatzweise die Buttons „… herunterladen“ / „… kopieren“ weiter
unten und ersetze die jeweilige Datei manuell. Neu hochgeladene Bilder/
Videos landen in diesem Fall in einer Liste „Noch abzulegende Dateien“ mit
Download-Link und Zielpfad je Datei.

**Projekte-Tab:** Links werden alle Projekte aus `data/projects.json`
geladen (Klick lädt zum Bearbeiten, ↑↓ zum Sortieren, „+ Neu“ für ein
leeres Formular). Das Titelbild ist immer ein Bild (Datei-Upload oder
Pfad/URL); Galerie-Einträge können zusätzlich Bild ODER Video sein
(Datei-Upload, Pfad/URL oder YouTube/Vimeo-Link — Video-Links werden
automatisch in die richtige Einbettungs-Form umgewandelt); dazu kommen
optional externe Links (Website, YouTube-Kanal etc.).

**Seiteninhalte-Tab:** ein Formular für Name, Hero-Text (inkl. Portrait),
Bereiche-Karten, Kontakt und Footer — also alles, was seitenweit oder auf
der Startseite erscheint. In Textfeldern macht `*Sternchen*` um ein Wort es
grün/kursiv hervorgehoben (wie „*Licht*“ im Hero).

**Rechtliches-Tab:** füllt die eckigen Platzhalter auf
[`impressum.html`](impressum.html) und [`datenschutz.html`](datenschutz.html)
aus — Name, Adresse, Telefon (optional), Umsatzsteuer-ID (optional) und
Hosting-Anbieter. Telefon/USt-ID lässt du einfach leer, um die jeweilige
Zeile/den Absatz auf der Seite ganz auszublenden. Die E-Mail-Adresse kommt
automatisch aus dem Kontakt-Feld im Seiteninhalte-Tab. Speichert ebenfalls
in `data/site.json` (Feld `legal`) — eigener Tab, aber dieselbe Datei und
Verbindung. Die beiden Seiten bleiben unverbindliche Vorlagen für die
restlichen (nicht per Editor einstellbaren) Textabschnitte — einmal ganz
durchlesen und im Zweifel rechtlich prüfen lassen, siehe Abschnitt 8.

> Der Editor lädt beim Öffnen den aktuellen Stand von `data/projects.json`
> und `data/site.json`. Bearbeitest du diese Dateien parallel von Hand,
> können sich Änderungen gegenseitig überschreiben — nutze am besten immer
> nur einen der beiden Wege. Vor dem Überschreiben prüft der Editor zudem,
> ob sich die Datei seit dem Laden verändert hat, und fragt im Zweifel nach.

---

## 5. Farben & Design anpassen

Alle Design-Werte liegen gebündelt am Anfang von `css/style.css` im
Abschnitt **„1. DESIGN-TOKENS“** als CSS-Variablen. Nichts davon ist an
anderer Stelle hart codiert — eine Änderung dort wirkt sich auf die
gesamte Seite aus.

### Akzentfarbe ändern

Die Akzentfarbe ist bewusst **pro Theme** definiert — im `[data-theme="light"]`-
Abschnitt von `css/style.css` als gedämpftes Pastell, im `[data-theme="dark"]`-
Abschnitt als kräftiges Leuchtgrün (Pastelltöne wirken auf dunklem Grund
schnell blass):

```css
[data-theme="light"] {
  --color-accent: #a8e6cf;          /* Pastell-Mintgrün: Buttons, aktive Filter, Icon-Hintergründe */
  --color-accent-strong: #2f9e63;   /* kräftiger, für Text/Icons, die auf Weiß lesbar bleiben müssen */
  --color-accent-contrast: #0b2e1a; /* Textfarbe AUF der Akzentfarbe (z. B. Buttons) */
  --color-accent-soft: #eaf9f1;     /* sehr helles Pastell für Badge-/Icon-Hintergründe */
}

[data-theme="dark"] {
  --color-accent: #4ade80;
  --color-accent-strong: #4ade80;
  --color-accent-contrast: #0b2e1a;
  --color-accent-soft: rgba(74, 222, 128, 0.14);
}
```

Für eine stimmige neue Farbe am einfachsten in **beiden** Blöcken die
Werte durch Farbtöne **derselben Farbfamilie** ersetzen — im hellen Theme
eher blass/pastellig, im dunklen eher kräftig/leuchtend. Kontrastreiche
Tools wie [uicolors.app](https://uicolors.app) oder die Tailwind-Farbpaletten
helfen beim Finden passender Abstufungen.

### Hell-/Dunkel-Theme anpassen

In denselben beiden Abschnitten (`[data-theme="light"]` / `[data-theme="dark"]`)
stehen außerdem Hintergrund-, Text- und Rahmenfarben — ebenfalls als
Variablen, unabhängig von der Akzentfarbe.

### Eigene Schriftarten

Standardmäßig werden reine System-Schriftarten verwendet (schnell, ohne
externe Anfragen, ohne Datenschutz-Fragen durch Web-Font-Anbieter). Für
eigene Web-Fonts (z. B. Google Fonts):

1. `<link>`-Tags im `<head>` der HTML-Dateien ergänzen.
2. In `css/style.css` die Variablen `--font-display` und `--font-body`
   anpassen.

**Datenschutz-Hinweis:** Bindest du Google Fonts über deren CDN
(`fonts.googleapis.com`) ein, wird beim Seitenaufruf die IP-Adresse der
Besucher:innen an Google übertragen — das gilt datenschutzrechtlich als
kritisch (u. a. LG München I, Urteil vom 20.01.2022). Lade die
Schriftdateien stattdessen herunter und binde sie selbst gehostet per
`@font-face` ein, dann entfällt das Problem.

### Abstände, Radien, Schriftgrößen

Ebenfalls im Abschnitt „Design-Tokens“: `--space-*` (Abstände),
`--radius-*` (Eckenrundung), `--text-*` (Schriftgrößen),
`--container-width` (maximale Inhaltsbreite) und `--transition`
(Geschwindigkeit der Hover-/Theme-Übergänge).

---

## 6. Eigene Inhalte eintragen

Name, Hero-Text, Portrait, Bereiche-Karten, Kontakt, Footer-Zeile und die
Pflichtangaben für Impressum/Datenschutz liegen zentral in
[`data/site.json`](data/site.json) und werden auf jeder Seite per
`js/site-content.js` eingesetzt — am einfachsten über den Editor bearbeiten
(Abschnitt 4, Tabs „Seiteninhalte“ und „Rechtliches“), alternativ direkt in
der JSON-Datei. Das betrifft:

- **Name**: erscheint im Header/Footer auf jeder Seite.
- **Hero-Text**: Überschrift (mit `*Sternchen*`-Hervorhebung, am besten
  kurz — steht einzeilig neben dem Portrait) und Lauftext.
- **Portrait**: Foto rechts neben dem Hero-Text (Editor, Tab
  „Seiteninhalte“ → „Hero“).
- **Bereiche-Karten**: eigener Abschnitt direkt unter dem Hero
  (Lichttechnik/Fotografie/Videografie) — Titel und Icon sind fix im HTML,
  Text und Werkzeug-Tags pro Karte kommen aus `site.json` (`services`-Array,
  Feld `text` + `tools`) und lassen sich im Editor bearbeiten (Tab
  „Seiteninhalte“ → „Bereiche-Karten“). Weitere Werkzeuge einfach mit Komma
  getrennt dazuschreiben.
- **Kontakt**: Überschrift, Text, E-Mail-Adresse, Social-Links.
- **Footer**: Copyright-Zeile.
- **Rechtliches** (Feld `legal`): Name, Adresse, Telefon, Umsatzsteuer-ID
  und Hosting-Anbieter für Impressum/Datenschutz — siehe Abschnitt 4, Tab
  „Rechtliches“, sowie Abschnitt 8.

Nicht in `site.json`, sondern weiterhin direkt im HTML (mit
`<!-- BEARBEITEN: … -->`-Kommentaren markiert):

- **Titel & Meta-Beschreibung** pro Seite: `<head>` von `index.html` etc.
- **Bereiche-Karten-Struktur** (Titel, Icon, Reihenfolge): `index.html`,
  Abschnitt „BEREICHE-KARTEN“ — hängt mit der Filterlogik zusammen, siehe
  Abschnitt 3 „Neue Kategorie hinzufügen“.
- **Rechtliche Textabschnitte** (Haftung, Urheberrecht, Datenschutz-Details
  usw.): direkt in `impressum.html`/`datenschutz.html` — nur die
  Pflichtangaben (siehe oben) kommen aus dem Editor.
- **Favicon**: aktuell ein einfacher grüner Kreis als Inline-SVG im
  `<head>` jeder Seite (`<link rel="icon" ...>`) — bei Bedarf durch eine
  eigene Bild-/SVG-Datei ersetzen.

Der Header/Footer ist auf allen Seiten identisch aufgebaut, aber (bewusst,
ohne Build-Tool) auf jeder Seite einzeln im HTML vorhanden. Struktur-
Änderungen an Navigation oder Footer (nicht die Texte — die kommen ja aus
`site.json`) müssen entsprechend in `index.html`, `project.html`,
`impressum.html`, `datenschutz.html` und `editor/index.html` gleichermaßen
vorgenommen werden.

---

## 7. Veröffentlichen

Die Seite besteht nur aus statischen Dateien und lässt sich auf jedem
Webspace sowie bei Anbietern wie Netlify, Vercel, GitHub Pages oder Cloudflare
Pages hosten — meist reicht es, den kompletten Projektordner hochzuladen.

---

## 8. Rechtliches (optional, für später)

`impressum.html` und `datenschutz.html` sind **Vorlagen** — bewusst nur im
Footer verlinkt, nicht in der Hauptnavigation. Die Pflichtangaben (Name,
Adresse, Telefon, Umsatzsteuer-ID, Hosting-Anbieter) trägst du am
einfachsten über den Editor ein (Abschnitt 4, Tab „Rechtliches“) — ohne
Eintrag steht dort weiterhin ein eckiger Platzhalter (`[…]`) als
Erinnerung. Für eine rein private Portfolio-/Studienseite ohne kommerzielle
Absicht sind die beiden Seiten in der Regel nicht zwingend nötig; die
Impressumspflicht in Deutschland greift vor allem bei geschäftsmäßig
betriebenen Websites. Du kannst die beiden Dateien und die zwei
Footer-Links jederzeit einfach löschen, wenn du sie nicht brauchst.

Die restlichen Textabschnitte (Haftung, Urheberrecht, Datenschutz-Details
usw.) sind feste Vorlagentexte direkt im HTML, nicht über den Editor
einstellbar. Falls du die Seite später doch für bezahlte Aufträge nutzt,
lies dir beide Seiten einmal ganz durch und lass sie im Zweifel kurz
prüfen (z. B. über einen Generator wie e-recht24.de) — mehr als ein
unverbindlicher Startpunkt sind sie ohnehin nicht.

---

## 9. Barrierefreiheit & Technik

- Semantisches HTML5, Tastaturbedienbarkeit (u. a. „Zum Inhalt springen“-
  Link, sichtbarer Fokus-Rahmen, Lightbox per Tastatur bedienbar).
- `prefers-reduced-motion` wird respektiert (Animationen werden reduziert).
- Kein Build-Schritt, keine Abhängigkeiten/Frameworks — einfach Dateien
  bearbeiten und neu laden.
