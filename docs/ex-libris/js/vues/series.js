/*
 * Séries : les tomes possédés, ceux qui manquent, et le suivant à guetter.
 * Les magazines ont leur propre liste : on y compte les numéros manquants entre le premier et le
 * dernier possédés (une collection commence rarement au n° 1), regroupés en plages.
 */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const { esc, cle, comparer, pluriel, enumerer, uid, toast } = Bib.outils;
  const D = Bib.donnees;
  const C = Bib.couverture;

  const MAX_AFFICHE = 60; // au-delà, on ne dessine pas chaque case manquante

  const numero = (t) => {
    const n = parseFloat(String(t ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  };

  function calculer() {
    const groupes = new Map();
    for (const l of D.presents()) {
      if (!l.serie) continue;
      const k = cle(l.serie);
      if (!groupes.has(k)) groupes.set(k, { cle: k, nom: l.serie, livres: [] });
      groupes.get(k).livres.push(l);
    }
    return [...groupes.values()].map((g) => {
      g.livres.sort((a, b) => (numero(a.tome) || Infinity) - (numero(b.tome) || Infinity) || comparer(a.titre, b.titre));
      const entiers = g.livres.map((l) => numero(l.tome)).filter((n) => Number.isInteger(n) && n > 0);
      g.magazine = g.livres.every((l) => l.genre === 'Magazine');
      g.max = entiers.length ? Math.max(...entiers) : 0;
      g.min = entiers.length ? Math.min(...entiers) : 0;
      const possedes = new Set(entiers);
      g.manquants = [];
      for (let i = g.magazine ? g.min : 1; i <= g.max; i++) if (!possedes.has(i)) g.manquants.push(i);
      g.auteurs = [...new Set(g.livres.flatMap((l) => l.auteurs || []))].slice(0, 3);
      return g;
    }).sort((a, b) => (b.manquants.length > 0) - (a.manquants.length > 0) || comparer(a.nom, b.nom));
  }

  const dejaEnvie = (g, tome) => D.etat.envies.some((e) => cle(e.serie) === g.cle && String(e.tome) === String(tome));

  function rendreTomes(g) {
    if (g.max > MAX_AFFICHE) {
      return `<div class="serie__tomes">${g.livres.map((l) => tomeCase(l)).join('')}</div>`;
    }
    const parNumero = new Map();
    const autres = [];
    for (const l of g.livres) {
      const n = numero(l.tome);
      if (Number.isInteger(n) && n > 0 && !parNumero.has(n)) parNumero.set(n, l);
      else autres.push(l);
    }
    const cases = [];
    for (let i = 1; i <= g.max; i++) {
      cases.push(parNumero.has(i)
        ? tomeCase(parNumero.get(i))
        : `<span class="tome tome--manquant${dejaEnvie(g, i) ? ' tome--envie' : ''}" title="${dejaEnvie(g, i) ? 'Sur ta liste d\'envies' : 'Manquant'}"><span class="tome__vide">${i}</span><span class="tome__numero">${dejaEnvie(g, i) ? 'en envie' : 'manque'}</span></span>`);
    }
    return `<div class="serie__tomes">${cases.join('')}${autres.map(tomeCase).join('')}</div>`;
  }

  function tomeCase(l) {
    return `<button type="button" class="tome" data-action="fiche" data-id="${esc(l.id)}" title="${esc(l.titre)}">
      ${C.htmlCouverture(l, 'couv--tome')}<span class="tome__numero">${l.tome ? `tome ${esc(l.tome)}` : 'hors série'}</span></button>`;
  }

  function bilan(g) {
    if (!g.max) return `${pluriel(g.livres.length, 'livre', 'livres')}, sans numéro de tome.`;
    if (!g.manquants.length) return `Complète jusqu'au tome ${g.max}.`;
    if (g.manquants.length > 12) return `Il manque ${g.manquants.length} tomes entre le 1 et le ${g.max}.`;
    return g.manquants.length === 1
      ? `Il te manque le tome ${g.manquants[0]}.`
      : `Il te manque les tomes ${enumerer(g.manquants.map(String))}.`;
  }

  // [312, 313, 314, 320] → « 312 à 314, 320 »
  function plages(nombres) {
    const morceaux = [];
    for (let i = 0; i < nombres.length; i++) {
      let j = i;
      while (j + 1 < nombres.length && nombres[j + 1] === nombres[j] + 1) j++;
      morceaux.push(j > i + 1 ? `${nombres[i]} à ${nombres[j]}` : j > i ? `${nombres[i]}, ${nombres[j]}` : String(nombres[i]));
      i = j;
    }
    return morceaux;
  }

  function rendreMagazine(g) {
    const morceaux = plages(g.manquants);
    const affiches = morceaux.slice(0, 40);
    const lien = `#/etageres?${new URLSearchParams({ vue: 'liste', q: g.nom })}`;
    return `<article class="serie serie--magazine">
      <header class="serie__entete">
        <h2>${esc(g.nom)}</h2>
        <p>${pluriel(g.livres.length, 'numéro', 'numéros')}${!g.max ? '' : g.min === g.max ? `, le n° ${g.max}` : `, du n° ${g.min} au n° ${g.max}`}</p>
      </header>
      <p class="serie__bilan">${!g.max ? 'Aucun numéro n\'est indiqué.'
        : !g.manquants.length ? `Aucun numéro ne manque entre le n° ${g.min} et le n° ${g.max}.`
        : `Il manque ${pluriel(g.manquants.length, 'numéro', 'numéros')} : n° ${esc(affiches.join(', '))}${morceaux.length > affiches.length ? '…' : ''}`}</p>
      <div class="resultat__actions ecran-seulement">
        <a class="bouton bouton--discret" href="${esc(lien)}">Voir les numéros</a>
      </div>
    </article>`;
  }

  function rendre(p) {
    const toutes = calculer();
    const magazines = toutes.filter((g) => g.magazine);
    const series = toutes.filter((g) => !g.magazine);
    const blocMagazines = magazines.length ? `
      <section class="magazines-manquants">
        <div class="magazines-manquants__entete">
          <h2>Magazines</h2>
          <button type="button" class="bouton bouton--second ecran-seulement" data-action="imprimer-magazines">Imprimer les numéros manquants</button>
        </div>
        <p class="imprime-seulement">Numéros manquants des magazines, le ${esc(Bib.outils.dateLongue(Bib.outils.aujourdhui()))}</p>
        <div class="series">${magazines.map(rendreMagazine).join('')}</div>
      </section>` : '';
    if (!series.length && magazines.length) {
      return `<header class="entete"><div><h1>Séries</h1><p>${pluriel(magazines.length, 'magazine', 'magazines')}.</p></div></header>${blocMagazines}`;
    }
    const incompletes = series.filter((g) => g.manquants.length);
    const affichees = p.toutes === '1' ? series : incompletes.length ? incompletes : series;
    if (!series.length) {
      return `<header class="entete"><div><h1>Séries</h1></div></header>
        <div class="vide"><p>Aucune série pour l'instant. Quand tu ajoutes un livre qui fait partie d'une série (Harry Potter, Astérix…), la BnF l'indique et il apparaît ici avec ses tomes manquants.</p></div>`;
    }
    return `
      <header class="entete">
        <div><h1>Séries</h1><p>${pluriel(series.length, 'série', 'séries')}, dont ${pluriel(incompletes.length, 'incomplète', 'incomplètes')}${magazines.length ? `, et ${pluriel(magazines.length, 'magazine', 'magazines')}` : ''}.</p></div>
        ${incompletes.length && incompletes.length < series.length ? `<div class="segments" role="group" aria-label="Séries affichées">
          <button type="button" data-action="series-filtre" data-valeur="" aria-pressed="${p.toutes !== '1'}">Incomplètes</button>
          <button type="button" data-action="series-filtre" data-valeur="1" aria-pressed="${p.toutes === '1'}">Toutes</button></div>` : ''}
      </header>
      <div class="series">${affichees.map((g) => {
        const aAjouter = g.manquants.filter((n) => !dejaEnvie(g, n));
        return `<article class="serie">
          <header class="serie__entete">
            <h2>${esc(g.nom)}</h2>
            <p>${esc(g.auteurs.join(', '))}</p>
          </header>
          ${rendreTomes(g)}
          <p class="serie__bilan">${esc(bilan(g))}</p>
          <div class="resultat__actions">
            ${aAjouter.length && aAjouter.length <= 30 ? `<button type="button" class="bouton bouton--second" data-action="envies-manquants" data-serie="${esc(g.cle)}">Mettre ${aAjouter.length > 1 ? 'les tomes manquants' : 'le tome manquant'} dans mes envies</button>` : ''}
            ${g.max && !dejaEnvie(g, g.max + 1) ? `<button type="button" class="bouton bouton--discret" data-action="envie-suivant" data-serie="${esc(g.cle)}">Guetter le tome ${g.max + 1}</button>` : ''}
          </div>
        </article>`;
      }).join('')}</div>
      ${blocMagazines}`;
  }

  async function ajouterEnvies(g, tomes) {
    for (const tome of tomes) {
      await D.enregistrerEnvie({ id: uid(), titre: `${g.nom}, tome ${tome}`, auteurs: g.auteurs, serie: g.nom, tome: String(tome), origine: 'serie' });
    }
  }

  Object.assign(Bib.actions, {
    // Seule la liste des magazines part à l'impression.
    'imprimer-magazines': () => {
      document.body.classList.add('impression-magazines');
      const fin = () => { document.body.classList.remove('impression-magazines'); window.removeEventListener('afterprint', fin); };
      window.addEventListener('afterprint', fin);
      window.print();
    },
    'series-filtre': (el) => Bib.app.aller('series', { toutes: el.dataset.valeur }),
    'envies-manquants': async (el) => {
      const g = calculer().find((x) => x.cle === el.dataset.serie);
      const tomes = g.manquants.filter((n) => !dejaEnvie(g, n));
      await ajouterEnvies(g, tomes);
      toast(`${pluriel(tomes.length, 'tome ajouté', 'tomes ajoutés')} à ta liste d'envies.`);
    },
    'envie-suivant': async (el) => {
      const g = calculer().find((x) => x.cle === el.dataset.serie);
      await ajouterEnvies(g, [g.max + 1]);
      toast(`Le tome ${g.max + 1} de ${g.nom} est sur ta liste d'envies.`);
    },
  });

  Bib.vues.series = { titre: 'Séries', rendre, calculer, plages };
})();
