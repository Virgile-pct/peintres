/* Ma lecture : la pile à lire, « que lire ce soir ? », les livres lus et l'objectif de l'année. */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const { esc, pluriel, nombre, depuis, moisAnnee, aujourdhui, comparer } = Bib.outils;
  const D = Bib.donnees;
  const C = Bib.couverture;

  const etat = { tirage: null, longueur: '', genre: '', precedent: null };
  const LONGUEURS = [['', 'Peu importe'], ['court', 'Plutôt court'], ['pave', 'Un pavé']];

  const pile = () => D.presents().filter((l) => l.statut === 'a-lire');

  function candidats() {
    return pile().filter((l) => {
      if (etat.genre && l.genre !== etat.genre) return false;
      if (etat.longueur === 'court') return l.pages && l.pages < 250;
      if (etat.longueur === 'pave') return l.pages && l.pages >= 450;
      return true;
    });
  }

  // Tirage au sort pondéré : plus un livre attend dans la pile, plus il a de chances de sortir.
  function piocher() {
    const liste = candidats().filter((l) => l.id !== etat.precedent || candidats().length === 1);
    if (!liste.length) return null;
    const poids = liste.map((l) => 1 + (Date.now() - new Date(l.dateAjout)) / (180 * 86400000));
    let tirage = Math.random() * poids.reduce((a, b) => a + b, 0);
    for (let i = 0; i < liste.length; i++) {
      tirage -= poids[i];
      if (tirage <= 0) return liste[i];
    }
    return liste[liste.length - 1];
  }

  function graphiqueMois(lus, annee) {
    const parMois = Array(12).fill(0);
    lus.forEach((l) => {
      const m = Number((l.dateLecture || '').slice(5, 7));
      if (m) parMois[m - 1]++;
    });
    const max = Math.max(1, ...parMois);
    const largeur = 480, hauteur = 150, base = 124, barre = 22, pas = largeur / 12;
    return `<svg class="graphique" viewBox="0 0 ${largeur} ${hauteur}" role="img" aria-label="Livres lus chaque mois en ${annee}">
      <line x1="0" x2="${largeur}" y1="${base}" y2="${base}" class="graphique__base"/>
      ${parMois.map((n, i) => {
        const h = n ? Math.max(5, (n / max) * 98) : 0;
        const x = i * pas + (pas - barre) / 2;
        return `${n ? `<rect x="${x}" y="${base - h}" width="${barre}" height="${h}" rx="3" class="graphique__barre"/>
          <text x="${x + barre / 2}" y="${base - h - 7}" class="graphique__valeur">${n}</text>` : ''}
          <text x="${x + barre / 2}" y="${hauteur - 6}" class="graphique__mois">${'JFMAMJJASOND'[i]}</text>`;
      }).join('')}
    </svg>`;
  }

  function anneau(fait, objectif) {
    const r = 52;
    const tour = 2 * Math.PI * r;
    const part = objectif ? Math.min(1, fait / objectif) : 0;
    return `<svg class="anneau" viewBox="0 0 124 124" aria-hidden="true">
      <circle cx="62" cy="62" r="${r}" class="anneau__fond"/>
      <circle cx="62" cy="62" r="${r}" class="anneau__plein" stroke-dasharray="${tour}" stroke-dashoffset="${tour * (1 - part)}" transform="rotate(-90 62 62)"/>
      <text x="62" y="62" class="anneau__nombre">${fait}</text>
      <text x="62" y="84" class="anneau__sur">sur ${objectif}</text>
    </svg>`;
  }

  function rendreTirage() {
    const total = pile().length;
    if (!total) {
      return `<p class="tirage__vide">La pile à lire est vide. Marque un livre « À lire » depuis sa fiche, ou ajoute tes prochains achats.</p>`;
    }
    const l = etat.tirage;
    if (!l) {
      return `<p class="tirage__vide">${pluriel(total, 'livre attend', 'livres attendent')} dans la pile. Laisse le hasard choisir : les livres oubliés depuis longtemps ont un peu plus de chances de sortir.</p>`;
    }
    return `<div class="tirage__livre" data-cle="${esc(l.id)}">
      ${C.htmlCouverture(l, 'couv--grande')}
      <div>
        <h3>${esc(l.titre)}</h3>
        <p class="tirage__auteurs">${esc((l.auteurs || []).join(', '))}</p>
        <p class="tirage__infos">${esc([l.genre, l.pages ? `${l.pages} pages` : '', `dans la pile ${depuis(l.dateAjout)}`].filter(Boolean).join(', '))}</p>
        ${D.emplacement(l) ? `<p class="tirage__infos">Rangé : ${esc(D.emplacement(l))}</p>` : ''}
        <div class="resultat__actions">
          <button type="button" class="bouton" data-action="commencer" data-id="${esc(l.id)}">Je le commence</button>
          <button type="button" class="bouton bouton--second" data-action="piocher">Un autre</button>
        </div>
      </div>
    </div>`;
  }

  function ligneLu(l) {
    return `<li><button type="button" class="ligne-livre" data-action="fiche" data-id="${esc(l.id)}">
      ${C.htmlCouverture(l, 'couv--mini')}
      <span class="ligne-livre__texte"><strong>${esc(l.titre)}</strong><span>${esc((l.auteurs || []).join(', '))}</span></span>
      <span class="ligne-livre__date">${esc(l.dateLecture ? moisAnnee(l.dateLecture) : '')}</span>
      ${Bib.fiche.etoilesTexte(l.note)}
    </button></li>`;
  }

  function rendre(p) {
    if (p.pioche === '1') {
      etat.tirage = piocher();
      Bib.app.majParams({ pioche: '' });
    }
    const annee = new Date().getFullYear();
    const livres = D.presents();
    const enCours = livres.filter((l) => l.statut === 'en-cours');
    const lus = livres.filter((l) => l.statut === 'lu').sort((a, b) => (b.dateLecture || '').localeCompare(a.dateLecture || ''));
    const lusAnnee = lus.filter((l) => (l.dateLecture || '').startsWith(String(annee)));
    const pagesAnnee = lusAnnee.reduce((s, l) => s + (l.pages || 0), 0);
    const objectif = Number(D.etat.reglages[`objectif-${annee}`]) || 0;
    const pileTriee = pile().sort((a, b) => (a.dateAjout || '').localeCompare(b.dateAjout || ''));
    const genresPile = [...new Set(pile().map((l) => l.genre).filter(Boolean))].sort(comparer);

    const parAnnee = new Map();
    for (const l of lus) {
      const a = (l.dateLecture || '').slice(0, 4) || 'Date inconnue';
      if (!parAnnee.has(a)) parAnnee.set(a, []);
      parAnnee.get(a).push(l);
    }

    return `
      <header class="entete"><div><h1>Ma lecture</h1><p>${pluriel(pile().length, 'livre', 'livres')} dans la pile à lire, ${nombre(enCours.length)} en cours.</p></div></header>

      <section class="tirage" aria-labelledby="titre-tirage">
        <div class="tirage__commandes">
          <h2 id="titre-tirage">Que lire ce soir ?</h2>
          <div class="segments" role="group" aria-label="Longueur">${LONGUEURS.map(([v, t]) =>
            `<button type="button" data-action="longueur" data-valeur="${v}" aria-pressed="${etat.longueur === v}">${t}</button>`).join('')}</div>
          ${genresPile.length > 1 ? `<label class="champ"><span>Genre</span><select class="saisie" data-change="genre-tirage">
            <option value="">Tous les genres</option>${genresPile.map((g) => `<option${g === etat.genre ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select></label>` : ''}
          <button type="button" class="bouton" data-action="piocher"${pile().length ? '' : ' disabled'}>Piocher un livre</button>
        </div>
        <div class="tirage__resultat" id="tirage" aria-live="polite">${rendreTirage()}</div>
      </section>

      <section class="section objectif">
        <div class="objectif__anneau">${objectif ? anneau(lusAnnee.length, objectif) : ''}
          <div>
            <h2>En ${annee}</h2>
            <p>${pluriel(lusAnnee.length, 'livre lu', 'livres lus')}${pagesAnnee ? `, soit ${nombre(pagesAnnee)} pages` : ''}.</p>
            <label class="champ champ--court"><span>Mon objectif pour ${annee}</span>
              <input class="saisie" type="number" min="0" inputmode="numeric" data-change="reglage" data-cle="objectif-${annee}" value="${objectif || ''}" placeholder="Nombre de livres"></label>
          </div>
        </div>
        ${graphiqueMois(lusAnnee, annee)}
      </section>

      ${enCours.length ? `<section class="section"><h2>En cours</h2><ul class="lignes-livres">${enCours.map((l) => `<li>
          <button type="button" class="ligne-livre" data-action="fiche" data-id="${esc(l.id)}">${C.htmlCouverture(l, 'couv--mini')}
          <span class="ligne-livre__texte"><strong>${esc(l.titre)}</strong><span>${esc((l.auteurs || []).join(', '))}</span></span>
          <span class="ligne-livre__date">${l.dateDebut ? `commencé ${esc(depuis(l.dateDebut))}` : ''}</span></button>
          <button type="button" class="bouton bouton--second" data-action="livre-fini" data-id="${esc(l.id)}">Je l'ai fini</button></li>`).join('')}</ul></section>` : ''}

      ${pileTriee.length ? `<section class="section"><h2>La pile à lire</h2><p class="section__aide">Les plus anciens d'abord.</p>
        <div class="mur mur--serre">${pileTriee.map((l) => `<button type="button" class="mur__livre" data-action="fiche" data-id="${esc(l.id)}">
          ${C.htmlCouverture(l)}<span class="mur__titre">${esc(l.titre)}</span><span class="mur__auteur">${esc((l.auteurs || []).join(', '))}</span></button>`).join('')}</div></section>` : ''}

      ${lus.length ? `<section class="section"><h2>Mes lectures</h2>${[...parAnnee.entries()].map(([a, liste]) => `
        <details class="annee-lecture"${a === String(annee) || parAnnee.size === 1 ? ' open' : ''}>
          <summary><span>${esc(a)}</span><span>${pluriel(liste.length, 'livre', 'livres')}</span></summary>
          <ul class="lignes-livres">${liste.map(ligneLu).join('')}</ul>
        </details>`).join('')}</section>` : ''}`;
  }

  function majTirage() {
    const zone = document.getElementById('tirage');
    if (zone) zone.innerHTML = rendreTirage();
  }

  Object.assign(Bib.actions, {
    'piocher': () => {
      etat.tirage = piocher();
      if (etat.tirage) etat.precedent = etat.tirage.id;
      else Bib.outils.toast('Aucun livre de la pile ne correspond à ces critères.');
      majTirage();
    },
    'longueur': (el) => {
      etat.longueur = el.dataset.valeur;
      document.querySelectorAll('[data-action="longueur"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
    },
    'commencer': async (el) => {
      const l = D.livre(el.dataset.id);
      l.statut = 'en-cours';
      l.dateDebut = aujourdhui();
      await D.enregistrerLivre(l, { type: 'lecture', detail: 'En cours' });
      etat.tirage = null;
      Bib.outils.toast(`Bonne lecture avec « ${l.titre} » !`);
    },
  });

  Object.assign(Bib.changements, {
    'genre-tirage': (el) => { etat.genre = el.value; },
  });

  Bib.vues.lecture = { titre: 'Ma lecture', rendre };
})();
