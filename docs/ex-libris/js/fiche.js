/*
 * Fiche d'un livre, dans un panneau qui glisse depuis la droite.
 * Chaque champ s'enregistre dès qu'on le quitte : pas de bouton « Enregistrer » à oublier.
 */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const { esc, dateLongue, euros, aujourdhui, toast, depuis } = Bib.outils;
  const D = Bib.donnees;
  const C = Bib.couverture;

  const STATUTS = [['a-lire', 'À lire'], ['en-cours', 'En cours'], ['lu', 'Lu'], ['abandonne', 'Abandonné']];
  const LIBELLES_STATUT = Object.fromEntries(STATUTS);
  const MOTIFS = ['Donné', 'Vendu', 'Prêté sans retour', 'Perdu', 'Abîmé'];
  const SOURCES = { bnf: 'Bibliothèque nationale de France', openlibrary: 'Open Library', google: 'Google Books', manuel: 'saisie à la main' };

  let ouvertId = null;
  let retourFocus = null;

  const tiroir = () => document.getElementById('tiroir');
  const voile = () => document.getElementById('voile');

  function etoiles(note, action = 'note') {
    return `<span class="etoiles" role="group" aria-label="Note sur 5">${[1, 2, 3, 4, 5]
      .map((n) => `<button type="button" class="${n <= note ? 'pleine' : ''}" data-action="${action}" data-valeur="${n}" aria-label="${n} sur 5" aria-pressed="${n === note}">${Bib.icones.etoile}</button>`)
      .join('')}</span>`;
  }

  function etoilesTexte(note) {
    return note ? `<span class="etoiles-texte" aria-label="${note} sur 5">${'★'.repeat(note)}<span>${'★'.repeat(5 - note)}</span></span>` : '';
  }

  function rendreHaut(l) {
    const meta = [l.editeur, l.collection, l.annee, l.pages ? `${l.pages} pages` : ''].filter(Boolean).join(', ');
    return `${C.htmlCouverture(l, 'couv--fiche')}
      <div class="tiroir__identite">
        <h2 class="tiroir__titre">${esc(l.titre || 'Sans titre')}</h2>
        ${l.sousTitre ? `<p class="tiroir__sous-titre">${esc(l.sousTitre)}</p>` : ''}
        ${l.auteurs.length ? `<p class="tiroir__auteurs">${esc(l.auteurs.join(', '))}</p>` : ''}
        ${meta ? `<p class="tiroir__meta">${esc(meta)}</p>` : ''}
        ${l.serie ? `<p class="tiroir__serie"><a href="#/series">${esc(l.serie)}</a>${l.tome ? `, tome ${esc(l.tome)}` : ''}</p>` : ''}
      </div>`;
  }

  function rendreLecture(l) {
    const date = (champ, libelle) =>
      `<label class="champ"><span>${libelle}</span><input type="date" class="saisie" data-champ="${champ}" value="${esc(l[champ])}"></label>`;
    return `<h3>Lecture</h3>
      <div class="segments" role="group" aria-label="Où en est la lecture">${STATUTS.map(
        ([v, t]) => `<button type="button" data-action="statut" data-valeur="${v}" aria-pressed="${l.statut === v}">${t}</button>`
      ).join('')}</div>
      <div class="tiroir__ligne">
        ${l.statut === 'en-cours' || l.statut === 'lu' ? date('dateDebut', 'Commencé le') : ''}
        ${l.statut === 'lu' ? date('dateLecture', 'Fini le') : ''}
      </div>
      ${l.statut === 'lu' || l.statut === 'abandonne' ? `<div class="champ"><span>Ma note</span>${etoiles(l.note)}</div>` : ''}
      ${l.statut && l.statut !== 'a-lire' ? `<label class="champ"><span>Mon avis</span><textarea class="saisie" data-champ="avis" rows="4" placeholder="Ce que j'en ai pensé, une citation…">${esc(l.avis)}</textarea></label>` : ''}`;
  }

  function champ(l, nom, libelle, { type = 'text', liste = '', large = false, aide = '' } = {}) {
    const valeur = nom === 'auteurs' ? l.auteurs.join(', ') : l[nom] ?? '';
    return `<label class="champ${large ? ' champ--large' : ''}"><span>${libelle}</span>
      <input class="saisie" type="${type}" data-champ="${nom}" value="${esc(valeur)}"${liste ? ` list="${liste}"` : ''}${type === 'number' ? ' min="0" step="any"' : ''}>
      ${aide ? `<small>${aide}</small>` : ''}</label>`;
  }

  function rendre(l) {
    const source = SOURCES[l.source] || l.source;
    const lienBnf = l.ark ? ` <a href="${esc(l.ark)}" target="_blank" rel="noopener">Voir la notice</a>` : '';
    return `
      <button type="button" class="tiroir__fermer" data-action="fermer-fiche" aria-label="Fermer la fiche">${Bib.icones.fermer}</button>
      <div class="tiroir__haut" data-zone="haut">${rendreHaut(l)}</div>
      ${l.sorti ? `<div class="tiroir__sorti"><p>Retiré de la bibliothèque le ${esc(dateLongue(l.sorti.date))} (${esc(l.sorti.motif.toLowerCase())}).</p>
        <button type="button" class="bouton bouton--second" data-action="remettre-livre">Le remettre dans la bibliothèque</button></div>` : ''}
      <section data-zone="lecture">${rendreLecture(l)}</section>
      <section>
        <h3>Rangement</h3>
        <div class="grille-champs">
          ${champ(l, 'piece', 'Pièce', { liste: 'liste-pieces' })}
          ${champ(l, 'rangement', 'Meuble ou étagère', { liste: 'liste-rangements' })}
          ${champ(l, 'exemplaires', 'Exemplaires', { type: 'number' })}
        </div>
      </section>
      <section>
        <h3>Fiche du livre</h3>
        <div class="grille-champs">
          ${champ(l, 'titre', 'Titre', { large: true })}
          ${champ(l, 'sousTitre', 'Sous-titre', { large: true })}
          ${champ(l, 'auteurs', 'Auteurs', { large: true, aide: 'Séparés par des virgules.' })}
          ${champ(l, 'serie', 'Série')}
          ${champ(l, 'tome', 'Tome')}
          ${champ(l, 'genre', 'Genre', { liste: 'liste-genres' })}
          ${champ(l, 'editeur', 'Éditeur')}
          ${champ(l, 'collection', 'Collection')}
          ${champ(l, 'annee', 'Année')}
          ${champ(l, 'pages', 'Pages', { type: 'number' })}
          ${champ(l, 'hauteur', 'Hauteur (cm)', { type: 'number' })}
          ${champ(l, 'prix', 'Prix neuf (€)', { type: 'number' })}
          ${champ(l, 'isbn', 'ISBN (code-barres)')}
          ${champ(l, 'couverture', 'Adresse de l\'image de couverture', { large: true, type: 'url' })}
        </div>
        <label class="champ champ--large"><span>Notes personnelles</span>
          <textarea class="saisie" data-champ="remarques" rows="3" placeholder="Offert par…, dédicacé, à relire l'été…">${esc(l.remarques)}</textarea></label>
        ${l.resume ? `<details class="tiroir__resume"><summary>Résumé de l'éditeur</summary><p>${esc(l.resume)}</p></details>` : ''}
      </section>
      <section class="tiroir__pied">
        <p>Ajouté ${esc(depuis(l.dateAjout))} (${esc(dateLongue(l.dateAjout))}). Fiche : ${esc(source)}.${lienBnf}</p>
        ${l.sorti ? '' : `<details class="tiroir__retrait">
          <summary>Retirer ce livre de la bibliothèque</summary>
          <p>Il disparaît des étagères mais reste dans l'historique : si tu le rescannes un jour, Ex-libris s'en souviendra.</p>
          <div class="tiroir__ligne">
            <label class="champ"><span>Pourquoi ?</span><select class="saisie" id="motif-retrait">${MOTIFS.map((m) => `<option>${m}</option>`).join('')}</select></label>
            <button type="button" class="bouton bouton--second" data-action="retirer-livre">Retirer</button>
          </div>
        </details>`}
        <button type="button" class="bouton bouton--discret" data-action="supprimer-fiche">Supprimer cette fiche (erreur de saisie)</button>
      </section>`;
  }

  function ouvrir(id) {
    const l = D.livre(id);
    if (!l) return;
    if (!ouvertId) retourFocus = document.activeElement;
    ouvertId = id;
    const t = tiroir();
    t.innerHTML = rendre(l);
    t.hidden = false;
    voile().hidden = false;
    t.scrollTop = 0;
    // Deux images d'attente : le panneau doit exister hors écran avant de glisser.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      t.classList.add('ouvert');
      voile().classList.add('ouvert');
    }));
    t.querySelector('.tiroir__fermer').focus({ preventScroll: true });
  }

  function fermer() {
    if (!ouvertId) return;
    ouvertId = null;
    tiroir().classList.remove('ouvert');
    voile().classList.remove('ouvert');
    setTimeout(() => {
      if (ouvertId) return;
      tiroir().hidden = true;
      voile().hidden = true;
      tiroir().innerHTML = '';
    }, 600);
    if (retourFocus && document.contains(retourFocus)) retourFocus.focus({ preventScroll: true });
    retourFocus = null;
  }

  const livreOuvert = () => (ouvertId ? D.livre(ouvertId) : null);

  function majZone(zone, html) {
    const el = tiroir().querySelector(`[data-zone="${zone}"]`);
    if (el) el.innerHTML = html;
  }

  function convertir(nom, valeur) {
    const v = String(valeur).trim();
    if (nom === 'auteurs') return v.split(',').map((a) => a.trim()).filter(Boolean);
    if (nom === 'pages' || nom === 'hauteur') return v ? Math.round(Number(v)) || null : null;
    if (nom === 'exemplaires') return Math.max(1, Math.round(Number(v)) || 1);
    if (nom === 'prix') return v ? Number(v.replace(',', '.')) || null : null;
    if (nom === 'isbn') {
      const a = Bib.isbn.analyser(v);
      return a.isbn || a.ean || Bib.isbn.chiffres(v);
    }
    return v;
  }

  // Enregistrement champ par champ, au moment où on quitte le champ.
  document.addEventListener('change', async (e) => {
    const el = e.target.closest('#tiroir [data-champ]');
    const l = livreOuvert();
    if (!el || !l) return;
    const nom = el.dataset.champ;
    const valeur = convertir(nom, el.value);
    if (JSON.stringify(valeur) === JSON.stringify(l[nom])) return;
    l[nom] = valeur;
    const evenement = nom === 'piece' || nom === 'rangement' ? { type: 'deplacement', detail: D.emplacement(l) || 'pas rangé' } : null;
    await D.enregistrerLivre(l, evenement);
    if (['titre', 'sousTitre', 'auteurs', 'editeur', 'collection', 'annee', 'pages', 'serie', 'tome', 'couverture'].includes(nom)) {
      majZone('haut', rendreHaut(l));
    }
    el.classList.add('saisie--enregistree');
    setTimeout(() => el.classList.remove('saisie--enregistree'), 1200);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ouvertId) fermer();
  });

  Bib.actions = Bib.actions || {};
  Object.assign(Bib.actions, {
    'fiche': (el) => ouvrir(el.dataset.id),
    'fermer-fiche': () => fermer(),

    'statut': async (el) => {
      const l = livreOuvert();
      const v = el.dataset.valeur;
      l.statut = l.statut === v ? '' : v;
      if (l.statut === 'en-cours' && !l.dateDebut) l.dateDebut = aujourdhui();
      if (l.statut === 'lu' && !l.dateLecture) l.dateLecture = aujourdhui();
      await D.enregistrerLivre(l, { type: 'lecture', detail: LIBELLES_STATUT[l.statut] || 'statut effacé' });
      majZone('lecture', rendreLecture(l));
      const bouton = tiroir().querySelector(`[data-action="statut"][data-valeur="${v}"]`);
      if (bouton) bouton.focus({ preventScroll: true });
    },

    'note': async (el) => {
      const l = livreOuvert();
      const n = Number(el.dataset.valeur);
      l.note = l.note === n ? 0 : n;
      await D.enregistrerLivre(l);
      majZone('lecture', rendreLecture(l));
    },

    'retirer-livre': async () => {
      const l = livreOuvert();
      const motif = document.getElementById('motif-retrait').value;
      l.sorti = { date: aujourdhui(), motif };
      await D.enregistrerLivre(l, { type: 'retrait', detail: motif });
      fermer();
      toast(`« ${l.titre} » est retiré de la bibliothèque.`, {
        action: 'Annuler',
        surAction: async () => {
          l.sorti = null;
          await D.enregistrerLivre(l, { type: 'retour', detail: 'retrait annulé' });
        },
      });
    },

    'remettre-livre': async () => {
      const l = livreOuvert();
      l.sorti = null;
      await D.enregistrerLivre(l, { type: 'retour' });
      ouvrir(l.id);
      toast(`« ${l.titre} » est de retour dans la bibliothèque.`);
    },

    'supprimer-fiche': async (el) => {
      // Deux clics : le premier arme le bouton, le second supprime.
      if (!el.dataset.arme) {
        el.dataset.arme = '1';
        el.textContent = 'Confirmer : supprimer définitivement cette fiche';
        el.classList.add('bouton--alerte');
        return;
      }
      const l = livreOuvert();
      fermer();
      await D.supprimerLivre(l);
      toast(`La fiche « ${l.titre} » est supprimée.`);
    },
  });

  Bib.fiche = { ouvrir, fermer, etoilesTexte, LIBELLES_STATUT, STATUTS };
})();
