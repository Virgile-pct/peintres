/*
 * Codes-barres des livres.
 * Le gencod (EAN-13) d'un livre EST son ISBN-13 : il commence par 978 ou 979.
 * Les livres d'avant 2007 portent aussi un ancien ISBN-10, que la BnF utilise encore
 * pour les retrouver : on sait passer de l'un à l'autre.
 */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});

  const chiffres = (s) => String(s ?? '').toUpperCase().replace(/[^0-9X]/g, '');

  // Clé EAN-13 : poids 1 et 3 en alternance, puis complément à 10.
  function cleEan13(douze) {
    let somme = 0;
    for (let i = 0; i < 12; i++) somme += Number(douze[i]) * (i % 2 ? 3 : 1);
    return String((10 - (somme % 10)) % 10);
  }

  // Clé ISBN-10 : poids de 10 à 2, modulo 11 ; « 10 » s'écrit X.
  function cleIsbn10(neuf) {
    let somme = 0;
    for (let i = 0; i < 9; i++) somme += Number(neuf[i]) * (10 - i);
    const c = (11 - (somme % 11)) % 11;
    return c === 10 ? 'X' : String(c);
  }

  const ean13Valide = (c) => /^\d{13}$/.test(c) && cleEan13(c) === c[12];
  const isbn10Valide = (c) => /^\d{9}[\dX]$/.test(c) && cleIsbn10(c) === c[9];

  function versIsbn13(isbn10) {
    const douze = '978' + isbn10.slice(0, 9);
    return douze + cleEan13(douze);
  }

  // Seuls les ISBN en 978 ont un équivalent à 10 chiffres (les 979 sont nés après 2007).
  function versIsbn10(isbn13) {
    if (!isbn13 || !isbn13.startsWith('978')) return null;
    const neuf = isbn13.slice(3, 12);
    return neuf + cleIsbn10(neuf);
  }

  /** Dit ce qu'est une saisie (douchette, webcam ou clavier). */
  function analyser(saisie) {
    let c = chiffres(saisie);
    // Certaines douchettes lisent aussi le petit code prix collé à droite (EAN-13 + 2 ou + 5).
    if (/^\d{15}$|^\d{18}$/.test(c)) c = c.slice(0, 13);
    if (c.length === 10 && isbn10Valide(c)) return { type: 'isbn', isbn: versIsbn13(c), isbn10: c };
    if (c.length === 13 && ean13Valide(c)) {
      if (/^97[89]/.test(c)) return { type: 'isbn', isbn: c, isbn10: versIsbn10(c) };
      if (c.startsWith('977')) return { type: 'revue', ean: c };
      return { type: 'ean', ean: c };
    }
    return { type: 'invalide', brut: c };
  }

  // Une saisie du comptoir est un code si elle n'est faite que de chiffres (et tirets, espaces).
  const ressembleACode = (s) => /^[\d\s-]+[\dXx]?$/.test(String(s).trim()) && chiffres(s).length >= 10;

  Bib.isbn = { analyser, chiffres, versIsbn10, versIsbn13, ean13Valide, ressembleACode };
})();
