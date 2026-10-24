/*
 * Couvertures et dos de livres.
 * Sous chaque photo de couverture, une couverture dessinée en SVG attend : si l'image
 * manque ou ne charge pas (hors ligne), on la retire et la couverture dessinée apparaît.
 */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const { esc, hash, cle } = Bib.outils;

  // Toiles de reliure : fond, puis couleur du texte.
  const TOILES = [
    ['#6E2B2E', '#EFE1CF'], ['#24365A', '#E7E2D4'], ['#2F5240', '#ECE5D1'], ['#8A6424', '#F5EEDD'],
    ['#4C5966', '#EEEAE0'], ['#5A3550', '#F0E5DC'], ['#2D5E63', '#E9E8DA'], ['#7A5236', '#F4EADB'],
    ['#5E6233', '#F1EDDC'], ['#3B3B46', '#E8E3D8'], ['#933F2F', '#F6E9DA'], ['#3F4F7A', '#ECE7DA'],
  ];

  // Les livres d'une même série partagent la même toile, comme en vrai.
  function toile(l) {
    const reference = l.serie ? `serie:${cle(l.serie)}` : `${cle(l.titre)}|${cle((l.auteurs || [])[0] || '')}`;
    return TOILES[hash(reference) % TOILES.length];
  }

  function couperLignes(texte, largeurMax, lignesMax) {
    const lignes = [];
    let ligne = '';
    for (const mot of texte.split(/\s+/).filter(Boolean)) {
      if (ligne && (ligne + ' ' + mot).length > largeurMax) {
        lignes.push(ligne);
        ligne = mot;
      } else {
        ligne = ligne ? ligne + ' ' + mot : mot;
      }
    }
    if (ligne) lignes.push(ligne);
    if (lignes.length > lignesMax) {
      lignes.length = lignesMax;
      lignes[lignesMax - 1] = lignes[lignesMax - 1].replace(/\s*\S*$/, '') + '…';
    }
    return lignes;
  }

  function svgCouverture(l) {
    const [fond, encre] = toile(l);
    const lignes = couperLignes(l.titre || 'Sans titre', 14, 4);
    const debut = 72 - ((lignes.length - 1) * 15) / 2;
    const auteur = (l.auteurs || [])[0] || '';
    return `<svg viewBox="0 0 120 180" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="120" height="180" fill="${fond}"/>
      <rect x="8" y="8" width="104" height="164" fill="none" stroke="#B48A3C" stroke-width="0.8" opacity="0.85"/>
      <text x="60" y="${debut}" text-anchor="middle" fill="${encre}" font-family="Spectral, Georgia, serif" font-size="13" font-weight="500">${lignes
        .map((t, i) => `<tspan x="60" dy="${i ? 15 : 0}">${esc(t)}</tspan>`)
        .join('')}</text>
      <path d="M50 ${debut + lignes.length * 15 + 2}h20" stroke="#B48A3C" stroke-width="0.8"/>
      <text x="60" y="152" text-anchor="middle" fill="${encre}" opacity="0.85" font-family="'Atkinson Hyperlegible', sans-serif" font-size="8">${esc(couperLignes(auteur, 24, 1)[0] || '')}</text>
    </svg>`;
  }

  function htmlCouverture(l, classe = '') {
    const photo = l.couverture
      ? `<img src="${esc(l.couverture)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
      : '';
    return `<span class="couv ${classe}" aria-hidden="true">${svgCouverture(l)}${photo}</span>`;
  }

  // Dos : épaisseur d'après le nombre de pages, hauteur d'après le format (en cm) donné par la BnF.
  const PX_PAR_CM = 8;
  const hauteurDos = (l) => Math.round(Math.min(31, Math.max(15, l.hauteur || 21)) * PX_PAR_CM);

  function htmlDos(l) {
    const [fond, encre] = toile(l);
    const epaisseur = Math.round(Math.min(64, Math.max(15, (l.pages || 220) * 0.06 + 10)));
    const hauteur = hauteurDos(l);
    const auteur = ((l.auteurs || [])[0] || '').split(/\s+/).pop();
    const bulle = [l.titre, (l.auteurs || []).join(', ')].filter(Boolean).join(', par ');
    return `<button type="button" class="dos" data-action="fiche" data-id="${esc(l.id)}" data-statut="${esc(l.statut)}"
      style="--toile:${fond};--encre-dos:${encre};width:${epaisseur}px;height:${hauteur}px" title="${esc(bulle)}">
      ${l.statut === 'en-cours' ? '<span class="dos__signet" aria-hidden="true"></span>' : ''}
      <span class="dos__titre${epaisseur < 20 ? ' dos__titre--fin' : ''}">${esc(l.titre)}</span>
      ${epaisseur >= 24 && auteur ? `<span class="dos__auteur">${esc(auteur)}</span>` : ''}
    </button>`;
  }

  // Une couverture qui ne charge pas laisse place à la couverture dessinée.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.parentElement && img.parentElement.classList.contains('couv')) img.remove();
  }, true);
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.parentElement && img.parentElement.classList.contains('couv') && img.naturalWidth < 10) img.remove();
  }, true);

  // Une rangée d'étagère : sa hauteur suit le plus grand livre posé dessus.
  function htmlRayon(livres, classe = '') {
    const rangee = Math.max(...livres.map(hauteurDos), 0) + 44;
    return `<div class="rayon ${classe}" style="--rangee:${rangee}px">${livres
      .map((l) => `<div class="rayon__case">${htmlDos(l)}</div>`).join('')}</div>`;
  }

  Bib.couverture = { htmlCouverture, htmlDos, htmlRayon, svgCouverture, toile };
})();
