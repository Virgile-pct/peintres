/*
 * Envies : les livres à acheter ou à demander en cadeau.
 * La liste s'imprime pour l'emporter en librairie, avec les tomes manquants des séries.
 */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const { esc, uid, toast, pluriel, depuis, euros, aujourdhui } = Bib.outils;
  const D = Bib.donnees;
  const C = Bib.couverture;

  function rendre() {
    const envies = [...D.etat.envies].sort((a, b) => (b.dateAjout || '').localeCompare(a.dateAjout || ''));
    const nom = D.etat.reglages.nom || 'Ma bibliothèque';
    return `
      <header class="entete">
        <div><h1>Envies</h1><p>${envies.length ? `${pluriel(envies.length, 'livre', 'livres')} à acheter ou à demander.` : 'Les livres à acheter ou à demander en cadeau.'}</p></div>
        ${envies.length ? '<button type="button" class="bouton bouton--second" data-action="imprimer">Imprimer la liste pour la librairie</button>' : ''}
      </header>
      <p class="imprime-seulement">${esc(nom)}, liste d'envies du ${esc(Bib.outils.dateLongue(aujourdhui()))}</p>

      <form class="envie-formulaire" data-form="envie" autocomplete="off">
        <label class="champ"><span>Titre</span><input class="saisie" name="titre" required></label>
        <label class="champ"><span>Auteur</span><input class="saisie" name="auteur"></label>
        <label class="champ"><span>Pourquoi, pour qui ? (facultatif)</span><input class="saisie" name="remarque" placeholder="Conseillé par…, pour Noël…"></label>
        <button class="bouton" type="submit">Ajouter</button>
      </form>
      <p class="section__aide ecran-seulement">Astuce : un livre vu chez quelqu'un ? Scanne-le dans « Ajouter des livres » et choisis « Mettre dans mes envies ».</p>

      ${envies.length ? `<ul class="envies">${envies.map((e) => `<li class="envie">
          ${C.htmlCouverture(e, 'couv--moyenne')}
          <div class="envie__texte">
            <h3>${esc(e.titre)}</h3>
            ${(e.auteurs || []).length ? `<p>${esc(e.auteurs.join(', '))}</p>` : ''}
            <p class="envie__details">${esc([e.editeur, e.isbn ? `ISBN ${e.isbn}` : '', e.prix ? euros(e.prix) : ''].filter(Boolean).join(', '))}</p>
            ${e.remarque ? `<p class="envie__remarque">${esc(e.remarque)}</p>` : ''}
            <p class="envie__depuis ecran-seulement">Sur la liste ${esc(depuis(e.dateAjout))}</p>
          </div>
          <div class="envie__actions ecran-seulement">
            <button type="button" class="bouton" data-action="envie-achetee" data-id="${esc(e.id)}">Je l'ai</button>
            <button type="button" class="bouton bouton--discret" data-action="envie-retirer" data-id="${esc(e.id)}">Retirer</button>
          </div>
        </li>`).join('')}</ul>`
      : '<div class="vide"><p>La liste est vide. Ajoute un titre ci-dessus, ou depuis la page Séries pour les tomes manquants.</p></div>'}
      ${rendreManquantsImprimes()}`;
  }

  // Sur la feuille imprimée seulement : les tomes manquants qui ne sont pas déjà dans la liste.
  function rendreManquantsImprimes() {
    const lignes = Bib.vues.series.calculer()
      .map((g) => ({ g, tomes: g.manquants.filter((n) => !D.etat.envies.some((e) => Bib.outils.cle(e.serie) === g.cle && String(e.tome) === String(n))) }))
      .filter(({ tomes }) => tomes.length && tomes.length <= 30);
    if (!lignes.length) return '';
    return `<section class="imprime-seulement"><h2>Tomes manquants de mes séries</h2><ul>${lignes
      .map(({ g, tomes }) => `<li><strong>${esc(g.nom)}</strong> : ${tomes.length > 1 ? 'tomes' : 'tome'} ${esc(Bib.outils.enumerer(tomes.map(String)))}</li>`)
      .join('')}</ul></section>`;
  }

  Object.assign(Bib.formulaires, {
    envie: async (form) => {
      const titre = form.elements.titre.value.trim();
      if (!titre) return;
      const auteur = form.elements.auteur.value.trim();
      await D.enregistrerEnvie({ id: uid(), titre, auteurs: auteur ? [auteur] : [], remarque: form.elements.remarque.value.trim(), origine: 'main' });
      toast(`« ${titre} » ajouté à tes envies.`);
      const champ = document.querySelector('[data-form="envie"] [name="titre"]');
      if (champ) champ.focus();
    },
  });

  Object.assign(Bib.actions, {
    'imprimer': () => window.print(),
    'envie-achetee': async (el) => {
      const e = D.etat.envies.find((x) => x.id === el.dataset.id);
      if (!e) return;
      // Avec un ISBN, on passe par le scan : anti-doublon, fiche complète, et l'envie se raye seule.
      if (e.isbn) return Bib.app.traiterCode(e.isbn);
      const r = D.etat.reglages;
      const l = D.nouveauLivre({
        titre: e.titre, auteurs: e.auteurs, serie: e.serie, tome: e.tome, couverture: e.couverture,
        piece: r.pieceCourante, rangement: r.rangementCourant, statut: 'a-lire', remarques: e.remarque,
      });
      await D.enregistrerLivre(l, { type: 'ajout', detail: 'depuis la liste d\'envies' });
      await D.supprimerEnvie(e.id);
      toast(`« ${l.titre} » est dans la bibliothèque. Complète sa fiche si besoin.`);
      Bib.fiche.ouvrir(l.id);
    },
    'envie-retirer': async (el) => {
      const e = D.etat.envies.find((x) => x.id === el.dataset.id);
      if (!e) return;
      await D.supprimerEnvie(e.id);
      toast(`« ${e.titre} » est retiré des envies.`, { action: 'Annuler', surAction: () => D.enregistrerEnvie(e) });
    },
  });

  Bib.vues.envies = { titre: 'Envies', rendre };
})();
