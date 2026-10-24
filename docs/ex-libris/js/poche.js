/*
 * Ex-libris de poche : la version téléphone, pour la librairie.
 * Une seule question : « Ce livre, je l'ai déjà ? »
 * La liste vient du fichier de sauvegarde que l'ordinateur écrit tout seul (dans OneDrive
 * ou Google Drive) : le téléphone le relit quand on touche « Mettre à jour ».
 * Le téléphone ne modifie jamais rien : c'est l'ordinateur qui fait foi.
 */
(function () {
  'use strict';
  const Bib = window.Bib;
  const { esc, cle, cleOeuvre, pluriel, dateLongue, moisAnnee, depuis, heure, toast, enumerer } = Bib.outils;
  const C = Bib.couverture;
  const I = Bib.isbn;

  const VIEILLE_LISTE_JOURS = 14;

  // ---------- La liste, gardée sur le téléphone ----------

  let ouverture = null;
  function base() {
    if (!ouverture) {
      ouverture = new Promise((resoudre, rejeter) => {
        const req = indexedDB.open('ex-libris-poche', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('liste');
        req.onsuccess = () => resoudre(req.result);
        req.onerror = () => rejeter(req.error);
      });
    }
    return ouverture;
  }

  async function lireListe() {
    const db = await base();
    return new Promise((resoudre, rejeter) => {
      const req = db.transaction('liste').objectStore('liste').get('courante');
      req.onsuccess = () => resoudre(req.result || null);
      req.onerror = () => rejeter(req.error);
    });
  }

  async function ecrireListe(valeur) {
    const db = await base();
    return new Promise((resoudre, rejeter) => {
      const tx = db.transaction('liste', 'readwrite');
      if (valeur) tx.objectStore('liste').put(valeur, 'courante');
      else tx.objectStore('liste').delete('courante');
      tx.oncomplete = () => resoudre();
      tx.onerror = () => rejeter(tx.error);
    });
  }

  // On ne garde que ce qui sert en librairie (le journal et les avis restent sur l'ordinateur).
  function alleger(sauvegarde) {
    const livre = (l) => ({
      isbn: l.isbn || '', titre: l.titre || '', auteurs: l.auteurs || [], editeur: l.editeur || '',
      collection: l.collection || '', annee: l.annee || '', serie: l.serie || '', tome: l.tome || '',
      piece: l.piece || '', rangement: l.rangement || '', statut: l.statut || '', note: l.note || 0,
      dateLecture: l.dateLecture || '', couverture: l.couverture || '', exemplaires: l.exemplaires || 1, sorti: l.sorti || null,
    });
    const envie = (e) => ({
      isbn: e.isbn || '', titre: e.titre || '', auteurs: e.auteurs || [], serie: e.serie || '',
      tome: e.tome || '', remarque: e.remarque || '', couverture: e.couverture || '',
    });
    return {
      nom: (sauvegarde.reglages && sauvegarde.reglages.nom) || 'Ma bibliothèque',
      dateSauvegarde: sauvegarde.date || '',
      dateChargement: new Date().toISOString(),
      livres: sauvegarde.livres.map(livre),
      envies: (sauvegarde.envies || []).map(envie),
    };
  }

  let liste = null;
  const presents = () => (liste ? liste.livres.filter((l) => !l.sorti) : []);
  const emplacement = (l) => [l.piece, l.rangement].filter(Boolean).join(', ');
  const numero = (t) => {
    const n = parseFloat(String(t ?? '').replace(',', '.'));
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  // ---------- Séries ----------

  function tomesPossedes(nomSerie) {
    const k = cle(nomSerie);
    return [...new Set(presents().filter((l) => l.serie && cle(l.serie) === k).map((l) => numero(l.tome)).filter(Boolean))].sort((a, b) => a - b);
  }

  function manquants(tomes) {
    const max = tomes.length ? tomes[tomes.length - 1] : 0;
    const resultat = [];
    for (let i = 1; i <= max; i++) if (!tomes.includes(i)) resultat.push(i);
    return resultat;
  }

  // Ce que la série dit du tome scanné : celui qui manque, la suite, ou un saut de tomes.
  function messageSerie(fiche) {
    const n = numero(fiche.tome);
    const tomes = tomesPossedes(fiche.serie);
    if (!n || !tomes.length) return null;
    const trous = manquants(tomes);
    const max = tomes[tomes.length - 1];
    const possedes = tomes.length > 6 ? `les tomes 1 à ${max}${trous.length ? ' (avec des trous)' : ''}` : `${tomes.length > 1 ? 'les tomes' : 'le tome'} ${enumerer(tomes.map(String))}`;
    const serie = `« ${fiche.serie} »`;
    if (trous.includes(n)) return { ton: 'bon', texte: `C'est le tome ${n} de ${serie} : justement, il te manque ! Tu as ${possedes}.` };
    if (n === max + 1) return { ton: 'bon', texte: `C'est la suite de ${serie} : tu as ${possedes}.` };
    if (n > max + 1) {
      const entre = [];
      for (let i = max + 1; i < n; i++) entre.push(i);
      return { ton: 'attention', texte: `Tu as ${possedes} de ${serie}. Avant ce tome ${n}, il te manque ${entre.length > 1 ? 'les tomes' : 'le tome'} ${enumerer(entre.map(String))}.` };
    }
    return { ton: 'neutre', texte: `Tu as ${possedes} de ${serie}.` };
  }

  // ---------- Verdict d'un scan ----------

  const etat = { onglet: 'scanner', resultat: null, arreterCamera: null, lampe: false, installation: null, armeEffacer: false };

  function vibrer(motif) {
    if (navigator.vibrate) navigator.vibrate(motif);
  }

  async function verdict(saisie) {
    const a = I.analyser(saisie);
    if (a.type === 'invalide' || a.type === 'revue') {
      etat.resultat = { type: 'illisible', code: a.brut || a.ean };
      return majResultat();
    }
    const code = a.isbn || a.ean;
    const memes = liste.livres.filter((l) => l.isbn === code);
    const present = memes.find((l) => !l.sorti);
    if (present) {
      vibrer([180, 90, 180]); // deux coups : « stop, tu l'as »
      etat.resultat = { type: 'deja', livre: present };
      return majResultat();
    }

    // Pas ce code-là à la maison : on le dit tout de suite, puis on vérifie les autres éditions en ligne.
    vibrer(60);
    const r = { type: 'absent', code, sorti: memes.find((l) => l.sorti) || null, envie: liste.envies.find((e) => e.isbn && e.isbn === code) || null, fiche: null, editions: [], serie: null };
    etat.resultat = r;
    if (a.type !== 'isbn') return majResultat();
    if (navigator.onLine === false) {
      r.horsLigne = true;
      return majResultat();
    }
    r.enCours = true;
    majResultat();
    try {
      const reponse = await Bib.catalogues.chercherParIsbn(a.isbn, a.isbn10);
      r.fiche = reponse.fiche;
      r.horsLigne = !reponse.fiche && reponse.horsLigne;
    } catch (e) {
      r.horsLigne = true;
    }
    r.enCours = false;
    if (etat.resultat !== r) return; // un autre livre a été scanné entre-temps
    if (r.fiche) {
      const k = cleOeuvre(r.fiche);
      if (cle(r.fiche.titre)) r.editions = presents().filter((l) => cleOeuvre(l) === k);
      r.envie = r.envie || liste.envies.find((e) =>
        (cle(e.titre) && (e.auteurs || []).length && cleOeuvre(e) === k) ||
        (e.serie && r.fiche.serie && cle(e.serie) === cle(r.fiche.serie) && String(e.tome) === String(r.fiche.tome))) || null;
      if (r.fiche.serie) r.serie = messageSerie(r.fiche);
      if (r.editions.length) vibrer([180, 90, 180]);
    }
    majResultat();
  }

  // ---------- Rendu ----------

  const vue = () => document.getElementById('poche-vue');

  function lectureTexte(l) {
    if (l.statut === 'lu') return `Lu${l.dateLecture ? ` en ${moisAnnee(l.dateLecture)}` : ''}${l.note ? ` ${'★'.repeat(l.note)}` : ''}`;
    if (l.statut === 'en-cours') return 'En cours de lecture';
    if (l.statut === 'a-lire') return 'Dans ta pile à lire';
    if (l.statut === 'abandonne') return 'Abandonné en cours de route';
    return '';
  }

  function blocLivre(l, classeCouv = 'couv--moyenne') {
    const meta = [l.editeur, l.collection, l.annee].filter(Boolean).join(', ');
    return `<div class="verdict__livre">${C.htmlCouverture(l, classeCouv)}
      <div><h2>${esc(l.titre || 'Sans titre')}</h2>
        ${(l.auteurs || []).length ? `<p class="verdict__auteurs">${esc(l.auteurs.join(', '))}</p>` : ''}
        ${meta ? `<p class="verdict__meta">${esc(meta)}</p>` : ''}
        ${l.serie ? `<p class="verdict__meta">${esc(l.serie)}${l.tome ? `, tome ${esc(l.tome)}` : ''}</p>` : ''}</div></div>`;
  }

  function rendreResultat() {
    const r = etat.resultat;
    if (!r) {
      return liste
        ? `<p class="poche-invite">Scanne le code-barres au dos d'un livre : je te dis tout de suite s'il est déjà à la maison.</p>`
        : '';
    }
    if (r.type === 'illisible') {
      return `<article class="verdict verdict--illisible"><h2>Ce n'est pas le code d'un livre</h2>
        <p>Les livres ont un code qui commence par 978 ou 979. Rescanne le code-barres principal, au dos.</p></article>`;
    }
    if (r.type === 'deja') {
      const l = r.livre;
      const faits = [emplacement(l) ? `Rangé : ${emplacement(l)}` : 'Pas encore rangé', lectureTexte(l), l.exemplaires > 1 ? `${l.exemplaires} exemplaires` : ''].filter(Boolean);
      return `<article class="verdict verdict--deja">
        <div class="tampon" role="status">Déjà à la maison</div>
        ${blocLivre(l)}
        <ul class="verdict__faits">${faits.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </article>`;
    }
    // absent (au moins sous ce code-barres)
    const doute = r.editions.length > 0;
    const alertes = [];
    if (doute) {
      alertes.push(`<div class="verdict__alerte verdict__alerte--attention"><strong>Attention, tu as peut-être ce livre dans une autre édition :</strong>
        <ul>${r.editions.map((l) => `<li>${esc([l.titre, l.editeur, l.collection, l.annee].filter(Boolean).join(', '))}${emplacement(l) ? `<br><small>Rangé : ${esc(emplacement(l))}</small>` : ''}</li>`).join('')}</ul></div>`);
    }
    if (r.envie) alertes.push(`<div class="verdict__alerte verdict__alerte--envie"><strong>Il est sur ta liste d'envies.</strong>${r.envie.remarque ? ` ${esc(r.envie.remarque)}` : ''}</div>`);
    if (r.serie) alertes.push(`<div class="verdict__alerte verdict__alerte--${r.serie.ton}">${esc(r.serie.texte)}</div>`);
    if (r.sorti) alertes.push(`<div class="verdict__alerte">Tu l'as déjà eu : retiré le ${esc(dateLongue(r.sorti.sorti.date))} (${esc(r.sorti.sorti.motif.toLowerCase())}).</div>`);
    return `<article class="verdict ${doute ? 'verdict--doute' : 'verdict--absent'}">
      <div class="tampon ${doute ? 'tampon--ambre' : 'tampon--vert'}" role="status">${doute ? 'Peut-être déjà ?' : 'Pas à la maison'}</div>
      ${r.fiche ? blocLivre(r.fiche) : `<p class="verdict__meta">Code ${esc(r.code)}</p>`}
      ${alertes.join('')}
      ${r.enCours ? '<p class="verdict__attente"><span class="point-attente" aria-hidden="true"></span>Je vérifie les autres éditions et les séries…</p>' : ''}
      ${r.horsLigne ? '<p class="verdict__attente">Pas de réseau : impossible de vérifier les autres éditions. Seul ce code-barres a été comparé.</p>' : ''}
    </article>`;
  }

  function rendreScanner() {
    if (!liste) {
      return `<div class="poche-accueil"><h1>Bienvenue</h1>
        <p>Pour savoir en librairie si un livre est déjà à la maison, le téléphone a besoin de la liste de tes livres.</p>
        <button type="button" class="bouton poche-gros" data-action="onglet" data-valeur="maj">Charger ma liste</button></div>`;
    }
    return `
      <div id="poche-resultat" aria-live="polite">${rendreResultat()}</div>
      <div class="poche-camera" id="poche-camera" hidden>
        <video id="poche-video" muted playsinline></video>
        <span class="poche-camera__viseur" aria-hidden="true"></span>
        <div class="poche-camera__commandes">
          <button type="button" class="bouton bouton--second" data-action="lampe" id="bouton-lampe" aria-pressed="false" hidden>Lampe</button>
          <button type="button" class="bouton bouton--second" data-action="arreter-camera">Arrêter</button>
        </div>
      </div>
      <button type="button" class="bouton poche-gros" data-action="scanner" id="bouton-scanner">${etat.resultat ? 'Scanner un autre livre' : 'Scanner un livre'}</button>
      <form class="poche-recherche" data-form="recherche" autocomplete="off" role="search">
        <label for="poche-cherche">Pas de code-barres ? Cherche chez toi</label>
        <input type="search" id="poche-cherche" class="saisie" data-input="recherche" placeholder="Titre, auteur ou série" enterkeyhint="search">
      </form>
      <div id="poche-trouves"></div>`;
  }

  function rendreTrouves(texte) {
    const mots = cle(texte).split(' ').filter(Boolean);
    if (!mots.length) return '';
    // Une saisie toute en chiffres : c'est un code tapé à la main.
    if (I.ressembleACode(texte)) return `<button type="button" class="bouton bouton--second" data-action="verifier-code">Vérifier le code ${esc(I.chiffres(texte))}</button>`;
    const trouves = presents().filter((l) => {
      const t = cle([l.titre, (l.auteurs || []).join(' '), l.serie].join(' '));
      return mots.every((m) => t.includes(m));
    });
    if (!trouves.length) return '<p class="poche-trouves__rien">Aucun livre de la maison ne correspond.</p>';
    return `<p class="poche-trouves__compte">${pluriel(trouves.length, 'livre à la maison', 'livres à la maison')}</p>
      <ul class="poche-trouves">${trouves.slice(0, 15).map((l) => `<li>${C.htmlCouverture(l, 'couv--mini')}
        <div><strong>${esc(l.titre)}</strong><span>${esc([(l.auteurs || []).join(', '), l.serie && l.tome ? `${l.serie}, tome ${l.tome}` : l.serie].filter(Boolean).join(', '))}</span>
        ${emplacement(l) ? `<small>${esc(emplacement(l))}</small>` : ''}</div></li>`).join('')}</ul>`;
  }

  function rendreListe() {
    if (!liste) return rendreScanner();
    const envies = liste.envies;
    const series = new Map();
    for (const l of presents()) {
      if (l.serie && !series.has(cle(l.serie))) series.set(cle(l.serie), l.serie);
    }
    const lignesSeries = [...series.values()]
      .map((nom) => ({ nom, tomes: manquants(tomesPossedes(nom)).filter((n) => !envies.some((e) => e.serie && cle(e.serie) === cle(nom) && String(e.tome) === String(n))) }))
      .filter((s) => s.tomes.length && s.tomes.length <= 30)
      .sort((a, b) => Bib.outils.comparer(a.nom, b.nom));
    return `<h1>Ma liste pour la librairie</h1>
      <section class="poche-section"><h2>Envies</h2>
        ${envies.length ? `<ul class="poche-envies">${envies.map((e) => `<li>${C.htmlCouverture(e, 'couv--mini')}
          <div><strong>${esc(e.titre)}</strong>${(e.auteurs || []).length ? `<span>${esc(e.auteurs.join(', '))}</span>` : ''}
          ${e.remarque ? `<small>${esc(e.remarque)}</small>` : ''}</div></li>`).join('')}</ul>`
        : '<p class="poche-trouves__rien">Aucune envie notée. Elles s\'ajoutent sur l\'ordinateur, page Envies.</p>'}
      </section>
      <section class="poche-section"><h2>Tomes manquants</h2>
        ${lignesSeries.length ? `<ul class="poche-tomes">${lignesSeries.map((s) => `<li><strong>${esc(s.nom)}</strong><span>${s.tomes.length > 1 ? 'tomes' : 'tome'} ${esc(enumerer(s.tomes.map(String)))}</span></li>`).join('')}</ul>`
        : '<p class="poche-trouves__rien">Toutes tes séries sont complètes.</p>'}
      </section>`;
  }

  function rendreMaj() {
    const etatListe = liste
      ? `<div class="maj__etat${vieille() ? ' maj__etat--vieille' : ''}">
          <p><strong>${esc(liste.nom)}</strong> : ${pluriel(presents().length, 'livre', 'livres')}, ${pluriel(liste.envies.length, 'envie', 'envies')}.</p>
          <p>Liste enregistrée par l'ordinateur le ${esc(dateLongue(liste.dateSauvegarde))}${liste.dateSauvegarde ? ` à ${esc(heure(new Date(liste.dateSauvegarde)))}` : ''}, chargée ${esc(depuis(liste.dateChargement))}.</p>
        </div>`
      : '<p class="maj__etat">Aucune liste sur ce téléphone pour l\'instant.</p>';
    return `<h1>Mettre à jour la liste</h1>
      ${etatListe}
      <ol class="etapes etapes--poche">
        <li><span>Touche « Choisir le fichier ».</span></li>
        <li><span>Ouvre OneDrive (ou Google Drive) et choisis <strong>ma-bibliotheque.json</strong>, le fichier que l'ordinateur tient à jour tout seul.</span></li>
        <li><span>La liste reste sur le téléphone, même sans réseau en magasin.</span></li>
      </ol>
      <label class="bouton poche-gros" for="fichier-liste">Choisir le fichier</label>
      <input type="file" id="fichier-liste" class="lecteur-ecran" data-change="charger">
      ${etat.installation ? '<button type="button" class="bouton bouton--second poche-installer" data-action="installer">Installer Ex-libris sur ce téléphone</button>' : ''}
      <p class="section__aide">Le téléphone ne modifie jamais la bibliothèque : les ajouts se font sur l'ordinateur.</p>
      ${liste ? `<button type="button" class="bouton bouton--discret" data-action="oublier-liste">${etat.armeEffacer ? 'Confirmer : effacer la liste de ce téléphone' : 'Effacer la liste de ce téléphone'}</button>` : ''}`;
  }

  function vieille() {
    return liste && liste.dateSauvegarde && Date.now() - new Date(liste.dateSauvegarde) > VIEILLE_LISTE_JOURS * 86400000;
  }

  function majFraicheur() {
    const el = document.getElementById('poche-fraicheur');
    if (!liste) {
      el.textContent = 'Aucune liste';
      el.classList.add('poche-haut__liste--vieille');
      return;
    }
    el.classList.toggle('poche-haut__liste--vieille', Boolean(vieille()));
    const date = liste.dateSauvegarde ? dateLongue(liste.dateSauvegarde).replace(/ \d{4}$/, '') : '';
    el.textContent = vieille() ? `Liste du ${date} : à mettre à jour` : `${pluriel(presents().length, 'livre', 'livres')}, liste du ${date}`;
  }

  function rendre() {
    document.querySelectorAll('[data-action="onglet"]').forEach((b) => {
      if (b.dataset.valeur === etat.onglet) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    majFraicheur();
    vue().innerHTML = etat.onglet === 'liste' ? rendreListe() : etat.onglet === 'maj' ? rendreMaj() : rendreScanner();
  }

  function majResultat() {
    const zone = document.getElementById('poche-resultat');
    if (zone) zone.innerHTML = rendreResultat();
    const bouton = document.getElementById('bouton-scanner');
    if (bouton) bouton.textContent = etat.resultat ? 'Scanner un autre livre' : 'Scanner un livre';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Caméra ----------

  function montrerCamera(visible) {
    const zone = document.getElementById('poche-camera');
    const bouton = document.getElementById('bouton-scanner');
    if (zone) zone.hidden = !visible;
    if (bouton) bouton.hidden = visible;
  }

  function eteindreCamera() {
    if (etat.arreterCamera) etat.arreterCamera();
    etat.arreterCamera = null;
    etat.lampe = false;
    montrerCamera(false);
  }

  async function allumerCamera() {
    etat.resultat = null;
    majResultat();
    montrerCamera(true);
    try {
      const arreter = await Bib.scanner.demarrerCamera(document.getElementById('poche-video'), (code) => {
        etat.arreterCamera = null; // la caméra s'est déjà éteinte d'elle-même
        montrerCamera(false);
        verdict(code);
      });
      etat.arreterCamera = arreter;
      const lampe = document.getElementById('bouton-lampe');
      if (lampe) lampe.hidden = !arreter.lampe;
    } catch (e) {
      montrerCamera(false);
      toast(Bib.scanner.messageErreurCamera(e), { duree: 9000 });
    }
  }

  // ---------- Événements ----------

  const actions = {
    onglet: (el) => {
      if (etat.onglet === 'scanner' && el.dataset.valeur !== 'scanner') eteindreCamera();
      etat.onglet = el.dataset.valeur;
      etat.armeEffacer = false;
      rendre();
      window.scrollTo(0, 0);
    },
    scanner: () => allumerCamera(),
    'arreter-camera': () => eteindreCamera(),
    lampe: async (el) => {
      if (!etat.arreterCamera || !etat.arreterCamera.lampe) return;
      etat.lampe = !etat.lampe;
      await etat.arreterCamera.lampe(etat.lampe).catch(() => {});
      el.setAttribute('aria-pressed', String(etat.lampe));
    },
    'verifier-code': () => {
      const champ = document.getElementById('poche-cherche');
      const code = champ.value;
      champ.value = '';
      document.getElementById('poche-trouves').innerHTML = '';
      verdict(code);
    },
    installer: async () => {
      const invite = etat.installation;
      etat.installation = null;
      if (invite) {
        invite.prompt();
        await invite.userChoice.catch(() => {});
      }
      rendre();
    },
    'oublier-liste': async () => {
      if (!etat.armeEffacer) {
        etat.armeEffacer = true;
        return rendre();
      }
      await ecrireListe(null);
      liste = null;
      etat.armeEffacer = false;
      etat.resultat = null;
      rendre();
      toast('La liste est effacée de ce téléphone.');
    },
  };

  async function chargerFichier(input) {
    const fichier = input.files[0];
    if (!fichier) return;
    try {
      let contenu;
      try {
        contenu = JSON.parse(await fichier.text());
      } catch (e) {
        throw new Error("Ce fichier n'est pas une sauvegarde lisible. Choisis ma-bibliotheque.json.");
      }
      if (!contenu || contenu.application !== 'Ex-libris' || !Array.isArray(contenu.livres)) {
        throw new Error("Ce fichier n'est pas une sauvegarde d'Ex-libris. Choisis ma-bibliotheque.json.");
      }
      liste = alleger(contenu);
      await ecrireListe(liste);
      etat.onglet = 'scanner';
      etat.resultat = null;
      rendre();
      toast(`Liste à jour : ${pluriel(presents().length, 'livre', 'livres')}.`);
    } catch (e) {
      toast(e.message, { duree: 9000 });
    }
    input.value = '';
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled || !actions[el.dataset.action]) return;
    e.preventDefault();
    Promise.resolve(actions[el.dataset.action](el, e)).catch((erreur) => {
      console.error(erreur);
      toast("Quelque chose s'est mal passé. Ferme et rouvre Ex-libris si ça continue.");
    });
  });

  document.addEventListener('submit', (e) => {
    if (!e.target.closest('[data-form="recherche"]')) return;
    e.preventDefault();
    const champ = document.getElementById('poche-cherche');
    if (I.ressembleACode(champ.value)) actions['verifier-code']();
    else champ.blur(); // referme le clavier pour voir les résultats
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'poche-cherche') document.getElementById('poche-trouves').innerHTML = rendreTrouves(e.target.value);
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'fichier-liste') chargerFichier(e.target);
  });

  // Téléphone mis en poche ou autre appli : on libère la caméra.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && etat.arreterCamera) eteindreCamera();
  });

  // Chrome propose l'installation : on garde l'invitation pour notre propre bouton.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    etat.installation = e;
    if (etat.onglet === 'maj') rendre();
  });

  async function demarrer() {
    try {
      liste = await lireListe();
    } catch (e) {
      liste = null;
    }
    if (!liste) etat.onglet = 'maj';
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw-poche.js').catch(() => {});
    }
    rendre();
  }

  Bib.poche = { verdict, etat: () => ({ ...etat, liste }) };
  demarrer();
})();
