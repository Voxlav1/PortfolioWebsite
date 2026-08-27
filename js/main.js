/**
 * main.js
 * Nur auf index.html geladen.
 * Lädt data/projects.json, rendert die Projekt-Kacheln über das
 * <template id="project-card-template"> in index.html und steuert die
 * Filter-Leiste (Alle / Fotografie / Videografie / Lichttechnik). Die
 * anklickbaren kleinen Karten in "Über mich" nutzen dieselbe Filterlogik
 * (siehe initBereicheLinks) — neue Kategorie? Auch dort einen
 * data-filter-jump ergänzen (siehe README, Abschnitt 3 "Neue Kategorie
 * hinzufügen").
 *
 * Neues Projekt hinzufügen? Kein Code hier anfassen — einfach einen
 * neuen Eintrag in data/projects.json ergänzen. Siehe README.md.
 */
(function () {
  var CATEGORY_LABELS = {
    fotografie: "Fotografie",
    videografie: "Videografie",
    lichttechnik: "Lichttechnik",
  };

  function categoryLabel(category) {
    return CATEGORY_LABELS[category] || category;
  }

  // Ein Projekt kann mehreren Kategorien angehören ("categories": [...]).
  // Ältere Einträge kennen noch das einzelne "category"-Feld (inkl. dem
  // inzwischen umbenannten Wert "video") — wird hier automatisch übersetzt,
  // damit beide Schreibweisen funktionieren.
  function getCategories(project) {
    if (Array.isArray(project.categories) && project.categories.length) return project.categories;
    if (project.category) return [project.category === "video" ? "videografie" : project.category];
    return [];
  }

  function categoryLabels(project) {
    return getCategories(project).map(categoryLabel).join(" · ");
  }

  // Das Titelbild eines Projekts ist immer ein Bild (siehe README, Abschnitt
  // "Titelbild") — oder fehlt ganz, dann zeigt die Kachel stattdessen Text
  // (siehe buildCard).
  function resolveCoverImageSrc(cover) {
    return (cover && cover.src) || null;
  }

  function buildCard(project, template) {
    var node = template.content.cloneNode(true);
    var article = node.querySelector(".project-card");
    var link = node.querySelector(".project-card__link");
    var mediaWrap = node.querySelector(".project-card__media");
    var image = node.querySelector(".project-card__image");
    var textCover = node.querySelector(".project-card__text-cover");
    var coverSrc = resolveCoverImageSrc(project.cover);

    article.dataset.category = getCategories(project).join(" ");
    link.href = "project.html?id=" + encodeURIComponent(project.id);

    if (coverSrc) {
      image.src = coverSrc;
      image.alt = (project.cover && project.cover.alt) || project.title;
      textCover.hidden = true;
    } else {
      // Kein Titelbild/-video hinterlegt: Kurzbeschreibung stattdessen zeigen,
      // damit die Kachel nicht leer/kaputt aussieht.
      mediaWrap.classList.add("project-card__media--text");
      image.remove();
      textCover.hidden = false;
      textCover.querySelector("p").textContent = project.summary || project.title;
    }

    node.querySelector(".project-card__category").textContent = categoryLabels(project);
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
  // kleinen Bereiche-Karten in "Über mich" genutzt (siehe initBereicheLinks).
  function applyFilter(filter, buttons, projects) {
    buttons.forEach(function (b) {
      var isActive = b.dataset.filter === filter;
      b.classList.toggle("is-active", isActive);
      b.setAttribute("aria-selected", String(isActive));
    });

    var filtered = filter === "alle" ? projects : projects.filter(function (p) {
      return getCategories(p).indexOf(filter) > -1;
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

  // Macht die kleinen Bereiche-Karten in "Über mich" anklickbar: Klick
  // wendet den passenden Filter auf das Projekt-Grid an und scrollt sanft zu #arbeiten.
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
        var projects = ((data && data.projects) || []).filter(function (p) { return !p.offline; });
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
