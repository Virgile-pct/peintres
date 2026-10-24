/*
 * Sauvegarde.
 * La base du navigateur peut être effacée (nettoyage, réinstallation…). On écrit donc
 * aussi, après chaque modification, un fichier .json choisi par l'utilisatrice
 * (idéalement dans OneDrive ou sur une clé USB). Edge et Chrome savent le faire
 * (File System Access) ; ailleurs, on propose de télécharger une copie.
 */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const { telecharger, aujourdhui, debounce, heure, dateLongue } = Bib.outils;
  const D = Bib.donnees;

  const PRISE_EN_CHARGE = 'showSaveFilePicker' in window;
  let statut = PRISE_EN_CHARGE ? 'aucun' : 'non-pris-en-charge'; // aucun | ok | en-cours | a-reconnecter | erreur
  let derniere = null;
  const ecouteurs = new Set();
  const signaler = () => ecouteurs.forEach((fn) => fn());

  function instantane() {
    const { livres, envies, journal, reglages } = D.etat;
    const r = { ...reglages };
    delete r.fichier; // le lien vers le fichier n'a de sens que sur cet ordinateur
    return { application: 'Ex-libris', format: 1, date: new Date().toISOString(), livres, envies, journal, reglages: r };
  }

  async function permission(fichier, demander) {
    const options = { mode: 'readwrite' };
    if ((await fichier.queryPermission(options)) === 'granted') return true;
    return demander && (await fichier.requestPermission(options)) === 'granted';
  }

  async function ecrire(demander = false) {
    const fichier = D.etat.reglages.fichier;
    if (!fichier || !PRISE_EN_CHARGE) return;
    try {
      if (!(await permission(fichier, demander))) {
        statut = 'a-reconnecter';
        return signaler();
      }
      statut = 'en-cours';
      signaler();
      const flux = await fichier.createWritable();
      await flux.write(JSON.stringify(instantane()));
      await flux.close();
      derniere = new Date();
      statut = 'ok';
      await D.reglage('derniereSauvegarde', derniere.toISOString(), { discret: true });
    } catch (e) {
      console.error('Sauvegarde', e);
      statut = 'erreur';
    }
    signaler();
  }

  const planifier = debounce(() => ecrire(false), 1200);

  async function choisirFichier() {
    let fichier;
    try {
      fichier = await window.showSaveFilePicker({
        suggestedName: 'ma-bibliotheque.json',
        types: [{ description: 'Sauvegarde Ex-libris', accept: { 'application/json': ['.json'] } }],
      });
    } catch (e) {
      return false; // fenêtre fermée sans choisir
    }
    await D.reglage('fichier', fichier, { discret: true });
    await ecrire(true);
    return statut === 'ok';
  }

  const reconnecter = () => ecrire(true);

  function telechargerCopie() {
    telecharger(`bibliotheque-${aujourdhui()}.json`, JSON.stringify(instantane(), null, 1), 'application/json');
    D.reglage('dernierTelechargement', new Date().toISOString(), { discret: true });
  }

  function exporterTableur() {
    const colonnes = [
      ['Titre', (l) => l.titre], ['Auteurs', (l) => (l.auteurs || []).join(', ')],
      ['ISBN', (l) => (l.isbn ? `="${l.isbn}"` : '')], // forme ="…" : Excel garde les 13 chiffres
      ['Éditeur', (l) => l.editeur], ['Collection', (l) => l.collection], ['Année', (l) => l.annee],
      ['Pages', (l) => l.pages], ['Genre', (l) => l.genre], ['Série', (l) => l.serie], ['Tome', (l) => l.tome],
      ['Pièce', (l) => l.piece], ['Meuble ou étagère', (l) => l.rangement], ['Lecture', (l) => Bib.fiche.LIBELLES_STATUT[l.statut] || ''],
      ['Lu le', (l) => l.dateLecture], ['Note', (l) => l.note || ''], ['Prix', (l) => (l.prix ? String(l.prix).replace('.', ',') : '')],
      ['Exemplaires', (l) => l.exemplaires], ['Ajouté le', (l) => (l.dateAjout || '').slice(0, 10)],
    ];
    const cellule = (v) => {
      const s = String(v ?? '');
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lignes = [
      colonnes.map(([nom]) => nom).join(';'),
      ...D.presents().map((l) => colonnes.map(([, lire]) => cellule(lire(l))).join(';')),
    ];
    // BOM + point-virgule : Excel en français ouvre le fichier directement, accents compris.
    telecharger(`bibliotheque-${aujourdhui()}.csv`, '﻿' + lignes.join('\r\n'), 'text/csv;charset=utf-8');
  }

  async function restaurer(fichierChoisi) {
    let contenu;
    try {
      contenu = JSON.parse(await fichierChoisi.text());
    } catch (e) {
      throw new Error("Ce fichier n'est pas une sauvegarde lisible.");
    }
    if (!contenu || contenu.application !== 'Ex-libris' || !Array.isArray(contenu.livres)) {
      throw new Error("Ce fichier n'est pas une sauvegarde d'Ex-libris.");
    }
    return D.fusionner(contenu);
  }

  /** Ce que la barre du haut affiche. */
  function etat() {
    const r = D.etat.reglages;
    const vide = !D.etat.livres.length;
    if (statut === 'ok') return { code: 'ok', texte: `Sauvegardé à ${heure(derniere)}` };
    if (statut === 'en-cours') return { code: 'ok', texte: 'Sauvegarde…' };
    if (statut === 'a-reconnecter') return { code: 'attention', texte: 'Reprendre la sauvegarde', action: 'reconnecter-sauvegarde' };
    if (statut === 'erreur') return { code: 'erreur', texte: 'La sauvegarde a échoué', lien: true };
    if (vide) return { code: 'neutre', texte: '' };
    if (statut === 'non-pris-en-charge') {
      const recente = r.dernierTelechargement && Date.now() - new Date(r.dernierTelechargement) < 7 * 86400000;
      return recente
        ? { code: 'ok', texte: `Copie du ${dateLongue(r.dernierTelechargement)}` }
        : { code: 'attention', texte: 'Pense à télécharger une copie', lien: true };
    }
    return { code: 'attention', texte: 'Sauvegarde automatique à régler', lien: true };
  }

  function demarrer() {
    if (PRISE_EN_CHARGE && D.etat.reglages.fichier) {
      statut = 'a-reconnecter';
      // Si le navigateur a gardé l'autorisation, on reprend sans rien demander.
      ecrire(false);
    }
    D.abonner((raison) => {
      if (raison !== 'discret' && D.etat.reglages.fichier) planifier();
    });
  }

  Bib.sauvegarde = {
    PRISE_EN_CHARGE, demarrer, etat, choisirFichier, reconnecter, telechargerCopie, exporterTableur, restaurer,
    surChangement: (fn) => ecouteurs.add(fn),
    statut: () => statut,
  };
})();
