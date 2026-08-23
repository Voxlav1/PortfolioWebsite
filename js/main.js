/**
 * main.js
 * Nur auf index.html geladen.
 * Lädt data/projects.json, rendert die Projekt-Kacheln über das
 * <template id="project-card-template"> in index.html und steuert die
 * Filter-Leiste (Alle / Fotografie / Video / Lichttechnik). Die anklickbaren
 * Karten im "Bereiche"-Abschnitt nutzen dieselbe Filterlogik (siehe
 * initBereicheLinks) — neue Kategorie? Auch dort einen data-filter-jump
 * ergänzen (siehe README, Abschnitt 3 "Neue Kategorie hinzufügen").
 *
 * Neues Projekt hinzufügen? Kein Code hier anfassen — einfach einen
 * neuen Eintrag in data/projects.json ergänzen. Siehe README.md.
 */
(function () {
  var CATEGORY_LABELS = {
    fotografie: "Fotografie",
    video: "Video",
    lichttechnik: "Lichttechnik",
  };

  function categoryLabel(category) {
    return CATEGORY_LABELS[category] || category;
  }

  // Erkennt eine YouTube-Video-ID sowohl in normalen als auch in
  // -nocookie-Embed-URLs, um daraus automatisch ein Vorschaubild zu bauen.
  function extractYouTubeId(url) {
    if (!url) return null;
    var match = url.match(/(?:youtube(?:-nocookie)?\.com\/embed\/|youtu\.be\/)([\w-]{6,})/);
    return match ? match[1] : null;
  }

  // Das Titelbild eines Projekts kann laut projects.json ein Bild ODER ein
  // Video sein (Datei/YouTube/Vimeo, siehe README). Für die Kachel hier wird
  // in jedem Fall ein einzelnes Vorschaubild gebraucht:
  //  - Bild: der hinterlegte Pfad
  //  - YouTube-Video: automatisch das offizielle YouTube-Vorschaubild
  //  - Datei-/Vimeo-Video: das optionale "poster"-Feld, sonst ein Platzhalter
  function resolveCoverImageSrc(cover) {
    var type = (cover && cover.type) || "image"; // ältere Projekte ohne "type" = Bild
    if (type !== "video") return cover.src;

    if (cover.provider === "youtube") {
      var id = extractYouTubeId(cover.src);
      if (id) return "https://img.youtube.com/vi/" + id + "/hqdefault.jpg";
    }
    return cover.poster || "assets/images/video-poster.svg";
  }

  function buildCard(project, template) {
    var node = template.content.cloneNode(true);
    var article = node.querySelector(".project-card");
    var link = node.querySelector(".project-card__link");
    var image = node.querySelector(".project-card__image");
    var playBadge = node.querySelector(".project-card__play");
    var coverType = (project.cover && project.cover.type) || "image";

    article.dataset.category = project.category;
    link.href = "project.html?id=" + encodeURIComponent(project.id);
    image.src = resolveCoverImageSrc(project.cover);
    image.alt = (project.cover && project.cover.alt) || project.title;
    playBadge.hidden = coverType !== "video";
    node.querySelector(".project-card__category").textContent = categoryLabel(project.category);
    node.querySelector(".project-card__title").textContent = project.title;

    return node;
  }

  function renderGrid(projects) {
    var grid = document.querySelector("[data-project-grid]");
    var template = document.getElementById("project-card-template");
    var emptyState = document.querySelector("[data-empty-state]");
    if (!grid || !template) return;

    grid.innerHTML = "";
    if (!projects.length) {
      if (emptyState) emptyState.hidden = false;
      return;
    }
    if (emptyState) emptyState.hidden = true;

    var fragment = document.createDocumentFragment();
    projects.forEach(function (project) {
      fragment.appendChild(buildCard(project, template));
    });
    grid.appendChild(fragment);
  }

  // Wird sowohl von den Filter-Buttons als auch von den anklickbaren
  // "Bereiche"-Karten weiter oben auf der Seite genutzt (siehe initBereicheLinks).
  function applyFilter(filter, buttons, projects) {
    buttons.forEach(function (b) {
      var isActive = b.dataset.filter === filter;
      b.classList.toggle("is-active", isActive);
      b.setAttribute("aria-selected", String(isActive));
    });

    var filtered = filter === "alle" ? projects : projects.filter(function (p) {
      return p.category === filter;
    });
    renderGrid(filtered);
  }

  function initFilters(projects) {
    var buttons = document.querySelectorAll("[data-filter]");
    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        applyFilter(button.dataset.filter, buttons, projects);
      });
    });
    return buttons;
  }

  // Macht die Karten im "Bereiche"-Abschnitt anklickbar: Klick wendet den
  // passenden Filter auf das Projekt-Grid an und scrollt sanft zu #arbeiten.
  // Der Sprung wird bewusst selbst ausgelöst (statt sich auf den nativen
  // Anker-Sprung des href zu verlassen), weil das Neuaufbauen des Grids im
  // selben Klick den nativen Scroll in manchen Browsern verhindert.
  function initBereicheLinks(projects, buttons) {
    var links = document.querySelectorAll("[data-filter-jump]");
    var target = document.getElementById("arbeiten");

    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        applyFilter(link.dataset.filterJump, buttons, projects);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        if (history.pushState) history.pushState(null, "", "#arbeiten");
        else window.location.hash = "arbeiten";
      });
    });
  }

  function showLoadError() {
    var grid = document.querySelector("[data-project-grid]");
    if (!grid) return;
    grid.innerHTML =
      '<p class="empty-state" style="grid-column: 1 / -1;">' +
      "Projekte konnten nicht geladen werden. Falls du die Seite lokal per Doppelklick geöffnet hast: " +
      "Browser blockieren das Nachladen von JSON-Dateien über file://. Starte stattdessen einen lokalen " +
      "Server (siehe README.md, Abschnitt „Lokal testen“)." +
      "</p>";
  }

  document.addEventListener("DOMContentLoaded", function () {
    fetch("data/projects.json")
      .then(function (response) {
        if (!response.ok) throw new Error("Netzwerk-Antwort war nicht ok");
        return response.json();
      })
      .then(function (data) {
        var projects = (data && data.projects) || [];
        renderGrid(projects);
        var buttons = initFilters(projects);
        initBereicheLinks(projects, buttons);
      })
      .catch(function (error) {
        console.error("Projekte konnten nicht geladen werden:", error);
        showLoadError();
      });
  });
})();
