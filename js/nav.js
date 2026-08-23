/**
 * nav.js
 * Steuert das mobile Ausklapp-Menü (Hamburger-Button) im Header.
 * Wird auf allen Seiten geladen.
 */
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.querySelector("[data-nav-toggle]");
    var nav = document.querySelector("[data-nav-links]");
    if (!toggle || !nav) return;

    function closeNav() {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    function toggleNav() {
      var isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    }

    toggle.addEventListener("click", toggleNav);

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeNav();
    });
  });
})();
