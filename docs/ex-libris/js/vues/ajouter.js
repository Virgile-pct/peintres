/*
 * Ajouter des livres.
 * Deux façons de faire :
 *  - un livre à la fois (un achat, un cadeau) : on montre la fiche trouvée, on confirme ;
 *  - inventaire d'une étagère : on scanne en rafale, chaque livre est ajouté et rangé sans clic,
 *    et ceux déjà connus sont notés comme « vus ici » (et déplacés s'ils étaient rangés ailleurs).
 * Dans les deux cas, l'anti-doublon passe avant tout.
 */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const { esc, toast, pluriel, euros, dateLongue, moisAnnee, uid, enumerer } = Bib.outils;
  const D = Bib.donnees;
  const C = Bib.couverture;
  const I = Bib.isbn;

  const etat = {
    mode: 'unitaire',
    recherche: null, // code en cours de recherche
    resultat: null,
    session: [], // inventaire en cours : { id, quoi: 'ajoute' | 'vu' | 'deplace' }
    arreterCamera: null,
    titres: null, // recherche par titre : { enCours, resultats, erreur }
  };
  let file = Promise.resolve(); // les scans rapides sont traités dans l'ordre

  const reglages = () => D.etat.reglages;
  const statutParDefaut = () => (reglages().statutDefaut ?? 'a-lire');

  // ---------- Étagères prévues ----------

  // « Grande bibliothèque gauche, étagère 3 » se range sous le meuble « Grande bibliothèque gauche ».
  const meubleDe = (e) => {
    const i = (e.rangement || '').lastIndexOf(', ');
    return i > 0 ? e.rangement.slice(0, i) : '';
  };

  function indexEmplacementCourant() {
    const r = reglages();
    return D.emplacements().findIndex((e) => (e.piece || '') === (r.pieceCourante || '') && (e.rangement || '') === (r.rangementCourant || ''));
  }

  function rendreChoixEtagere() {
    const liste = D.emplacements();
    if (!liste.length) return '';
    const courant = indexEmplacementCourant();
    const groupes = [];
    liste.forEach((e, i) => {
      const nom = [e.piece, meubleDe(e)].filter(Boolean).join(', ') || 'Autres';
      if (!groupes.length || groupes[groupes.length - 1].nom !== nom) groupes.push({ nom, options: [] });
      groupes[groupes.length - 1].options.push(`<option value="${i}"${i === courant ? ' selected' : ''}>${esc(e.rangement || e.piece)}</option>`);
    });
    return `<label class="champ choix-etagere"><span>Étagère prévue</span>
      <select class="saisie" data-change="choisir-emplacement" id="choix-etagere">
        <option value=""${courant === -1 ? ' selected' : ''}>Choisis une étagère…</option>
        ${groupes.map((g) => `<optgroup label="${esc(g.nom)}">${g.options.join('')}</optgroup>`).join('')}
      </select></label>`;
  }

  // Met l'étagère courante à jour sans redessiner l'écran (un scan peut être en cours).
  async function allerA(index) {
    const e = D.emplacements()[index];
    if (!e) return;
    await D.reglage('pieceCourante', e.piece || '');
    await D.reglage('rangementCourant', e.rangement || '');
    const champs = { pieceCourante: e.piece || '', rangementCourant: e.rangement || '' };
    for (const [cle, valeur] of Object.entries(champs)) {
      const champ = document.querySelector(`[data-cle="${cle}"]`);
      if (champ) champ.value = valeur;
    }
    const choix = document.getElementById('choix-etagere');
    if (choix) choix.value = String(index);
  }

  // ---------- Rendu ----------

  function rendre(params) {
    if (params.mode === 'inventaire' || params.mode === 'unitaire') etat.mode = params.mode;
    const inventaire = etat.mode === 'inventaire';
    const r = reglages();
    const statuts = [['a-lire', 'À lire'], ['lu', 'Déjà lus'], ['', 'Je ne sais pas']];
    return `
      <header class="entete">
        <div>
          <h1>Ajouter des livres</h1>
          <p>${inventaire
            ? "Scanne à la suite tous les livres d'une même étagère : ils sont ajoutés et rangés au fur et à mesure, sans clic."
            : "Scanne un livre : Ex-libris vérifie d'abord si tu l'as déjà, puis retrouve sa fiche dans les catalogues."}</p>
        </div>
        <div class="segments" role="group" aria-label="Façon d'ajouter">
          <button type="button" data-action="mode-ajout" data-valeur="unitaire" aria-pressed="${!inventaire}">Un livre à la fois</button>
          <button type="button" data-action="mode-ajout" data-valeur="inventaire" aria-pressed="${inventaire}">Inventaire d'une étagère</button>
        </div>
      </header>

      <div class="ajout">
        <div class="ajout__colonne">
          <form class="scan" data-form="scan" autocomplete="off">
            <label class="scan__etiquette" for="champ-scan">Code-barres du livre</label>
            <div class="scan__ligne">
              <input id="champ-scan" name="code" class="scan__champ" inputmode="numeric" spellcheck="false"
                placeholder="Scanne, ou tape les 13 chiffres">
              <button class="bouton" type="submit">Chercher</button>
            </div>
            <div class="scan__aide">
              <button type="button" class="bouton bouton--second" data-action="camera">${Bib.icones.camera}<span>${etat.arreterCamera ? 'Éteindre la webcam' : 'Scanner avec la webcam'}</span></button>
              <span>La douchette marche aussi depuis les autres écrans.</span>
            </div>
            <div class="camera" id="camera" ${etat.arreterCamera ? '' : 'hidden'}>
              <video id="video-camera" muted playsinline></video>
              <span class="camera__viseur" aria-hidden="true"></span>
              <p>Tiens le dos du livre face à la webcam, à une vingtaine de centimètres, bien éclairé.</p>
            </div>
          </form>

          <fieldset class="rangement-courant${inventaire ? ' rangement-courant--inventaire' : ''}">
            <legend>${inventaire ? 'Étagère inventoriée' : 'Où ranger les nouveaux livres ?'}</legend>
            ${rendreChoixEtagere()}
            <div class="grille-champs">
              <label class="champ"><span>Pièce</span>
                <input class="saisie" data-change="reglage" data-cle="pieceCourante" list="liste-pieces" value="${esc(r.pieceCourante || '')}" placeholder="Salon, chambre…"></label>
              <label class="champ"><span>Meuble ou étagère</span>
                <input class="saisie" data-change="reglage" data-cle="rangementCourant" list="liste-rangements" value="${esc(r.rangementCourant || '')}" placeholder="Grande bibliothèque, étagère 2…"></label>
              <label class="champ"><span>Ces livres sont</span>
                <select class="saisie" data-change="reglage" data-cle="statutDefaut">${statuts
                  .map(([v, t]) => `<option value="${v}"${statutParDefaut() === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
            </div>
          </fieldset>

          ${inventaire ? `<div id="session">${rendreSession()}</div>` : ''}
        </div>

        <div class="ajout__colonne" id="resultat-ajout" aria-live="polite">${rendreResultat()}</div>
      </div>

      <section class="section sans-code">
        <h2>Un livre sans code-barres ?</h2>
        <p>Les livres d'avant les années 1970 n'en ont souvent pas. Cherche-le par son titre dans le catalogue de la Bibliothèque nationale de France, ou décris-le toi-même.</p>
        <form class="sans-code__formulaire" data-form="titre" autocomplete="off">
          <label class="champ"><span>Titre</span><input class="saisie" name="titre" required value="${esc((etat.titres && etat.titres.titre) || '')}"></label>
          <label class="champ"><span>Auteur (facultatif)</span><input class="saisie" name="auteur" value="${esc((etat.titres && etat.titres.auteur) || '')}"></label>
          <button class="bouton" type="submit">${Bib.icones.chercher}<span>Chercher</span></button>
          <button class="bouton bouton--discret" type="button" data-action="saisie-manuelle">Le décrire moi-même</button>
        </form>
        <div id="resultats-titre">${rendreTitres()}</div>
      </section>`;
  }

  function lignesInfos(f) {
    const lignes = [];
    const edition = [f.editeur, f.collection, f.annee].filter(Boolean).join(', ');
    if (edition) lignes.push(edition);
    if (f.pages) lignes.push(`${f.pages} pages${f.hauteur ? `, ${f.hauteur} cm de haut` : ''}`);
    if (f.serie) lignes.push(`Série ${f.serie}${f.tome ? `, tome ${f.tome}` : ''}`);
    if (f.genre) lignes.push(f.genre);
    if (f.prix) lignes.push(`Prix neuf ${euros(f.prix)}`);
    return lignes.map((t) => `<li>${esc(t)}</li>`).join('');
  }

  function carteLivre(f, { grande = false } = {}) {
    return `<div class="carte-livre${grande ? ' carte-livre--grande' : ''}">
      ${C.htmlCouverture(f, grande ? 'couv--grande' : 'couv--moyenne')}
      <div class="carte-livre__texte">
        <h3>${esc(f.titre || 'Sans titre')}</h3>
        ${f.sousTitre ? `<p class="carte-livre__sous-titre">${esc(f.sousTitre)}</p>` : ''}
        ${(f.auteurs || []).length ? `<p class="carte-livre__auteurs">${esc(f.auteurs.join(', '))}</p>` : ''}
        <ul class="carte-livre__infos">${lignesInfos(f)}</ul>
      </div>
    </div>`;
  }

  function situation(l) {
    const ou = D.emplacement(l);
    const lignes = [ou ? `Rangé : ${ou}` : 'Pas encore rangé'];
    if (l.statut === 'lu') lignes.push(`Lu${l.dateLecture ? ` en ${moisAnnee(l.dateLecture)}` : ''}`);
    else if (l.statut) lignes.push(Bib.fiche.LIBELLES_STATUT[l.statut]);
    if (l.exemplaires > 1) lignes.push(`${l.exemplaires} exemplaires`);
    return lignes.map((t) => `<li>${esc(t)}</li>`).join('');
  }

  function rendreResultat() {
    if (etat.recherche) {
      return `<div class="resultat resultat--attente">
        <span class="feuilletage" aria-hidden="true"><span></span><span></span><span></span></span>
        <p>Recherche du ${esc(etat.recherche)} dans les catalogues…</p></div>`;
    }
    const r = etat.resultat;
    if (!r) return reposResultat();
    switch (r.type) {
      case 'deja': return rendreDeja(r);
      case 'trouve': return rendreTrouve(r);
      case 'ajoute': return rendreAjoute(r);
      case 'envie': return `<div class="resultat">${carteLivre(r.fiche)}<p class="resultat__message">Il est dans ta liste d'envies. <a href="#/envies">Voir la liste</a></p></div>`;
      case 'bilan': return rendreBilan(r);
      case 'invalide': return message('Ce code ne correspond à aucun livre', `Les chiffres lus (${r.code || 'aucun'}) ne forment pas un code-barres valide. Rescanne le livre, ou vérifie les 13 chiffres sous le code-barres.`);
      case 'revue': return message("C'est un magazine", 'Les codes en 977 désignent des revues et des journaux, pas des livres. Tu peux quand même le décrire toi-même plus bas.');
      default: return rendreManuel(r);
    }
  }

  function message(titre, texte) {
    return `<div class="resultat resultat--message"><h3>${esc(titre)}</h3><p>${esc(texte)}</p></div>`;
  }

  function reposResultat() {
    return `<div class="resultat resultat--repos">
      <svg class="repos__code" viewBox="0 0 190 96" aria-hidden="true">
        <g fill="currentColor">${[0, 4, 7, 12, 15, 21, 24, 27, 33, 36, 41, 45, 48, 54, 57, 62, 66, 69, 74, 78, 83, 86, 90, 95, 99, 102, 107, 112, 115, 120, 124, 127, 133, 136, 141, 145, 148, 154, 158, 161, 166, 170, 174, 178, 182, 186]
          .map((x, i) => `<rect x="${x}" y="0" width="${i % 3 ? 1.6 : 2.6}" height="${i === 0 || i === 23 || i === 45 ? 80 : 72}"/>`).join('')}</g>
        <text x="95" y="93" text-anchor="middle" font-size="13" fill="currentColor" font-family="'Atkinson Hyperlegible', sans-serif" letter-spacing="2">978 2 07 058462 8</text>
      </svg>
      <p>Le code-barres est au dos du livre, en bas. Ses chiffres commencent par 978 ou 979 : c'est l'ISBN, la carte d'identité du livre.</p>
    </div>`;
  }

  function rendreDeja(r) {
    const l = r.livre;
    const inventaire = etat.mode === 'inventaire';
    return `<div class="resultat resultat--deja">
      <div class="tampon" aria-hidden="true">Déjà dans ta bibliothèque</div>
      <p class="lecteur-ecran">Déjà dans ta bibliothèque.</p>
      ${carteLivre(l)}
      <ul class="resultat__situation">${situation(l)}</ul>
      ${r.deplace ? `<p class="resultat__note">Il était rangé ${r.deplace.avant ? `ailleurs (${esc(r.deplace.avant)})` : 'nulle part'} : il est maintenant noté sur cette étagère.</p>` : ''}
      ${inventaire && !r.deplace ? '<p class="resultat__note">Noté comme vu sur cette étagère.</p>' : ''}
      <div class="resultat__actions">
        <button type="button" class="bouton" data-action="fiche" data-id="${esc(l.id)}">Ouvrir la fiche</button>
        <button type="button" class="bouton bouton--second" data-action="exemplaire" data-id="${esc(l.id)}">J'en ai un exemplaire de plus</button>
      </div>
    </div>`;
  }

  function rendreTrouve(r) {
    const avertissements = [];
    if (r.editions.length) {
      avertissements.push(`<div class="avertissement">
        <p><strong>Tu as peut-être déjà ce livre dans une autre édition :</strong></p>
        <ul class="avertissement__liste">${r.editions.map((l) => `<li>
          <button type="button" class="lien-livre" data-action="fiche" data-id="${esc(l.id)}">${C.htmlCouverture(l, 'couv--mini')}
          <span><strong>${esc(l.titre)}</strong> ${esc([l.editeur, l.collection, l.annee].filter(Boolean).join(', '))}<br>
          <small>${esc(D.emplacement(l) || 'pas encore rangé')}</small></span></button></li>`).join('')}</ul>
      </div>`);
    }
    for (const l of r.sortis) {
      avertissements.push(`<div class="avertissement avertissement--doux"><p>Tu l'as déjà eu : retiré le ${esc(dateLongue(l.sorti.date))} (${esc(l.sorti.motif.toLowerCase())}).</p></div>`);
    }
    if (r.envie) {
      avertissements.push(`<div class="avertissement avertissement--envie"><p>Il est sur ta liste d'envies : il en sera rayé dès que tu l'ajoutes.</p></div>`);
    }
    return `<div class="resultat resultat--trouve">
      ${avertissements.join('')}
      ${carteLivre(r.fiche, { grande: true })}
      <div class="resultat__actions">
        <button type="button" class="bouton" data-action="ajouter-fiche">Ajouter à la bibliothèque</button>
        <button type="button" class="bouton bouton--second" data-action="envie-fiche">Mettre dans mes envies</button>
        <button type="button" class="bouton bouton--discret" data-action="oublier-resultat">Laisser tomber</button>
      </div>
    </div>`;
  }

  function rendreAjoute(r) {
    const l = r.livre;
    return `<div class="resultat resultat--ajoute">
      <p class="resultat__confirmation">Ajouté à la bibliothèque${D.emplacement(l) ? `, rangé : ${esc(D.emplacement(l))}` : ''}.</p>
      ${carteLivre(l)}
      ${r.envie ? '<p class="resultat__note">Rayé de ta liste d\'envies.</p>' : ''}
      <div class="resultat__actions">
        <button type="button" class="bouton bouton--second" data-action="fiche" data-id="${esc(l.id)}">Ouvrir la fiche</button>
        <button type="button" class="bouton bouton--discret" data-action="annuler-ajout" data-id="${esc(l.id)}">Annuler l'ajout</button>
      </div>
    </div>`;
  }

  function rendreManuel(r) {
    const textes = {
      introuvable: ['Ce livre n\'est dans aucun catalogue', `Le code ${r.code} n'a été trouvé ni à la BnF ni sur Open Library. Décris-le toi-même : seul le titre est obligatoire.`],
      horsLigne: ['Les catalogues ne répondent pas', 'Vérifie que l\'ordinateur est connecté à Internet, puis rescanne le livre. Tu peux aussi le décrire toi-même.'],
      ean: ['Ce code n\'est pas celui d\'un livre', `Le code ${r.code} ne commence pas par 978 ou 979. Si c'est bien un livre, décris-le toi-même.`],
      manuel: ['Décrire un livre', 'Seul le titre est obligatoire. Tu pourras compléter la fiche plus tard.'],
    };
    const [titre, texte] = textes[r.type] || textes.manuel;
    const f = r.fiche || {};
    const champ = (nom, libelle, attributs = '') =>
      `<label class="champ"><span>${libelle}</span><input class="saisie" name="${nom}" value="${esc(nom === 'auteurs' ? (f.auteurs || []).join(', ') : f[nom] || '')}" ${attributs}></label>`;
    return `<div class="resultat resultat--manuel">
      <h3>${esc(titre)}</h3><p>${esc(texte)}</p>
      <form class="grille-champs" data-form="manuel" autocomplete="off">
        <div class="champ--large">${champ('titre', 'Titre', 'required')}</div>
        <div class="champ--large">${champ('auteurs', 'Auteurs (séparés par des virgules)')}</div>
        ${champ('editeur', 'Éditeur')}
        ${champ('annee', 'Année', 'inputmode="numeric"')}
        ${champ('serie', 'Série')}
        ${champ('tome', 'Tome')}
        ${champ('genre', 'Genre', 'list="liste-genres"')}
        ${champ('pages', 'Pages', 'inputmode="numeric"')}
        <input type="hidden" name="isbn" value="${esc(r.code || f.isbn || '')}">
        <div class="resultat__actions champ--large">
          <button class="bouton" type="submit">Ajouter à la bibliothèque</button>
          <button class="bouton bouton--discret" type="button" data-action="oublier-resultat">Laisser tomber</button>
        </div>
      </form>
    </div>`;
  }

  function rendreSession() {
    if (!etat.session.length) {
      return `<div class="session session--vide"><p>Les livres scannés sur cette étagère s'afficheront ici. Quand elle est finie, termine-la pour voir si des livres manquent à l'appel.</p></div>`;
    }
    const compte = (quoi) => etat.session.filter((s) => s.quoi === quoi).length;
    const libelles = { ajoute: 'ajouté', vu: 'déjà là', deplace: 'déplacé ici' };
    const details = [];
    if (compte('ajoute')) details.push(pluriel(compte('ajoute'), 'ajouté', 'ajoutés'));
    if (compte('vu')) details.push(pluriel(compte('vu'), 'déjà là', 'déjà là'));
    if (compte('deplace')) details.push(pluriel(compte('deplace'), 'déplacé', 'déplacés'));
    return `<div class="session">
      <h3>Sur cette étagère : ${pluriel(etat.session.length, 'livre scanné', 'livres scannés')}</h3>
      <p>${esc(enumerer(details))}.</p>
      <ol class="session__liste" reversed>${[...etat.session].reverse().slice(0, 12).map((s) => {
        const l = D.livre(s.id);
        return l ? `<li><button type="button" class="lien-livre" data-action="fiche" data-id="${esc(l.id)}">${esc(l.titre)}</button><span class="pastille pastille--${s.quoi}">${libelles[s.quoi]}</span></li>` : '';
      }).join('')}</ol>
      <button type="button" class="bouton bouton--second" data-action="terminer-etagere">Terminer cette étagère</button>
    </div>`;
  }

  function rendreBilan(r) {
    const titre = r.lieu ? `Étagère terminée : ${r.lieu}` : 'Étagère terminée';
    return `<div class="resultat resultat--bilan">
      <h3>${esc(titre)}</h3>
      <p>${pluriel(r.vus, 'livre scanné', 'livres scannés')}.</p>
      ${r.absents.length ? `<div class="avertissement">
          <p><strong>${pluriel(r.absents.length, 'livre noté sur cette étagère n\'a pas été scanné', 'livres notés sur cette étagère n\'ont pas été scannés')}.</strong> ${r.absents.length > 1 ? 'Ils sont peut-être prêtés, ou rangés ailleurs.' : 'Il est peut-être prêté, ou rangé ailleurs.'}</p>
          <ul class="avertissement__liste">${r.absents.map((l) => `<li><button type="button" class="lien-livre" data-action="fiche" data-id="${esc(l.id)}">${C.htmlCouverture(l, 'couv--mini')}<span><strong>${esc(l.titre)}</strong><br><small>${esc(l.auteurs.join(', '))}</small></span></button></li>`).join('')}</ul>
        </div>`
        : '<p>Aucun livre ne manque à l\'appel.</p>'}
      ${r.suivante ? `<div class="resultat__actions">
          <button type="button" class="bouton" data-action="etagere-suivante" data-index="${r.suivante.index}">Passer à l'étagère suivante</button>
        </div>
        <p class="section__aide">Ensuite : ${esc(r.suivante.lieu)}.</p>`
        : '<p>Indique la prochaine étagère à gauche, puis continue de scanner.</p>'}
    </div>`;
  }

  function rendreTitres() {
    const t = etat.titres;
    if (!t) return '';
    if (t.enCours) return '<p class="attente-texte">Recherche à la BnF…</p>';
    if (t.erreur) return `<p class="erreur-texte">${esc(t.erreur)}</p>`;
    if (!t.resultats.length) return '<p>Aucun livre trouvé avec ce titre. Essaie avec moins de mots, ou décris-le toi-même.</p>';
    return `<p>${pluriel(t.resultats.length, 'résultat', 'résultats')}. Choisis la bonne édition :</p>
      <ul class="liste-titres">${t.resultats.map((f, i) => `<li>
        ${C.htmlCouverture(f, 'couv--mini')}
        <div><strong>${esc(f.titre)}</strong>${f.sousTitre ? ` : ${esc(f.sousTitre)}` : ''}<br>
        <small>${esc([f.auteurs.join(', '), f.editeur, f.collection, f.annee, f.pages ? `${f.pages} p.` : ''].filter(Boolean).join(', '))}</small></div>
        <button type="button" class="bouton bouton--second" data-action="choisir-titre" data-index="${i}">Choisir</button>
      </li>`).join('')}</ul>`;
  }

  // ---------- Mises à jour partielles (la vue garde son champ et sa webcam) ----------

  function majResultat() {
    const zone = document.getElementById('resultat-ajout');
    if (zone) zone.innerHTML = rendreResultat();
    const session = document.getElementById('session');
    if (session) session.innerHTML = rendreSession();
  }

  function majTitres() {
    const zone = document.getElementById('resultats-titre');
    if (zone) zone.innerHTML = rendreTitres();
  }

  function montrer(resultat) {
    etat.resultat = resultat;
    majResultat();
    const champ = document.getElementById('champ-scan');
    if (champ && !(resultat && resultat.type === 'manuel') && document.activeElement !== champ) champ.focus({ preventScroll: true });
  }

  function noterSession(l, quoi) {
    if (etat.mode !== 'inventaire') return;
    etat.session = etat.session.filter((s) => s.id !== l.id);
    etat.session.push({ id: l.id, quoi });
  }

  // ---------- Logique ----------

  async function ajouterLivre(fiche, envie) {
    const r = reglages();
    const l = D.nouveauLivre({ ...fiche, piece: r.pieceCourante || '', rangement: r.rangementCourant || '', statut: statutParDefaut() });
    await D.enregistrerLivre(l, { type: 'ajout', detail: D.emplacement(l) });
    if (envie) await D.supprimerEnvie(envie.id);
    noterSession(l, 'ajoute');
    return l;
  }

  function traiter(saisie) {
    file = file.then(() => traiterUn(saisie)).catch((e) => {
      console.error(e);
      etat.recherche = null;
      montrer({ type: 'horsLigne', code: I.chiffres(saisie) });
    });
    return file;
  }

  async function traiterUn(saisie) {
    const a = I.analyser(saisie);
    if (a.type === 'invalide') return montrer({ type: 'invalide', code: a.brut });
    if (a.type === 'revue') return montrer({ type: 'revue', code: a.ean });
    const code = a.isbn || a.ean;

    // 1. L'a-t-elle déjà ?
    const existants = D.parIsbn(code);
    const present = existants.find((l) => !l.sorti);
    if (present) {
      let deplace = null;
      if (etat.mode === 'inventaire') {
        const r = reglages();
        const piece = r.pieceCourante || '';
        const rangement = r.rangementCourant || '';
        if ((piece || rangement) && (present.piece !== piece || present.rangement !== rangement)) {
          deplace = { avant: D.emplacement(present) };
          present.piece = piece;
          present.rangement = rangement;
          await D.enregistrerLivre(present, { type: 'deplacement', detail: D.emplacement(present) });
        }
        noterSession(present, deplace ? 'deplace' : 'vu');
      }
      return montrer({ type: 'deja', livre: present, deplace });
    }
    if (a.type === 'ean') return montrer({ type: 'ean', code });

    // 2. Sinon, on cherche sa fiche.
    etat.recherche = code;
    majResultat();
    let reponse;
    try {
      reponse = await Bib.catalogues.chercherParIsbn(a.isbn, a.isbn10);
    } finally {
      etat.recherche = null;
    }
    if (!reponse.fiche) return montrer({ type: reponse.horsLigne ? 'horsLigne' : 'introuvable', code });

    const fiche = reponse.fiche;
    const editions = D.autresEditions(fiche);
    const envie = D.envieCorrespondante(fiche);
    const sortis = existants.filter((l) => l.sorti);
    // En inventaire, on n'arrête la rafale que s'il y a un doute (autre édition déjà présente).
    if (etat.mode === 'inventaire' && !editions.length) {
      const l = await ajouterLivre(fiche, envie);
      return montrer({ type: 'ajoute', livre: l, envie });
    }
    montrer({ type: 'trouve', fiche, editions, envie, sortis });
  }

  async function basculerCamera() {
    if (etat.arreterCamera) {
      etat.arreterCamera();
      etat.arreterCamera = null;
      return Bib.app.afficher({ garderDefilement: true });
    }
    const zone = document.getElementById('camera');
    zone.hidden = false;
    try {
      etat.arreterCamera = await Bib.scanner.demarrerCamera(
        document.getElementById('video-camera'),
        (code) => {
          if (etat.mode !== 'inventaire') {
            etat.arreterCamera = null;
            const z = document.getElementById('camera');
            if (z) z.hidden = true;
            majBoutonCamera();
          }
          traiter(code);
        },
        { continu: etat.mode === 'inventaire' }
      );
    } catch (e) {
      zone.hidden = true;
      etat.arreterCamera = null;
      toast(Bib.scanner.messageErreurCamera(e), { duree: 9000 });
    }
    majBoutonCamera();
  }

  function majBoutonCamera() {
    const texte = document.querySelector('[data-action="camera"] span');
    if (texte) texte.textContent = etat.arreterCamera ? 'Éteindre la webcam' : 'Scanner avec la webcam';
  }

  function quitter() {
    if (etat.arreterCamera) {
      etat.arreterCamera();
      etat.arreterCamera = null;
    }
  }

  // ---------- Actions ----------

  Object.assign(Bib.actions, {
    'mode-ajout': (el) => {
      quitter();
      etat.mode = el.dataset.valeur;
      etat.session = [];
      etat.resultat = null;
      Bib.app.aller('ajouter', { mode: etat.mode });
    },
    'camera': () => basculerCamera(),
    'ajouter-fiche': async () => {
      const r = etat.resultat;
      const l = await ajouterLivre(r.fiche, r.envie);
      montrer({ type: 'ajoute', livre: l, envie: r.envie });
    },
    'envie-fiche': async () => {
      const f = etat.resultat.fiche;
      await D.enregistrerEnvie({ id: uid(), isbn: f.isbn, titre: f.titre, auteurs: f.auteurs || [], serie: f.serie, tome: f.tome, couverture: f.couverture, editeur: f.editeur, prix: f.prix, origine: 'scan' });
      montrer({ type: 'envie', fiche: f });
    },
    'oublier-resultat': () => montrer(null),
    'exemplaire': async (el) => {
      const l = D.livre(el.dataset.id);
      l.exemplaires = (l.exemplaires || 1) + 1;
      await D.enregistrerLivre(l, { type: 'exemplaire', detail: `${l.exemplaires} exemplaires` });
      montrer({ type: 'deja', livre: l });
      toast(`Tu as maintenant ${l.exemplaires} exemplaires de « ${l.titre} ».`);
    },
    'annuler-ajout': async (el) => {
      const l = D.livre(el.dataset.id);
      if (!l) return;
      await D.supprimerLivre(l, { silencieux: true });
      etat.session = etat.session.filter((s) => s.id !== l.id);
      montrer(null);
      toast(`L'ajout de « ${l.titre} » est annulé.`);
    },
    'terminer-etagere': () => {
      const r = reglages();
      const piece = r.pieceCourante || '';
      const rangement = r.rangementCourant || '';
      const vus = new Set(etat.session.map((s) => s.id));
      const absents = (piece || rangement)
        ? D.presents().filter((l) => l.piece === piece && l.rangement === rangement && !vus.has(l.id))
        : [];
      const i = indexEmplacementCourant();
      const prochaine = i === -1 ? null : D.emplacements()[i + 1];
      const suivante = prochaine ? { index: i + 1, lieu: [prochaine.piece, prochaine.rangement].filter(Boolean).join(', ') } : null;
      const bilan = { type: 'bilan', vus: etat.session.length, absents, suivante, lieu: [piece, rangement].filter(Boolean).join(', ') };
      etat.session = [];
      montrer(bilan);
      const champRangement = document.querySelector('[data-cle="rangementCourant"]');
      if (champRangement) champRangement.select();
    },
    'etagere-suivante': async (el) => {
      await allerA(Number(el.dataset.index));
      montrer(null);
      const champ = document.getElementById('champ-scan');
      if (champ) champ.focus({ preventScroll: true });
      toast(`Étagère suivante : ${reglages().rangementCourant}.`);
    },
    'saisie-manuelle': () => {
      montrer({ type: 'manuel', code: '' });
      document.getElementById('resultat-ajout').scrollIntoView({ behavior: 'smooth', block: 'start' });
      const titre = document.querySelector('[data-form="manuel"] [name="titre"]');
      if (titre) titre.focus({ preventScroll: true });
    },
    'choisir-titre': async (el) => {
      const fiche = { ...etat.titres.resultats[Number(el.dataset.index)] };
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (fiche.isbn) {
        const deja = D.parIsbn(fiche.isbn).find((l) => !l.sorti);
        if (deja) return montrer({ type: 'deja', livre: deja });
        etat.recherche = fiche.isbn;
        majResultat();
        try {
          fiche.couverture = await Bib.catalogues.meilleureCouverture(fiche.isbn, [fiche]);
        } finally {
          etat.recherche = null;
        }
      }
      montrer({ type: 'trouve', fiche, editions: D.autresEditions(fiche), envie: D.envieCorrespondante(fiche), sortis: [] });
    },
  });

  Object.assign(Bib.formulaires, {
    scan: (form) => {
      const valeur = form.elements.code.value;
      form.elements.code.value = '';
      if (valeur.trim()) traiter(valeur);
    },
    titre: async (form) => {
      const titre = form.elements.titre.value.trim();
      const auteur = form.elements.auteur.value.trim();
      if (!titre) return;
      etat.titres = { titre, auteur, enCours: true };
      majTitres();
      try {
        etat.titres = { titre, auteur, resultats: await Bib.catalogues.chercherParTitre(titre, auteur) };
      } catch (e) {
        etat.titres = { titre, auteur, erreur: 'La BnF ne répond pas. Vérifie la connexion Internet et réessaie.' };
      }
      majTitres();
    },
    manuel: async (form) => {
      const v = (nom) => form.elements[nom].value.trim();
      const fiche = {
        titre: v('titre'),
        auteurs: v('auteurs').split(',').map((a) => a.trim()).filter(Boolean),
        editeur: v('editeur'), annee: v('annee'), serie: v('serie'), tome: v('tome'), genre: v('genre'),
        pages: Math.round(Number(v('pages'))) || null,
        isbn: v('isbn'), source: 'manuel',
      };
      const l = await ajouterLivre(fiche, D.envieCorrespondante(fiche));
      montrer({ type: 'ajoute', livre: l });
    },
  });

  Object.assign(Bib.changements, {
    'choisir-emplacement': (el) => {
      if (el.value !== '') allerA(Number(el.value));
    },
  });

  Bib.vues.ajouter = {
    titre: 'Ajouter des livres',
    rendre,
    apres: () => {
      const champ = document.getElementById('champ-scan');
      if (champ) champ.focus({ preventScroll: true });
    },
    surChangement: () => {}, // la vue se met à jour elle-même, pour ne pas couper un scan en cours
    quitter,
    traiter,
  };
})();
