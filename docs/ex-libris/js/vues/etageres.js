/*
 * Mes étagères : toute la bibliothèque, en trois présentations.
 *  - « Dos » : les livres debout sur leurs étagères, comme à la maison ;
 *  - « Couvertures » : un mur de couvertures ;
 *  - « Liste » : un tableau qu'on peut trier.
 */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const { esc, cle, comparer, pluriel, debounce } = Bib.outils;
  const D = Bib.donnees;
  const C = Bib.couverture;

  const PAS_RANGES = '__aucune';
  const VUES = [['dos', 'Dos'], ['couvertures', 'Couvertures'], ['liste', 'Liste']];
  const FILTRES_STATUT = [
    ['', 'Toutes les lectures'], ['a-lire', 'À lire'], ['en-cours', 'En cours'], ['lu', 'Lus'],
    ['abandonne', 'Abandonnés'], ['aucun', 'Lecture non précisée'], ['dedicaces', 'Livres dédicacés'], ['retires', 'Livres retirés'],
  ];
  const TRIS = { auteur: 'Auteur', titre: 'Titre', ajout: 'Derniers ajoutés', annee: 'Année de parution' };

  const nombre = (t) => {
    const n = parseFloat(String(t ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : Infinity;
  };
  const nomDeFamille = (l) => ((l.auteurs || [])[0] || '').trim().split(/\s+/).pop() || '';

  const ORDRES = {
    auteur: (a, b) => comparer(nomDeFamille(a), nomDeFamille(b)) || comparer(a.serie, b.serie) || nombre(a.tome) - nombre(b.tome) || comparer(a.titre, b.titre),
    titre: (a, b) => comparer(cle(a.titre), cle(b.titre)),
    ajout: (a, b) => (b.dateAjout || '').localeCompare(a.dateAjout || ''),
    annee: (a, b) => (b.annee || '').localeCompare(a.annee || '') || comparer(a.titre, b.titre),
  };

  function filtrer(p) {
    let liste = p.statut === 'retires' ? D.etat.livres.filter((l) => l.sorti) : D.presents();
    const mots = cle(p.q || '').split(' ').filter(Boolean);
    if (mots.length) {
      liste = liste.filter((l) => {
        const texte = cle([l.titre, l.sousTitre, (l.auteurs || []).join(' '), l.serie, l.editeur, l.collection, l.isbn, l.genre].join(' '));
        return mots.every((m) => texte.includes(m));
      });
    }
    if (p.genre) liste = liste.filter((l) => l.genre === p.genre);
    if (p.statut === 'dedicaces') liste = liste.filter((l) => l.dedicace);
    else if (p.statut && p.statut !== 'retires') liste = liste.filter((l) => (l.statut || 'aucun') === p.statut);
    if (p.piece) liste = liste.filter((l) => (p.piece === PAS_RANGES ? !l.piece && !l.rangement : l.piece === p.piece));
    return liste.sort(ORDRES[p.tri] || ORDRES.auteur);
  }

  const options = (liste, choisi) =>
    liste.map(([v, t]) => `<option value="${esc(v)}"${v === (choisi || '') ? ' selected' : ''}>${esc(t)}</option>`).join('');

  function rendre(p) {
    const vue = p.vue || 'dos';
    const genres = D.genres().map((g) => [g, g]);
    const pieces = D.pieces().map((x) => [x, x]);
    return `
      <header class="entete">
        <div>
          <h1>Mes étagères</h1>
          <p id="compte-etageres">${compte(p)}</p>
        </div>
        <div class="segments" role="group" aria-label="Présentation">${VUES.map(
          ([v, t]) => `<button type="button" data-action="vue-etageres" data-valeur="${v}" aria-pressed="${vue === v}">${t}</button>`
        ).join('')}</div>
      </header>
      <div class="filtres">
        <label class="filtres__recherche">${Bib.icones.chercher}
          <input type="search" data-input="filtre-texte" value="${esc(p.q || '')}" placeholder="Titre, auteur, série, ISBN…" aria-label="Chercher dans la bibliothèque" spellcheck="false"></label>
        <select class="saisie" data-change="filtre" data-cle="genre" aria-label="Genre">${options([['', 'Tous les genres'], ...genres], p.genre)}</select>
        <select class="saisie" data-change="filtre" data-cle="statut" aria-label="Lecture">${options(FILTRES_STATUT, p.statut)}</select>
        <select class="saisie" data-change="filtre" data-cle="piece" aria-label="Pièce">${options([['', 'Toutes les pièces'], ...pieces, [PAS_RANGES, 'Pas encore rangés']], p.piece)}</select>
        ${vue === 'liste' ? '' : `<select class="saisie" data-change="filtre" data-cle="tri" aria-label="Ordre">${options(Object.entries(TRIS), p.tri || 'auteur')}</select>`}
      </div>
      <div id="resultats-etageres">${rendreResultats(p)}</div>`;
  }

  function compte(p) {
    const total = D.presents().length;
    const filtre = p.q || p.genre || p.statut || p.piece;
    if (!filtre) return `${pluriel(total, 'livre', 'livres')} dans la bibliothèque.`;
    const n = filtrer(p).length;
    return `${pluriel(n, 'livre trouvé', 'livres trouvés')} sur ${pluriel(total, 'livre', 'livres')}.`;
  }

  function rendreResultats(p) {
    if (!D.etat.livres.length) {
      return `<div class="vide"><p>Les étagères sont vides pour l'instant.</p><a class="bouton" href="#/ajouter?mode=inventaire">Inventorier une première étagère</a></div>`;
    }
    const liste = filtrer(p);
    if (!liste.length) {
      return `<div class="vide"><p>Aucun livre ne correspond${p.q ? ` à « ${esc(p.q)} »` : ''}.</p><button type="button" class="bouton bouton--second" data-action="effacer-filtres">Effacer la recherche et les filtres</button></div>`;
    }
    const vue = p.vue || 'dos';
    if (vue === 'couvertures') return rendreMur(liste);
    if (vue === 'liste') return rendreTableau(liste, p);
    return rendreDos(liste);
  }

  function rendreDos(liste) {
    const groupes = new Map();
    for (const l of liste) {
      const k = `${l.piece || ''}\u0000${l.rangement || ''}`;
      if (!groupes.has(k)) groupes.set(k, { piece: l.piece || '', rangement: l.rangement || '', livres: [] });
      groupes.get(k).livres.push(l);
    }
    const ordonnes = [...groupes.values()].sort((a, b) => {
      const aRien = !a.piece && !a.rangement;
      const bRien = !b.piece && !b.rangement;
      return aRien - bRien || comparer(a.piece, b.piece) || comparer(a.rangement, b.rangement);
    });
    return ordonnes.map((g) => {
      const titre = g.piece || g.rangement ? esc(g.piece || g.rangement) : 'Pas encore rangés';
      const meuble = g.piece && g.rangement ? `<span class="etagere__meuble">${esc(g.rangement)}</span>` : '';
      return `<section class="etagere">
        <div class="etagere__entete"><h2>${titre}${meuble}</h2><span>${pluriel(g.livres.length, 'livre', 'livres')}</span></div>
        ${C.htmlRayon(g.livres)}
      </section>`;
    }).join('');
  }

  function marqueLecture(l) {
    if (l.statut === 'lu') return l.note ? Bib.fiche.etoilesTexte(l.note) : '<span class="marque-lecture">Lu</span>';
    if (l.statut === 'en-cours') return '<span class="marque-lecture marque-lecture--en-cours">En cours</span>';
    if (l.statut === 'a-lire') return '<span class="marque-lecture marque-lecture--a-lire">À lire</span>';
    return '';
  }

  function rendreMur(liste) {
    return `<div class="mur">${liste.map((l) => `
      <button type="button" class="mur__livre" data-action="fiche" data-id="${esc(l.id)}">
        ${C.htmlCouverture(l)}
        <span class="mur__titre">${esc(l.titre)}</span>
        <span class="mur__auteur">${esc((l.auteurs || []).join(', '))}</span>
        ${marqueLecture(l)}
      </button>`).join('')}</div>`;
  }

  function rendreTableau(liste, p) {
    const tri = p.tri || 'auteur';
    const entete = (cleTri, libelle) =>
      `<th scope="col" aria-sort="${tri === cleTri ? 'ascending' : 'none'}"><button type="button" data-action="trier" data-valeur="${cleTri}">${libelle}</button></th>`;
    return `<div class="tableau-cadre"><table class="tableau">
      <thead><tr><th scope="col"><span class="lecteur-ecran">Couverture</span></th>${entete('titre', 'Titre')}${entete('auteur', 'Auteur')}<th scope="col">Série</th><th scope="col">Rangement</th><th scope="col">Lecture</th>${entete('annee', 'Année')}${entete('ajout', 'Ajouté')}</tr></thead>
      <tbody>${liste.map((l) => `<tr data-action="fiche" data-id="${esc(l.id)}">
        <td>${C.htmlCouverture(l, 'couv--mini')}</td>
        <td><button type="button" class="lien-livre" data-action="fiche" data-id="${esc(l.id)}">${esc(l.titre)}</button></td>
        <td>${esc((l.auteurs || []).join(', '))}</td>
        <td>${l.serie ? `${esc(l.serie)}${l.tome ? ` (${esc(l.tome)})` : ''}` : ''}</td>
        <td>${esc(D.emplacement(l))}</td>
        <td>${marqueLecture(l)}</td>
        <td>${esc(l.annee)}</td>
        <td>${esc((l.dateAjout || '').slice(0, 10).split('-').reverse().join('/'))}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function majResultats() {
    const p = Bib.app.params();
    const zone = document.getElementById('resultats-etageres');
    if (zone) zone.innerHTML = rendreResultats(p);
    const c = document.getElementById('compte-etageres');
    if (c) c.textContent = compte(p);
  }

  const rechercheDifferee = debounce((valeur) => {
    Bib.app.majParams({ q: valeur });
    majResultats();
  }, 180);

  Object.assign(Bib.changements, {
    'filtre-texte': (el) => rechercheDifferee(el.value),
    'filtre': (el) => {
      Bib.app.majParams({ [el.dataset.cle]: el.value });
      majResultats();
    },
  });

  Object.assign(Bib.actions, {
    'vue-etageres': (el) => Bib.app.aller('etageres', { ...Bib.app.params(), vue: el.dataset.valeur }),
    'trier': (el) => {
      Bib.app.majParams({ tri: el.dataset.valeur });
      majResultats();
    },
    'effacer-filtres': () => Bib.app.aller('etageres', { vue: Bib.app.params().vue }),
  });

  Bib.vues.etageres = {
    titre: 'Mes étagères',
    rendre,
    // Après une modification, seuls les livres sont redessinés : la recherche en cours garde le curseur.
    surChangement: () => majResultats(),
  };
})();
