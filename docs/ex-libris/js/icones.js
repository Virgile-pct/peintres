/* Icônes au trait, dessinées en SVG (jamais de canvas). */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const trait = (chemins) => `<svg viewBox="0 0 24 24" aria-hidden="true" class="icone">${chemins}</svg>`;

  Bib.icones = {
    accueil: trait('<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v12h13V9"/><path d="M10 21v-6h4v6"/>'),
    ajouter: trait('<path d="M4 5v14M7 5v14M10.5 5v14M14 5v14M17 5v14M20 5v14"/>'),
    etageres: trait('<path d="M3 21h18M3 3h18"/><rect x="5" y="7" width="3" height="14"/><rect x="9" y="5.5" width="3" height="15.5"/><path d="m14.2 8.6 2.9-.8 3.6 13.4-2.9.8z"/>'),
    lecture: trait('<path d="M12 6.5C10 5 7 4.5 3 5v13.5c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5Z"/><path d="M12 6.5V20"/>'),
    series: trait('<rect x="3" y="4" width="4" height="16"/><rect x="8.5" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16" stroke-dasharray="2 2"/>'),
    envies: trait('<path d="M6.5 3h11v18l-5.5-4.2L6.5 21Z"/>'),
    sauvegarde: trait('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v3.5h16V17"/>'),
    camera: trait('<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    chercher: trait('<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/>'),
    fermer: trait('<path d="M6 6l12 12M18 6 6 18"/>'),
    etoile: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 17l-5.7 3.3 1.4-6.4-4.9-4.4 6.5-.7z"/></svg>',
  };
})();
