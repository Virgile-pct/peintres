/* Séries : les tomes possédés, ceux qui manquent, et le suivant à guetter. */
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
      g.max = entiers.length ? Math.max(...entiers) : 0;
      const possedes = new Set(entiers);
      g.manquants = [];
      for (let i = 1; i <= g.max; i++) if (!possedes.has(i)) g.manquants.push(i);
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

  function rendre(p) {
    const series = calculer();
    const incompletes = series.filter((g) => g.manquants.length);
    const affichees = p.toutes === '1' ? series : incompletes.length ? incompletes : series;
    if (!series.length) {
      return `<header class="entete"><div><h1>Séries</h1></div></header>
        <div class="vide"><p>Aucune série pour l'instant. Quand tu ajoutes un livre qui fait partie d'une série (Harry Potter, Astérix…), la BnF l'indique et il apparaît ici avec ses tomes manquants.</p></div>`;
    }
    return `
      <header class="entete">
        <div><h1>Séries</h1><p>${pluriel(series.length, 'série', 'séries')}, dont ${pluriel(incompletes.length, 'incomplète', 'incomplètes')}.</p></div>
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
      }).join('')}</div>`;
  }

  async function ajouterEnvies(g, tomes) {
    for (const tome of tomes) {
      await D.enregistrerEnvie({ id: uid(), titre: `${g.nom}, tome ${tome}`, auteurs: g.auteurs, serie: g.nom, tome: String(tome), origine: 'serie' });
    }
  }

  Object.assign(Bib.actions, {
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

  Bib.vues.series = { titre: 'Séries', rendre, calculer };
})();
