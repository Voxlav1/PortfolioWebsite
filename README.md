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
index.html          Startseite (Hero, Bereiche, Projekt-Grid, Über mich, Kontakt)
project.html         EIN Template für ALLE Projekt-Detailseiten (?id=…)
impressum.html        Rechtliche Vorlage — unbedingt anpassen, siehe Abschnitt 8
datenschutz.html       Rechtliche Vorlage — unbedingt anpassen, siehe Abschnitt 8
css/style.css          Gesamtes Styling inkl. aller Design-Variablen
js/theme.js             Hell/Dunkel-Umschalter
js/nav.js                Mobiles Ausklapp-Menü
js/site-content.js         Lädt data/site.json (Name, Hero, Über mich, Kontakt, Footer) auf jede Seite
js/main.js                   Baut das Projekt-Grid auf der Startseite + Filter
js/project.js                  Baut die Projekt-Detailseite inkl. Lightbox
data/projects.json              Alle Projekte — die Datei, die du am häufigsten bearbeitest
data/site.json                    Allgemeine Seiteninhalte (Name, Hero, Über mich, Kontakt, Footer)
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
| `category` | ja | Muss exakt `fotografie`, `video` oder `lichttechnik` sein (steuert die Filter-Buttons). |
| `date` | nein | Format `YYYY-MM`, wird als „Monat Jahr“ angezeigt. |
| `location` | nein | Ort, wird mit Pin-Icon angezeigt. |
| `client` | nein | Kunde/Auftraggeber, wird mit Koffer-Icon angezeigt. |
| `tags` | nein | Array von Schlagworten, erscheinen als kleine Chips. |
| `summary` | nein | Kurzer Teaser-Satz auf der Detailseite. |
| `description` | nein | Array von Absätzen (längerer Fließtext). |
| `cover` | ja | Titelbild/-video für Kachel + großen Bereich oben auf der Detailseite. Gleicher Aufbau wie ein `media`-Eintrag (siehe unten) — kann also auch `"type": "video"` sein. |
| `media` | nein | Array der Galerie-Einträge auf der Detailseite (siehe unten). |
| `links` | nein | Array externer Links, z. B. `[{ "label": "Website", "url": "https://…" }]` — erscheinen als kleine Buttons unten auf der Detailseite. |

### Neue Kategorie hinzufügen

Möchtest du z. B. eine vierte Kategorie „Event“ ergänzen: einen weiteren
Filter-Button in `index.html` (Abschnitt „Arbeiten“) mit
`data-filter="event"` einfügen und bei den betreffenden Projekten
`"category": "event"` setzen. Die Groß-/Kleinschreibung in der Anzeige
übernimmt automatisch CSS (`text-transform: capitalize`). Falls die neue
Kategorie auch eine eigene Karte im „Bereiche“-Abschnitt bekommen soll,
dort eine weitere `<a class="service-card" ... data-filter-jump="event">`
nach demselben Muster ergänzen (springt zu #arbeiten und filtert dort
automatisch, siehe js/main.js).

### Bilder in der Galerie (`media`, `type: "image"`)

```json
{ "type": "image", "src": "assets/images/mein-bild.jpg", "alt": "Beschreibung" }
```

Bilder in der Galerie sind anklickbar und öffnen eine Lightbox
(Vollbildansicht mit Vor-/Zurück-Navigation, schließbar per Klick, „Esc“
oder Klick daneben).

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

### Titelbild als Video

`cover` hat genau denselben Aufbau wie ein `media`-Eintrag — statt eines
Bildes kann das Titelbild also auch eines der beiden Video-Formate von
oben sein. Auf der Kachel (Startseite) wird dabei automatisch ein
Vorschaubild angezeigt (bei YouTube automatisch von YouTube übernommen,
sonst über `poster`, sonst ein Platzhalter) plus ein kleines Abspiel-Symbol;
auf der Detailseite erscheint groß oben das echte, abspielbare Video.

