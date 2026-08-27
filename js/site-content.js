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
  // Icons für die Social-Links im Kontakt-Bereich. Welches Icon verwendet
  // wird, entscheidet detectPlatform() anhand von Label/URL — bei
  // unbekannten Plattformen greift "generic" (einfacher Link-Pfeil).
  var SOCIAL_ICONS = {
    instagram:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1"/></svg>',
    youtube:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10.3 9.2v5.6l4.9-2.8-4.9-2.8Z" fill="currentColor" stroke="none"/></svg>',
    vimeo:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9.5"/><path d="M10 8.5v7l6-3.5-6-3.5Z" fill="currentColor" stroke="none"/></svg>',
    linkedin:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9.5"/><text x="12" y="16" text-anchor="middle" font-size="9" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700" fill="currentColor" stroke="none">in</text></svg>',
    tiktok:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9.5"/><path d="M13 7.2v7.3a2.4 2.4 0 1 1-2-2.36"/><path d="M13 7.2c.3 1.7 1.4 2.8 3 3.1"/></svg>',
    facebook:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9.5"/><path d="M13.5 16.5v-4.8h1.8l.3-2.2h-2.1V8.1c0-.6.2-1 1.1-1h1.1V5.1c-.2 0-.9-.1-1.7-.1-1.7 0-2.9 1-2.9 2.9v1.6H9.2v2.2h1.9v4.8"/></svg>',
    twitter:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l16 16M20 4 4 20"/></svg>',
    mail:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
    generic:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>',
  };

  // Erkennt die Plattform anhand von Label-Text und/oder URL — funktioniert
  // also unabhängig davon, wie genau im Editor das Label geschrieben wurde.
  function detectPlatform(label, url) {
    var text = ((label || "") + " " + (url || "")).toLowerCase();
    if (text.indexOf("instagram") > -1) return "instagram";
    if (text.indexOf("youtube") > -1 || text.indexOf("youtu.be") > -1) return "youtube";
    if (text.indexOf("vimeo") > -1) return "vimeo";
    if (text.indexOf("linkedin") > -1) return "linkedin";
    if (text.indexOf("tiktok") > -1) return "tiktok";
    if (text.indexOf("facebook") > -1) return "facebook";
    if (text.indexOf("twitter") > -1 || text.indexOf("x.com") > -1) return "twitter";
    if (text.indexOf("mailto:") > -1 || text.indexOf("@") > -1) return "mail";
    return "generic";
  }

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
      renderEmphasis($("[data-site-hero-heading]"), site.hero.heading);
      var lede = $("[data-site-hero-lede]");
      if (lede) lede.textContent = site.hero.lede || "";
    }

    // ---- Portrait (nur index.html, erscheint im Hero) ----
    if (site.about) {
      var aboutImg = $("[data-site-about-image]");
      if (aboutImg && site.about.image) {
        aboutImg.src = site.about.image.src || "";
        aboutImg.alt = site.about.image.alt || "";
      }
    }

    // ---- Bereiche-Karten im Hero (nur index.html) ----
    // Kategorie/Icon kommen aus dem HTML (data-service="…"); Text,
    // Werkzeug-Tags UND die Reihenfolge (Editor: ↑↓) kommen aus site.json —
    // die Reihenfolge wird über CSS "order" nach dem Array-Index gesetzt,
    // ohne die Elemente im DOM selbst umzusortieren.
    (site.services || []).forEach(function (service, index) {
      var card = document.querySelector('[data-service="' + service.category + '"]');
      if (!card) return;
      card.style.order = index;
      var textEl = card.querySelector("[data-service-text]");
      if (textEl) textEl.textContent = service.text || "";
      var toolsEl = card.querySelector("[data-service-tools]");
      if (toolsEl) {
        toolsEl.innerHTML = "";
        (service.tools || []).forEach(function (tool) {
          var span = document.createElement("span");
          span.className = "tag";
          span.textContent = tool;
          toolsEl.appendChild(span);
        });
      }
    });

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
          var platform = detectPlatform(entry.label, entry.url);
          a.innerHTML = SOCIAL_ICONS[platform] || SOCIAL_ICONS.generic;
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

    // ---- Rechtliches (nur impressum.html/datenschutz.html) ----
    // Name/Adresse sind Pflichtangaben nach § 5 TMG und stehen deshalb auf
    // beiden Seiten mehrfach — daher $all() statt $(). Ohne Eintrag bleibt
    // der eckige Platzhalter als Erinnerung stehen (siehe Editor, Tab
    // "Rechtliches"). Telefon/USt-ID sind optional — ohne Eintrag verschwindet
    // die jeweilige Zeile/der Absatz komplett, statt eine leere Angabe zu zeigen.
    if (site.legal) {
      var legal = site.legal;
      $all("[data-site-legal-name]").forEach(function (el) { el.textContent = legal.name || "[Vorname Nachname]"; });
      $all("[data-site-legal-street]").forEach(function (el) { el.textContent = legal.street || "[Straße Hausnummer]"; });
      $all("[data-site-legal-zip-city]").forEach(function (el) { el.textContent = legal.zipCity || "[PLZ Ort]"; });
      $all("[data-site-legal-hosting]").forEach(function (el) { el.textContent = legal.hostingProvider || "[Name des Hosting-Anbieters]"; });

      $all("[data-site-legal-phone-row]").forEach(function (row) {
        row.hidden = !legal.phone;
        var el = row.querySelector("[data-site-legal-phone]");
        if (el) el.textContent = legal.phone || "";
      });
      $all("[data-site-legal-vat-row]").forEach(function (row) {
        row.hidden = !legal.vatId;
        var el = row.querySelector("[data-site-legal-vat]");
        if (el) el.textContent = legal.vatId || "";
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
