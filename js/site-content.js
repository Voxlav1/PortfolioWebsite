/**
 * site-content.js
 * Auf JEDER Seite geladen (index/project/impressum/datenschutz sowie im
 * Editor). Lädt data/site.json und befüllt damit alle Stellen, die sich
 * seitenweit wiederholen — Name im Header, Footer-Copyright — sowie auf
 * index.html zusätzlich Hero, "Über mich" und "Kontakt".
 *
 * Fehlt ein Ziel-Element auf der aktuellen Seite (z. B. hat impressum.html
 * keinen Hero), wird der jeweilige Teil einfach übersprungen — diese Datei
 * kann daher überall gefahrlos eingebunden werden.
 *
 * In Texten macht *Sternchen* ein Wort hervorgehoben (grün/kursiv), z. B.
 * "*Licht*. Bild." — siehe renderEmphasis().
 */
(function () {
  var ICON_EXTERNAL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>';

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  // Wandelt "*Wort*" in <em>Wort</em> um (Rest bleibt reiner Text). Nutzt
  // ausschließlich textContent/createElement statt innerHTML — kein Risiko
  // durch eingegebenes HTML in site.json.
  function renderEmphasis(el, text) {
    if (!el) return;
    el.innerHTML = "";
    (text || "").split(/\*(.+?)\*/g).forEach(function (part, i) {
      if (!part) return;
      if (i % 2 === 1) {
        var em = document.createElement("em");
        em.textContent = part;
        el.appendChild(em);
      } else {
        el.appendChild(document.createTextNode(part));
      }
    });
  }

  function renderParagraphs(container, paragraphs) {
    if (!container) return;
    container.innerHTML = "";
    (paragraphs || []).forEach(function (text) {
      var p = document.createElement("p");
      p.textContent = text;
      container.appendChild(p);
    });
  }

  function applySiteContent(site) {
    // ---- Marke/Logo (jede Seite) ----
    var brandHighlight = $("[data-site-brand-highlight]");
    var brandName = $("[data-site-brand-name]");
    if (site.brand) {
      if (brandName) brandName.textContent = (site.brand.name || "") + " ";
      if (brandHighlight) brandHighlight.textContent = site.brand.highlight || "";
    }

    // ---- Hero (nur index.html) ----
    if (site.hero) {
      var eyebrow = $("[data-site-hero-eyebrow]");
      if (eyebrow) eyebrow.textContent = site.hero.eyebrow || "";
      renderEmphasis($("[data-site-hero-heading]"), site.hero.heading);
      var lede = $("[data-site-hero-lede]");
      if (lede) lede.textContent = site.hero.lede || "";
    }

    // ---- Über mich (nur index.html) ----
    if (site.about) {
      var aboutHeading = $("[data-site-about-heading]");
      if (aboutHeading) aboutHeading.textContent = site.about.heading || "";
      renderParagraphs($("[data-site-about-paragraphs]"), site.about.paragraphs);

      var tagsHost = $("[data-site-about-tags]");
      if (tagsHost) {
        tagsHost.innerHTML = "";
        (site.about.tags || []).forEach(function (tag) {
          var span = document.createElement("span");
          span.className = "tag";
          span.textContent = tag;
          tagsHost.appendChild(span);
        });
      }

      var aboutImg = $("[data-site-about-image]");
      if (aboutImg && site.about.image) {
        aboutImg.src = site.about.image.src || "";
        aboutImg.alt = site.about.image.alt || "";
      }
    }

    // ---- Kontakt (nur index.html) ----
    if (site.contact) {
      var contactHeading = $("[data-site-contact-heading]");
      if (contactHeading) contactHeading.textContent = site.contact.heading || "";
      var contactText = $("[data-site-contact-text]");
      if (contactText) contactText.textContent = site.contact.text || "";

      var emailEl = $("[data-site-contact-email]");
      if (emailEl && site.contact.email) {
        emailEl.textContent = site.contact.email;
        emailEl.href = "mailto:" + site.contact.email;
      }

      var socialHost = $("[data-site-contact-social]");
      if (socialHost) {
        socialHost.innerHTML = "";
        (site.contact.social || []).forEach(function (entry) {
          if (!entry || !entry.url) return;
          var a = document.createElement("a");
          a.href = entry.url;
          a.setAttribute("aria-label", entry.label || "Link");
          if (/^https?:\/\//i.test(entry.url)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
          a.innerHTML = ICON_EXTERNAL;
          socialHost.appendChild(a);
        });
      }
    }

    // ---- Footer (jede Seite) ----
    if (site.footer) {
      $all("[data-site-footer-copyright]").forEach(function (el) {
        el.textContent = site.footer.copyright || "";
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var base = document.body.dataset.sitePrefix || "";
    fetch(base + "data/site.json")
      .then(function (response) {
        if (!response.ok) throw new Error("Netzwerk-Antwort war nicht ok");
        return response.json();
      })
      .then(function (data) { applySiteContent(data || {}); })
      .catch(function (error) {
        console.error("Seiteninhalte (data/site.json) konnten nicht geladen werden:", error);
      });
  });
})();
