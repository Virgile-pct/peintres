/*
 * Lecture des codes-barres.
 *  - Douchette USB : elle se comporte comme un clavier qui taperait les 13 chiffres puis Entrée
 *    en quelques millisecondes. On reconnaît ce rythme n'importe où dans l'appli.
 *  - Webcam : API BarcodeDetector du navigateur, ou à défaut sa version portable (zxing en WebAssembly),
 *    chargée seulement au premier usage.
 */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});

  // « ponyfill » : la version qui ne remplace pas celle du navigateur (utile quand celle-ci ignore l'EAN-13).
  const LECTEUR_PORTABLE = 'https://cdn.jsdelivr.net/npm/barcode-detector@3.0.8/dist/iife/ponyfill.js';
  const ECART_MAX_MS = 60; // un humain ne tape pas deux chiffres en moins de 60 ms

  // Les champs faits pour recevoir un code : la douchette y écrit normalement.
  const CHAMPS_A_CODE = '[data-form="scan"] input, [data-form="comptoir"] input, [data-champ="isbn"]';
  const CHAMPS_TEXTE = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, [contenteditable="true"]';

  function ecouterDouchette(surCode) {
    let tampon = '';
    let dernier = 0;
    let champ = null; // champ texte qui avait le focus au début de la rafale, et sa valeur d'avant
    let valeurAvant = '';
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const cible = e.target.closest ? e.target : null;
      if (cible && cible.closest(CHAMPS_A_CODE)) return;
      const maintenant = performance.now();
      if (maintenant - dernier > ECART_MAX_MS) {
        tampon = '';
        champ = cible && cible.closest(CHAMPS_TEXTE);
        valeurAvant = champ ? (champ.value ?? champ.textContent) : '';
      }
      dernier = maintenant;
      if (e.key === 'Enter') {
        if (tampon.length >= 10) {
          // Rafale tapée dans un autre champ (pièce, titre…) : on lui rend sa valeur, le code part au scan.
          e.preventDefault();
          if (champ) {
            if ('value' in champ) champ.value = valeurAvant;
            else champ.textContent = valeurAvant;
            champ.dispatchEvent(new Event('input', { bubbles: true })); // une recherche en cours se remet à jour
          }
          surCode(tampon);
        }
        tampon = '';
      } else {
        // e.code désigne la touche physique : « Digit1 » reste un 1 quel que soit le clavier (AZERTY ou QWERTY).
        const chiffre = /^(?:Digit|Numpad)(\d)$/.exec(e.code || '');
        if (chiffre) tampon += chiffre[1];
      }
    });
  }

  function chargerScript(src) {
    return new Promise((resoudre, rejeter) => {
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = resoudre;
      s.onerror = () => rejeter(new Error('lecteur-indisponible'));
      document.head.append(s);
    });
  }

  // Le lecteur du navigateur (Chrome sur Android) quand il sait lire l'EAN-13, sinon la version portable.
  async function detecteur() {
    if ('BarcodeDetector' in window) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (formats.includes('ean_13')) return new window.BarcodeDetector({ formats: ['ean_13'] });
      } catch (e) {
        // lecteur présent mais inutilisable : on passe à la version portable
      }
    }
    if (!window.BarcodeDetectionAPI) await chargerScript(LECTEUR_PORTABLE);
    return new window.BarcodeDetectionAPI.BarcodeDetector({ formats: ['ean_13'] });
  }

  /**
   * Allume la webcam et appelle surCode à chaque code lu deux fois de suite (évite les lectures ratées).
   * continu = true : la webcam reste allumée pour enchaîner les livres (inventaire).
   * Renvoie une fonction pour l'éteindre.
   */
  async function demarrerCamera(video, surCode, { continu = false } = {}) {
    const det = await detecteur();
    const flux = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
      audio: false,
    });
    video.srcObject = flux;
    await video.play();

    // Mise au point continue si le téléphone la propose (les codes-barres se lisent de près).
    const piste = flux.getVideoTracks()[0];
    const capacites = piste && piste.getCapabilities ? piste.getCapabilities() : {};
    if ((capacites.focusMode || []).includes('continuous')) {
      piste.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
    }

    let actif = true;
    let candidat = '';
    let confirmations = 0;
    const derniersLus = new Map(); // code → instant, pour ne pas relire le même livre en boucle

    const arreter = () => {
      actif = false;
      flux.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };

    async function boucle() {
      if (!actif) return;
      try {
        if (video.readyState >= 2) {
          const codes = await det.detect(video);
          const lu = codes.map((c) => c.rawValue).find((v) => Bib.isbn.ean13Valide(v));
          if (lu) {
            confirmations = lu === candidat ? confirmations + 1 : 1;
            candidat = lu;
            const recent = Date.now() - (derniersLus.get(lu) || 0) < 4000;
            if (confirmations >= 2 && !recent) {
              derniersLus.set(lu, Date.now());
              confirmations = 0;
              if (!continu) arreter();
              surCode(lu);
            }
          }
        }
      } catch (e) {
        // Image pas encore prête : on réessaie au tour suivant.
      }
      if (actif) setTimeout(boucle, 120);
    }
    boucle();
    // Lampe torche des téléphones, pour les rayons mal éclairés.
    arreter.lampe = capacites.torch ? (allumee) => piste.applyConstraints({ advanced: [{ torch: allumee }] }) : null;
    return arreter;
  }

  /** Lit un code-barres sur une image fixe (sert aux vérifications). */
  async function lireImage(image) {
    const det = await detecteur();
    return (await det.detect(image)).map((c) => c.rawValue);
  }

  function messageErreurCamera(e) {
    if (e && e.name === 'NotAllowedError') return "Le navigateur n'a pas l'autorisation d'utiliser la webcam. Autorise-la dans la barre d'adresse, puis réessaie.";
    if (e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError')) return 'Aucune webcam trouvée sur cet ordinateur.';
    if (e && e.message === 'lecteur-indisponible') return 'Le lecteur de codes-barres ne se charge pas : vérifie la connexion Internet.';
    return "La webcam n'a pas pu démarrer.";
  }

  Bib.scanner = { ecouterDouchette, demarrerCamera, lireImage, messageErreurCamera };
})();
