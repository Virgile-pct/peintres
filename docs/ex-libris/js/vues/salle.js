/*
 * La pièce en 3D : la mezzanine vue comme une maison de poupée, chaque meuble à sa place
 * et chaque livre sur son étagère, de la couleur de sa couverture dessinée.
 * La perspective est calculée ici (projection orthogonale) et tout est dessiné en SVG,
 * jamais en canvas : chaque face plane est un groupe SVG posé par une matrice affine.
 */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const { esc, pluriel, decouperRangement } = Bib.outils;
  const D = Bib.donnees;
  const C = Bib.couverture;

  // ---------- Le plan, relevé sur les photos (en centimètres) ----------
  // Murs vus de l'intérieur : « gauche », « fond », « droite » ; l'entrée est du côté ouvert.
  // s : distance depuis le bout gauche du mur, quand on lui fait face. Étagères numérotées depuis le haut.
  const PIECES = {
    Mezzanine: {
      article: 'La', largeur: 420, profondeur: 420, hauteur: 260,
      style: { mur: '#D8C8B6', papier: true, sol: '#5C3F2C', lames: '#3E2A1D' },
      libelles: { gauche: 'La grande bibliothèque', fond: 'Le fond', droite: 'Le long de la rampe' },
      vues: { droite: { cible: [420, 65, 115], zoom: 2.2, phi: 18 } }, // les meubles bas, de plus près
      tremie: { x: 110, z: 110, largeur: 220, profondeur: 310 }, // la cage d'escalier, entourée de sa rampe
      porte: { mur: 'gauche', s: 285, largeur: 90, hauteur: 200 }, // la porte aux faux livres
      fenetre: { mur: 'fond', s: 205, largeur: 110, bas: 95, hauteur: 105 },
      meubles: [
        { nom: 'Grande bibliothèque gauche', mur: 'gauche', s: 51, largeur: 78, hauteur: 255, profondeur: 32, etageres: 10, tiroirApres: 7 },
        { nom: 'Grande bibliothèque milieu', mur: 'gauche', s: 129, largeur: 78, hauteur: 255, profondeur: 32, etageres: 10, tiroirApres: 7 },
        { nom: 'Grande bibliothèque droite', mur: 'gauche', s: 207, largeur: 78, hauteur: 255, profondeur: 32, etageres: 10, tiroirApres: 7 },
        { nom: 'Au-dessus de la porte', mur: 'gauche', s: 285, bas: 200, largeur: 90, hauteur: 60, profondeur: 32, etageres: 3 },
        { nom: 'Colonne près de la porte', mur: 'gauche', s: 375, largeur: 45, hauteur: 255, profondeur: 30, etageres: 10 },
        { nom: 'Bibliothèque du fond gauche', mur: 'fond', s: 55, largeur: 75, hauteur: 240, profondeur: 32, etageres: 9, tiroirApres: 6 },
        { nom: 'Bibliothèque du fond droite', mur: 'fond', s: 130, largeur: 75, hauteur: 240, profondeur: 32, etageres: 9, tiroirApres: 6 },
        { nom: 'Au-dessus de la fenêtre', mur: 'fond', s: 205, bas: 210, largeur: 110, hauteur: 30, profondeur: 25, etageres: 1 },
        { nom: 'Au-dessus de la vitrine', mur: 'fond', s: 315, bas: 195, largeur: 85, hauteur: 65, profondeur: 35, etageres: 2 },
        { nom: 'Vitrine', mur: 'fond', s: 315, bas: 95, largeur: 85, hauteur: 100, profondeur: 35, vitrine: true },
        { nom: 'Sous la vitrine', mur: 'fond', s: 315, largeur: 85, hauteur: 95, profondeur: 35, etageres: 2 },
        { nom: 'Bibliothèque basse gauche', mur: 'droite', s: 10, largeur: 70, hauteur: 115, profondeur: 32, etageres: 3 },
        { nom: 'Bibliothèque basse milieu', mur: 'droite', s: 80, largeur: 70, hauteur: 115, profondeur: 32, etageres: 3 },
        { nom: 'Bibliothèque basse droite', mur: 'droite', s: 150, largeur: 70, hauteur: 115, profondeur: 32, etageres: 3 },
      ],
    },
    // La pièce aux magazines : murs verts, plafond à poutres, la table au milieu.
    Bureau: {
      article: 'Le', largeur: 320, profondeur: 400, hauteur: 230,
      style: { mur: '#24463A', papier: false, sol: '#C68C55', lames: '#8F5E30' },
      libelles: { gauche: 'Les classeurs', fond: 'Le fond', droite: 'Les piles de magazines' },
      rideau: { mur: 'gauche', s: 0, largeur: 85 }, // le rideau aux faux livres
      table: { x: 120, z: 170, largeur: 85, profondeur: 130, hauteur: 76 },
      meubles: [
        { nom: 'Classeurs à gauche', mur: 'gauche', s: 88, largeur: 95, hauteur: 215, profondeur: 32, etageres: 6 },
        { nom: 'Vitrine du bureau', mur: 'gauche', s: 183, bas: 115, largeur: 65, hauteur: 100, profondeur: 35, vitrine: true },
        { nom: 'Sous la vitrine du bureau', mur: 'gauche', s: 183, bas: 70, largeur: 65, hauteur: 45, profondeur: 35, etageres: 1, piles: true },
        { nom: 'Placard du bureau', mur: 'gauche', s: 183, largeur: 65, hauteur: 70, profondeur: 35, placard: true },
        { nom: 'Bibliothèque en merisier', mur: 'fond', s: 5, largeur: 70, hauteur: 200, profondeur: 30, etageres: 5, piles: true },
        { nom: 'Magazines debout gauche', mur: 'fond', s: 110, largeur: 85, hauteur: 210, profondeur: 30, etageres: 7 },
        { nom: 'Magazines debout droite', mur: 'fond', s: 200, largeur: 85, hauteur: 210, profondeur: 30, etageres: 7 },
        { nom: 'Magazines en piles gauche', mur: 'droite', s: 10, largeur: 85, hauteur: 215, profondeur: 32, etageres: 7, piles: true },
        { nom: 'Magazines en piles droite', mur: 'droite', s: 95, largeur: 85, hauteur: 215, profondeur: 32, etageres: 7, piles: true },
        { nom: 'Meuble bas aux photos', mur: 'droite', s: 185, largeur: 80, hauteur: 105, profondeur: 32, etageres: 3, piles: true },
        { nom: 'Classeurs à droite', mur: 'droite', s: 265, largeur: 90, hauteur: 215, profondeur: 32, etageres: 6 },
      ],
    },
  };
  const PIECE_PAR_DEFAUT = 'Mezzanine';

  // ---------- Petite géométrie ----------

  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const HAUT = [0, 1, 0];
  const BAS = [0, -1, 0];
  const LUMIERE = (() => { const l = [0.35, 0.85, 0.45]; const n = Math.hypot(...l); return l.map((x) => x / n); })();

  // Chaque mur : son bout gauche au sol, la direction « vers la droite » et la normale vers la pièce.
  function murs(p) {
    return {
      fond: { origine: [0, 0, 0], u: [1, 0, 0], n: [0, 0, 1], longueur: p.largeur },
      gauche: { origine: [0, 0, p.profondeur], u: [0, 0, -1], n: [1, 0, 0], longueur: p.profondeur },
      droite: { origine: [p.largeur, 0, 0], u: [0, 0, 1], n: [-1, 0, 0], longueur: p.profondeur },
    };
  }

  // ---------- Caméra ----------

  // Les points de vue tout faits, calculés d'après les dimensions de la pièce (420 cm : zoom 1).
  function vuesDe(p) {
    const W = p.largeur;
    const L = p.profondeur;
    const k = 420 / Math.max(W, L);
    const lib = p.libelles || {};
    const vues = {
      piece: { libelle: 'Toute la pièce', theta: 32, phi: 30, cible: [W / 2, 95, L / 2], zoom: k },
      gauche: { libelle: lib.gauche || 'À gauche', theta: 90, phi: 10, cible: [0, p.hauteur / 2, L / 2], zoom: (1.45 * 420) / L },
      fond: { libelle: lib.fond || 'Le fond', theta: 0, phi: 10, cible: [W / 2, p.hauteur / 2 - 10, 0], zoom: (1.45 * 420) / W },
      droite: { libelle: lib.droite || 'À droite', theta: -90, phi: 10, cible: [W, p.hauteur / 2, L / 2], zoom: (1.45 * 420) / L },
      autre: { libelle: "L'autre côté", theta: -34, phi: 30, cible: [W / 2, 95, L / 2], zoom: k },
    };
    for (const [cle, v] of Object.entries(p.vues || {})) Object.assign(vues[cle], v);
    return vues;
  }
  const THETA_MUR = { fond: 0, gauche: 90, droite: -90 };
  const LARGEUR_VUE = 720; // largeur du cadre à zoom 1, en cm

  const depart = vuesDe(PIECES[PIECE_PAR_DEFAUT]).piece;
  const cam = { ...depart, cible: [...depart.cible] };
  let camPiece = PIECE_PAR_DEFAUT; // la pièce pour laquelle la caméra est réglée
  let anim = null;

  function repere() {
    const t = (cam.theta * Math.PI) / 180;
    const f = (cam.phi * Math.PI) / 180;
    return {
      droite: [Math.cos(t), 0, -Math.sin(t)],
      haut: [-Math.sin(t) * Math.sin(f), Math.cos(f), -Math.cos(t) * Math.sin(f)],
      versCamera: [Math.sin(t) * Math.cos(f), Math.sin(f), Math.cos(t) * Math.cos(f)],
    };
  }

  // ---------- Construction de la scène ----------
  // Une face : un rectangle plan (origine en haut à gauche, axes u et v en cm) et son dessin local.

  function face({ o, u, v, l, h, n, double = false, contenu, classe = '' }) {
    return { o, u, v, l, h, n, double, contenu, classe };
  }

  function ombrage(n) {
    if (!n) return 0;
    return Math.max(0, Math.min(0.55, 0.5 - 0.42 * dot(n, LUMIERE)));
  }

  const r1 = (x) => Math.round(x * 10) / 10;
  const epaisseurCm = (l) => (l.genre === 'Magazine' ? 0.5 : ((l.pages || 220) / 2) * 0.01 + 0.2);

  function nomEtagere(m, i) {
    return m.etageres > 1 ? `${m.nom}, étagère ${i + 1}` : m.nom;
  }

  // Les rangées d'un meuble, du haut vers le bas, avec la place du tiroir.
  function rangees(m) {
    const haut = 3;
    const socle = m.bas ? 3 : 6;
    const planche = 2;
    const tiroir = 16;
    const ecarts = [];
    for (let i = 0; i < m.etageres - 1; i++) ecarts.push(i + 1 === m.tiroirApres ? planche * 2 + tiroir : planche);
    const h = (m.hauteur - haut - socle - ecarts.reduce((s, e) => s + e, 0)) / m.etageres;
    const liste = [];
    let y = haut;
    for (let i = 0; i < m.etageres; i++) {
      liste.push({ y, h });
      y += h + (ecarts[i] || 0);
    }
    return liste;
  }

  function dessinFacade(m, livresParRang, choisie) {
    const w = m.largeur;
    if (m.vitrine) {
      const verre = [];
      for (let i = 1; i < 3; i++) verre.push(`<rect x="4" y="${r1((m.hauteur * i) / 3)}" width="${w - 8}" height="0.8" fill="#E8EEEC" opacity="0.8"/>`);
      const bibelots = [[14, 30, '#B48A3C'], [30, 28, '#933F2F'], [52, 31, '#3F4F7A'], [68, 29, '#E8D7AE'],
        [18, 62, '#5B3F8C'], [40, 63, '#7D6146'], [62, 61, '#2E5245'], [24, 95, '#B48A3C'], [58, 94, '#ECEFE8']]
        .map(([x, y, c]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="5" fill="${c}"/>`).join('');
      return `<rect width="${w}" height="${m.hauteur}" fill="var(--bois-clair)"/>
        <rect x="4" y="4" width="${w - 8}" height="${m.hauteur - 8}" fill="#2C2119"/>
        ${bibelots}${verre}
        <rect x="4" y="4" width="${w - 8}" height="${m.hauteur - 8}" fill="#CFE0DC" opacity="0.28"/>
        <rect x="${w / 2 - 0.6}" y="4" width="1.2" height="${m.hauteur - 8}" fill="var(--bois-clair)"/>
        <circle cx="${w / 2 - 3}" cy="${m.hauteur / 2}" r="1.3" fill="var(--laiton)"/><circle cx="${w / 2 + 3}" cy="${m.hauteur / 2}" r="1.3" fill="var(--laiton)"/>`;
    }
    if (m.placard) {
      return `<rect width="${w}" height="${m.hauteur}" fill="var(--bois-clair)"/>
        <rect x="4" y="4" width="${w / 2 - 5}" height="${m.hauteur - 10}" fill="#B98A55"/>
        <rect x="${w / 2 + 1}" y="4" width="${w / 2 - 5}" height="${m.hauteur - 10}" fill="#B98A55"/>
        <rect x="${w / 2 - 4}" y="${m.hauteur / 2 - 6}" width="1.4" height="12" rx="0.7" fill="#C9C9C9"/>
        <rect x="${w / 2 + 2.6}" y="${m.hauteur / 2 - 6}" width="1.4" height="12" rx="0.7" fill="#C9C9C9"/>`;
    }
    const lignes = rangees(m);
    const parts = [`<rect width="${w}" height="${m.hauteur}" fill="var(--bois-clair)"/>`];
    lignes.forEach((r, i) => {
      const nom = nomEtagere(m, i);
      const tous = livresParRang.get(i) || [];
      // Sur les meubles à piles, les magazines sont couchés ; ailleurs, debout comme des livres.
      const livres = m.piles ? tous.filter((l) => l.genre !== 'Magazine') : tous;
      const magazines = m.piles ? tous.filter((l) => l.genre === 'Magazine') : [];
      parts.push(`<rect x="3" y="${r1(r.y)}" width="${w - 6}" height="${r1(r.h)}" fill="#2C2119"/>`);
      // Les magazines sont couchés en piles de 22 cm de large, à droite des livres.
      const parPile = Math.max(1, Math.floor((r.h - 1) / 0.5));
      const piles = [];
      for (let k = 0; k < magazines.length; k += parPile) piles.push(magazines.slice(k, k + parPile));
      const largeurPile = piles.length ? Math.min(22, (w - 7) / piles.length) : 0;
      const placeLivres = w - 6.5 - piles.length * largeurPile;
      piles.forEach((pile, k) => {
        const x0 = w - 3.2 - (piles.length - k) * largeurPile;
        pile.forEach((l, j) => {
          // La tranche d'un magazine : surtout du papier, avec la couleur de la couverture dessus.
          const y = r.y + r.h - (j + 1) * 0.5;
          parts.push(`<rect x="${r1(x0 + 0.3)}" y="${r1(y)}" width="${r1(largeurPile - 0.8)}" height="0.46" fill="#E6DDCB"/><rect x="${r1(x0 + 0.3)}" y="${r1(y)}" width="${r1(largeurPile - 0.8)}" height="0.14" fill="${C.toile(l)[0]}"/>`);
        });
      });
      const total = livres.reduce((s, l) => s + epaisseurCm(l), 0);
      const echelle = Math.min(1, Math.max(0, placeLivres) / (total || 1));
      let x = 3.2;
      for (const l of livres) {
        const lb = epaisseurCm(l) * echelle;
        const hb = Math.min(r.h - 0.6, l.genre === 'Magazine' ? 28 : Math.max(11, l.hauteur || 18));
        parts.push(`<rect x="${r1(x)}" y="${r1(r.y + r.h - hb)}" width="${r1(Math.max(0.3, lb - 0.12))}" height="${r1(hb)}" fill="${C.toile(l)[0]}"/>`);
        x += lb;
      }
      if (i < lignes.length - 1) {
        const y = r.y + r.h;
        parts.push(`<rect x="0" y="${r1(y)}" width="${w}" height="2" fill="var(--bois)"/>`);
        if (i + 1 === m.tiroirApres) {
          parts.push(`<rect x="3" y="${r1(y + 2)}" width="${w - 6}" height="16" fill="var(--bois)"/>
            <rect x="4" y="${r1(y + 3)}" width="${w - 8}" height="14" fill="var(--bois-clair)"/>
            <ellipse cx="${w / 2}" cy="${r1(y + 10)}" rx="4" ry="1.6" fill="var(--laiton)"/>`);
        }
      }
      const contenu = [livres.length ? pluriel(livres.length, 'livre', 'livres') : '', magazines.length ? pluriel(magazines.length, 'magazine', 'magazines') : ''].filter(Boolean).join(' et ');
      const titre = `${nom} : ${contenu || 'vide'}`;
      parts.push(`<rect class="salle__rang${nom === choisie ? ' salle__rang--choisi' : ''}" x="3" y="${r1(r.y)}" width="${w - 6}" height="${r1(r.h)}"
        data-rangement="${esc(nom)}" data-mur="${m.mur}" data-meuble="${esc(m.nom)}"><title>${esc(titre)}</title></rect>`);
    });
    parts.push(`<rect x="0" y="${m.hauteur - (m.bas ? 3 : 6)}" width="${w}" height="${m.bas ? 3 : 6}" fill="var(--bois)"/>`);
    return parts.join('');
  }

  function dessinMur(p, nomMur, mur) {
    const st = p.style;
    const parts = [`<rect width="${mur.longueur}" height="${p.hauteur}" fill="${st.mur}"/>
      ${st.papier ? `<rect width="${mur.longueur}" height="${p.hauteur}" fill="url(#salle-papier)"/>` : ''}
      <rect y="${p.hauteur - 8}" width="${mur.longueur}" height="8" fill="var(--bois)"/>`];
    if (p.rideau && p.rideau.mur === nomMur) {
      const { s, largeur } = p.rideau;
      const teintes = ['#8C3A22', '#3F2A1C', '#A8742E', '#2F4A3A', '#6E2A1E', '#C9A45C'];
      const faux = [`<rect x="${s}" y="4" width="${largeur}" height="${p.hauteur - 8}" fill="#5A3322"/>`];
      for (let y = 10; y < p.hauteur - 20; y += 22) {
        let x = s + 3;
        let k = Math.round(y / 22);
        while (x < s + largeur - 4) {
          const lb = 3 + ((k * 5) % 4);
          faux.push(`<rect x="${x}" y="${y + (k % 3)}" width="${lb}" height="${18 - (k % 3)}" fill="${teintes[k % teintes.length]}"/>`);
          x += lb + 0.8;
          k++;
        }
      }
      for (let x = s + 8; x < s + largeur; x += 14) faux.push(`<rect x="${x}" y="4" width="3" height="${p.hauteur - 8}" fill="#000" opacity="0.18"/>`);
      parts.push(faux.join(''));
    }
    if (p.porte && p.porte.mur === nomMur) {
      const { s, largeur, hauteur } = p.porte;
      const y0 = p.hauteur - hauteur;
      const faux = [];
      const teintes = ['#7B2E22', '#4A2A1C', '#8C5A2E', '#2F3A2A', '#5E1F1A'];
      for (let rang = 0; rang < 6; rang++) {
        const yr = y0 + 22 + rang * 27;
        let x = s + 14 + (rang % 2) * 6;
        let k = rang;
        while (x < s + largeur - 22) {
          const lb = 2.2 + ((k * 7) % 5) * 0.6;
          faux.push(`<rect x="${r1(x)}" y="${yr - 16 + (k % 3)}" width="${r1(lb)}" height="${16 - (k % 3)}" fill="${teintes[k % teintes.length]}"/>`);
          x += lb + 0.4;
          k++;
        }
        faux.push(`<rect x="${s + 10}" y="${yr}" width="${largeur - 26}" height="1.5" fill="#8C6A48"/>`);
      }
      parts.push(`<rect x="${s}" y="${y0}" width="${largeur}" height="${hauteur}" fill="var(--bois)"/>
        <rect x="${s + 4}" y="${y0 + 4}" width="${largeur - 8}" height="${hauteur - 4}" fill="#EDE5D2"/>${faux.join('')}
        <rect x="${s + 8}" y="${y0 + hauteur / 2}" width="7" height="2" rx="1" fill="#9A9A9A"/>`);
    }
    if (p.fenetre && p.fenetre.mur === nomMur) {
      const { s, largeur, bas, hauteur } = p.fenetre;
      const y0 = p.hauteur - bas - hauteur;
      parts.push(`<rect x="${s}" y="${y0}" width="${largeur}" height="${hauteur}" fill="#F1EEE6"/>
        <rect x="${s + 6}" y="${y0 + 6}" width="${largeur / 2 - 8}" height="${hauteur - 12}" fill="#BFD6D9"/>
        <rect x="${s + largeur / 2 + 2}" y="${y0 + 6}" width="${largeur / 2 - 8}" height="${hauteur - 12}" fill="#BFD6D9"/>
        <rect x="${s + 6}" y="${y0 + hauteur * 0.62}" width="${largeur - 12}" height="${hauteur * 0.38 - 6}" fill="#8FAF8C" opacity="0.7"/>
        <rect x="${s + 18}" y="${y0 + 2}" width="${largeur - 36}" height="${hauteur - 4}" fill="#5E6E78" opacity="0.18"/>
        <rect x="${s - 4}" y="${y0 + hauteur}" width="${largeur + 8}" height="4" fill="var(--bois)"/>`);
    }
    return parts.join('');
  }

  function dessinSol(p) {
    const lames = [];
    for (let z = 14; z < p.profondeur; z += 14) lames.push(`<rect y="${z}" width="${p.largeur}" height="0.6" fill="${p.style.lames}" opacity="0.5"/>`);
    const parts = [`<rect width="${p.largeur}" height="${p.profondeur}" fill="${p.style.sol}"/>${lames.join('')}`];
    const t = p.tremie;
    if (t) {
      const marches = [];
      for (let z = t.z + 30; z < t.z + t.profondeur; z += 24) marches.push(`<rect x="${t.x + 20}" y="${z}" width="${t.largeur - 40}" height="3" fill="#4A3B33"/>`);
      parts.push(`<rect x="${t.x}" y="${t.z}" width="${t.largeur}" height="${t.profondeur}" fill="#1E1714"/>
        <rect x="${t.x + 20}" y="${t.z + 20}" width="${t.largeur - 40}" height="${t.profondeur - 20}" fill="#2B221D"/>${marches.join('')}`);
    }
    return parts.join('');
  }

  // Un simple bloc de bois posé au sol (la table du bureau) : ses cinq faces visibles possibles.
  function bloc({ x, z, largeur, profondeur, hauteur }) {
    const bois = (l, h, c) => `<rect width="${l}" height="${h}" fill="${c}"/>`;
    const dessus = `${bois(largeur, profondeur, '#8A5A32')}<rect x="6" y="6" width="${largeur - 12}" height="${profondeur - 12}" fill="#2F4A3A" opacity="0.55"/>`;
    return {
      table: true,
      centre: [x + largeur / 2, hauteur / 2, z + profondeur / 2],
      faces: [
        face({ o: [x, hauteur, z], u: [1, 0, 0], v: [0, 0, 1], l: largeur, h: profondeur, n: HAUT, contenu: dessus }),
        face({ o: [x, hauteur, z + profondeur], u: [1, 0, 0], v: BAS, l: largeur, h: hauteur, n: [0, 0, 1], contenu: bois(largeur, hauteur, '#7A4E2C') }),
        face({ o: [x + largeur, hauteur, z], u: [-1, 0, 0], v: BAS, l: largeur, h: hauteur, n: [0, 0, -1], contenu: bois(largeur, hauteur, '#7A4E2C') }),
        face({ o: [x, hauteur, z], u: [0, 0, 1], v: BAS, l: profondeur, h: hauteur, n: [-1, 0, 0], contenu: bois(profondeur, hauteur, '#7A4E2C') }),
        face({ o: [x + largeur, hauteur, z + profondeur], u: [0, 0, -1], v: BAS, l: profondeur, h: hauteur, n: [1, 0, 0], contenu: bois(profondeur, hauteur, '#7A4E2C') }),
      ],
    };
  }

  function dessinRampe(longueur) {
    const parts = [`<rect y="0" width="${longueur}" height="5" rx="2" fill="#A8894A"/><rect y="${95 - 6}" width="${longueur}" height="3" fill="#8C7240"/>`];
    for (let x = 6; x < longueur; x += 13) parts.push(`<rect x="${x}" y="5" width="1.6" height="${95 - 9}" fill="#9A8048"/>`);
    return parts.join('');
  }

  // Les livres de la pièce, rangés par meuble puis par étagère (0 = celle du haut).
  function repartir(nomPiece) {
    const parMeuble = new Map();
    for (const l of D.presents()) {
      if (!l.rangement || (l.piece && l.piece !== nomPiece)) continue;
      const { meuble, numero } = decouperRangement(l.rangement);
      if (!parMeuble.has(meuble)) parMeuble.set(meuble, new Map());
      const rangs = parMeuble.get(meuble);
      const i = Math.max(0, numero - 1);
      if (!rangs.has(i)) rangs.set(i, []);
      rangs.get(i).push(l);
    }
    for (const rangs of parMeuble.values()) {
      for (const liste of rangs.values()) liste.sort((a, b) => (a.dateAjout || '').localeCompare(b.dateAjout || ''));
    }
    return parMeuble;
  }

  function construire(nomPiece, choisie) {
    const p = PIECES[nomPiece];
    const M = murs(p);
    const parMeuble = repartir(nomPiece);
    const sol = face({ o: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], l: p.largeur, h: p.profondeur, n: HAUT, contenu: dessinSol(p) });
    const parois = Object.entries(M).map(([nom, m]) =>
      face({ o: add(m.origine, mul(HAUT, p.hauteur)), u: m.u, v: BAS, l: m.longueur, h: p.hauteur, n: m.n, contenu: dessinMur(p, nom, m) }));

    const objets = p.meubles.map((m) => {
      const mur = M[m.mur];
      const bas = m.bas || 0;
      const coin = add(add(mur.origine, mul(mur.u, m.s)), mul(HAUT, bas + m.hauteur)); // haut, gauche, contre le mur
      const devant = mul(mur.n, m.profondeur);
      const rangs = parMeuble.get(m.nom) || new Map();
      const bois = (l, h) => `<rect width="${l}" height="${h}" fill="var(--bois-clair)"/>`;
      return {
        meuble: m,
        centre: add(add(add(mur.origine, mul(mur.u, m.s + m.largeur / 2)), mul(mur.n, m.profondeur / 2)), mul(HAUT, bas + m.hauteur / 2)),
        faces: [
          face({ o: coin, u: mur.u, v: mur.n, l: m.largeur, h: m.profondeur, n: HAUT, contenu: bois(m.largeur, m.profondeur) }),
          face({ o: coin, u: mur.n, v: BAS, l: m.profondeur, h: m.hauteur, n: mul(mur.u, -1), contenu: bois(m.profondeur, m.hauteur) }),
          face({ o: add(add(coin, mul(mur.u, m.largeur)), devant), u: mul(mur.n, -1), v: BAS, l: m.profondeur, h: m.hauteur, n: mur.u, contenu: bois(m.profondeur, m.hauteur) }),
          face({ o: add(coin, devant), u: mur.u, v: BAS, l: m.largeur, h: m.hauteur, n: mur.n, contenu: dessinFacade(m, rangs, choisie), classe: 'salle__facade' }),
        ],
      };
    });

    const t = p.tremie;
    const rampes = (t ? [
      { o: [t.x, 95, t.z + t.profondeur], u: [0, 0, -1], l: t.profondeur },
      { o: [t.x, 95, t.z], u: [1, 0, 0], l: t.largeur },
      { o: [t.x + t.largeur, 95, t.z], u: [0, 0, 1], l: t.profondeur },
    ] : []).map((r) => ({
      rampe: true,
      centre: add(r.o, add(mul(r.u, r.l / 2), [0, -47, 0])),
      faces: [face({ o: r.o, u: r.u, v: BAS, l: r.l, h: 95, double: true, contenu: dessinRampe(r.l) })],
    }));

    // Ce qui est rangé dans un meuble que le plan ne connaît pas, ou sur une étagère qu'il n'a pas.
    const connus = new Map(p.meubles.map((m) => [m.nom, m]));
    const horsPlan = [];
    for (const [meuble, rangs] of parMeuble) {
      const m = connus.get(meuble);
      for (const [i, liste] of rangs) if (!m || m.vitrine || m.placard || i >= m.etageres) horsPlan.push(...liste);
    }
    const decor = p.table ? [bloc(p.table)] : [];
    return { p, sol, parois, objets: [...objets, ...rampes, ...decor], horsPlan };
  }

  // ---------- Dessin et mise à jour ----------

  let scene = null; // { svg, elements: [{ face, el }], groupes: [{ objet, el }] }

  function groupeFace(f) {
    const ombre = ombrage(f.n);
    return `<g class="salle__face ${f.classe}">${f.contenu}${ombre ? `<rect width="${f.l}" height="${f.h}" fill="#140E0A" opacity="${ombre.toFixed(2)}" pointer-events="none"/>` : ''}</g>`;
  }

  function monter(conteneur, nomPiece, choisie) {
    const s = construire(nomPiece, choisie);
    const objetsHtml = s.objets.map((o, i) => `<g class="salle__objet" data-i="${i}">${o.faces.map(groupeFace).join('')}</g>`).join('');
    conteneur.innerHTML = `<svg class="salle__svg" xmlns="http://www.w3.org/2000/svg" role="img"
        aria-label="La ${esc(nomPiece.toLowerCase())} en trois dimensions, avec ses meubles et ses livres">
      <defs>
        <pattern id="salle-papier" width="44" height="52" patternUnits="userSpaceOnUse">
          <ellipse cx="22" cy="26" rx="13" ry="17" fill="#F1E9DD"/>
          <path d="M19 37c0-5 2-7 1-10-2-1-3-3-2-5 0-5 4-8 8-7 3 1 4 4 3 7l2 3-2 1v3c-2 1-3 1-3 3l1 5z" fill="#2A1F1A"/>
        </pattern>
      </defs>
      <g class="salle__sol">${groupeFace(s.sol)}</g>
      <g class="salle__murs">${s.parois.map(groupeFace).join('')}</g>
      <g class="salle__objets">${objetsHtml}</g>
    </svg>`;
    const svg = conteneur.querySelector('svg');
    const murs = [...svg.querySelectorAll('.salle__murs > .salle__face')];
    const objets = [...svg.querySelectorAll('.salle__objet')];
    scene = {
      svg,
      piece: s.p,
      horsPlan: s.horsPlan,
      sol: { face: s.sol, el: svg.querySelector('.salle__sol > .salle__face') },
      murs: s.parois.map((f, i) => ({ face: f, el: murs[i] })),
      objets: s.objets.map((o, i) => ({ objet: o, el: objets[i], faces: o.faces.map((f, j) => ({ face: f, el: objets[i].children[j] })) })),
      ordre: '',
    };
    cadrer();
  }

  function poser(rep, { face: f, el }) {
    const vu = dot(f.n || [0, 0, 0], rep.versCamera);
    if (f.n && !f.double && vu <= 0.001) {
      el.setAttribute('display', 'none');
      return;
    }
    el.removeAttribute('display');
    const px = (a) => dot(a, rep.droite);
    const py = (a) => -dot(a, rep.haut);
    el.setAttribute('transform', `matrix(${[px(f.u), py(f.u), px(f.v), py(f.v), px(f.o), py(f.o)].map((x) => x.toFixed(4)).join(' ')})`);
  }

  function cadrer() {
    if (!scene) return;
    const rep = repere();
    poser(rep, scene.sol);
    scene.murs.forEach((m) => poser(rep, m));
    for (const o of scene.objets) {
      o.faces.forEach((f) => poser(rep, f));
      // Un meuble vu de dos cacherait la pièce : il s'efface, comme le mur contre lequel il est posé.
      const facade = o.faces[o.faces.length - 1].face;
      if (o.objet.meuble) o.el.setAttribute('opacity', dot(facade.n, rep.versCamera) > 0 ? '1' : '0.16');
      // De près, la rampe ou la table ne cachent plus les étagères du bas.
      else if (o.objet.rampe || o.objet.table) o.el.setAttribute('opacity', cam.zoom > 1.3 ? '0.3' : '1');
    }
    // Du plus loin au plus proche : les meubles du premier plan passent devant.
    const tries = [...scene.objets].sort((a, b) => dot(a.objet.centre, rep.versCamera) - dot(b.objet.centre, rep.versCamera));
    const ordre = tries.map((o) => o.el.dataset.i).join(',');
    if (ordre !== scene.ordre) {
      const parent = scene.svg.querySelector('.salle__objets');
      tries.forEach((o) => parent.appendChild(o.el));
      scene.ordre = ordre;
    }
    const rect = scene.svg.getBoundingClientRect();
    const rapport = rect.width ? rect.height / rect.width : 0.62;
    const l = LARGEUR_VUE / cam.zoom;
    const h = l * rapport;
    const cx = dot(cam.cible, rep.droite);
    const cy = -dot(cam.cible, rep.haut);
    scene.svg.setAttribute('viewBox', `${(cx - l / 2).toFixed(2)} ${(cy - h / 2).toFixed(2)} ${l.toFixed(2)} ${h.toFixed(2)}`);
  }

  // ---------- Mouvements ----------

  const doux = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)); // courbe « expo », comme les animations CSS de l'appli

  function allerVers(but, duree = 900) {
    if (anim) cancelAnimationFrame(anim.id);
    const depart = { theta: cam.theta, phi: cam.phi, cible: [...cam.cible], zoom: cam.zoom };
    let dTheta = ((but.theta - depart.theta) % 360 + 540) % 360 - 180; // le plus court chemin
    const debut = performance.now();
    const pas = (maintenant) => {
      const k = doux((maintenant - debut) / duree);
      cam.theta = depart.theta + dTheta * k;
      cam.phi = depart.phi + (but.phi - depart.phi) * k;
      cam.zoom = depart.zoom * Math.pow(but.zoom / depart.zoom, k);
      cam.cible = depart.cible.map((x, i) => x + (but.cible[i] - x) * k);
      cadrer();
      anim = k < 1 ? { id: requestAnimationFrame(pas) } : null;
    };
    anim = { id: requestAnimationFrame(pas) };
  }

  // Se placer bien en face d'un meuble, assez près pour lire ses étagères.
  function regarderMeuble(nomMeuble) {
    const m = scene && scene.piece.meubles.find((x) => x.nom === nomMeuble);
    if (!m) return;
    const mur = murs(scene.piece)[m.mur];
    const bas = m.bas || 0;
    const cible = add(add(add(mur.origine, mul(mur.u, m.s + m.largeur / 2)), mul(mur.n, m.profondeur)), mul(HAUT, bas + m.hauteur / 2));
    const rect = scene.svg.getBoundingClientRect();
    const rapport = rect.width ? rect.height / rect.width : 0.62;
    const zoom = Math.min(LARGEUR_VUE / (m.largeur * 2.4), (LARGEUR_VUE * rapport) / (m.hauteur * 1.25), 6);
    allerVers({ theta: THETA_MUR[m.mur], phi: 6, cible, zoom });
  }

  let glisse = null;
  let ecouteurs = [];

  function brancher() {
    const svg = scene.svg;
    const sur = (cible, type, fn, options) => {
      cible.addEventListener(type, fn, options);
      ecouteurs.push(() => cible.removeEventListener(type, fn, options));
    };
    sur(svg, 'pointerdown', (e) => {
      if (anim) { cancelAnimationFrame(anim.id); anim = null; }
      glisse = { x: e.clientX, y: e.clientY, theta: cam.theta, phi: cam.phi, bouge: false, id: e.pointerId };
    });
    sur(window, 'pointermove', (e) => {
      if (!glisse || e.pointerId !== glisse.id) return;
      const dx = e.clientX - glisse.x;
      const dy = e.clientY - glisse.y;
      if (!glisse.bouge && Math.hypot(dx, dy) < 5) return;
      if (!glisse.bouge) svg.setPointerCapture(e.pointerId);
      glisse.bouge = true;
      cam.theta = glisse.theta - dx * 0.35;
      cam.phi = Math.max(2, Math.min(85, glisse.phi + dy * 0.3));
      cadrer();
    });
    const lacher = (e) => {
      if (!glisse || e.pointerId !== glisse.id) return;
      const bouge = glisse.bouge;
      glisse = null;
      if (bouge) return;
      const rang = e.target.closest && e.target.closest('.salle__rang');
      if (rang) choisir(rang.dataset.rangement, rang.dataset.meuble);
    };
    sur(window, 'pointerup', lacher);
    sur(window, 'pointercancel', () => { glisse = null; });
    sur(svg, 'wheel', (e) => {
      e.preventDefault();
      if (anim) { cancelAnimationFrame(anim.id); anim = null; }
      cam.zoom = Math.max(0.6, Math.min(8, cam.zoom * Math.exp(-e.deltaY * 0.0015)));
      cadrer();
    }, { passive: false });
    sur(window, 'resize', cadrer);
  }

  // ---------- Étagère choisie ----------

  let choisie = '';

  function legende() {
    if (!choisie) {
      return `<p>Fais glisser la pièce pour tourner autour, et la molette pour t'approcher. Touche une étagère pour la voir de près.</p>`;
    }
    const ici = D.presents().filter((l) => l.rangement === choisie);
    const n = ici.length;
    const nMag = ici.filter((l) => l.genre === 'Magazine').length;
    const detail = [n - nMag ? pluriel(n - nMag, 'livre', 'livres') : '', nMag ? pluriel(nMag, 'magazine', 'magazines') : ''].filter(Boolean).join(' et ');
    return `<p><strong>${esc(choisie)}</strong> : ${n ? detail : 'rien pour l\'instant'}.</p>
      ${n ? `<a class="bouton" href="#/etageres?${esc(new URLSearchParams({ vue: 'couvertures', rangement: choisie }).toString())}">${nMag === n ? 'Voir ces magazines' : 'Voir ces livres'}</a>` : ''}
      <button type="button" class="bouton bouton--second" data-action="salle-vue" data-vue="piece">Revenir à toute la pièce</button>`;
  }

  function choisir(rangement, meuble) {
    choisie = rangement;
    scene.svg.querySelectorAll('.salle__rang--choisi').forEach((el) => el.classList.remove('salle__rang--choisi'));
    scene.svg.querySelectorAll('.salle__rang').forEach((el) => { if (el.dataset.rangement === rangement) el.classList.add('salle__rang--choisi'); });
    const zone = document.getElementById('salle-legende');
    if (zone) zone.innerHTML = legende();
    regarderMeuble(meuble);
  }

  // ---------- Écran ----------

  let pieceChoisie = ''; // la pièce choisie à l'écran ; sinon celle de l'inventaire en cours

  function pieceAffichee() {
    if (PIECES[pieceChoisie]) return pieceChoisie;
    const r = D.etat.reglages;
    return PIECES[r.pieceCourante] ? r.pieceCourante : PIECE_PAR_DEFAUT;
  }

  function regler(nomPiece) {
    if (camPiece === nomPiece) return;
    const v = vuesDe(PIECES[nomPiece]).piece;
    Object.assign(cam, { theta: v.theta, phi: v.phi, zoom: v.zoom, cible: [...v.cible] });
    camPiece = nomPiece;
    choisie = '';
  }

  function rendre() {
    const nomPiece = pieceAffichee();
    regler(nomPiece);
    const p = PIECES[nomPiece];
    const ici = D.presents().filter((l) => l.piece === nomPiece);
    const mags = ici.filter((l) => l.genre === 'Magazine').length;
    const compte = [ici.length - mags ? pluriel(ici.length - mags, 'livre', 'livres') : '', mags ? pluriel(mags, 'magazine', 'magazines') : ''].filter(Boolean).join(' et ');
    const noms = Object.keys(PIECES);
    return `
      <header class="entete">
        <div>
          <h1>${esc(p.article)} ${esc(nomPiece.toLowerCase())} en 3D</h1>
          <p>${compte ? `${esc(compte)} dans la pièce, chacun à sa place, de la couleur de sa couverture dessinée.` : 'Rien n\'y est encore rangé : la pièce se remplira au fil de l\'inventaire.'}</p>
        </div>
        ${noms.length > 1 ? `<div class="segments" role="group" aria-label="Pièce">${noms.map((nom) =>
          `<button type="button" data-action="salle-piece" data-piece="${esc(nom)}" aria-pressed="${nom === nomPiece}">${esc(nom)}</button>`).join('')}</div>` : ''}
      </header>
      <div class="salle">
        <div class="salle__commandes" role="group" aria-label="Points de vue">
          ${Object.entries(vuesDe(p)).map(([cle, v]) => `<button type="button" class="bouton bouton--second" data-action="salle-vue" data-vue="${cle}">${esc(v.libelle)}</button>`).join('')}
          <span class="salle__zoom">
            <button type="button" class="bouton bouton--second" data-action="salle-zoom" data-sens="-1" aria-label="S'éloigner">−</button>
            <button type="button" class="bouton bouton--second" data-action="salle-zoom" data-sens="1" aria-label="S'approcher">+</button>
          </span>
        </div>
        <div class="salle__scene" id="salle-scene"></div>
        <div class="salle__legende" id="salle-legende" aria-live="polite">${legende()}</div>
        <p class="salle__note" id="salle-note"></p>
      </div>`;
  }

  function apres() {
    const zone = document.getElementById('salle-scene');
    if (!zone) return;
    ecouteurs.forEach((retirer) => retirer()); // au cas où l'écran serait redessiné sans être quitté
    ecouteurs = [];
    monter(zone, pieceAffichee(), choisie);
    brancher();
    const note = document.getElementById('salle-note');
    if (note && scene.horsPlan.length) {
      note.textContent = `${pluriel(scene.horsPlan.length, 'livre est rangé', 'livres sont rangés')} sur un meuble ou une étagère que le plan en 3D ne connaît pas encore, et n'${scene.horsPlan.length > 1 ? 'apparaissent' : 'apparaît'} pas ici.`;
    }
  }

  function quitter() {
    if (anim) cancelAnimationFrame(anim.id);
    anim = null;
    ecouteurs.forEach((retirer) => retirer());
    ecouteurs = [];
    scene = null;
  }

  Object.assign(Bib.actions, {
    'salle-piece': (el) => {
      if (!PIECES[el.dataset.piece] || el.dataset.piece === pieceAffichee()) return;
      pieceChoisie = el.dataset.piece;
      Bib.app.afficher({ garderDefilement: true });
    },
    'salle-vue': (el) => {
      const v = scene && vuesDe(scene.piece)[el.dataset.vue];
      if (!v || !scene) return;
      if (el.dataset.vue === 'piece' && choisie) {
        choisie = '';
        scene.svg.querySelectorAll('.salle__rang--choisi').forEach((r) => r.classList.remove('salle__rang--choisi'));
        const zone = document.getElementById('salle-legende');
        if (zone) zone.innerHTML = legende();
      }
      allerVers(v);
    },
    'salle-zoom': (el) => {
      if (!scene) return;
      allerVers({ theta: cam.theta, phi: cam.phi, cible: cam.cible, zoom: Math.max(0.6, Math.min(8, cam.zoom * (el.dataset.sens === '1' ? 1.4 : 1 / 1.4))) }, 450);
    },
  });

  Bib.vues.salle = {
    titre: 'La pièce en 3D',
    rendre,
    apres,
    quitter,
    // Un livre ajouté ou déplacé : on redessine sans bouger la caméra.
    surChangement: () => {
      const zone = document.getElementById('salle-scene');
      if (!zone || !scene) return;
      quitter();
      apres();
    },
  };
})();
