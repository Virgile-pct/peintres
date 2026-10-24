/* Outils communs : échappement, dates, nombres, notifications. */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});

  // Registres remplis par chaque écran : vues, et réactions aux clics (data-action),
  // aux formulaires (data-form) et aux champs (data-change / data-input).
  Bib.vues = {};
  Bib.actions = {};
  Bib.formulaires = {};
  Bib.changements = {};

  const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);

  const uid = () =>
    window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  const sansAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Clé de comparaison : minuscules, sans accents ni ponctuation (« L'Étranger » = « l etranger »).
  const cle = (s) => sansAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const comparer = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'fr', { sensitivity: 'base' });

  // Une « œuvre » = titre + nom de famille du premier auteur, sans accents ni ponctuation.
  // Ça repère le même livre en poche et en grand format, qui ont deux ISBN différents.
  function cleOeuvre(l) {
    const nom = ((l.auteurs || [])[0] || '').trim().split(/\s+/).pop() || '';
    return `${cle(l.titre)}|${cle(nom)}`;
  }

  // Date du jour au format AAAA-MM-JJ, en heure locale (toISOString donnerait l'heure UTC).
  const aujourdhui = () => new Date().toLocaleDateString('sv-SE');

  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function dateLongue(valeur) {
    if (!valeur) return '';
    if (valeur.length > 10) {
      return new Date(valeur).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    const [a, m, j] = valeur.split('-').map(Number);
    if (!a) return '';
    if (!m) return String(a);
    return `${j ? (j === 1 ? '1er' : j) + ' ' : ''}${MOIS[m - 1]} ${a}`;
  }

  function moisAnnee(valeur) {
    if (!valeur) return '';
    const [a, m] = valeur.slice(0, 7).split('-').map(Number);
    return m ? `${MOIS[m - 1]} ${a}` : String(a);
  }

  function depuis(valeur) {
    if (!valeur) return '';
    const jours = Math.floor((Date.now() - new Date(valeur).getTime()) / 86400000);
    if (jours <= 0) return "aujourd'hui";
    if (jours === 1) return 'hier';
    if (jours < 7) return `il y a ${jours} jours`;
    if (jours < 31) {
      const s = Math.round(jours / 7);
      return `il y a ${s} semaine${s > 1 ? 's' : ''}`;
    }
    if (jours < 365) return `il y a ${Math.max(1, Math.round(jours / 30.4))} mois`;
    const a = Math.floor(jours / 365);
    return `il y a ${a} an${a > 1 ? 's' : ''}`;
  }

  const heure = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const nombre = (n) => new Intl.NumberFormat('fr-FR').format(n);
  const euros = (n) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n);
  // En français, 0 et 1 restent au singulier.
  const pluriel = (n, un, plusieurs) => `${nombre(n)} ${n > 1 ? plusieurs : un}`;

  // « 3 », « 3 et 5 », « 3, 5 et 8 »
  function enumerer(elements) {
    if (elements.length < 2) return elements.join('');
    return `${elements.slice(0, -1).join(', ')} et ${elements[elements.length - 1]}`;
  }

  function hash(s) {
    let h = 2166136261;
    for (const c of String(s)) {
      h ^= c.codePointAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function debounce(fn, ms) {
    let minuteur = null;
    return (...args) => {
      clearTimeout(minuteur);
      minuteur = setTimeout(() => fn(...args), ms);
    };
  }

  function toast(message, { action, surAction, duree = 6000 } = {}) {
    const zone = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    const texte = document.createElement('span');
    texte.textContent = message;
    el.append(texte);
    let fini = false;
    const fermer = () => {
      if (fini) return;
      fini = true;
      el.classList.add('toast--sortie');
      setTimeout(() => el.remove(), 350);
    };
    if (action) {
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.textContent = action;
      bouton.addEventListener('click', () => {
        fermer();
        if (surAction) surAction();
      });
      el.append(bouton);
    }
    zone.append(el);
    setTimeout(fermer, duree);
  }

  function telecharger(nomFichier, contenu, type) {
    const url = URL.createObjectURL(new Blob([contenu], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nomFichier;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  Bib.outils = {
    esc, uid, sansAccents, cle, cleOeuvre, comparer, aujourdhui, dateLongue, moisAnnee, depuis, heure,
    nombre, euros, pluriel, enumerer, hash, debounce, toast, telecharger,
  };
})();
