/*
 * Chef d'orchestre : navigation entre les écrans (adresse #/ecran?param=…),
 * barre du haut, et distribution des clics, formulaires et saisies.
 */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const { esc, pluriel } = Bib.outils;
  const D = Bib.donnees;

  const NAVIGATION = [
    ['accueil', 'Accueil'], ['ajouter', 'Ajouter des livres'], ['etageres', 'Mes étagères'],
    ['lecture', 'Ma lecture'], ['series', 'Séries'], ['envies', 'Envies'], ['sauvegarde', 'Sauvegarde'],
  ];

  let courante = null; // { nom, params }

  function lireAdresse() {
    const [nom, requete] = location.hash.replace(/^#\/?/, '').split('?');
    return { nom: Bib.vues[nom] ? nom : 'accueil', params: Object.fromEntries(new URLSearchParams(requete || '')) };
  }

  function adresse(nom, params) {
    const requete = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v !== '' && v != null)).toString();
    return `#/${nom}${requete ? '?' + requete : ''}`;
  }

  function aller(nom, params = {}) {
    const cible = adresse(nom, params);
    if (location.hash === cible) afficher();
    else location.hash = cible;
  }

  // Change l'adresse sans redessiner (filtres, recherche).
  function majParams(params) {
    courante.params = { ...courante.params, ...params };
    history.replaceState(null, '', adresse(courante.nom, courante.params));
  }

  function afficher({ garderDefilement = false } = {}) {
    const { nom, params } = lireAdresse();
    const nouvelleVue = !courante || courante.nom !== nom;
    if (nouvelleVue && courante && Bib.vues[courante.nom].quitter) Bib.vues[courante.nom].quitter();
    courante = { nom, params };
    const vue = Bib.vues[nom];
    const racine = document.getElementById('vue');
    const defilement = window.scrollY;
    racine.innerHTML = vue.rendre(params);
    document.title = `${vue.titre}, Ex-libris`;
    if (vue.apres) vue.apres(racine, params);
    majNavigation();
    if (nouvelleVue) {
      window.scrollTo(0, 0);
      if (!vue.apres) racine.focus({ preventScroll: true });
    } else if (garderDefilement) {
      window.scrollTo(0, defilement);
    }
  }

  function traiterCode(code) {
    Bib.fiche.fermer();
    if (!courante || courante.nom !== 'ajouter') {
      history.pushState(null, '', adresse('ajouter', {}));
      afficher();
    }
    return Bib.vues.ajouter.traiter(code);
  }

  // ---------- Cadre ----------

  function construireNavigation() {
    document.getElementById('nav-liens').innerHTML = NAVIGATION.map(
      ([nom, libelle]) => `<a class="nav__lien" href="#/${nom}" data-vue="${nom}">${Bib.icones[nom]}<span>${libelle}</span></a>`
    ).join('');
  }

  function majNavigation() {
    document.querySelectorAll('.nav__lien').forEach((a) => {
      if (a.dataset.vue === courante.nom) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function majCadre() {
    const r = D.etat.reglages;
    document.getElementById('nom-bibliotheque').textContent = r.nom || 'Ma bibliothèque';
    const n = D.presents().length;
    const envies = D.etat.envies.length;
    document.getElementById('nav-compte').textContent = n
      ? `${pluriel(n, 'livre', 'livres')}${envies ? `, ${pluriel(envies, 'envie', 'envies')}` : ''}`
      : '';
    const listes = (id, valeurs) => `<datalist id="${id}">${valeurs.map((v) => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
    const genres = [...new Set([...Bib.catalogues.GENRES_CONNUS, ...D.genres()])];
    document.getElementById('listes').innerHTML =
      listes('liste-pieces', D.pieces()) + listes('liste-rangements', D.rangements()) + listes('liste-genres', genres);
    majEtatSauvegarde();
  }

  function majEtatSauvegarde() {
    const el = document.getElementById('etat-sauvegarde');
    const s = Bib.sauvegarde.etat();
    el.dataset.etat = s.code;
    if (!s.texte) {
      el.innerHTML = '';
      return;
    }
    const contenu = s.action
      ? `<button type="button" class="lien" data-action="${s.action}">${esc(s.texte)}</button>`
      : s.lien ? `<a href="#/sauvegarde">${esc(s.texte)}</a>` : `<span>${esc(s.texte)}</span>`;
    el.innerHTML = `<span class="etat-sauvegarde__pastille" aria-hidden="true"></span>${contenu}`;
  }

  // ---------- Distribution des événements ----------

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const action = Bib.actions[el.dataset.action];
    if (!action) return;
    e.preventDefault();
    Promise.resolve(action(el, e)).catch((erreur) => {
      console.error(erreur);
      Bib.outils.toast("Quelque chose s'est mal passé. Recharge la page si le problème continue.");
    });
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const traitement = Bib.formulaires[form.dataset.form];
    if (traitement) Promise.resolve(traitement(form, e)).catch(console.error);
  });

  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el && Bib.changements[el.dataset.change]) Bib.changements[el.dataset.change](el, e);
  });

  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (el && Bib.changements[el.dataset.input]) Bib.changements[el.dataset.input](el, e);
  });

  Object.assign(Bib.changements, {
    reglage: (el) => {
      const valeur = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value.trim();
      D.reglage(el.dataset.cle, valeur);
    },
  });

  // Barre du haut : un code part au scan, un texte part en recherche dans les étagères.
  Bib.formulaires.comptoir = (form) => {
    const champ = form.elements.q;
    const valeur = champ.value.trim();
    if (!valeur) return;
    champ.value = '';
    if (Bib.isbn.ressembleACode(valeur)) traiterCode(valeur);
    else aller('etageres', { ...(courante.nom === 'etageres' ? courante.params : {}), q: valeur });
    champ.blur();
  };

  // ---------- Démarrage ----------

  async function demarrer() {
    try {
      await D.charger();
    } catch (e) {
      console.error(e);
      document.getElementById('vue').innerHTML = `<div class="vide"><h1>La bibliothèque ne s'ouvre pas</h1>
        <p>Le navigateur refuse d'enregistrer des données (c'est le cas en navigation privée). Ouvre Ex-libris dans une fenêtre normale d'Edge ou de Chrome.</p></div>`;
      return;
    }
    // Demande au navigateur de ne jamais effacer ces données pour faire de la place.
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

    construireNavigation();
    majCadre();
    Bib.sauvegarde.demarrer();
    Bib.sauvegarde.surChangement(() => {
      majEtatSauvegarde();
      if (courante && courante.nom === 'sauvegarde') afficher({ garderDefilement: true });
    });

    D.abonner((raison) => {
      majCadre();
      if (raison === 'discret') return;
      const vue = Bib.vues[courante.nom];
      if (vue.surChangement) vue.surChangement(raison);
      else afficher({ garderDefilement: true });
    });

    window.addEventListener('hashchange', () => afficher());
    Bib.scanner.ecouterDouchette(traiterCode);
    afficher();
  }

  Bib.app = {
    aller, afficher, majParams, traiterCode,
    params: () => (courante ? { ...courante.params } : {}),
    vueCourante: () => courante && courante.nom,
  };

  demarrer();
})();