```json
"cover": {
  "type": "video",
  "provider": "youtube",
  "src": "https://www.youtube-nocookie.com/embed/DEINE-VIDEO-ID",
  "alt": "Beschreibung"
}
```

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
lokales Werkzeug für **beides**: Projekte UND die allgemeinen Seiteninhalte
(Name, Hero-Text, Über mich, Kontakt, Footer) — mit Live-Vorschau im echten
Design der Website. Die Seite ist bewusst nicht in der Navigation verlinkt;
du erreichst sie nur direkt über die URL.

```bash
python3 -m http.server 8000
```

dann `http://localhost:8000/editor/` öffnen (derselbe lokale Server wie in
Abschnitt 1 — kein separates Setup nötig). Oben wählst du per Tab zwischen
„Projekte“ und „Seiteninhalte“.

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
leeres Formular). Titelbild und Galerie-Einträge können Bild ODER Video
sein (Datei-Upload, Pfad/URL oder YouTube/Vimeo-Link — Video-Links werden
automatisch in die richtige Einbettungs-Form umgewandelt); dazu kommen
optional externe Links (Website, YouTube-Kanal etc.).

**Seiteninhalte-Tab:** ein Formular für Name, Hero-Text, „Über mich“,
Kontakt und Footer — also alles, was seitenweit oder auf der Startseite
außerhalb der Projekte erscheint. In Textfeldern macht `*Sternchen*` um
ein Wort es grün/kursiv hervorgehoben (wie „*Licht*“ im Hero).

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

Name, Hero-Text, „Über mich“, Kontakt und Footer-Zeile liegen zentral in
[`data/site.json`](data/site.json) und werden auf jeder Seite per
`js/site-content.js` eingesetzt — am einfachsten über den Editor bearbeiten
(Abschnitt 4, Tab „Seiteninhalte“), alternativ direkt in der JSON-Datei.
Das betrifft:

- **Name**: erscheint im Header/Footer auf jeder Seite.
- **Hero-Text**: Eyebrow-Zeile, Überschrift (mit `*Sternchen*`-Hervorhebung),
  Lauftext.
- **„Über mich“**: Überschrift, Text (Leerzeile = neuer Absatz), Tags
  (Ausrüstung/Software), Portraitfoto.
- **Kontakt**: Überschrift, Text, E-Mail-Adresse, Social-Links.
- **Footer**: Copyright-Zeile.

Nicht in `site.json`, sondern weiterhin direkt im HTML (mit
`<!-- BEARBEITEN: … -->`-Kommentaren markiert):

- **Titel & Meta-Beschreibung** pro Seite: `<head>` von `index.html` etc.
- **„Bereiche“-Abschnitt** (Lichttechnik/Fotografie/Videografie-Karten):
  `index.html`, Abschnitt „Leistungen“ — hängt mit der Filterlogik
  zusammen, siehe Abschnitt 3 „Neue Kategorie hinzufügen“.
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

`impressum.html` und `datenschutz.html` sind unausgefüllte **Vorlagen**
mit Platzhaltern in eckigen Klammern (`[…]`) — bewusst nur im Footer
verlinkt, nicht in der Hauptnavigation. Für eine rein private Portfolio-
/Studienseite ohne kommerzielle Absicht sind sie in der Regel nicht
zwingend nötig; die Impressumspflicht in Deutschland greift vor allem bei
geschäftsmäßig betriebenen Websites. Du kannst die beiden Dateien und die
zwei Footer-Links jederzeit einfach löschen, wenn du sie nicht brauchst.
Falls du die Seite später doch für bezahlte Aufträge nutzt, trage echte
Angaben ein und lass die Texte im Zweifel kurz prüfen (z. B. über einen
Generator wie e-recht24.de) — mehr als ein unverbindlicher Startpunkt
sind sie ohnehin nicht.

---

## 9. Barrierefreiheit & Technik

- Semantisches HTML5, Tastaturbedienbarkeit (u. a. „Zum Inhalt springen“-
  Link, sichtbarer Fokus-Rahmen, Lightbox per Tastatur bedienbar).
- `prefers-reduced-motion` wird respektiert (Animationen werden reduziert).
- Kein Build-Schritt, keine Abhängigkeiten/Frameworks — einfach Dateien
  bearbeiten und neu laden.
