/**
 * editor.js
 * Lokales Werkzeug zum Bearbeiten der ganzen Website: Projekte (Text,
 * Bilder, Videos) UND allgemeine Seiteninhalte (Name, Hero, Über mich,
 * Kontakt, Footer). Läuft komplett im Browser, ohne Server/Backend.
 *
 * Speichern:
 *   - Einmal pro Sitzung "Mit Projektordner verbinden" (Chrome/Edge, File
 *     System Access API) — danach schreibt jeder "speichern"-Klick sofort
 *     in data/projects.json bzw. data/site.json sowie neu hochgeladene
 *     Bilder/Videos in assets/images bzw. assets/videos.
 *   - Ohne Verbindung (z. B. Firefox/Safari) bleiben Änderungen nur im
 *     Formular; "herunterladen"/"kopieren" dienen dann als Ersatz.
 *
 * Diese Seite ist bewusst nicht Teil der öffentlichen Navigation.
 */
(function () {
  "use strict";

  var CATEGORY_LABELS = { fotografie: "Fotografie", videografie: "Videografie", lichttechnik: "Lichttechnik" };
  var KNOWN_CATEGORIES = Object.keys(CATEGORY_LABELS);
  var MONTHS = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ];
  var ICONS = {
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-7.2-7-12a7 7 0 1 1 14 0c0 4.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>',
  };
  var SITE_HINWEIS =
    "Allgemeine Seiteninhalte (Name, Hero-Text, Über mich, Kontakt, Footer). Wird auf jeder Seite geladen. " +
    "Am einfachsten über editor/index.html (Tab 'Seiteninhalte') bearbeiten — dort auch mit Vorschau. " +
    "In Texten macht *Sternchen* ein Wort grün/kursiv hervorgehoben, z. B. *Licht*.";
  var PROJECTS_HINWEIS =
    "Das ist die zentrale Datenquelle der Seite. Neues Projekt = neues Objekt im 'projects'-Array kopieren, " +
    "Werte anpassen, speichern. Kein Programmieren nötig. Details siehe README.md.";

  // ---- Status: Projekte -------------------------------------------------------
  var projects = [];             // vollständige, JSON-taugliche Projektliste (Quelle der Wahrheit)
  var currentIndex = null;       // Index des im Formular geladenen Projekts, oder null = neu
  var mediaList = [];            // Arbeitskopie der Galerie-Einträge des aktuell bearbeiteten Projekts
  var linksList = [];            // Arbeitskopie der externen Links des aktuell bearbeiteten Projekts
  var coverItem = freshCover();  // Arbeitskopie des Titelbilds/-videos
  var idTouched = false;         // true, sobald die ID manuell bearbeitet wurde (stoppt Auto-Slug)

  // ---- Status: Seiteninhalte ---------------------------------------------------
  var site = {};
  var socialList = [];

  // ---- Status: Speichern --------------------------------------------------------
  var pendingFiles = new Map();      // Zielpfad -> File, für Direkt-Speichern / Download-Checkliste
  var rootDirHandle = null;          // FileSystemDirectoryHandle (nur während dieser Sitzung gemerkt)
  var loadedProjectsSnapshot = null; // zuletzt geladener/gespeicherter Inhalt von projects.json
  var loadedSiteSnapshot = null;     // zuletzt geladener/gespeicherter Inhalt von site.json

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function freshCover() {
    return { type: "image", src: "", alt: "" };
  }

  // ---- Kleine Helfer ---------------------------------------------------------
  function slugify(str) {
    return (str || "")
      .toString()
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Ein Projekt kann mehreren Kategorien angehören ("categories": [...]).
  // Ältere Einträge kennen noch das einzelne "category"-Feld (inkl. dem
  // inzwischen umbenannten Wert "video") — wird hier automatisch übersetzt.
  function normalizeCategories(project) {
    if (Array.isArray(project.categories) && project.categories.length) return project.categories;
    if (project.category) return [project.category === "video" ? "videografie" : project.category];
    return [];
  }

  function categoryLabel(category) {
    return CATEGORY_LABELS[category] || category;
  }

  function categoryLabels(categories) {
    return categories.map(categoryLabel).join(" · ");
  }

  function sanitizeFilename(name) {
    var idx = name.lastIndexOf(".");
    var base = idx > 0 ? name.slice(0, idx) : name;
    var ext = idx > 0 ? name.slice(idx + 1).toLowerCase() : "";
    var cleanBase = slugify(base) || "datei";
    return ext ? cleanBase + "." + ext : cleanBase;
  }

  function formatDate(value) {
    if (!value) return "";
    var parts = value.split("-");
    var monthName = MONTHS[parseInt(parts[1], 10) - 1];
    return monthName ? monthName + " " + parts[0] : value;
  }

  function toYouTubeEmbed(input) {
    input = (input || "").trim();
    var m = input.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
    var id = m ? m[1] : (/^[\w-]{6,}$/.test(input) ? input : null);
    return id ? "https://www.youtube-nocookie.com/embed/" + id : input;
  }

  function toVimeoEmbed(input) {
    input = (input || "").trim();
    var m = input.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    var id = m ? m[1] : (/^\d+$/.test(input) ? input : null);
    return id ? "https://player.vimeo.com/video/" + id : input;
  }

  // Pfade in projects.json/site.json sind relativ zur Website-Wurzel gedacht
  // (z. B. "assets/images/foto.jpg"). Der Editor liegt eine Ebene tiefer —
  // für die Vorschau hier braucht ein solcher Pfad ein vorangestelltes "../".
  function toSiteRelativePath(path) {
    path = (path || "").trim();
    if (!path) return "";
    if (/^([a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(path)) return path;
    return "../" + path;
  }

  // ---- Kleine DOM-Bausteine für Formulare ---------------------------------
  function iconButton(symbol, label, onClick, disabled) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn";
    btn.textContent = symbol;
    btn.setAttribute("aria-label", label);
    btn.title = label;
    if (disabled) btn.disabled = true;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function textField(labelText, value, onInput) {
    var field = document.createElement("div");
    field.className = "field";
    var label = document.createElement("label");
    label.textContent = labelText;
    var input = document.createElement("input");
    input.type = "text";
    input.value = value || "";
    input.addEventListener("input", function () { onInput(input.value); });
    field.appendChild(label);
    field.appendChild(input);
    return field;
  }

  function selectField(labelText, options, value, onChange) {
    var field = document.createElement("div");
    field.className = "field";
    var label = document.createElement("label");
    label.textContent = labelText;
    var select = document.createElement("select");
    options.forEach(function (opt) {
      var optionEl = document.createElement("option");
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      if (opt.value === value) optionEl.selected = true;
      select.appendChild(optionEl);
    });
    select.addEventListener("change", function () { onChange(select.value); });
    field.appendChild(label);
    field.appendChild(select);
    return field;
  }

  function imagePreviewEl(src) {
    var wrap = document.createElement("div");
    wrap.className = "cover-preview";
    var img = document.createElement("img");
    img.src = src;
    img.alt = "";
    wrap.appendChild(img);
    return wrap;
  }

  function fileAndPathField(opts) {
    var isVideo = opts.accept.indexOf("video") === 0;
    var folder = isVideo ? "assets/videos/" : "assets/images/";

    var wrap = document.createElement("div");
    wrap.className = "field-row";

    var fileField = document.createElement("div");
    fileField.className = "field";
    var fileLabel = document.createElement("label");
    fileLabel.textContent = opts.fileLabel;
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = opts.accept;
    fileField.appendChild(fileLabel);
    fileField.appendChild(fileInput);

    var pathField = document.createElement("div");
    pathField.className = "field";
    var pathLabel = document.createElement("label");
    pathLabel.textContent = opts.pathLabel;
    var pathInput = document.createElement("input");
    pathInput.type = "text";
    pathInput.value = opts.pathValue || "";
    pathInput.placeholder = folder + "…";
    pathField.appendChild(pathLabel);
    pathField.appendChild(pathInput);

    fileInput.addEventListener("change", function () {
      var file = fileInput.files[0];
      if (!file) return;
      var path = folder + sanitizeFilename(file.name);
      pendingFiles.set(path, file);
      pathInput.value = path;
      opts.onFile(file, path);
    });
    pathInput.addEventListener("input", function () { opts.onPath(pathInput.value); });

    wrap.appendChild(fileField);
    wrap.appendChild(pathField);
    return wrap;
  }

  // Ein Label+URL-Zeilen-Editor, wiederverwendet für Projekt-"links" UND die
  // Social-Links der Seiteninhalte.
  function buildLinkRow(list, index, rerender) {
    var item = list[index];
    var row = document.createElement("div");
    row.className = "link-row";
    row.appendChild(textField("Label", item.label, function (val) { item.label = val; }));
    row.appendChild(textField("URL", item.url, function (val) { item.url = val; }));
    row.appendChild(iconButton("✕", "Entfernen", function () { list.splice(index, 1); rerender(); }));
    return row;
  }

  function renderLinkRows(list, container, rerender) {
    container.innerHTML = "";
    list.forEach(function (item, index) {
      container.appendChild(buildLinkRow(list, index, rerender));
    });
  }

  // ---- Vorschau-Hilfsfunktionen (Datei-Uploads vor dem Speichern anzeigen) ------
  function resolveItemPreviewSrc(item) {
    if (item._file) {
      if (!item._fileUrl) item._fileUrl = URL.createObjectURL(item._file);
      return item._fileUrl;
    }
    return toSiteRelativePath(item.src);
  }

  function resolveItemPosterPreviewSrc(item) {
    if (item._posterFile) {
      if (!item._posterUrl) item._posterUrl = URL.createObjectURL(item._posterFile);
      return item._posterUrl;
    }
    return toSiteRelativePath(item.poster);
  }

  // ---- Vorschaubild automatisch aus einem Video-Frame erzeugen ----------------
  // Lädt eine Videodatei unsichtbar, springt zu einer kurzen Stelle (nicht
  // Frame 0 — der ist bei vielen Videos noch schwarz/leer) und zeichnet den
  // aktuellen Frame in ein <canvas>, um daraus ein JPEG-Bild (Blob) zu machen.
  // Funktioniert nur für Datei-Uploads (provider "file") — bei YouTube/Vimeo
  // ist das Video ein eingebetteter Player, kein direkt lesbares Videoelement.
  function extractVideoFrame(videoUrl) {
    return new Promise(function (resolve, reject) {
      if (!videoUrl) { reject(new Error("Keine Videoquelle vorhanden.")); return; }
      var video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.src = videoUrl;

      var settled = false;
      var timeoutId = setTimeout(function () { fail("Zeitüberschreitung beim Laden des Videos."); }, 10000);

      function cleanup() {
        clearTimeout(timeoutId);
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        video.removeAttribute("src");
        video.load();
      }
      function fail(message) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(message));
      }
      function succeed(blob) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(blob);
      }
      function onError() { fail("Video konnte nicht geladen werden."); }
      function onLoadedMetadata() {
        var duration = video.duration;
        var target = isFinite(duration) && duration > 0 ? Math.min(1, duration * 0.1) : 0;
        try { video.currentTime = target; } catch (e) { fail("Im Video konnte nicht gesprungen werden."); }
      }
      function onSeeked() {
        var canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        if (!canvas.width || !canvas.height) { fail("Video-Abmessungen konnten nicht gelesen werden."); return; }
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          if (!blob) { fail("Frame konnte nicht als Bild gespeichert werden."); return; }
          succeed(blob);
        }, "image/jpeg", 0.85);
      }

      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onError);
    });
  }

  // Stabiler Dateiname fürs generierte Vorschaubild, abgeleitet vom
  // Videodateinamen — erzeugt man es erneut, wird dieselbe Datei überschrieben
  // statt immer neue Dateien anzuhäufen.
  function posterFilenameFor(item) {
    var source = (item._file && item._file.name) || item.src || "video";
    source = source.split("/").pop().split("\\").pop();
    var idx = source.lastIndexOf(".");
    var base = idx > 0 ? source.slice(0, idx) : source;
    var cleanBase = slugify(base) || "video";
    return "assets/images/" + cleanBase + "-frame.jpg";
  }

  // Übernimmt einen erzeugten Frame (Blob) als Vorschaubild für coverItem oder
  // einen media[]-Eintrag — über denselben pendingFiles-Mechanismus wie bei
  // einem manuellen Datei-Upload, damit der Speichervorgang identisch ist.
  function applyExtractedFrame(item, blob) {
    var path = posterFilenameFor(item);
    var file = new File([blob], path.split("/").pop(), { type: "image/jpeg" });
    if (item._posterUrl) URL.revokeObjectURL(item._posterUrl);
    item._posterFile = file;
    item._posterUrl = null;
    item.poster = path;
    pendingFiles.set(path, file);
  }

  // Wird direkt nach dem Hochladen einer Video-Datei aufgerufen: erzeugt im
  // Hintergrund automatisch ein Vorschaubild aus dem ersten Frame, falls noch
  // keins gesetzt ist — leise, ohne Fehlermeldung. Schlägt es fehl, bleibt
  // einfach der Platzhalter; der Button unten lässt sich weiterhin manuell
  // benutzen (z. B. um erneut oder an einer anderen Stelle zu erzeugen).
  function autoGenerateFrameIfNeeded(item, rerender) {
    if (item.poster) return;
    var source = resolveItemPreviewSrc(item);
    if (!source) return;
    extractVideoFrame(source)
      .then(function (blob) {
        if (item.poster) return; // in der Zwischenzeit manuell gesetzt
        applyExtractedFrame(item, blob);
        rerender();
      })
      .catch(function () { /* Platzhalter bleibt, Button bleibt verfügbar */ });
  }

  // Button „Vorschaubild aus Video-Frame erzeugen“ für Video-Einträge in der
  // Galerie (das Titelbild selbst ist immer ein Bild, siehe renderCoverFields).
  function frameExtractButton(item, rerender) {
    var wrap = document.createElement("div");
    wrap.className = "frame-extract";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--secondary btn--sm";
    btn.textContent = "Vorschaubild aus Video-Frame erzeugen";

    var status = document.createElement("span");
    status.className = "hint";

    btn.addEventListener("click", function () {
      var source = resolveItemPreviewSrc(item);
      if (!source) {
        status.textContent = "Bitte zuerst eine Videodatei hochladen oder einen Pfad angeben.";
        return;
      }
      btn.disabled = true;
      status.textContent = "Erzeuge Vorschaubild …";
      extractVideoFrame(source)
        .then(function (blob) {
          applyExtractedFrame(item, blob);
          rerender();
        })
        .catch(function (err) {
          btn.disabled = false;
          status.textContent = (err && err.message) || "Vorschaubild konnte nicht erzeugt werden.";
        });
    });

    wrap.appendChild(btn);
    wrap.appendChild(status);
    return wrap;
  }

  // ---- Medien-Liste (Galerie) -------------------------------------------------
  function addMedia(type) {
    var item = type === "image"
      ? { type: "image", src: "", alt: "" }
      : { type: "video", provider: "file", src: "", alt: "", poster: "" };
    mediaList.push(item);
    renderMediaRows();
  }

  // "+ Bild" wählt (anders als "+ Video") direkt mehrere Dateien auf einmal
  // aus (siehe init()) — für jede Datei entsteht sofort ein fertiger
  // Galerie-Eintrag, ohne erst eine leere Zeile anzulegen und die Datei
  // dort einzeln nachzutragen. Hoch- und Querformat werden dabei gleich
  // behandelt — welches Raster-Feld ein Bild auf der Website bekommt,
  // entscheidet automatisch js/project.js anhand des tatsächlichen Formats.
  function addImagesFromFiles(fileList) {
    Array.from(fileList).forEach(function (file) {
      var path = "assets/images/" + sanitizeFilename(file.name);
      pendingFiles.set(path, file);
      mediaList.push({ type: "image", src: path, alt: "", _file: file });
    });
    renderMediaRows();
  }

  function removeMedia(index) {
    var item = mediaList[index];
    if (item._fileUrl) URL.revokeObjectURL(item._fileUrl);
    if (item._posterUrl) URL.revokeObjectURL(item._posterUrl);
    mediaList.splice(index, 1);
    renderMediaRows();
  }

  function moveMedia(index, dir) {
    var target = index + dir;
    if (target < 0 || target >= mediaList.length) return;
    var tmp = mediaList[index];
    mediaList[index] = mediaList[target];
    mediaList[target] = tmp;
    renderMediaRows();
  }

  function renderMediaRows() {
    var container = $("[data-media-rows]");
    container.innerHTML = "";
    mediaList.forEach(function (item, index) {
      container.appendChild(buildMediaRowElement(item, index));
    });
    updatePreview();
  }

  function buildMediaRowElement(item, index) {
    var row = document.createElement("div");
    row.className = "media-row";

    var head = document.createElement("div");
    head.className = "media-row__head";
    var label = document.createElement("span");
    label.textContent = (item.type === "image" ? "Bild " : "Video ") + (index + 1);
    head.appendChild(label);

    var actions = document.createElement("div");
    actions.className = "media-row__actions";
    actions.appendChild(iconButton("↑", "Nach oben", function () { moveMedia(index, -1); }, index === 0));
    actions.appendChild(iconButton("↓", "Nach unten", function () { moveMedia(index, 1); }, index === mediaList.length - 1));
    actions.appendChild(iconButton("✕", "Entfernen", function () { removeMedia(index); }));
    head.appendChild(actions);
    row.appendChild(head);

    if (item.type === "image") {
      row.appendChild(fileAndPathField({
        fileLabel: "Datei", pathLabel: "…oder Pfad/URL", accept: "image/*", pathValue: item.src,
        onFile: function (file, path) {
          if (item._fileUrl) URL.revokeObjectURL(item._fileUrl);
          item._file = file; item._fileUrl = null; item.src = path; renderMediaRows();
        },
        onPath: function (val) { item.src = val; updatePreview(); },
      }));
      row.appendChild(textField("Alt-Text", item.alt, function (val) { item.alt = val; }));

      var keepFormatLabel = document.createElement("label");
      keepFormatLabel.className = "checkbox-field";
      var keepFormatInput = document.createElement("input");
      keepFormatInput.type = "checkbox";
      keepFormatInput.checked = !!item.keepFormat;
      keepFormatInput.addEventListener("change", function () {
        item.keepFormat = keepFormatInput.checked;
        updatePreview();
      });
      keepFormatLabel.appendChild(keepFormatInput);
      keepFormatLabel.appendChild(document.createTextNode(" Format behalten"));
      row.appendChild(keepFormatLabel);
      var keepFormatHint = document.createElement("p");
      keepFormatHint.className = "hint";
      keepFormatHint.textContent = "Zeigt dieses Bild in der Galerie über die volle Breite, ohne Rundung und im exakten Originalformat — statt normal einsortiert (Hoch-/Querformat-Raster).";
      row.appendChild(keepFormatHint);

      var previewSrc = resolveItemPreviewSrc(item);
      if (previewSrc) row.appendChild(imagePreviewEl(previewSrc));
    } else {
      row.appendChild(selectField("Quelle", [
        { value: "file", label: "Datei-Upload" },
        { value: "youtube", label: "YouTube" },
        { value: "vimeo", label: "Vimeo" },
      ], item.provider, function (val) { item.provider = val; renderMediaRows(); }));

      if (item.provider === "file") {
        row.appendChild(fileAndPathField({
          fileLabel: "Video-Datei", pathLabel: "…oder Pfad", accept: "video/*", pathValue: item.src,
          onFile: function (file, path) {
            if (item._fileUrl) URL.revokeObjectURL(item._fileUrl);
            item._file = file; item._fileUrl = null; item.src = path; renderMediaRows();
            autoGenerateFrameIfNeeded(item, renderMediaRows);
          },
          onPath: function (val) { item.src = val; updatePreview(); },
        }));
        row.appendChild(fileAndPathField({
          fileLabel: "Vorschaubild (Poster)", pathLabel: "…oder Pfad", accept: "image/*", pathValue: item.poster || "",
          onFile: function (file, path) {
            if (item._posterUrl) URL.revokeObjectURL(item._posterUrl);
            item._posterFile = file; item._posterUrl = null; item.poster = path; renderMediaRows();
          },
          onPath: function (val) { item.poster = val; updatePreview(); },
        }));
        row.appendChild(frameExtractButton(item, renderMediaRows));
      } else {
        row.appendChild(textField(
          item.provider === "youtube" ? "YouTube-Link oder Video-ID" : "Vimeo-Link oder Video-ID",
          item.src,
          function (val) { item.src = item.provider === "youtube" ? toYouTubeEmbed(val) : toVimeoEmbed(val); updatePreview(); }
        ));
      }
      row.appendChild(textField("Alt-Text", item.alt, function (val) { item.alt = val; }));
    }

    return row;
  }

  // ---- Titelbild (Bild oder Video) -------------------------------------------
  // Das Titelbild ist immer ein Bild (kein Video) — siehe README, Abschnitt
  // "Titelbild". Für Videos: als normaler Galerie-Eintrag anlegen (siehe
  // buildMediaRowElement), der dort auch ein automatisch erzeugtes
  // Vorschaubild bekommen kann.
  function renderCoverFields() {
    var container = $("[data-cover-fields]");
    container.innerHTML = "";

    container.appendChild(fileAndPathField({
      fileLabel: "Datei", pathLabel: "…oder Pfad/URL", accept: "image/*", pathValue: coverItem.src,
      onFile: function (file, path) {
        if (coverItem._fileUrl) URL.revokeObjectURL(coverItem._fileUrl);
        coverItem._file = file; coverItem._fileUrl = null; coverItem.src = path; renderCoverFields();
      },
      onPath: function (val) { coverItem.src = val; updatePreview(); },
    }));
    container.appendChild(textField("Alt-Text", coverItem.alt, function (val) { coverItem.alt = val; }));
    var previewSrc = resolveItemPreviewSrc(coverItem);
    if (previewSrc) container.appendChild(imagePreviewEl(previewSrc));

    var statusBadge = $("[data-cover-status]");
    statusBadge.hidden = !coverItem.src;

    updatePreview();
  }

  // ---- Formular <-> Datenmodell (Projekte) ------------------------------------
  // Setzt die Kategorie-Checkboxen + das Freitextfeld anhand einer Liste von
  // Kategorie-Werten (z. B. beim Laden eines vorhandenen Projekts).
  function setCategoryCheckboxes(categories) {
    $all("[data-category-checkbox]").forEach(function (cb) {
      cb.checked = categories.indexOf(cb.value) > -1;
    });
    var customOnes = categories.filter(function (c) { return KNOWN_CATEGORIES.indexOf(c) === -1; });
    $("#f-category-custom").value = customOnes.join(", ");
  }

  // Liest die aktuelle Kategorie-Auswahl (Checkboxen + Freitext) als Array,
  // ohne Duplikate, in der Reihenfolge: bekannte Kategorien zuerst.
  function getCategoryValues() {
    var checked = $all("[data-category-checkbox]:checked").map(function (cb) { return cb.value; });
    var custom = $("#f-category-custom").value
      .split(",")
      .map(function (s) { return slugify(s.trim()); })
      .filter(Boolean);
    var seen = {};
    return checked.concat(custom).filter(function (c) {
      if (seen[c]) return false;
      seen[c] = true;
      return true;
    });
  }

  function collectProject() {
    var title = $("#f-title").value.trim();
    var tags = $("#f-tags").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var description = $("#f-description").value.split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean);

    var media = mediaList.map(function (m) {
      var out = { type: m.type, src: m.src || "", alt: m.alt || "" };
      if (m.type === "video") {
        out.provider = m.provider;
        if (m.provider === "file" && m.poster) out.poster = m.poster;
      } else if (m.keepFormat) {
        out.keepFormat = true;
      }
      return out;
    });

    // Titelbild ist optional (immer ein Bild) — ohne gesetzten Pfad wird gar
    // kein "cover" gespeichert (die Website zeigt dann die Kurzbeschreibung).
    var cover = coverItem.src ? { type: "image", src: coverItem.src, alt: coverItem.alt || "" } : null;

    var links = linksList
      .filter(function (l) { return l.url; })
      .map(function (l) { return { label: l.label || "", url: l.url }; });

    var project = {
      id: $("#f-id").value.trim() || slugify(title),
      title: title,
      categories: getCategoryValues(),
      date: $("#f-date").value,
      location: $("#f-location").value.trim(),
      client: $("#f-client").value.trim(),
      tags: tags,
      summary: $("#f-summary").value.trim(),
      description: description,
      media: media,
      links: links,
    };
    if (cover) project.cover = cover;
    if ($("#f-offline").checked) project.offline = true;
    return project;
  }

  function validateProject(project) {
    var errors = [];
    if (!project.title) errors.push("Titel fehlt.");
    if (!project.categories.length) errors.push("Mindestens eine Kategorie fehlt.");
    if (!project.cover && !project.summary) {
      errors.push("Ohne Titelbild wird die Kurzbeschreibung an dessen Stelle gezeigt — bitte mindestens eine der beiden angeben.");
    }
    if (!/^[a-z0-9-]+$/.test(project.id)) errors.push("Adresse/ID darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.");
    return errors;
  }

  function newProject() {
    currentIndex = null;
    idTouched = false;

    $("[data-project-form]").reset();
    setCategoryCheckboxes([]);

    coverItem = freshCover();
    renderCoverFields();

    mediaList = [];
    renderMediaRows();

    linksList = [];
    renderLinksList();

    $("[data-cancel-edit]").hidden = true;
    $("[data-delete-project]").hidden = true;
    setFormStatus("");
    updateFormStatus();
    renderList();
  }

  function loadIntoForm(index) {
    var project = projects[index];
    currentIndex = index;
    idTouched = true; // vorhandene ID nicht automatisch überschreiben

    $("#f-title").value = project.title || "";
    $("#f-id").value = project.id || "";
    setCategoryCheckboxes(normalizeCategories(project));
    $("#f-date").value = project.date || "";
    $("#f-location").value = project.location || "";
    $("#f-client").value = project.client || "";
    $("#f-tags").value = (project.tags || []).join(", ");
    $("#f-summary").value = project.summary || "";
    $("#f-description").value = (project.description || []).join("\n\n");
    $("#f-offline").checked = !!project.offline;

    // Titelbild ist immer ein Bild — ein aus einer alten Version noch
    // vorhandenes Video-Titelbild wird beim Laden nicht mehr übernommen
    // (unter "Galerie" als normalen Video-Eintrag anlegen stattdessen).
    var rawCover = project.cover || {};
    coverItem = rawCover.type === "video"
      ? freshCover()
      : { type: "image", src: rawCover.src || "", alt: rawCover.alt || "" };
    renderCoverFields();

    mediaList = (project.media || []).map(function (m) {
      var copy = {};
      for (var key in m) if (Object.prototype.hasOwnProperty.call(m, key)) copy[key] = m[key];
      return copy;
    });
    renderMediaRows();

    linksList = (project.links || []).map(function (l) { return { label: l.label || "", url: l.url || "" }; });
    renderLinksList();

    $("[data-cancel-edit]").hidden = false;
    $("[data-delete-project]").hidden = false;
    setFormStatus("");
    updateFormStatus();
    renderList();

    var formPanel = $(".editor-form");
    if (formPanel) formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderLinksList() {
    renderLinkRows(linksList, $("[data-link-rows]"), renderLinksList);
    updatePreview();
  }

  function updateFormStatus() {
    var heading = $("[data-form-heading]");
    var status = $("[data-form-status]");
    if (currentIndex === null) {
      heading.textContent = "Neues Projekt";
      status.textContent = "Ungespeichert";
      status.classList.remove("is-dirty");
    } else {
      heading.textContent = "Bearbeite: " + (projects[currentIndex].title || "(ohne Titel)");
      status.textContent = "Gespeichert";
      status.classList.add("is-dirty");
    }
  }

  function setFormStatus(text, isError) {
    var el = $("[data-form-message]");
    el.textContent = text || "";
    el.style.color = isError ? "#dc2626" : "";
  }

  // ---- Vorschau im echten Design ----------------------------------------------
  // Spiegelt js/project.js: Querformat-Bilder bekommen zwei zusammengefügte
  // Hochformat-Plätze im Galerie-Grid (siehe .media-item--landscape,
  // style.css) — für eine pixelgenaue Vorschau hier genauso ermittelt.
  function applyGalleryOrientation(img, figure) {
    function check() {
      if (img.naturalWidth > img.naturalHeight) figure.classList.add("media-item--landscape");
    }
    if (img.complete && img.naturalWidth) check();
    else img.addEventListener("load", check);
  }

  function buildPreviewMediaItem(item) {
    var figure = document.createElement("figure");
    figure.className = "media-item media-item--" + item.type;

    if (item.type === "image") {
      var img = document.createElement("img");
      img.src = resolveItemPreviewSrc(item) || "";
      img.alt = item.alt || "";
      figure.appendChild(img);
      if (item.keepFormat) figure.classList.add("media-item--keep-format");
      else applyGalleryOrientation(img, figure);
    } else if (item.provider === "file") {
      var video = document.createElement("video");
      video.controls = true;
      video.src = resolveItemPreviewSrc(item) || "";
      var poster = resolveItemPosterPreviewSrc(item);
      if (poster) video.poster = poster;
      figure.appendChild(video);
    } else {
      var embedWrap = document.createElement("div");
      embedWrap.className = "media-item__embed";
      var iframe = document.createElement("iframe");
      iframe.src = item.src || "";
      iframe.title = item.alt || "Eingebettetes Video";
      embedWrap.appendChild(iframe);
      figure.appendChild(embedWrap);
    }
    return figure;
  }

  function renderCardPreview(project) {
    var host = $(".preview-card-frame");
    host.innerHTML = "";
    var article = document.createElement("article");
    article.className = "project-card";
    article.innerHTML =
      '<div class="project-card__link">' +
        '<div class="project-card__media"><img class="project-card__image" alt=""><div class="project-card__text-cover" hidden><p></p></div></div>' +
        '<div class="project-card__body">' +
          '<div class="project-card__text"><span class="project-card__category"></span><h3 class="project-card__title"></h3></div>' +
          '<span class="project-card__arrow" aria-hidden="true">→</span>' +
        '</div>' +
      '</div>';
    var img = article.querySelector(".project-card__image");
    var thumbSrc = coverItem.src ? resolveItemPreviewSrc(coverItem) : null;
    if (thumbSrc) {
      img.src = thumbSrc;
      img.alt = coverItem.alt || project.title;
    } else {
      article.querySelector(".project-card__media").classList.add("project-card__media--text");
      img.remove();
      var textCover = article.querySelector(".project-card__text-cover");
      textCover.hidden = false;
      textCover.querySelector("p").textContent = project.summary || project.title || "Ohne Titel";
    }
    article.querySelector(".project-card__category").textContent = categoryLabels(project.categories) || "—";
    article.querySelector(".project-card__title").textContent = project.title || "Ohne Titel";
    host.appendChild(article);
  }

  function renderDetailPreview(project) {
    var host = $("[data-preview-detail]");
    host.innerHTML = "";

    var wrap = document.createElement("div");
    wrap.className = "project-detail preview-detail-frame";

    var category = document.createElement("p");
    category.className = "project-detail__category";
    category.textContent = categoryLabels(project.categories) || "—";
    wrap.appendChild(category);

    var title = document.createElement("h1");
    title.className = "project-detail__title";
    title.textContent = project.title || "Ohne Titel";
    wrap.appendChild(title);

    var metaList = document.createElement("ul");
    metaList.className = "project-detail__meta";
    [
      [ICONS.calendar, formatDate(project.date)],
      [ICONS.pin, project.location],
      [ICONS.briefcase, project.client],
    ].forEach(function (pair) {
      if (!pair[1]) return;
      var li = document.createElement("li");
      var span = document.createElement("span");
      span.setAttribute("aria-hidden", "true");
      span.innerHTML = pair[0];
      li.appendChild(span);
      li.appendChild(document.createTextNode(pair[1]));
      metaList.appendChild(li);
    });
    wrap.appendChild(metaList);

    if (coverItem.src || coverItem._file) {
      var heroWrap = document.createElement("div");
      heroWrap.className = "project-detail__hero";
      heroWrap.appendChild(buildPreviewMediaItem(coverItem));
      wrap.appendChild(heroWrap);
    }

    if (project.summary) {
      var summary = document.createElement("p");
      summary.className = "project-detail__intro";
      summary.textContent = project.summary;
      wrap.appendChild(summary);
    }

    var gallery = document.createElement("div");
    gallery.className = "project-detail__gallery";
    mediaList.forEach(function (item) {
      if (coverItem.src && item.src === coverItem.src) return; // Duplikat des Titelbilds überspringen
      gallery.appendChild(buildPreviewMediaItem(item));
    });
    wrap.appendChild(gallery);

    if (project.description.length) {
      var descWrap = document.createElement("div");
      descWrap.className = "project-detail__description";
      project.description.forEach(function (para) {
        var p = document.createElement("p");
        p.textContent = para;
        descWrap.appendChild(p);
      });
      wrap.appendChild(descWrap);
    }

    if (project.tags.length) {
      var tagsWrap = document.createElement("div");
      tagsWrap.className = "project-detail__tags";
      project.tags.forEach(function (tag) {
        var span = document.createElement("span");
        span.className = "tag";
        span.textContent = tag;
        tagsWrap.appendChild(span);
      });
      wrap.appendChild(tagsWrap);
    }

    if (project.links.length) {
      var linksWrap = document.createElement("div");
      linksWrap.className = "project-detail__links";
      project.links.forEach(function (link) {
        var a = document.createElement("a");
        a.className = "link-pill";
        a.textContent = "↗ " + (link.label || link.url);
        linksWrap.appendChild(a);
      });
      wrap.appendChild(linksWrap);
    }

    host.appendChild(wrap);
  }

  function updatePreview() {
    var project = collectProject();
    renderOfflineNotice(project);
    renderCardPreview(project);
    renderDetailPreview(project);
  }

  function renderOfflineNotice(project) {
    var notice = $("[data-offline-notice]");
    if (!notice) return;
    notice.hidden = !project.offline;
  }

  // ---- Projektliste ------------------------------------------------------------
  function renderList() {
    var listEl = $("[data-project-list]");
    var emptyHint = $("[data-list-empty-hint]");
    listEl.innerHTML = "";
    emptyHint.hidden = projects.length > 0;

    projects.forEach(function (project, index) {
      var li = document.createElement("li");
      li.className = "project-list-item" + (index === currentIndex ? " is-active" : "");

      var thumb = document.createElement("img");
      var thumbSrc = project.cover && project.cover.src;
      if (thumbSrc) thumb.src = toSiteRelativePath(thumbSrc);
      thumb.alt = "";
      li.appendChild(thumb);

      var text = document.createElement("span");
      text.className = "project-list-item__text";
      var titleEl = document.createElement("strong");
      titleEl.textContent = project.title || "(ohne Titel)";
      if (project.offline) {
        var offlineBadge = document.createElement("span");
        offlineBadge.className = "badge badge--offline";
        offlineBadge.textContent = "Offline";
        titleEl.appendChild(document.createTextNode(" "));
        titleEl.appendChild(offlineBadge);
      }
      var catEl = document.createElement("small");
      catEl.textContent = categoryLabels(normalizeCategories(project));
      text.appendChild(titleEl);
      text.appendChild(catEl);
      li.appendChild(text);

      var actions = document.createElement("span");
      actions.className = "project-list-item__actions";
      actions.appendChild(iconButton("↑", "Nach oben", function (e) { e.stopPropagation(); reorderProject(index, -1); }, index === 0));
      actions.appendChild(iconButton("↓", "Nach unten", function (e) { e.stopPropagation(); reorderProject(index, 1); }, index === projects.length - 1));
      li.appendChild(actions);

      li.addEventListener("click", function () { loadIntoForm(index); });

      listEl.appendChild(li);
    });

    updateExportBar();
  }

  function reorderProject(index, dir) {
    var target = index + dir;
    if (target < 0 || target >= projects.length) return;
    var tmp = projects[index];
    projects[index] = projects[target];
    projects[target] = tmp;
    if (currentIndex === index) currentIndex = target;
    else if (currentIndex === target) currentIndex = index;
    renderList();
    persistProjects().then(function (result) {
      if (result.saved) setExportStatus("Reihenfolge gespeichert.");
    }).catch(function (err) { console.error(err); });
  }

  // ---- Verbindung zum Projektordner (File System Access API) --------------------
  function updateConnectionUI() {
    var statusEl = $("[data-connection-status]");
    var label = $("[data-connection-label]");
    var hint = $("[data-connection-hint]");
    var connected = !!rootDirHandle;
    statusEl.classList.toggle("is-connected", connected);
    label.textContent = connected ? "Verbunden mit Projektordner" : "Nicht verbunden";
    if (connected) {
      hint.textContent = "„Projekt speichern“ und „Seiteninhalte speichern“ schreiben jetzt direkt in deinen Projektordner.";
    } else if (!("showDirectoryPicker" in window)) {
      hint.textContent = "Dein Browser unterstützt direktes Speichern nicht (funktioniert in Chrome/Edge) — nutze stattdessen Download/Kopieren.";
    } else {
      hint.textContent = "Verbinde dich einmal mit deinem Projektordner, danach speichert „speichern“ automatisch — kein zusätzlicher Export nötig.";
    }
  }

  function ensureConnected() {
    if (rootDirHandle) return Promise.resolve(true);
    if (!("showDirectoryPicker" in window)) return Promise.resolve(false);
    return window.showDirectoryPicker({ id: "portfolio-root", mode: "readwrite" })
      .then(function (handle) {
        rootDirHandle = handle;
        updateConnectionUI();
        return true;
      })
      .catch(function (err) {
        if (err && err.name !== "AbortError") console.error(err);
        return false;
      });
  }

  function writeFileToPath(path, file) {
    var parts = path.split("/");
    var filename = parts.pop();
    var dirPromise = Promise.resolve(rootDirHandle);
    parts.forEach(function (part) {
      dirPromise = dirPromise.then(function (dir) { return dir.getDirectoryHandle(part, { create: true }); });
    });
    return dirPromise
      .then(function (dir) { return dir.getFileHandle(filename, { create: true }); })
      .then(function (fileHandle) { return fileHandle.createWritable(); })
      .then(function (writable) { return writable.write(file).then(function () { return writable.close(); }); });
  }

  function flushPendingFiles() {
    var entries = Array.from(pendingFiles.entries());
    return entries.reduce(function (chain, entry) {
      return chain.then(function () { return writeFileToPath(entry[0], entry[1]); });
    }, Promise.resolve()).then(function () {
      var count = entries.length;
      pendingFiles.clear();
      updateExportBar();
      return count;
    });
  }

  function checkStaleness(fileHandle, snapshot) {
    if (snapshot === null) return Promise.resolve(true);
    return fileHandle.getFile()
      .then(function (file) { return file.text(); })
      .then(function (existingText) {
        if (existingText.trim() && existingText !== snapshot) {
          return window.confirm(
            "Diese Datei wurde offenbar seit dem Laden verändert (z. B. von Hand bearbeitet). " +
            "Trotzdem mit dem Stand aus diesem Editor überschreiben?"
          );
        }
        return true;
      });
  }

  function writeJsonWithStaleCheck(filename, jsonString, snapshotGetter, snapshotSetter) {
    return ensureConnected().then(function (connected) {
      if (!connected) return { saved: false, reason: "not-connected" };
      return rootDirHandle.getDirectoryHandle("data", { create: true })
        .then(function (dataDir) { return dataDir.getFileHandle(filename, { create: true }); })
        .then(function (fileHandle) {
          return checkStaleness(fileHandle, snapshotGetter()).then(function (proceed) {
            if (!proceed) return { saved: false, reason: "cancelled" };
            return fileHandle.createWritable().then(function (writable) {
              return writable.write(jsonString).then(function () { return writable.close(); });
            }).then(function () {
              snapshotSetter(jsonString);
              return flushPendingFiles().then(function (fileCount) { return { saved: true, fileCount: fileCount }; });
            });
          });
        });
    });
  }

  // ---- Speichern: Projekte -----------------------------------------------------
  function buildProjectsJsonString() {
    return JSON.stringify({ _hinweis: PROJECTS_HINWEIS, projects: projects }, null, 2);
  }

  function persistProjects() {
    return writeJsonWithStaleCheck(
      "projects.json",
      buildProjectsJsonString(),
      function () { return loadedProjectsSnapshot; },
      function (val) { loadedProjectsSnapshot = val; }
    );
  }

  function updateExportBar() {
    $("[data-export-count]").textContent = projects.length + (projects.length === 1 ? " Projekt" : " Projekte");

    var pendingHint = $("[data-pending-files-hint]");
    var pendingPanel = $("[data-pending-files-panel]");
    var pendingListEl = $("[data-pending-files-list]");

    if (pendingFiles.size > 0) {
      pendingHint.hidden = false;
      pendingHint.textContent = " · " + pendingFiles.size + " Datei(en) noch abzulegen";
      pendingPanel.hidden = false;
      pendingListEl.innerHTML = "";
      pendingFiles.forEach(function (file, path) {
        var li = document.createElement("li");
        var code = document.createElement("code");
        code.textContent = path;
        var dlBtn = document.createElement("a");
        dlBtn.className = "btn btn--secondary btn--sm";
        dlBtn.textContent = "Herunterladen";
        dlBtn.href = URL.createObjectURL(file);
        dlBtn.download = path.split("/").pop();
        li.appendChild(code);
        li.appendChild(dlBtn);
        pendingListEl.appendChild(li);
      });
    } else {
      pendingHint.hidden = true;
      pendingPanel.hidden = true;
    }
  }

  function setExportStatus(text, isError) {
    var el = $("[data-export-status]");
    el.textContent = text || "";
    el.style.color = isError ? "#dc2626" : "";
  }

  function downloadTextFile(filename, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function notConnectedMessage(leadIn) {
    return leadIn + " in dieser Sitzung vorgemerkt, aber NICHT gespeichert — " +
      (("showDirectoryPicker" in window)
        ? "verbinde dich oben mit deinem Projektordner oder nutze Download/Kopieren."
        : "dein Browser unterstützt direktes Speichern nicht — nutze stattdessen Download/Kopieren.");
  }

  // Die drei Kategorien der Bereiche-Karten — Titel und Icon sind fix im
  // HTML (index.html), hier werden nur Text, Werkzeug-Tags und die
  // Reihenfolge editiert (siehe data-service-block, ↑↓-Buttons unten).
  var SERVICE_CATEGORIES = ["lichttechnik", "fotografie", "videografie"];

  // Deaktiviert ↑ am ersten und ↓ am letzten Block, je nach aktueller
  // Reihenfolge im DOM.
  function updateServiceMoveButtons() {
    var blocks = $all("[data-service-block]");
    blocks.forEach(function (block, index) {
      block.querySelector('[data-service-move="up"]').disabled = index === 0;
      block.querySelector('[data-service-move="down"]').disabled = index === blocks.length - 1;
    });
  }

  // ---- Formular <-> Datenmodell (Seiteninhalte) --------------------------------
  function loadSiteIntoForm(data) {
    var brand = data.brand || {};
    var hero = data.hero || {};
    var about = data.about || {};
    var contact = data.contact || {};
    var footer = data.footer || {};
    var aboutImage = about.image || {};
    var services = data.services || [];

    $("#s-brand-name").value = brand.name || "";
    $("#s-brand-highlight").value = brand.highlight || "";
    $("#s-hero-heading").value = hero.heading || "";
    $("#s-hero-lede").value = hero.lede || "";
    $("#s-about-image-path").value = aboutImage.src || "";
    $("#s-about-image-alt").value = aboutImage.alt || "";

    // Reihenfolge der Karten-Blöcke im Formular an die geladene Reihenfolge
    // anpassen (appendChild auf ein bereits vorhandenes Kind verschiebt es
    // nur ans Ende, statt es zu klonen — so geht dabei nichts verloren).
    var blocksContainer = $("[data-service-blocks]");
    services.forEach(function (s) {
      var block = blocksContainer.querySelector('[data-service-category="' + s.category + '"]');
      if (block) blocksContainer.appendChild(block);
    });
    updateServiceMoveButtons();

    SERVICE_CATEGORIES.forEach(function (category) {
      var service = services.filter(function (s) { return s.category === category; })[0] || {};
      $("#s-service-" + category + "-text").value = service.text || "";
      $("#s-service-" + category + "-tools").value = (service.tools || []).join(", ");
    });

    $("#s-contact-heading").value = contact.heading || "";
    $("#s-contact-text").value = contact.text || "";
    $("#s-contact-email").value = contact.email || "";
    $("#s-footer-copyright").value = footer.copyright || "";

    var legal = data.legal || {};
    $("#s-legal-name").value = legal.name || "";
    $("#s-legal-street").value = legal.street || "";
    $("#s-legal-zip-city").value = legal.zipCity || "";
    $("#s-legal-phone").value = legal.phone || "";
    $("#s-legal-vat").value = legal.vatId || "";
    $("#s-legal-hosting").value = legal.hostingProvider || "";

    socialList = (contact.social || []).map(function (s) { return { label: s.label || "", url: s.url || "" }; });
    renderSocialRows();
  }

  function collectSiteContent() {
    return {
      brand: {
        name: $("#s-brand-name").value.trim(),
        highlight: $("#s-brand-highlight").value.trim(),
      },
      hero: {
        heading: $("#s-hero-heading").value.trim(),
        lede: $("#s-hero-lede").value.trim(),
      },
      about: {
        image: { src: $("#s-about-image-path").value.trim(), alt: $("#s-about-image-alt").value.trim() },
      },
      // In der aktuellen (ggf. per ↑↓ geänderten) Reihenfolge der Blöcke im
      // Formular — nicht in der festen SERVICE_CATEGORIES-Reihenfolge —,
      // damit sich die Kartenreihenfolge auf der Website mit ändert.
      services: $all("[data-service-block]").map(function (block) {
        var category = block.dataset.serviceCategory;
        return {
          category: category,
          text: $("#s-service-" + category + "-text").value.trim(),
          tools: $("#s-service-" + category + "-tools").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
        };
      }),
      contact: {
        heading: $("#s-contact-heading").value.trim(),
        text: $("#s-contact-text").value.trim(),
        email: $("#s-contact-email").value.trim(),
        social: socialList.filter(function (s) { return s.url; }),
      },
      footer: { copyright: $("#s-footer-copyright").value.trim() },
      legal: {
        name: $("#s-legal-name").value.trim(),
        street: $("#s-legal-street").value.trim(),
        zipCity: $("#s-legal-zip-city").value.trim(),
        phone: $("#s-legal-phone").value.trim(),
        vatId: $("#s-legal-vat").value.trim(),
        hostingProvider: $("#s-legal-hosting").value.trim(),
      },
    };
  }

  function renderSocialRows() {
    renderLinkRows(socialList, $("[data-site-social-rows]"), renderSocialRows);
  }

  function buildSiteJsonString(data) {
    var out = { _hinweis: SITE_HINWEIS };
    for (var key in data) if (Object.prototype.hasOwnProperty.call(data, key)) out[key] = data[key];
    return JSON.stringify(out, null, 2);
  }

  function persistSite() {
    site = collectSiteContent();
    return writeJsonWithStaleCheck(
      "site.json",
      buildSiteJsonString(site),
      function () { return loadedSiteSnapshot; },
      function (val) { loadedSiteSnapshot = val; }
    );
  }

  function setSiteFormStatus(text, isError) {
    var el = $("[data-site-form-message]");
    el.textContent = text || "";
    el.style.color = isError ? "#dc2626" : "";
  }

  function setLegalFormStatus(text, isError) {
    var el = $("[data-legal-form-message]");
    el.textContent = text || "";
    el.style.color = isError ? "#dc2626" : "";
  }

  // ---- Laden ---------------------------------------------------------------------
  // { cache: "no-store" } ist hier wichtig: ohne das kann der Browser eine
  // ältere, zwischengespeicherte Antwort liefern, obwohl die Datei auf der
  // Festplatte längst neuer ist — das führte sonst zu einer falschen
  // "wurde seit dem Laden verändert"-Warnung beim nächsten Speichern.
  function loadProjects() {
    return fetch("../data/projects.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        loadedProjectsSnapshot = text;
        var data = JSON.parse(text);
        projects = (data && data.projects) || [];
        renderList();
      })
      .catch(function (err) {
        console.error(err);
        var hint = $("[data-list-empty-hint]");
        hint.hidden = false;
        hint.textContent =
          "Bestehende Projekte konnten nicht geladen werden (läuft ein lokaler Server? siehe README, " +
          "Abschnitt 1). Du kannst trotzdem neue Projekte anlegen — speichere aber erst, nachdem du " +
          "die Seite mit laufendem Server neu geladen hast, sonst gehen bestehende Einträge verloren.";
      });
  }

  function loadSite() {
    return fetch("../data/site.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        loadedSiteSnapshot = text;
        site = JSON.parse(text) || {};
        loadSiteIntoForm(site);
      })
      .catch(function (err) {
        console.error(err);
        setSiteFormStatus("Seiteninhalte konnten nicht geladen werden (läuft ein lokaler Server? siehe README, Abschnitt 1).", true);
      });
  }

  // ---- Verkabelung / Init ---------------------------------------------------------
  function init() {
    updateConnectionUI();
    loadProjects();
    loadSite();

    setCategoryCheckboxes([]);
    renderCoverFields();
    renderMediaRows();
    renderLinksList();
    updateFormStatus();

    // ---- Tabs ----
    $all("[data-editor-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $all("[data-editor-tab]").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-selected", String(b === btn));
        });
        $all("[data-tab-panel]").forEach(function (panel) {
          panel.hidden = panel.dataset.tabPanel !== btn.dataset.editorTab;
        });
        updateFloatingSaveLabel();
      });
    });

    // ---- Immer sichtbarer Speichern-Button unten rechts ----
    // Übernimmt Beschriftung und Klick-Verhalten vom "echten" Speichern-Button
    // des gerade offenen Tabs (Projekt/Seiteninhalte/Rechtliches) — ein
    // Klick löst also exakt dasselbe Speichern samt Validierung aus, nur
    // ohne dafür ans Formularende scrollen zu müssen.
    function activeSubmitButton() {
      var panel = $all("[data-tab-panel]").filter(function (p) { return !p.hidden; })[0];
      return panel ? panel.querySelector('button[type="submit"]') : null;
    }
    function updateFloatingSaveLabel() {
      var submitBtn = activeSubmitButton();
      $("[data-floating-save]").textContent = submitBtn ? submitBtn.textContent : "Speichern";
    }
    $("[data-floating-save]").addEventListener("click", function () {
      var submitBtn = activeSubmitButton();
      if (submitBtn) submitBtn.click();
    });
    updateFloatingSaveLabel();

    // ---- Verbindung ----
    $("[data-connect-folder]").addEventListener("click", function () {
      ensureConnected().then(function (connected) {
        if (!connected && !("showDirectoryPicker" in window)) {
          window.alert("Dein Browser unterstützt das direkte Speichern nicht (funktioniert in Chrome/Edge). Nutze stattdessen Download/Kopieren.");
        }
      });
    });

    // ---- Projekt-Formularfelder ----
    ["f-date", "f-location", "f-client", "f-tags", "f-summary", "f-description", "f-category-custom"]
      .forEach(function (id) { document.getElementById(id).addEventListener("input", updatePreview); });

    $("#f-title").addEventListener("input", function () {
      if (!idTouched) $("#f-id").value = slugify($("#f-title").value);
      updatePreview();
    });
    $("#f-id").addEventListener("input", function () { idTouched = true; });
    $("#f-offline").addEventListener("change", updatePreview);

    $all("[data-category-checkbox]").forEach(function (cb) {
      cb.addEventListener("change", updatePreview);
    });

    $("[data-remove-cover]").addEventListener("click", function () {
      if (coverItem._fileUrl) URL.revokeObjectURL(coverItem._fileUrl);
      coverItem = freshCover();
      renderCoverFields();
    });

    // "+ Bild" öffnet einen Mehrfachauswahl-Dialog (siehe addImagesFromFiles);
    // "+ Video" legt weiterhin eine einzelne leere Zeile an (Datei-Upload,
    // YouTube- oder Vimeo-Link — passt nicht in eine Mehrfachauswahl).
    var multiImagePicker = document.createElement("input");
    multiImagePicker.type = "file";
    multiImagePicker.accept = "image/*";
    multiImagePicker.multiple = true;
    multiImagePicker.hidden = true;
    document.body.appendChild(multiImagePicker);
    multiImagePicker.addEventListener("change", function () {
      if (multiImagePicker.files.length) addImagesFromFiles(multiImagePicker.files);
      multiImagePicker.value = ""; // erlaubt erneutes Auswählen derselben Datei(en)
    });

    $all("[data-add-media]").forEach(function (btn) {
      if (btn.dataset.addMedia === "image") {
        btn.addEventListener("click", function () { multiImagePicker.click(); });
      } else {
        btn.addEventListener("click", function () { addMedia(btn.dataset.addMedia); });
      }
    });

    $("[data-add-link]").addEventListener("click", function () {
      linksList.push({ label: "", url: "" });
      renderLinksList();
    });

    $all("[data-preview-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $all("[data-preview-tab]").forEach(function (b) { b.classList.toggle("is-active", b === btn); });
        var tab = btn.dataset.previewTab;
        $("[data-preview-card]").hidden = tab !== "card";
        $("[data-preview-detail]").hidden = tab !== "detail";
      });
    });

    $("[data-project-form]").addEventListener("submit", function (e) {
      e.preventDefault();

      var project = collectProject();
      var errors = validateProject(project);
      if (errors.length) { setFormStatus(errors.join(" "), true); return; }

      if (currentIndex === null) {
        var baseId = project.id || slugify(project.title) || "projekt";
        var uniqueId = baseId, n = 2;
        while (projects.some(function (p) { return p.id === uniqueId; })) { uniqueId = baseId + "-" + n; n++; }
        project.id = uniqueId;
        projects.push(project);
        currentIndex = projects.length - 1;
      } else {
        projects[currentIndex] = project;
      }

      $("#f-id").value = project.id;
      $("[data-cancel-edit]").hidden = false;
      $("[data-delete-project]").hidden = false;
      renderList();
      updateFormStatus();
      setFormStatus("Speichere …");

      persistProjects().then(function (result) {
        if (result.saved) {
          setFormStatus("„" + (project.title || "Ohne Titel") + "“ gespeichert — data/projects.json aktualisiert" + (result.fileCount ? " (+ " + result.fileCount + " Datei(en))." : "."));
        } else if (result.reason === "not-connected") {
          setFormStatus(notConnectedMessage("„" + (project.title || "Ohne Titel") + "“ ist"), true);
        } else {
          setFormStatus("Speichern abgebrochen.", true);
        }
      }).catch(function (err) {
        console.error(err);
        setFormStatus("Speichern fehlgeschlagen: " + err.message, true);
      });
    });

    $("[data-cancel-edit]").addEventListener("click", newProject);
    $("[data-new-project]").addEventListener("click", newProject);

    $("[data-delete-project]").addEventListener("click", function () {
      if (currentIndex === null) return;
      var project = projects[currentIndex];
      if (!window.confirm("„" + (project.title || "Ohne Titel") + "“ wirklich aus der Liste entfernen?")) return;
      projects.splice(currentIndex, 1);
      newProject();
      persistProjects().then(function (result) {
        if (result.saved) setExportStatus("Gelöscht und gespeichert.");
      }).catch(function (err) { console.error(err); });
    });

    $("[data-download-json]").addEventListener("click", function () {
      downloadTextFile("projects.json", buildProjectsJsonString());
      setExportStatus("projects.json heruntergeladen – ersetze data/projects.json in deinem Projektordner damit.");
    });
    $("[data-copy-json]").addEventListener("click", function () {
      navigator.clipboard.writeText(buildProjectsJsonString()).then(function () {
        setExportStatus("JSON in die Zwischenablage kopiert.");
      }, function () {
        setExportStatus("Kopieren nicht möglich – bitte stattdessen projects.json herunterladen.", true);
      });
    });

    // ---- Seiteninhalte ----
    $("#s-about-image-upload").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var path = "assets/images/" + sanitizeFilename(file.name);
      pendingFiles.set(path, file);
      $("#s-about-image-path").value = path;
      updateExportBar();
    });

    $("[data-add-social]").addEventListener("click", function () {
      socialList.push({ label: "", url: "" });
      renderSocialRows();
    });

    // Bereiche-Karten per ↑↓ neu anordnen — verschiebt nur den Block im DOM
    // (die Eingabefelder darin bleiben unangetastet, nichts geht verloren).
    $all("[data-service-block]").forEach(function (block) {
      block.querySelector('[data-service-move="up"]').addEventListener("click", function () {
        var prev = block.previousElementSibling;
        if (prev) block.parentNode.insertBefore(block, prev);
        updateServiceMoveButtons();
      });
      block.querySelector('[data-service-move="down"]').addEventListener("click", function () {
        var next = block.nextElementSibling;
        if (next) block.parentNode.insertBefore(next, block);
        updateServiceMoveButtons();
      });
    });
    updateServiceMoveButtons();

    $("[data-site-form]").addEventListener("submit", function (e) {
      e.preventDefault();
      setSiteFormStatus("Speichere …");
      persistSite().then(function (result) {
        if (result.saved) {
          setSiteFormStatus("Gespeichert — data/site.json aktualisiert" + (result.fileCount ? " (+ " + result.fileCount + " Datei(en))." : "."));
        } else if (result.reason === "not-connected") {
          setSiteFormStatus(notConnectedMessage("Die Seiteninhalte sind"), true);
        } else {
          setSiteFormStatus("Speichern abgebrochen.", true);
        }
      }).catch(function (err) {
        console.error(err);
        setSiteFormStatus("Speichern fehlgeschlagen: " + err.message, true);
      });
    });

    // "Rechtliches" ist ein eigener Tab/Formular, landet aber in derselben
    // site.json wie "Seiteninhalte" — persistSite() sammelt bei jedem
    // Speichern ohnehin den kompletten aktuellen Formular-Stand (siehe
    // collectSiteContent), unabhängig davon, welcher Tab gerade sichtbar ist.
    $("[data-legal-form]").addEventListener("submit", function (e) {
      e.preventDefault();
      setLegalFormStatus("Speichere …");
      persistSite().then(function (result) {
        if (result.saved) {
          setLegalFormStatus("Gespeichert — data/site.json aktualisiert" + (result.fileCount ? " (+ " + result.fileCount + " Datei(en))." : "."));
        } else if (result.reason === "not-connected") {
          setLegalFormStatus(notConnectedMessage("Die rechtlichen Angaben sind"), true);
        } else {
          setLegalFormStatus("Speichern abgebrochen.", true);
        }
      }).catch(function (err) {
        console.error(err);
        setLegalFormStatus("Speichern fehlgeschlagen: " + err.message, true);
      });
    });

    $all("[data-download-site-json]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        downloadTextFile("site.json", buildSiteJsonString(collectSiteContent()));
        var msg = btn.closest("form").querySelector("[data-site-form-message], [data-legal-form-message]");
        if (msg) { msg.textContent = "site.json heruntergeladen – ersetze data/site.json in deinem Projektordner damit."; msg.style.color = ""; }
      });
    });

    updatePreview();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
