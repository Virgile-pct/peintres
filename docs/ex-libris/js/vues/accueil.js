/* Accueil : l'état de la bibliothèque en un coup d'œil. */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const { esc, pluriel, nombre, euros, depuis } = Bib.outils;
  const D = Bib.donnees;
  const C = Bib.couverture;

  const LIBELLES_JOURNAL = {
    ajout: 'Ajouté', exemplaire: 'Exemplaire en plus', lecture: 'Lecture', deplacement: 'Rangé',
    retrait: 'Retiré', retour: 'Remis en rayon', suppression: 'Fiche supprimée', import: 'Sauvegarde restaurée',
  };

  function rendreVide(nom) {
    return `<div class="accueil-vide">
      <h1>${esc(nom)} est encore vide.</h1>
      <p>Commence par une étagère : scanne les livres un par un, Ex-libris retrouve tout seul le titre, l'auteur et la couverture.</p>
      <ol class="etapes">
        <li>Branche la douchette, ou prépare la webcam.</li>
        <li>Indique la pièce et l'étagère que tu inventories.</li>
        <li>Scanne les livres à la suite, sans rien taper.</li>
      </ol>
      <a class="bouton" href="#/ajouter?mode=inventaire">Commencer l'inventaire</a>
      <p class="accueil-vide__restaurer">Une sauvegarde existe déjà ? <a href="#/sauvegarde">La restaurer</a></p>
    </div>`;
  }

  function barres(paires, total) {
    const max = Math.max(...paires.map(([, n]) => n), 1);
    return `<ul class="barres">${paires.map(([libelle, n]) => `<li class="barre">
      <span class="barre__libelle">${esc(libelle)}</span>
      <span class="barre__piste"><span class="barre__plein" style="width:${(n / max) * 100}%"></span></span>
      <span class="barre__nombre" title="${Math.round((n / total) * 100)} %">${nombre(n)}</span></li>`).join('')}</ul>`;
  }

  function rendre() {
    const livres = D.presents();
    const nom = D.etat.reglages.nom || 'Ma bibliothèque';
    if (!livres.length) return rendreVide(nom);

    const annee = new Date().getFullYear();
    const enCours = livres.filter((l) => l.statut === 'en-cours');
    const aLire = livres.filter((l) => l.statut === 'a-lire');
    const lusAnnee = livres.filter((l) => l.statut === 'lu' && (l.dateLecture || '').startsWith(String(annee)));
    const recents = [...livres].sort((a, b) => b.dateAjout.localeCompare(a.dateAjout)).slice(0, 18);
    const avecPrix = livres.filter((l) => l.prix > 0);
    const valeur = avecPrix.reduce((s, l) => s + l.prix * (l.exemplaires || 1), 0);
    const objectif = Number(D.etat.reglages[`objectif-${annee}`]) || 0;

    const parGenre = new Map();
    for (const l of livres) parGenre.set(l.genre || 'Sans genre', (parGenre.get(l.genre || 'Sans genre') || 0) + 1);
    const genres = [...parGenre.entries()].sort((a, b) => b[1] - a[1]);
    const genresAffiches = genres.length > 7 ? [...genres.slice(0, 6), ['Autres', genres.slice(6).reduce((s, [, n]) => s + n, 0)]] : genres;

    const lignesPieces = new Map();
    for (const l of livres) if (l.piece) lignesPieces.set(l.piece, (lignesPieces.get(l.piece) || 0) + 1);
    const pieces = [...lignesPieces.entries()].sort((a, b) => b[1] - a[1]);
    const nonRanges = livres.filter((l) => !l.piece && !l.rangement).length;

    const sousPhrase = [
      `${nombre(aLire.length)} dans la pile à lire`,
      `${nombre(enCours.length)} en cours`,
      `${pluriel(lusAnnee.length, 'lu', 'lus')} en ${annee}`,
    ].join(', ');

    return `
      <header class="accueil-entete">
        <h1 class="accueil-phrase">${esc(nom)} compte ${pluriel(livres.length, 'livre', 'livres')}.</h1>
        <p class="accueil-sous">${sousPhrase}.</p>
      </header>

      <section class="accueil-rayon" aria-labelledby="titre-arrivees">
        <div class="etagere__entete"><h2 id="titre-arrivees">Derniers arrivés</h2><a href="#/etageres?tri=ajout&vue=couvertures">Tout voir</a></div>
        ${C.htmlRayon(recents, 'rayon--unique')}
      </section>

      <div class="accueil-grille">
        <section class="bloc bloc--large">
          <h2>En ce moment</h2>
          ${enCours.length ? `<ul class="en-cours">${enCours.map((l) => `<li>
              <button type="button" class="en-cours__livre" data-action="fiche" data-id="${esc(l.id)}">${C.htmlCouverture(l, 'couv--moyenne')}
                <span><strong>${esc(l.titre)}</strong><span>${esc((l.auteurs || []).join(', '))}</span>
                ${l.dateDebut ? `<small>Commencé ${esc(depuis(l.dateDebut))}</small>` : ''}</span></button>
              <button type="button" class="bouton bouton--second" data-action="livre-fini" data-id="${esc(l.id)}">Je l'ai fini</button>
            </li>`).join('')}</ul>`
            : `<p class="bloc__vide">Aucun livre en cours de lecture.</p>
               ${aLire.length ? '<a class="bouton bouton--second" href="#/lecture?pioche=1">Piocher dans la pile à lire</a>' : ''}`}
        </section>

        <section class="bloc">
          <h2>En ${annee}</h2>
          <p class="bloc__chiffre">${pluriel(lusAnnee.length, 'livre lu', 'livres lus')}${objectif ? ` sur ${nombre(objectif)}` : ''}</p>
          ${objectif ? `<div class="jauge" role="progressbar" aria-valuemin="0" aria-valuemax="${objectif}" aria-valuenow="${lusAnnee.length}"><span style="width:${Math.min(100, (lusAnnee.length / objectif) * 100)}%"></span></div>` : ''}
          <p><a href="#/lecture">${objectif ? 'Voir ma lecture' : 'Me fixer un objectif de lecture'}</a></p>
        </section>

        <section class="bloc">
          <h2>Par genre</h2>
          ${barres(genresAffiches, livres.length)}
        </section>

        <section class="bloc">
          <h2>Par pièce</h2>
          ${pieces.length ? barres(pieces, livres.length) : '<p class="bloc__vide">Aucun livre rangé pour l\'instant.</p>'}
          ${nonRanges ? `<p class="bloc__note"><a href="#/etageres?piece=__aucune">${pluriel(nonRanges, 'livre pas encore rangé', 'livres pas encore rangés')}</a></p>` : ''}
        </section>

        ${valeur ? `<section class="bloc">
          <h2>Valeur à neuf</h2>
          <p class="bloc__chiffre">${euros(valeur)}</p>
          <p class="bloc__note">D'après le prix de ${pluriel(avecPrix.length, 'livre', 'livres')}${avecPrix.length < livres.length ? ` (${nombre(livres.length - avecPrix.length)} sans prix connu)` : ''}. Utile pour l'assurance habitation : l'export pour Excel en donne le détail.</p>
        </section>` : ''}

        <section class="bloc${valeur ? '' : ' bloc--large'}">
          <h2>Dernières opérations</h2>
          <ul class="journal">${D.etat.journal.slice(0, 7).map((e) => `<li>
            <span class="journal__type">${esc(LIBELLES_JOURNAL[e.type] || e.type)}</span>
            <span class="journal__quoi">${e.livreId && D.livre(e.livreId)
              ? `<button type="button" class="lien-livre" data-action="fiche" data-id="${esc(e.livreId)}">${esc(e.titre)}</button>`
              : esc(e.titre || '')}${e.detail ? ` <small>${esc(e.detail)}</small>` : ''}</span>
            <span class="journal__quand">${esc(depuis(e.date))}</span></li>`).join('')}</ul>
        </section>
      </div>`;
  }

  Object.assign(Bib.actions, {
    'livre-fini': async (el) => {
      const l = D.livre(el.dataset.id);
      l.statut = 'lu';
      l.dateLecture = l.dateLecture || Bib.outils.aujourdhui();
      await D.enregistrerLivre(l, { type: 'lecture', detail: 'Lu' });
      Bib.fiche.ouvrir(l.id); // pour lui donner une note tout de suite
    },
  });

  Bib.vues.accueil = { titre: 'Accueil', rendre };
})();
