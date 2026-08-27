/**
 * theme.js
 * Steuert den Hell/Dunkel-Umschalter im Header — und dessen zweite Kopie im
 * mobilen Ausklapp-Menü (auf schmalen Bildschirmen verschwindet die
 * Header-Variante, siehe style.css). Beide tragen [data-theme-toggle] und
 * werden hier synchron gehalten.
 *
 * Die eigentliche Theme-Erkennung (localStorage bzw. Systempräferenz)
 * passiert bewusst NICHT hier, sondern in einem kleinen Inline-Script im
 * <head> jeder Seite — so wird das Theme gesetzt, BEVOR die Seite
 * gezeichnet wird (kein kurzes "Aufblitzen" des falschen Themes).
 * Dieses Script kümmert sich nur noch um den Klick auf den/die Umschalter.
 */
(function () {
  var STORAGE_KEY = "portfolio-theme";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (err) {
      /* localStorage evtl. nicht verfügbar (z. B. privates Fenster) — kein Problem */
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var toggles = document.querySelectorAll("[data-theme-toggle]");
    if (!toggles.length) return;

    toggles.forEach(function (toggle) {
      toggle.addEventListener("click", function () {
        var current = document.documentElement.getAttribute("data-theme");
        var next = current === "dark" ? "light" : "dark";
        applyTheme(next);
        var label = next === "dark" ? "Zu hellem Design wechseln" : "Zu dunklem Design wechseln";
        toggles.forEach(function (t) { t.setAttribute("aria-label", label); });
      });
    });
  });
})();
