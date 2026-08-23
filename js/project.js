/**
 * project.js
 * Nur auf project.html geladen.
 *
 * Diese eine Seite ist das "Template" für ALLE Projekte. Welches Projekt
 * angezeigt wird, entscheidet der ?id=... Parameter in der URL
 * (siehe project.html?id=beispiel-projekt). Der Inhalt kommt komplett aus
 * data/projects.json — für ein neues Projekt musst du also nie eine neue
 * HTML-Seite anlegen, sondern nur einen neuen Eintrag in der JSON-Datei.
 */
(function () {
  var CATEGORY_LABELS = {
    fotografie: "Fotografie",
    video: "Video",
    lichttechnik: "Lichttechnik",
  };

  var MONTHS = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ];

  var ICONS = {
    calendar:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    pin:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-7.2-7-12a7 7 0 1 1 14 0c0 4.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    briefcase:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>',
    external:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>',
  };

  function categoryLabel(category) {
    return CATEGORY_LABELS[category] || category;
  }

  function formatDate(value) {
    if (!value) return "";
    var parts = value.split("-");
    var monthIndex = parseInt(parts[1], 10) - 1;
    var monthName = MONTHS[monthIndex];
    return monthName ? monthName + " " + parts[0] : value;
  }

  function createMetaItem(iconKey, text) {
    if (!text) return null;
    var li = document.createElement("li");
    var icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = ICONS[iconKey] || "";
    li.appendChild(icon);
    li.appendChild(document.createTextNode(text));
    return li;
  }

  // Ältere Projekte kennen bei "cover" noch kein "type"-Feld (war immer ein
  // Bild). Fehlt es, wird weiterhin "image" angenommen — neue Projekte
  // können stattdessen "type: video" (Datei/YouTube/Vimeo) nutzen.
  function normalizeCover(cover) {
    cover = cover || {};
    return {
      type: cover.type || "image",
      src: cover.src || "",
      alt: cover.alt || "",
      provider: cover.provider,
      poster: cover.poster,
    };
  }

  // ---- Lightbox ---------------------------------------------------------
  var lightbox = {
    items: [],
    index: 0,
    trigger: null,
    el: null,
    imageEl: null,

    init: function () {
      this.el = document.querySelector("[data-lightbox]");
      if (!this.el) return;
      this.imageEl = this.el.querySelector("[data-lightbox-image]");
      var self = this;

      this.el.querySelector("[data-lightbox-close]").addEventListener("click", function () {
        self.close();
      });
      this.el.querySelector("[data-lightbox-prev]").addEventListener("click", function () {
        self.step(-1);
      });
      this.el.querySelector("[data-lightbox-next]").addEventListener("click", function () {
        self.step(1);
      });
      this.el.addEventListener("click", function (event) {
        if (event.target === self.el) self.close();
      });
      document.addEventListener("keydown", function (event) {
        if (self.el.hidden) return;
        if (event.key === "Escape") self.close();
        if (event.key === "ArrowLeft") self.step(-1);
        if (event.key === "ArrowRight") self.step(1);
      });
    },

    setItems: function (items) {
      this.items = items;
    },

    open: function (index, triggerEl) {
      if (!this.el || !this.items.length) return;
      this.index = index;
      this.trigger = triggerEl || null;
      this.render();
      this.el.hidden = false;
      document.body.style.overflow = "hidden";
      this.el.querySelector("[data-lightbox-close]").focus();
    },

    close: function () {
      if (!this.el) return;
      this.el.hidden = true;
      document.body.style.overflow = "";
      if (this.trigger) this.trigger.focus();
    },

    step: function (delta) {
      var len = this.items.length;
      this.index = (this.index + delta + len) % len;
      this.render();
    },

    render: function () {
      var item = this.items[this.index];
      if (!item || !this.imageEl) return;
      this.imageEl.src = item.src;
      this.imageEl.alt = item.alt || "";
      var multi = this.items.length > 1;
      this.el.querySelector("[data-lightbox-prev]").hidden = !multi;
      this.el.querySelector("[data-lightbox-next]").hidden = !multi;
    },
  };

  // ---- Ein einzelnes Medien-Element bauen (Bild / Datei-Video / Embed) ------
  // Wird sowohl für das große Titelbild/-video oben (data-hero) als auch für
  // die Galerie darunter (data-gallery) genutzt — beide bekommen dieselben
  // Bild/Video-Typen aus projects.json (cover bzw. media[]).
  function buildMediaFigure(item) {
    if (item.type === "image") {
      var tpl = document.getElementById("media-image-template");
      var node = tpl.content.cloneNode(true);
      var img = node.querySelector("img");
      img.src = item.src;
      img.alt = item.alt || "";
      img.loading = "lazy";
      return { node: node, figure: node.querySelector(".media-item"), lightboxItem: { src: item.src, alt: item.alt || "" } };
    }

    if (item.provider === "youtube" || item.provider === "vimeo") {
      var tplEmbed = document.getElementById("media-video-embed-template");
      var nodeEmbed = tplEmbed.content.cloneNode(true);
      var iframe = nodeEmbed.querySelector("iframe");
      iframe.src = item.src;
      iframe.title = item.alt || "Eingebettetes Video";
      return { node: nodeEmbed, figure: nodeEmbed.querySelector(".media-item"), lightboxItem: null };
    }

    var tplFile = document.getElementById("media-video-file-template");
    var nodeFile = tplFile.content.cloneNode(true);
    var video = nodeFile.querySelector("video");
    video.src = item.src;
    if (item.poster) video.poster = item.poster;
    video.setAttribute("aria-label", item.alt || "Video");
    return { node: nodeFile, figure: nodeFile.querySelector(".media-item"), lightboxItem: null };
  }

  function wireLightboxClick(figure, index, altText) {
    figure.tabIndex = 0;
    figure.setAttribute("role", "button");
    figure.setAttribute("aria-label", "Bild vergrößern: " + (altText || ""));
    figure.addEventListener("click", function () {
      lightbox.open(index, figure);
    });
    figure.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        lightbox.open(index, figure);
      }
    });
  }

  // Baut Titelbild/-video und Galerie und sammelt dabei alle Bilder (Titelbild
  // zuerst, falls es eins ist) in EINER gemeinsamen Lightbox-Liste, damit die
  // Vor-/Zurück-Navigation in der Lightbox über beide Bereiche hinweg passt.
  function renderHeroAndGallery(project) {
    var heroHost = document.querySelector("[data-hero]");
    var galleryHost = document.querySelector("[data-gallery]");
    heroHost.innerHTML = "";
    galleryHost.innerHTML = "";

    var lightboxImages = [];

    function addFigure(host, item) {
      var built = buildMediaFigure(item);
      host.appendChild(built.node);
      if (built.lightboxItem) {
        var index = lightboxImages.length;
        lightboxImages.push(built.lightboxItem);
        wireLightboxClick(built.figure, index, built.lightboxItem.alt);
      }
    }

    var cover = normalizeCover(project.cover);
    if (cover.src) addFigure(heroHost, cover);

    (project.media || []).forEach(function (item) {
      addFigure(galleryHost, item);
    });

    lightbox.setItems(lightboxImages);
  }

  // ---- Externe Links (Website, YouTube, Instagram …) -------------------------
  function renderLinks(links) {
    var host = document.querySelector("[data-detail-links]");
    host.innerHTML = "";
    (links || []).forEach(function (link) {
      if (!link || !link.url) return;
      var a = document.createElement("a");
      a.className = "link-pill";
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      var iconSpan = document.createElement("span");
      iconSpan.setAttribute("aria-hidden", "true");
      iconSpan.innerHTML = ICONS.external;
      a.appendChild(iconSpan);
      a.appendChild(document.createTextNode(link.label || link.url));
      host.appendChild(a);
    });
  }

  // ---- Projekt rendern ------------------------------------------------
  function renderProject(projects, index) {
    var project = projects[index];

    document.title = project.title + " · Dein Name";
    var metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription && project.summary) metaDescription.setAttribute("content", project.summary);

    document.querySelector("[data-detail-category]").textContent = categoryLabel(project.category);
    document.querySelector("[data-detail-title]").textContent = project.title;

    var metaList = document.querySelector("[data-detail-meta]");
    metaList.innerHTML = "";
    [
      createMetaItem("calendar", formatDate(project.date)),
      createMetaItem("pin", project.location),
      createMetaItem("briefcase", project.client),
    ].forEach(function (item) {
      if (item) metaList.appendChild(item);
    });

    var summaryEl = document.querySelector("[data-detail-summary]");
    summaryEl.textContent = project.summary || "";

    renderHeroAndGallery(project);

    var descriptionEl = document.querySelector("[data-detail-description]");
    descriptionEl.innerHTML = "";
    (project.description || []).forEach(function (paragraph) {
      var p = document.createElement("p");
      p.textContent = paragraph;
      descriptionEl.appendChild(p);
    });

    var tagsEl = document.querySelector("[data-detail-tags]");
    tagsEl.innerHTML = "";
    (project.tags || []).forEach(function (tag) {
      var span = document.createElement("span");
      span.className = "tag";
      span.textContent = tag;
      tagsEl.appendChild(span);
    });

    renderLinks(project.links);

    var navEl = document.querySelector("[data-detail-nav]");
    if (projects.length > 1) {
      var prevIndex = (index - 1 + projects.length) % projects.length;
      var nextIndex = (index + 1) % projects.length;
      var prevLink = document.querySelector("[data-prev-link]");
      var nextLink = document.querySelector("[data-next-link]");
      prevLink.href = "project.html?id=" + encodeURIComponent(projects[prevIndex].id);
      nextLink.href = "project.html?id=" + encodeURIComponent(projects[nextIndex].id);
      document.querySelector("[data-prev-title]").textContent = projects[prevIndex].title;
      document.querySelector("[data-next-title]").textContent = projects[nextIndex].title;
      navEl.hidden = false;
    } else {
      navEl.hidden = true;
    }

    document.querySelector("[data-loading-state]").hidden = true;
    document.querySelector("[data-project-detail]").hidden = false;
  }

  function showNotFound() {
    document.querySelector("[data-loading-state]").hidden = true;
    document.querySelector("[data-not-found]").hidden = false;
  }

  document.addEventListener("DOMContentLoaded", function () {
    lightbox.init();

    var id = new URLSearchParams(window.location.search).get("id");

    fetch("data/projects.json")
      .then(function (response) {
        if (!response.ok) throw new Error("Netzwerk-Antwort war nicht ok");
        return response.json();
      })
      .then(function (data) {
        var projects = (data && data.projects) || [];
        var index = projects.findIndex(function (p) {
          return p.id === id;
        });
        if (index === -1) {
          showNotFound();
          return;
        }
        renderProject(projects, index);
      })
      .catch(function (error) {
        console.error("Projekt konnte nicht geladen werden:", error);
        showNotFound();
      });
  });
})();
