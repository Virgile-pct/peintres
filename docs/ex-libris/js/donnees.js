/*
 * Données de la bibliothèque, rangées dans IndexedDB (la base intégrée au navigateur).
 * Tout est aussi gardé en mémoire : quelques milliers de livres tiennent sans peine,
 * et les écrans se dessinent instantanément.
 */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const { uid, cle, cleOeuvre } = Bib.outils;

  const NOM_BASE = 'ex-libris';
  const MAGASINS = ['livres', 'envies', 'journal', 'reglages'];
  let ouverture = null;

  function ouvrir() {
    if (!ouverture) {
      ouverture = new Promise((resoudre, rejeter) => {
        const req = indexedDB.open(NOM_BASE, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore('livres', { keyPath: 'id' });
          db.createObjectStore('envies', { keyPath: 'id' });
          db.createObjectStore('journal', { keyPath: 'id' });
          db.createObjectStore('reglages', { keyPath: 'cle' });
        };
        req.onsuccess = () => resoudre(req.result);
        req.onerror = () => rejeter(req.error);
      });
    }
    return ouverture;
  }

  async function transaction(magasin, mode, action) {
    const db = await ouvrir();
    return new Promise((resoudre, rejeter) => {
      const tx = db.transaction(magasin, mode);
      let resultat;
      const req = action(tx.objectStore(magasin));
      if (req) req.onsuccess = () => { resultat = req.result; };
      tx.oncomplete = () => resoudre(resultat);
      tx.onerror = () => rejeter(tx.error);
      tx.onabort = () => rejeter(tx.error);
    });
  }
  const tout = (magasin) => transaction(magasin, 'readonly', (s) => s.getAll());
  const mettre = (magasin, objet) => transaction(magasin, 'readwrite', (s) => s.put(objet));
  const enlever = (magasin, id) => transaction(magasin, 'readwrite', (s) => s.delete(id));
  const mettrePlusieurs = (magasin, objets) =>
    transaction(magasin, 'readwrite', (s) => { objets.forEach((o) => s.put(o)); });

  const etat = { livres: [], envies: [], journal: [], reglages: {} };

  // Chaque écran s'abonne pour se redessiner quand les données changent.
  // « discret » = changement qui ne mérite ni nouveau rendu ni sauvegarde.
  const abonnes = new Set();
  const abonner = (fn) => abonnes.add(fn);
  const prevenir = (raison) => abonnes.forEach((fn) => fn(raison));

  async function charger() {
    const [livres, envies, journal, reglages] = await Promise.all(MAGASINS.map(tout));
    etat.livres = livres;
    etat.envies = envies;
    etat.journal = journal.sort((a, b) => b.date.localeCompare(a.date));
    etat.reglages = Object.fromEntries(reglages.map((r) => [r.cle, r.valeur]));
  }

  const presents = () => etat.livres.filter((l) => !l.sorti);
  const livre = (id) => etat.livres.find((l) => l.id === id);
  const emplacement = (l) => [l.piece, l.rangement].filter(Boolean).join(', ');

  const MODELE = {
    isbn: '', titre: '', sousTitre: '', auteurs: [], editeur: '', collection: '', annee: '',
    pages: null, hauteur: null, serie: '', tome: '', genre: '', prix: null, langue: '',
    couverture: '', resume: '', source: 'manuel', ark: '',
    piece: '', rangement: '', statut: '', note: 0, avis: '', dateDebut: '', dateLecture: '',
    exemplaires: 1, remarques: '', sorti: null,
  };

  function nouveauLivre(fiche) {
    const remplis = Object.fromEntries(
      Object.entries(fiche || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );
    const maintenant = new Date().toISOString();
    return { ...MODELE, auteurs: [], ...remplis, id: uid(), dateAjout: maintenant, dateModif: maintenant };
  }

  async function journaliser(type, l, detail = '') {
    const evenement = { id: uid(), date: new Date().toISOString(), type, livreId: l ? l.id : null, titre: l ? l.titre : '', detail };
    etat.journal.unshift(evenement);
    await mettre('journal', evenement);
  }

  async function enregistrerLivre(l, evenement) {
    l.dateModif = new Date().toISOString();
    await mettre('livres', l);
    const i = etat.livres.findIndex((x) => x.id === l.id);
    if (i === -1) etat.livres.push(l);
    else etat.livres[i] = l;
    if (evenement) await journaliser(evenement.type, l, evenement.detail);
    prevenir('livres');
    return l;
  }

  async function supprimerLivre(l, { silencieux = false } = {}) {
    await enlever('livres', l.id);
    etat.livres = etat.livres.filter((x) => x.id !== l.id);
    if (silencieux) {
      // Annulation d'un ajout : on efface aussi sa trace dans le journal.
      const traces = etat.journal.filter((e) => e.livreId === l.id);
      etat.journal = etat.journal.filter((e) => e.livreId !== l.id);
      await Promise.all(traces.map((e) => enlever('journal', e.id)));
    } else {
      await journaliser('suppression', l);
    }
    prevenir('livres');
  }

  async function enregistrerEnvie(envie) {
    envie.dateAjout = envie.dateAjout || new Date().toISOString();
    await mettre('envies', envie);
    const i = etat.envies.findIndex((x) => x.id === envie.id);
    if (i === -1) etat.envies.push(envie);
    else etat.envies[i] = envie;
    prevenir('envies');
    return envie;
  }

  async function supprimerEnvie(id) {
    await enlever('envies', id);
    etat.envies = etat.envies.filter((e) => e.id !== id);
    prevenir('envies');
  }

  async function reglage(nom, valeur, { discret = false } = {}) {
    etat.reglages[nom] = valeur;
    await mettre('reglages', { cle: nom, valeur });
    prevenir(discret ? 'discret' : 'reglages');
  }

  // ---- Anti-doublon ----

  const parIsbn = (isbn) => (isbn ? etat.livres.filter((l) => l.isbn === isbn) : []);

  function autresEditions(fiche) {
    if (!cle(fiche.titre)) return [];
    const k = cleOeuvre(fiche);
    return presents().filter((l) => l.isbn !== fiche.isbn && cleOeuvre(l) === k);
  }

  function envieCorrespondante(fiche) {
    return etat.envies.find((e) =>
      (e.isbn && e.isbn === fiche.isbn) ||
      (cle(e.titre) && (e.auteurs || []).length && cleOeuvre(e) === cleOeuvre(fiche)) ||
      (e.serie && fiche.serie && cle(e.serie) === cle(fiche.serie) && String(e.tome) === String(fiche.tome))
    );
  }

  // ---- Listes pour les suggestions de saisie ----

  const distincts = (valeurs) => [...new Set(valeurs.filter(Boolean))].sort(Bib.outils.comparer);
  // Étagères prévues à l'avance (réglage « emplacements ») : proposées même quand elles sont encore vides.
  const emplacements = () => (etat.reglages.emplacements || []).filter((e) => e && (e.piece || e.rangement));
  const pieces = () => distincts([...etat.livres, ...emplacements()].map((l) => l.piece));
  const rangements = () => distincts([...etat.livres, ...emplacements()].map((l) => l.rangement));
  const genres = () => distincts(etat.livres.map((l) => l.genre));

  // ---- Restauration d'une sauvegarde : on garde la version la plus récente de chaque fiche ----

  async function fusionner(sauvegarde) {
    let livresAjoutes = 0;
    const plusRecent = (existant, entrant, champ) => !existant || (entrant[champ] || '') > (existant[champ] || '');

    const livres = (sauvegarde.livres || []).filter((l) => l && l.id && plusRecent(livre(l.id), l, 'dateModif'));
    for (const l of livres) {
      if (!livre(l.id)) livresAjoutes++;
      const complet = { ...MODELE, ...l };
      const i = etat.livres.findIndex((x) => x.id === l.id);
      if (i === -1) etat.livres.push(complet);
      else etat.livres[i] = complet;
    }
    await mettrePlusieurs('livres', livres.map((l) => livre(l.id)));

    const envies = (sauvegarde.envies || []).filter((e) => e && e.id && !etat.envies.some((x) => x.id === e.id));
    etat.envies.push(...envies);
    await mettrePlusieurs('envies', envies);

    const journal = (sauvegarde.journal || []).filter((e) => e && e.id && !etat.journal.some((x) => x.id === e.id));
    etat.journal.push(...journal);
    etat.journal.sort((a, b) => b.date.localeCompare(a.date));
    await mettrePlusieurs('journal', journal);

    for (const [nom, valeur] of Object.entries(sauvegarde.reglages || {})) {
      if (etat.reglages[nom] === undefined) await reglage(nom, valeur, { discret: true });
    }
    await journaliser('import', null, `${livresAjoutes} livres ajoutés, ${livres.length - livresAjoutes} mis à jour`);
    prevenir('import');
    return { livresAjoutes, livresMisAJour: livres.length - livresAjoutes };
  }

  Bib.donnees = {
    etat, charger, abonner, presents, livre, emplacement, nouveauLivre,
    enregistrerLivre, supprimerLivre, enregistrerEnvie, supprimerEnvie, reglage, journaliser,
    parIsbn, autresEditions, envieCorrespondante, cleOeuvre, emplacements, pieces, rangements, genres, fusionner,
  };
})();
