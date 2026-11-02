/*
 * Vue d'ensemble : la bibliothèque d'un seul regard.
 * Le plan des meubles avec leurs livres en miniature, les auteurs les plus présents,
 * la frise des parutions, et la recherche des couvertures qui manquent.
 * Tout est dessiné en SVG (jamais de canvas) ; chaque élément mène aux livres concernés.
 */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const { esc, nombre, pluriel, comparer, euros, toast } = Bib.outils;
  const D = Bib.donnees;
  const C = Bib.couverture;

  const SANS_GENRE = '__aucun';
  const lienEtageres =(params) => `#/etageres?${new URLSearchParams({ vue: 'couvertures', ...params })}`;

  // ---------- Chiffres ----------

  // Épaisseur réelle approchée : une feuille fait 0,1 mm (deux pages), plus 2 mm de couverture.
  const epaisseurMm = (l) => ((l.pages || 220) / 2) * 0.1 + 2;

  function chiffres(livres) {
    const pages = livres.reduce((s, l) => s + (l.pages || 0), 0);
    const annees = livres.map((l) => parseInt(l.annee, 10)).filter((a) => a > 1000);
    const avecPrix = livres.filter((l) => l.prix > 0);
    return {
      auteurs: new Set(livres.flatMap((l) => l.auteurs || [])).size,
      series: new Set(livres.map((l) => l.serie).filter(Boolean)).size,
      pages,
      metres: livres.reduce((s, l) => s + epaisseurMm(l) * (l.exemplaires || 1), 0) / 1000,
      // Une page toutes les 1 min 30, le rythme d'un roman lu tranquillement.
      heures: Math.round((pages * 1.5) / 60),
      plusAncien: annees.length ? Math.min(...annees) : null,
      plusRecent: annees.length ? Math.max(...annees) : null,
      valeur: avecPrix.reduce((s, l) => s + l.prix * (l.exemplaires || 1), 0),
      avecPrix: avecPrix.length,
    };
  }

  function rendreChiffres(livres, c) {
    const tuiles = [
      [`${nombre(Math.round(c.metres * 10) / 10)} m`, 'de rayonnages, si on mettait tous les livres bout à bout'],
      [nombre(c.pages), `pages, soit environ ${nombre(c.heures)} heures de lecture`],
      [nombre(c.auteurs), `auteurs différents${c.series ? `, et ${pluriel(c.series, 'série', 'séries')}` : ''}`],
      c.plusAncien ? [`${c.plusAncien} – ${c.plusRecent}`, 'du livre le plus ancien au plus récent'] : null,
      c.valeur ? [euros(c.valeur), `de valeur à neuf, d'après les ${nombre(c.avecPrix)} livres dont le prix est connu`] : null,
    ].filter(Boolean);
    return `<div class="tuiles">${tuiles.map(([grand, petit]) => `<div class="tuile">
      <span class="tuile__grand">${esc(grand)}</span><span class="tuile__petit">${esc(petit)}</span></div>`).join('')}</div>`;
  }

  // ---------- Plan des meubles ----------

  // « Grande bibliothèque gauche, étagère 6 » → meuble « Grande bibliothèque gauche », étagère 6.
  function decouper(rangement) {
    const m = String(rangement || '').match(/^(.*?),?\s*(?:étagère|etagere|rayon|planche)\s*(\d+)\s*$/i);
    return m ? { meuble: m[1].trim() || rangement, numero: Number(m[2]) } : { meuble: rangement || 'Sans meuble', numero: 0 };
  }

  function plan(livres) {
    const pieces = new Map();
    for (const l of livres) {
      if (!l.piece && !l.rangement) continue;
      const piece = l.piece || 'Sans pièce';
      const { meuble, numero } = decouper(l.rangement);
      if (!pieces.has(piece)) pieces.set(piece, new Map());
      const meubles = pieces.get(piece);
      if (!meubles.has(meuble)) meubles.set(meuble, new Map());
      const etageres = meubles.get(meuble);
      if (!etageres.has(numero)) etageres.set(numero, { numero, rangement: l.rangement, livres: [] });
      etageres.get(numero).livres.push(l);
    }
    return pieces;
  }

  const LARGEUR = 300; // largeur utile d'une étagère dessinée
  const HAUT_RANG = 34; // hauteur d'une rangée

  function svgMeuble(nom, etageres) {
    const rangs = [...etageres.values()].sort((a, b) => a.numero - b.numero);
    rangs.forEach((r) => r.livres.sort((a, b) => (a.dateAjout || '').localeCompare(b.dateAjout || '')));
    const plusLarge = Math.max(...rangs.map((r) => r.livres.reduce((s, l) => s + epaisseurMm(l), 0)), 1);
    const echelle = Math.min(1.2, (LARGEUR - 8) / plusLarge); // px par mm
    const hauteur = rangs.length * HAUT_RANG + 10;
    const lignes = rangs.map((r, i) => {
      const y = 6 + i * HAUT_RANG;
      let x = 30;
      const dos = r.livres.map((l) => {
        const w = Math.max(1, epaisseurMm(l) * echelle);
        const h = Math.round(Math.min(26, Math.max(17, (l.hauteur || 18) * 1.05)));
        const rect = `<rect x="${x.toFixed(1)}" y="${y + HAUT_RANG - 6 - h}" width="${Math.max(0.8, w - 0.6).toFixed(1)}" height="${h}" fill="${C.toile(l)[0]}"/>`;
        x += w;
        return rect;
      }).join('');
      const titre = `${r.rangement || nom} : ${pluriel(r.livres.length, 'livre', 'livres')}`;
      return `<a href="${esc(lienEtageres({ rangement: r.rangement || '' }))}" class="plan__rang" aria-label="${esc(titre)}">
        <title>${esc(titre)}</title>
        <rect class="plan__survol" x="24" y="${y}" width="${LARGEUR + 10}" height="${HAUT_RANG}" rx="3"/>
        <text class="plan__numero" x="14" y="${y + HAUT_RANG - 10}" text-anchor="middle">${r.numero || ''}</text>
        ${dos}
        <rect class="plan__planche" x="26" y="${y + HAUT_RANG - 6}" width="${LARGEUR + 6}" height="3"/>
        <text class="plan__compte" x="${LARGEUR + 40}" y="${y + HAUT_RANG - 10}">${r.livres.length}</text>
      </a>`;
    }).join('');
    const total = rangs.reduce((s, r) => s + r.livres.length, 0);
    return `<figure class="meuble">
      <figcaption><strong>${esc(nom)}</strong><span>${pluriel(total, 'livre', 'livres')}, ${pluriel(rangs.length, 'étagère', 'étagères')}</span></figcaption>
      <svg viewBox="0 0 ${LARGEUR + 64} ${hauteur}" role="group" aria-label="${esc(nom)}">
        <rect class="plan__montant" x="22" y="2" width="4" height="${hauteur - 4}"/>
        <rect class="plan__montant" x="${LARGEUR + 32}" y="2" width="4" height="${hauteur - 4}"/>
        ${lignes}
      </svg>
    </figure>`;
  }

  function rendrePlan(livres) {
    const pieces = plan(livres);
    if (!pieces.size) return '<p class="bloc__vide">Aucun livre n\'est encore rangé sur une étagère.</p>';
    return [...pieces.entries()].sort((a, b) => comparer(a[0], b[0])).map(([piece, meubles]) => `
      <div class="plan__piece">
        ${pieces.size > 1 ? `<h3>${esc(piece)}</h3>` : ''}
        <div class="plan__meubles">${[...meubles.entries()].sort((a, b) => comparer(a[0], b[0]))
          .map(([nom, etageres]) => svgMeuble(nom, etageres)).join('')}</div>
      </div>`).join('');
  }

  // ---------- Classements ----------

  function compter(livres, valeurs) {
    const m = new Map();
    for (const l of livres) for (const v of valeurs(l)) if (v) m.set(v, (m.get(v) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || comparer(a[0], b[0]));
  }

  function barresLiens(paires, lien) {
    const max = Math.max(...paires.map(([, n]) => n), 1);
    return `<ul class="barres">${paires.map(([libelle, n]) => `<li><a class="barre barre--lien" href="${esc(lien(libelle))}">
      <span class="barre__libelle">${esc(libelle)}</span>
      <span class="barre__piste"><span class="barre__plein" style="width:${(n / max) * 100}%"></span></span>
      <span class="barre__nombre">${nombre(n)}</span></a></li>`).join('')}</ul>`;
  }

  // ---------- Genres manquants ----------

  // Un genre est proposé quand les autres livres du même auteur (ou, à défaut, de la même
  // collection) en ont un très majoritaire. Rien n'est appliqué sans son accord.
  const PART_MINIMALE = 0.7;

  function genreDominant(livres, valeur, minimum) {
    const parValeur = new Map();
    for (const l of livres) {
      const v = valeur(l);
      if (!v || !l.genre) continue;
      if (!parValeur.has(v)) parValeur.set(v, new Map());
      const genres = parValeur.get(v);
      genres.set(l.genre, (genres.get(l.genre) || 0) + 1);
    }
    const dominant = new Map();
    for (const [v, genres] of parValeur) {
      const total = [...genres.values()].reduce((s, n) => s + n, 0);
      const [genre, n] = [...genres.entries()].sort((a, b) => b[1] - a[1])[0];
      if (total >= minimum && n / total >= PART_MINIMALE) dominant.set(v, { genre, n, total });
    }
    return dominant;
  }

  function propositionsGenres(livres) {
    const auteur = (l) => (l.auteurs || [])[0] || '';
    const parAuteur = genreDominant(livres, auteur, 2);
    const parCollection = genreDominant(livres, (l) => l.collection, 5);
    return livres.filter((l) => !l.genre).map((l) => {
      const a = parAuteur.get(auteur(l));
      if (a) return { livre: l, genre: a.genre, raison: `${a.n} autres livres de ${auteur(l)} sur ${a.total}` };
      const c = parCollection.get(l.collection);
      if (c) return { livre: l, genre: c.genre, raison: `${c.n} livres de la collection ${l.collection} sur ${c.total}` };
      return null;
    }).filter(Boolean).sort((x, y) => comparer(x.genre, y.genre) || comparer(x.livre.titre, y.livre.titre));
  }

  function rendrePropositionsGenres(livres) {
    const sans = livres.filter((l) => !l.genre).length;
    if (!sans) return '';
    const propositions = propositionsGenres(livres);
    if (!propositions.length) {
      return `<p class="bloc__note">${pluriel(sans, 'livre n\'a', 'livres n\'ont')} pas de genre, et rien ne permet d'en deviner un. Tu peux le choisir dans la fiche de chaque livre.</p>`;
    }
    return `<details class="genres-proposes">
      <summary>${pluriel(sans, 'livre n\'a', 'livres n\'ont')} pas de genre. Ex-libris en propose un pour ${nombre(propositions.length)}.</summary>
      <p class="bloc__note">D'après les autres livres du même auteur ou de la même collection. Décoche ceux qui ne conviennent pas.</p>
      <ul class="genres-proposes__liste">${propositions.map((p) => `<li><label class="case-a-cocher">
        <input type="checkbox" checked data-id="${esc(p.livre.id)}" data-genre="${esc(p.genre)}">
        <span><strong>${esc(p.livre.titre || 'Sans titre')}</strong> → ${esc(p.genre)}<small>${esc(p.raison)}</small></span></label></li>`).join('')}</ul>
      <button type="button" class="bouton" data-action="appliquer-genres">Appliquer les genres cochés</button>
    </details>`;
  }

  // ---------- Frise des parutions ----------

  function rendreFrise(livres) {
    const parDecennie = new Map();
    for (const l of livres) {
      const a = parseInt(l.annee, 10);
      if (a > 1000) parDecennie.set(Math.floor(a / 10) * 10, (parDecennie.get(Math.floor(a / 10) * 10) || 0) + 1);
    }
    if (!parDecennie.size) return '<p class="bloc__vide">Les années de parution ne sont pas connues.</p>';
    const debut = Math.min(...parDecennie.keys());
    const fin = Math.max(...parDecennie.keys());
    const decennies = [];
    for (let d = debut; d <= fin; d += 10) decennies.push(d);
    const max = Math.max(...parDecennie.values());
    const col = Math.max(22, Math.min(52, 640 / decennies.length));
    const largeur = decennies.length * col;
    const H = 170;
    const barres = decennies.map((d, i) => {
      const n = parDecennie.get(d) || 0;
      const h = n ? Math.max(3, (n / max) * (H - 40)) : 0;
      const x = i * col;
      const titre = `Années ${d} : ${pluriel(n, 'livre', 'livres')}`;
      const etiquette = decennies.length > 12 && i % 2 ? '' : `’${String(d).slice(2)}`;
      return n
        ? `<a href="${esc(lienEtageres({ decennie: String(d), tri: 'annee' }))}" class="frise__col" aria-label="${esc(titre)}"><title>${esc(titre)}</title>
            <rect class="frise__fond" x="${x}" y="0" width="${col}" height="${H}"/>
            <rect class="frise__barre" x="${x + col * 0.18}" y="${H - 22 - h}" width="${col * 0.64}" height="${h}" rx="2"/>
            <text class="frise__nombre" x="${x + col / 2}" y="${H - 28 - h}" text-anchor="middle">${n}</text>
            <text class="frise__annee" x="${x + col / 2}" y="${H - 6}" text-anchor="middle">${etiquette}</text></a>`
        : `<text class="frise__annee" x="${x + col / 2}" y="${H - 6}" text-anchor="middle">${etiquette}</text>`;
    }).join('');
    return `<svg class="frise" viewBox="0 0 ${largeur} ${H}" role="group" aria-label="Livres par décennie de parution">${barres}</svg>`;
  }

  // ---------- Couvertures manquantes ----------

  const recherche = { enCours: false, faits: 0, total: 0, trouvees: 0 };

  const sansCouverture = (livres) => livres.filter((l) => !l.couverture);

  function rendreCouvertures(livres) {
    const manquantes = sansCouverture(livres);
    const jamaisCherchees = manquantes.filter((l) => !l.couvertureCherchee);
    if (recherche.enCours) {
      return `<div class="couv-recherche" id="couv-recherche">${progression()}</div>`;
    }
    if (!manquantes.length) return '<p>Tous les livres ont leur couverture.</p>';
    const parTitre = manquantes.slice(0, 12);
    return `<div class="couv-recherche" id="couv-recherche">
      <p>${pluriel(manquantes.length, 'livre n\'a', 'livres n\'ont')} pas encore de couverture : à la place, Ex-libris en dessine une.
      ${jamaisCherchees.length
        ? `Ex-libris peut en chercher ${jamaisCherchees.length === manquantes.length ? 'une pour chacun' : `pour les ${nombre(jamaisCherchees.length)} pas encore essayés`} sur d'autres catalogues. Ça prend quelques minutes, tu peux continuer à utiliser l'appli pendant ce temps.`
        : 'Les catalogues n\'en ont pas trouvé pour eux. Ce sont souvent des éditions anciennes.'}</p>
      <div class="couv-recherche__apercu">${parTitre.map((l) => `<button type="button" class="couv-recherche__livre" data-action="fiche" data-id="${esc(l.id)}" title="${esc(l.titre)}">${C.htmlCouverture(l, 'couv--mini')}</button>`).join('')}</div>
      <p class="couv-recherche__actions">
        ${jamaisCherchees.length ? `<button type="button" class="bouton" data-action="chercher-couvertures">Chercher les couvertures</button>` : ''}
        ${manquantes.length > jamaisCherchees.length ? `<button type="button" class="bouton bouton--discret" data-action="chercher-couvertures" data-toutes="1">Réessayer pour tous</button>` : ''}
      </p>
    </div>`;
  }

  function progression() {
    const pct = recherche.total ? Math.round((recherche.faits / recherche.total) * 100) : 0;
    return `<p><strong>Recherche des couvertures…</strong> ${nombre(recherche.faits)} sur ${nombre(recherche.total)},
      ${pluriel(recherche.trouvees, 'couverture trouvée', 'couvertures trouvées')}.</p>
      <div class="jauge" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>`;
  }

  async function chercherCouvertures(toutes) {
    if (recherche.enCours) return;
    const cibles = sansCouverture(D.presents()).filter((l) => toutes || !l.couvertureCherchee);
    Object.assign(recherche, { enCours: true, faits: 0, total: cibles.length, trouvees: 0 });
    majProgression();
    let enAttente = [];
    const enregistrer = async () => {
      const lot = enAttente;
      enAttente = [];
      await D.enregistrerPlusieurs(lot);
    };
    let i = 0;
    // Quatre recherches à la fois : assez rapide, sans bombarder les catalogues.
    const ouvrier = async () => {
      while (i < cibles.length) {
        const l = cibles[i++];
        let url = '';
        try { url = await Bib.catalogues.retrouverCouverture(l); } catch (e) { url = ''; }
        if (url) { l.couverture = url; recherche.trouvees++; }
        l.couvertureCherchee = new Date().toISOString();
        enAttente.push(l);
        recherche.faits++;
        if (enAttente.length >= 25) await enregistrer();
        majProgression();
      }
    };
    try {
      await Promise.all([ouvrier(), ouvrier(), ouvrier(), ouvrier()]);
      await enregistrer();
    } finally {
      recherche.enCours = false;
    }
    toast(`${pluriel(recherche.trouvees, 'couverture retrouvée', 'couvertures retrouvées')} sur ${nombre(recherche.total)}.`);
    if (Bib.app.vueCourante() === 'ensemble') Bib.app.afficher({ garderDefilement: true });
  }

  function majProgression() {
    const zone = document.getElementById('couv-recherche');
    if (zone && recherche.enCours) zone.innerHTML = progression();
  }

  // ---------- Écran ----------

  function rendre() {
    const livres = D.presents();
    if (!livres.length) {
      return `<div class="vide"><h1>Vue d'ensemble</h1><p>Elle se remplira au fil des livres ajoutés.</p>
        <a class="bouton" href="#/ajouter?mode=inventaire">Commencer l'inventaire</a></div>`;
    }
    const c = chiffres(livres);
    const auteurs = compter(livres, (l) => l.auteurs || []).slice(0, 15);
    const editeurs = compter(livres, (l) => [l.editeur]).slice(0, 10);
    const genres = compter(livres, (l) => [l.genre || 'Sans genre']);

    return `
      <header class="entete">
        <div>
          <h1>Vue d'ensemble</h1>
          <p>${pluriel(livres.length, 'livre', 'livres')}, d'un seul regard. Touche un élément pour voir les livres qu'il contient.</p>
        </div>
      </header>

      ${rendreChiffres(livres, c)}

      <section class="bloc bloc--plan">
        <h2>Les meubles, étagère par étagère</h2>
        <p class="bloc__note bloc__note--haut">Chaque trait est un livre, dans l'ordre où il a été scanné, avec l'épaisseur de son nombre de pages et la couleur de sa couverture dessinée.</p>
        ${rendrePlan(livres)}
      </section>

      <div class="accueil-grille ensemble-grille">
        <section class="bloc">
          <h2>Les auteurs les plus présents</h2>
          ${barresLiens(auteurs, (a) => lienEtageres({ auteur: a, tri: 'auteur' }))}
        </section>

        <section class="bloc">
          <h2>Années de parution</h2>
          ${rendreFrise(livres)}
          <p class="bloc__note">Par décennie. Touche une colonne pour voir les livres de ces années-là.</p>
        </section>

        <section class="bloc">
          <h2>Les éditeurs</h2>
          ${barresLiens(editeurs, (e) => lienEtageres({ editeur: e }))}
        </section>

        <section class="bloc">
          <h2>Les genres</h2>
          ${barresLiens(genres, (g) => (g === 'Sans genre' ? lienEtageres({ genre: SANS_GENRE }) : lienEtageres({ genre: g })))}
          ${rendrePropositionsGenres(livres)}
        </section>

        <section class="bloc bloc--large">
          <h2>Les couvertures</h2>
          ${rendreCouvertures(livres)}
        </section>
      </div>`;
  }

  Object.assign(Bib.actions, {
    'appliquer-genres': async (el) => {
      const cases = [...el.closest('.genres-proposes').querySelectorAll('input[type="checkbox"]:checked')];
      const livres = cases.map((c) => {
        const l = D.livre(c.dataset.id);
        if (l && !l.genre) l.genre = c.dataset.genre;
        return l;
      }).filter(Boolean);
      await D.enregistrerPlusieurs(livres);
      toast(`${pluriel(livres.length, 'genre ajouté', 'genres ajoutés')}.`);
    },
    'chercher-couvertures': (el) => {
      chercherCouvertures(Boolean(el.dataset.toutes)).catch((e) => {
        console.error(e);
        recherche.enCours = false;
        toast("La recherche des couvertures s'est interrompue. Tu peux la relancer.");
      });
      majProgression();
      const zone = document.getElementById('couv-recherche');
      if (zone) zone.innerHTML = progression();
    },
  });

  Bib.vues.ensemble = {
    titre: "Vue d'ensemble",
    rendre,
    // Pendant la recherche des couvertures, on ne redessine que la jauge.
    surChangement: () => (recherche.enCours ? majProgression() : Bib.app.afficher({ garderDefilement: true })),
  };
})();
