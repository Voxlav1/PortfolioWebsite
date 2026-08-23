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

  var CATEGORY_LABELS = { fotografie: "Fotografie", video: "Video", lichttechnik: "Lichttechnik" };
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
    return { type: "image", src: "", alt: "", provider: "file", poster: "" };
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

  function extractYouTubeId(url) {
    if (!url) return null;
    var m = url.match(/(?:youtube(?:-nocookie)?\.com\/embed\/|youtu\.be\/)([\w-]{6,})/);
    return m ? m[1] : null;
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

  function resolveCoverThumbSrc() {
    if (coverItem.type === "video") {
      if (coverItem.provider === "youtube") {
        var id = extractYouTubeId(coverItem.src);
        if (id) return "https://img.youtube.com/vi/" + id + "/hqdefault.jpg";
      }
      var poster = resolveItemPosterPreviewSrc(coverItem);
      return poster || "../assets/images/video-poster.svg";
    }
    return resolveItemPreviewSrc(coverItem);
  }

  // ---- Medien-Liste (Galerie) -------------------------------------------------
  function addMedia(type) {
    var item = type === "image"
      ? { type: "image", src: "", alt: "" }
      : { type: "video", provider: "file", src: "", alt: "", poster: "" };
    mediaList.push(item);
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
        onFile: function (file) {
          if (item._fileUrl) URL.revokeObjectURL(item._fileUrl);
          item._file = file; item._fileUrl = null; renderMediaRows();
        },
        onPath: function (val) { item.src = val; updatePreview(); },
      }));
      row.appendChild(textField("Alt-Text", item.alt, function (val) { item.alt = val; }));
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
          onFile: function (file) {
            if (item._fileUrl) URL.revokeObjectURL(item._fileUrl);
            item._file = file; item._fileUrl = null; renderMediaRows();
          },
          onPath: function (val) { item.src = val; updatePreview(); },
        }));
        row.appendChild(fileAndPathField({
          fileLabel: "Vorschaubild (Poster)", pathLabel: "…oder Pfad", accept: "image/*", pathValue: item.poster || "",
          onFile: function (file) {
            if (item._posterUrl) URL.revokeObjectURL(item._posterUrl);
            item._posterFile = file; item._posterUrl = null; renderMediaRows();
          },
          onPath: function (val) { item.poster = val; updatePreview(); },
        }));
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
  function renderCoverFields() {
    var container = $("[data-cover-fields]");
    container.innerHTML = "";

    if (coverItem.type === "image") {
      container.appendChild(fileAndPathField({
        fileLabel: "Datei", pathLabel: "…oder Pfad/URL", accept: "image/*", pathValue: coverItem.src,
        onFile: function (file) {
          if (coverItem._fileUrl) URL.revokeObjectURL(coverItem._fileUrl);
          coverItem._file = file; coverItem._fileUrl = null; renderCoverFields();
        },
        onPath: function (val) { coverItem.src = val; updatePreview(); },
      }));
      container.appendChild(textField("Alt-Text", coverItem.alt, function (val) { coverItem.alt = val; }));
      var previewSrc = resolveItemPreviewSrc(coverItem);
      if (previewSrc) container.appendChild(imagePreviewEl(previewSrc));
    } else {
      container.appendChild(selectField("Quelle", [
        { value: "file", label: "Datei-Upload" },
        { value: "youtube", label: "YouTube" },
        { value: "vimeo", label: "Vimeo" },
      ], coverItem.provider, function (val) { coverItem.provider = val; renderCoverFields(); }));

      if (coverItem.provider === "file") {
        container.appendChild(fileAndPathField({
          fileLabel: "Video-Datei", pathLabel: "…oder Pfad", accept: "video/*", pathValue: coverItem.src,
          onFile: function (file) {
            if (coverItem._fileUrl) URL.revokeObjectURL(coverItem._fileUrl);
            coverItem._file = file; coverItem._fileUrl = null; renderCoverFields();
          },
          onPath: function (val) { coverItem.src = val; updatePreview(); },
        }));
      } else {
        container.appendChild(textField(
          coverItem.provider === "youtube" ? "YouTube-Link oder Video-ID" : "Vimeo-Link oder Video-ID",
          coverItem.src,
          function (val) {
            coverItem.src = coverItem.provider === "youtube" ? toYouTubeEmbed(val) : toVimeoEmbed(val);
            updatePreview();
          }
        ));
      }

      container.appendChild(textField("Alt-Text", coverItem.alt, function (val) { coverItem.alt = val; }));

      if (coverItem.provider !== "youtube") {
        container.appendChild(fileAndPathField({
          fileLabel: "Vorschaubild (Poster)", pathLabel: "…oder Pfad", accept: "image/*", pathValue: coverItem.poster || "",
          onFile: function (file) {
            if (coverItem._posterUrl) URL.revokeObjectURL(coverItem._posterUrl);
            coverItem._posterFile = file; coverItem._posterUrl = null; renderCoverFields();
          },
          onPath: function (val) { coverItem.poster = val; updatePreview(); },
        }));
      } else {
        var hint = document.createElement("p");
        hint.className = "hint";
        hint.textContent = "Vorschaubild wird automatisch von YouTube übernommen.";
        container.appendChild(hint);
      }
    }

    updatePreview();
  }

  // ---- Formular <-> Datenmodell (Projekte) ------------------------------------
  function setCategorySelect(category) {
    var select = $("#f-category");
    var customWrap = $("[data-category-custom-wrap]");
    var hint = $("[data-category-hint]");
    if (!category || KNOWN_CATEGORIES.indexOf(category) > -1) {
      select.value = category || "fotografie";
      customWrap.hidden = true;
      hint.hidden = true;
      $("#f-category-custom").value = "";
    } else {
      select.value = "__custom__";
      customWrap.hidden = false;
      hint.hidden = false;
      $("#f-category-custom").value = category;
    }
  }

  function getCategoryValue() {
    var value = $("#f-category").value;
    if (value === "__custom__") return slugify($("#f-category-custom").value.trim());
    return value;
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
      }
      return out;
    });

    var cover = { type: coverItem.type, src: coverItem.src || "", alt: coverItem.alt || "" };
    if (coverItem.type === "video") {
      cover.provider = coverItem.provider;
      if (coverItem.poster) cover.poster = coverItem.poster;
    }

    var links = linksList
      .filter(function (l) { return l.url; })
      .map(function (l) { return { label: l.label || "", url: l.url }; });

    return {
      id: $("#f-id").value.trim() || slugify(title),
      title: title,
      category: getCategoryValue(),
      date: $("#f-date").value,
      location: $("#f-location").value.trim(),
      client: $("#f-client").value.trim(),
      tags: tags,
      summary: $("#f-summary").value.trim(),
      description: description,
      cover: cover,
      media: media,
      links: links,
    };
  }

  function validateProject(project) {
    var errors = [];
    if (!project.title) errors.push("Titel fehlt.");
    if (!project.category) errors.push("Kategorie fehlt.");
    if (!project.cover.src) errors.push("Titelbild (Datei, Pfad oder Video-Link) fehlt.");
    if (!/^[a-z0-9-]+$/.test(project.id)) errors.push("Adresse/ID darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.");
    return errors;
  }

  function newProject() {
    currentIndex = null;
    idTouched = false;

    $("[data-project-form]").reset();
    setCategorySelect("fotografie");

    coverItem = freshCover();
    $("#f-cover-type").value = "image";
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
    setCategorySelect(project.category);
    $("#f-date").value = project.date || "";
    $("#f-location").value = project.location || "";
    $("#f-client").value = project.client || "";
    $("#f-tags").value = (project.tags || []).join(", ");
    $("#f-summary").value = project.summary || "";
    $("#f-description").value = (project.description || []).join("\n\n");

    var rawCover = project.cover || {};
    coverItem = {
      type: rawCover.type || "image",
      src: rawCover.src || "",
      alt: rawCover.alt || "",
      provider: rawCover.provider || "file",
      poster: rawCover.poster || "",
    };
    $("#f-cover-type").value = coverItem.type;
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
  function buildPreviewMediaItem(item) {
    var figure = document.createElement("figure");
    figure.className = "media-item media-item--" + item.type;

    if (item.type === "image") {
      var img = document.createElement("img");
      img.src = resolveItemPreviewSrc(item) || "";
      img.alt = item.alt || "";
      figure.appendChild(img);
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
        '<div class="project-card__media"><img class="project-card__image" alt=""><span class="project-card__play" aria-hidden="true" hidden></span></div>' +
        '<div class="project-card__body">' +
          '<div class="project-card__text"><span class="project-card__category"></span><h3 class="project-card__title"></h3></div>' +
          '<span class="project-card__arrow" aria-hidden="true">→</span>' +
        '</div>' +
      '</div>';
    var img = article.querySelector(".project-card__image");
    img.src = resolveCoverThumbSrc() || "";
    img.alt = coverItem.alt || project.title;
    article.querySelector(".project-card__play").hidden = coverItem.type !== "video";
    article.querySelector(".project-card__category").textContent = CATEGORY_LABELS[project.category] || project.category || "—";
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
    category.textContent = CATEGORY_LABELS[project.category] || project.category || "—";
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

    if (project.summary) {
      var summary = document.createElement("p");
      summary.className = "project-detail__intro";
      summary.textContent = project.summary;
      wrap.appendChild(summary);
    }

    if (coverItem.src || coverItem._file) {
      var heroWrap = document.createElement("div");
      heroWrap.className = "project-detail__hero";
      heroWrap.appendChild(buildPreviewMediaItem(coverItem));
      wrap.appendChild(heroWrap);
    }

    var gallery = document.createElement("div");
    gallery.className = "project-detail__gallery";
    mediaList.forEach(function (item) { gallery.appendChild(buildPreviewMediaItem(item)); });
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
    renderCardPreview(project);
    renderDetailPreview(project);
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
      thumb.src = toSiteRelativePath(project.cover && project.cover.src);
      thumb.alt = "";
      li.appendChild(thumb);

      var text = document.createElement("span");
      text.className = "project-list-item__text";
      var titleEl = document.createElement("strong");
      titleEl.textContent = project.title || "(ohne Titel)";
      var catEl = document.createElement("small");
      catEl.textContent = CATEGORY_LABELS[project.category] || project.category || "";
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

  // ---- Formular <-> Datenmodell (Seiteninhalte) --------------------------------
  function loadSiteIntoForm(data) {
    var brand = data.brand || {};
    var hero = data.hero || {};
    var about = data.about || {};
    var contact = data.contact || {};
    var footer = data.footer || {};
    var aboutImage = about.image || {};

    $("#s-brand-name").value = brand.name || "";
    $("#s-brand-highlight").value = brand.highlight || "";
    $("#s-hero-eyebrow").value = hero.eyebrow || "";
    $("#s-hero-heading").value = hero.heading || "";
    $("#s-hero-lede").value = hero.lede || "";
    $("#s-about-heading").value = about.heading || "";
    $("#s-about-paragraphs").value = (about.paragraphs || []).join("\n\n");
    $("#s-about-tags").value = (about.tags || []).join(", ");
    $("#s-about-image-path").value = aboutImage.src || "";
    $("#s-about-image-alt").value = aboutImage.alt || "";
    $("#s-contact-heading").value = contact.heading || "";
    $("#s-contact-text").value = contact.text || "";
    $("#s-contact-email").value = contact.email || "";
    $("#s-footer-copyright").value = footer.copyright || "";

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
        eyebrow: $("#s-hero-eyebrow").value.trim(),
        heading: $("#s-hero-heading").value.trim(),
        lede: $("#s-hero-lede").value.trim(),
      },
      about: {
        heading: $("#s-about-heading").value.trim(),
        paragraphs: $("#s-about-paragraphs").value.split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean),
        tags: $("#s-about-tags").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
        image: { src: $("#s-about-image-path").value.trim(), alt: $("#s-about-image-alt").value.trim() },
      },
      contact: {
        heading: $("#s-contact-heading").value.trim(),
        text: $("#s-contact-text").value.trim(),
        email: $("#s-contact-email").value.trim(),
        social: socialList.filter(function (s) { return s.url; }),
      },
      footer: { copyright: $("#s-footer-copyright").value.trim() },
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

  // ---- Laden ---------------------------------------------------------------------
  function loadProjects() {
    return fetch("../data/projects.json")
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
    return fetch("../data/site.json")
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

    setCategorySelect("fotografie");
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
      });
    });

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

    $("#f-category").addEventListener("change", function () {
      var isCustom = $("#f-category").value === "__custom__";
      $("[data-category-custom-wrap]").hidden = !isCustom;
      $("[data-category-hint]").hidden = !isCustom;
      updatePreview();
    });

    $("#f-cover-type").addEventListener("change", function () {
      coverItem.type = $("#f-cover-type").value;
      if (coverItem.type === "video" && !coverItem.provider) coverItem.provider = "file";
      renderCoverFields();
    });

    $all("[data-add-media]").forEach(function (btn) {
      btn.addEventListener("click", function () { addMedia(btn.dataset.addMedia); });
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

    $("[data-download-site-json]").addEventListener("click", function () {
      downloadTextFile("site.json", buildSiteJsonString(collectSiteContent()));
      setSiteFormStatus("site.json heruntergeladen – ersetze data/site.json in deinem Projektordner damit.");
    });

    updatePreview();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
