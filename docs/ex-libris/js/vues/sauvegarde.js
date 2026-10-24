/* Sauvegarde et réglages. */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const { esc, pluriel, dateLongue, heure, toast } = Bib.outils;
  const D = Bib.donnees;
  const S = Bib.sauvegarde;

  const ADRESSE_POCHE = 'https://virgile-pct.github.io/peintres/ex-libris/poche.html';
  const LIBRAIRIE_QR = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';

  function blocTelephone() {
    const fichier = D.etat.reglages.fichier;
    return `<p>En librairie, le téléphone dit tout de suite si un livre est déjà à la maison. Il relit le fichier de sauvegarde automatique${fichier ? ` (<strong>${esc(fichier.name)}</strong>)` : ''} : pour qu'il le trouve, ce fichier doit être dans <strong>OneDrive</strong> ou <strong>Google Drive</strong>, avec l'appli du même nom installée sur le téléphone.</p>
      <div class="telephone">
        <div class="telephone__qr" id="qr-poche" aria-hidden="true"></div>
        <ol class="etapes etapes--compactes">
          <li><span>Flashe ce code avec l'appareil photo du téléphone et ouvre le lien.</span></li>
          <li><span>Touche « Installer Ex-libris sur ce téléphone » (ou, dans le menu de Chrome, « Ajouter à l'écran d'accueil »).</span></li>
          <li><span>Touche « Choisir le fichier » et prends ce fichier de sauvegarde dans OneDrive. À refaire avant d'aller en librairie, pour avoir les derniers achats.</span></li>
        </ol>
      </div>
      <p class="section__aide">Adresse : ${esc(ADRESSE_POCHE.replace('https://', ''))}</p>`;
  }

  // Le QR code est dessiné en SVG par une petite librairie chargée au besoin (hors ligne : l'adresse suffit).
  async function dessinerQr() {
    const zone = document.getElementById('qr-poche');
    if (!zone) return;
    try {
      if (!window.qrcode) {
        await new Promise((resoudre, rejeter) => {
          const s = document.createElement('script');
          s.src = LIBRAIRIE_QR;
          s.onload = resoudre;
          s.onerror = rejeter;
          document.head.append(s);
        });
      }
      const qr = window.qrcode(0, 'M');
      qr.addData(ADRESSE_POCHE);
      qr.make();
      zone.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
    } catch (e) {
      zone.hidden = true;
    }
  }

  function blocAutomatique() {
    if (!S.PRISE_EN_CHARGE) {
      return `<p>Ce navigateur ne sait pas écrire seul dans un fichier. Ouvre Ex-libris avec <strong>Microsoft Edge</strong> ou <strong>Google Chrome</strong> pour la sauvegarde automatique, ou télécharge une copie de temps en temps (ci-dessous).</p>`;
    }
    const fichier = D.etat.reglages.fichier;
    const statut = S.statut();
    const derniere = D.etat.reglages.derniereSauvegarde;
    if (!fichier) {
      return `<p>Choisis un fichier où Ex-libris recopiera toute la bibliothèque après chaque modification. Le mieux : un dossier OneDrive, ou une clé USB qui reste branchée. Si l'ordinateur tombe en panne, rien n'est perdu.</p>
        <button type="button" class="bouton" data-action="choisir-fichier">Choisir le fichier de sauvegarde</button>`;
    }
    const etatTexte = {
      ok: `Tout est sauvegardé dans <strong>${esc(fichier.name)}</strong>${derniere ? `, dernière copie le ${esc(dateLongue(derniere))} à ${esc(heure(new Date(derniere)))}` : ''}.`,
      'en-cours': 'Sauvegarde en cours…',
      'a-reconnecter': `Le navigateur demande ton accord pour continuer à écrire dans <strong>${esc(fichier.name)}</strong>. C'est normal après avoir relancé l'ordinateur : clique sur le bouton, puis sur « Autoriser ».`,
      erreur: `La dernière écriture dans <strong>${esc(fichier.name)}</strong> a échoué. Le fichier a peut-être été déplacé, ou la clé USB retirée. Choisis à nouveau le fichier.`,
    };
    return `<p class="sauvegarde__etat sauvegarde__etat--${esc(statut)}">${etatTexte[statut] || etatTexte['a-reconnecter']}</p>
      <div class="resultat__actions">
        ${statut === 'a-reconnecter' ? '<button type="button" class="bouton" data-action="reconnecter-sauvegarde">Reprendre la sauvegarde</button>' : ''}
        <button type="button" class="bouton bouton--second" data-action="choisir-fichier">Changer de fichier</button>
      </div>`;
  }

  function rendre() {
    const r = D.etat.reglages;
    const { livres, envies, journal } = D.etat;
    const retires = livres.filter((l) => l.sorti).length;
    return `
      <header class="entete"><div><h1>Sauvegarde et réglages</h1>
        <p>Les livres sont enregistrés dans ce navigateur, sur cet ordinateur. Une copie dans un fichier les met à l'abri.</p></div></header>

      <section class="reglage">
        <h2>Sauvegarde automatique</h2>
        <div id="bloc-automatique">${blocAutomatique()}</div>
      </section>

      <section class="reglage">
        <h2>Sur le téléphone</h2>
        ${blocTelephone()}
      </section>

      <section class="reglage">
        <h2>Copies et export</h2>
        <div class="reglage__actions">
          <div><button type="button" class="bouton bouton--second" data-action="telecharger-copie">Télécharger une copie</button>
            <p>Un fichier .json avec toute la bibliothèque, à garder où tu veux.</p></div>
          <div><button type="button" class="bouton bouton--second" data-action="exporter-tableur">Exporter pour Excel</button>
            <p>La liste des livres en tableau : pour l'imprimer, la trier ou l'envoyer à l'assurance.</p></div>
          <div><label class="bouton bouton--second" for="fichier-restauration">Restaurer une sauvegarde</label>
            <input type="file" id="fichier-restauration" accept=".json,application/json" data-change="restaurer" class="lecteur-ecran">
            <p>Reprend les livres d'une copie. Ceux déjà présents gardent leur version la plus récente : rien n'est écrasé.</p></div>
        </div>
      </section>

      <section class="reglage">
        <h2>Nom de la bibliothèque</h2>
        <label class="champ champ--moyen"><span>Affiché en haut à gauche et sur l'accueil</span>
          <input class="saisie" data-change="reglage" data-cle="nom" value="${esc(r.nom || '')}" placeholder="Ma bibliothèque"></label>
      </section>

      <section class="reglage">
        <h2>Étagères prévues</h2>
        <p>La liste proposée dans « Ajouter des livres », dans l'ordre de l'inventaire. Une étagère par ligne : la pièce, une barre « / », puis le meuble et l'étagère.</p>
        <label class="champ"><span>${pluriel(D.emplacements().length, 'étagère prévue', 'étagères prévues')}</span>
          <textarea class="saisie saisie--etageres" data-change="emplacements" spellcheck="false" rows="8"
            placeholder="Salon / Bibliothèque, étagère 1">${esc(D.emplacements().map((e) => [e.piece, e.rangement].filter(Boolean).join(' / ')).join('\n'))}</textarea></label>
      </section>

      <section class="reglage">
        <h2>Catalogues consultés</h2>
        <p>À chaque scan, Ex-libris interroge le catalogue de la <strong>Bibliothèque nationale de France</strong>, qui connaît presque tous les livres publiés en France, puis <strong>Open Library</strong> pour les livres étrangers et les couvertures.</p>
        <label class="champ champ--moyen"><span>Clé Google Books (facultatif)</span>
          <input class="saisie" data-change="reglage" data-cle="cleGoogle" value="${esc(r.cleGoogle || '')}" spellcheck="false" autocomplete="off"></label>
        <p class="section__aide">Une clé gratuite (créée sur console.cloud.google.com) ajoute Google Books comme troisième source, utile pour les résumés et certaines couvertures.</p>
      </section>

      <section class="reglage">
        <h2>Contenu</h2>
        <p>${pluriel(livres.length - retires, 'livre', 'livres')} dans la bibliothèque, ${pluriel(retires, 'livre retiré', 'livres retirés')}, ${pluriel(envies.length, 'envie', 'envies')}, ${pluriel(journal.length, 'opération', 'opérations')} dans l'historique.</p>
      </section>`;
  }

  Object.assign(Bib.actions, {
    'choisir-fichier': async () => {
      if (await S.choisirFichier()) toast('La sauvegarde automatique est en place.');
      Bib.app.afficher({ garderDefilement: true });
    },
    'reconnecter-sauvegarde': async () => {
      await S.reconnecter();
      if (Bib.app.vueCourante() === 'sauvegarde') Bib.app.afficher({ garderDefilement: true });
    },
    'telecharger-copie': () => S.telechargerCopie(),
    'exporter-tableur': () => S.exporterTableur(),
  });

  Object.assign(Bib.changements, {
    'emplacements': (el) => {
      const liste = el.value.split('\n').map((ligne) => ligne.trim()).filter(Boolean).map((ligne) => {
        const i = ligne.indexOf('/');
        return i === -1 ? { piece: '', rangement: ligne } : { piece: ligne.slice(0, i).trim(), rangement: ligne.slice(i + 1).trim() };
      });
      D.reglage('emplacements', liste);
      toast(pluriel(liste.length, 'étagère enregistrée', 'étagères enregistrées') + '.');
    },
    'restaurer': async (el) => {
      const fichier = el.files[0];
      if (!fichier) return;
      try {
        const { livresAjoutes, livresMisAJour } = await S.restaurer(fichier);
        toast(`Sauvegarde restaurée : ${pluriel(livresAjoutes, 'livre ajouté', 'livres ajoutés')}, ${pluriel(livresMisAJour, 'mis à jour', 'mis à jour')}.`);
      } catch (e) {
        toast(e.message, { duree: 9000 });
      }
      el.value = '';
    },
  });

  Bib.vues.sauvegarde = { titre: 'Sauvegarde', rendre, apres: dessinerQr };
})();
