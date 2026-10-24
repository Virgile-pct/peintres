/*
 * Recherche des fiches de livres dans les catalogues publics.
 *  - BnF (catalogue général, format UNIMARC) : la référence pour les livres vendus en France.
 *  - Open Library : complète les livres étrangers et fournit des couvertures.
 *  - Google Books : seulement si une clé est réglée (l'accès anonyme est saturé).
 * Les trois répondent aux pages web directement (en-tête Access-Control-Allow-Origin).
 */
(function () {
  'use strict';
  const Bib = (window.Bib = window.Bib || {});
  const { cle } = Bib.outils;

  const SRU_BNF = 'https://catalogue.bnf.fr/api/SRU';

  // Cadre de classement de la Bibliographie nationale française (champ 686), traduit en genres parlants.
  const GENRES_BNF = {
    '803': 'Roman', '805': 'Bande dessinée', '809': 'Jeunesse', '801': 'Poésie', '802': 'Théâtre',
    '804': 'Essai', '800': 'Critique littéraire',
    '920': 'Biographie', '910': 'Voyage', '900': 'Histoire', '930': 'Histoire', '940': 'Histoire', '944': 'Histoire',
    '640': 'Cuisine et maison', '610': 'Santé', '630': 'Jardin et nature', '580': 'Jardin et nature', '590': 'Jardin et nature',
    '150': 'Psychologie', '130': 'Ésotérisme', '100': 'Philosophie', '200': 'Religion', '220': 'Religion', '290': 'Religion',
    '796': 'Sport', '793': 'Jeux', '770': 'Photographie', '780': 'Musique', '791': 'Cinéma', '792': 'Spectacles',
    '740': 'Loisirs créatifs', '700': 'Arts', '720': 'Arts', '730': 'Arts', '750': 'Arts', '760': 'Arts',
    '400': 'Langues', '370': 'Éducation', '330': 'Économie', '320': 'Société', '340': 'Droit', '300': 'Société', '360': 'Société', '390': 'Société',
    '004': 'Informatique', '030': 'Encyclopédie',
  };
  const GENRES_PAR_CENTAINE = ['Généralités', 'Philosophie', 'Religion', 'Société', 'Langues', 'Sciences', 'Vie pratique', 'Arts et loisirs', 'Littérature', 'Histoire'];
  const GENRES_GOOGLE = {
    'fiction': 'Roman', 'juvenile fiction': 'Jeunesse', 'comics & graphic novels': 'Bande dessinée', 'cooking': 'Cuisine et maison',
    'biography & autobiography': 'Biographie', 'history': 'Histoire', 'travel': 'Voyage', 'poetry': 'Poésie', 'drama': 'Théâtre',
  };
  const GENRES_CONNUS = [...new Set([...Object.values(GENRES_BNF), ...GENRES_PAR_CENTAINE])].sort(Bib.outils.comparer);

  async function recuperer(url, { delai = 12000, texte = false } = {}) {
    const controle = new AbortController();
    const minuteur = setTimeout(() => controle.abort(), delai);
    try {
      const reponse = await fetch(url, { signal: controle.signal });
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      return texte ? await reponse.text() : await reponse.json();
    } finally {
      clearTimeout(minuteur);
    }
  }

  // ---------- BnF ----------

  // Marqueurs de non-tri : dans « ‹Une› aventure d'Astérix », l'article est ignoré au classement.
  const propre = (s) => String(s || '').replace(/[\u0088\u0089\u0098\u009c]/g, '').replace(/\s+/g, ' ').trim();

  function lireNotice(record) {
    const champs = {};
    for (const df of record.getElementsByTagNameNS('*', 'datafield')) {
      const sous = {};
      for (const sf of df.getElementsByTagNameNS('*', 'subfield')) {
        const code = sf.getAttribute('code');
        (sous[code] = sous[code] || []).push(propre(sf.textContent));
      }
      const tag = df.getAttribute('tag');
      (champs[tag] = champs[tag] || []).push(sous);
    }
    const controle = {};
    for (const cf of record.getElementsByTagNameNS('*', 'controlfield')) {
      controle[cf.getAttribute('tag')] = cf.textContent.trim();
    }
    return { champs, controle };
  }

  function lireReponseSru(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return [...doc.getElementsByTagNameNS('*', 'recordData')]
      .map((rd) => rd.firstElementChild)
      .filter(Boolean)
      .map(lireNotice);
  }

  const un = (sous, code) => ((sous || {})[code] || [])[0] || '';
  const tous = (champs, tag) => champs[tag] || [];

  function isbnsDeNotice({ champs }) {
    return tous(champs, '010').map((c) => Bib.isbn.chiffres(un(c, 'a'))).filter(Boolean);
  }

  function ficheDepuisBnf(notice) {
    const { champs, controle } = notice;
    const t200 = tous(champs, '200')[0] || {};
    let titre = un(t200, 'a');
    const sousTitre = (t200.e || []).join(' : ');

    // Série (461) et collection de l'éditeur (410) : « Harry Potter, tome 1 » contre « Folio junior ».
    const t461 = tous(champs, '461')[0];
    let serie = t461 ? un(t461, 't') : '';
    let tome = t461 ? un(t461, 'v') : '';
    if (t200.i && t200.i.length) {
      // « Le Seigneur des anneaux. 1, La Communauté de l'anneau »
      serie = serie || titre;
      tome = tome || un(t200, 'h');
      titre = t200.i[0];
    }
    let collection = '';
    const t410 = tous(champs, '410')[0];
    if (t410) collection = un(t410, 't').replace(/^Collection\s+/i, '');
    else {
      const t225 = tous(champs, '225').find((c) => un(c, 'a') && cle(un(c, 'a')) !== cle(serie));
      if (t225) collection = un(t225, 'a');
    }

    // Auteurs : 700 = auteur principal ; 701/702 retenus s'ils sont auteurs (070) ou illustrateurs (440).
    const auteurs = [];
    for (const tag of ['700', '710', '701', '702', '711', '712']) {
      for (const p of tous(champs, tag)) {
        const role = un(p, '4');
        if (!['700', '710'].includes(tag) && role && !['070', '440'].includes(role)) continue;
        const nom = [un(p, 'b'), un(p, 'a')].filter(Boolean).join(' ');
        if (nom && !auteurs.includes(nom)) auteurs.push(nom);
      }
    }

    const publication = tous(champs, '214').find((c) => un(c, 'c')) || tous(champs, '210').find((c) => un(c, 'c')) || {};
    const annee = (un(publication, 'd').match(/\d{4}/) || [''])[0];
    if (cle(collection) === cle(un(publication, 'c'))) collection = ''; // « Le Livre de poche » éditeur et collection

    // Collation : « 1 vol. (311 p.) ; 18 cm » → 311 pages, 18 cm de haut.
    const t215 = tous(champs, '215')[0] || {};
    const mentionsPages = [...un(t215, 'a').matchAll(/(\d+)\]?\s*p\b/g)];
    const pages = mentionsPages.length ? Number(mentionsPages[mentionsPages.length - 1][1]) : null;
    const hauteur = Number((un(t215, 'd').match(/(\d+)\s*cm/) || [])[1]) || null;

    let prix = null;
    for (const c of tous(champs, '010')) {
      const m = un(c, 'd').match(/(\d+(?:[.,]\d+)?)\s*(?:EUR|€)/i);
      if (m) { prix = Number(m[1].replace(',', '.')); break; }
    }

    const classement = tous(champs, '686').find((c) => /classement/i.test(un(c, '2'))) || tous(champs, '686')[0];
    const code = classement ? un(classement, 'a') : '';
    const genre = code ? GENRES_BNF[code] || GENRES_PAR_CENTAINE[Number(code[0])] || '' : '';

    return {
      titre, sousTitre, auteurs, editeur: un(publication, 'c'), collection, annee, pages, hauteur,
      serie, tome, genre, prix, langue: un(tous(champs, '101')[0], 'a'),
      resume: un(tous(champs, '330')[0], 'a'), ark: controle['003'] || '', source: 'bnf',
    };
  }

  const requeteSru = (requete, max) =>
    `${SRU_BNF}?version=1.2&operation=searchRetrieve&recordSchema=unimarcxchange&maximumRecords=${max}&query=${encodeURIComponent(requete)}`;

  async function bnfParIsbn(isbn13, isbn10) {
    const codes = [isbn13, isbn10].filter(Boolean);
    const requete = codes.map((c) => `bib.isbn adj "${c}"`).join(' or ');
    const notices = lireReponseSru(await recuperer(requeteSru(requete, 5), { texte: true }));
    if (!notices.length) return null;
    const bonne = notices.find((n) => isbnsDeNotice(n).some((c) => codes.includes(c))) || notices[0];
    return { ...ficheDepuisBnf(bonne), isbn: isbn13 };
  }

  const pourRequete = (s) => String(s).replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();

  /** Recherche par titre (et auteur) pour les livres sans code-barres. */
  async function chercherParTitre(titre, auteur) {
    const parties = [];
    if (titre) parties.push(`bib.title all "${pourRequete(titre)}"`);
    if (auteur) parties.push(`bib.author all "${pourRequete(auteur)}"`);
    parties.push('bib.doctype any "a"');
    const notices = lireReponseSru(await recuperer(requeteSru(parties.join(' and '), 40), { texte: true, delai: 20000 }));
    const cible = cle(titre);
    const fiches = notices.map((n) => {
      const fiche = ficheDepuisBnf(n);
      const lu = isbnsDeNotice(n).map(Bib.isbn.analyser).find((a) => a.type === 'isbn');
      fiche.isbn = lu ? lu.isbn : '';
      return fiche;
    });
    // La BnF classe mal par pertinence : on remonte les titres exacts, puis ceux qui commencent pareil.
    const score = (f) => (cle(f.titre) === cible ? 0 : cle(f.titre).startsWith(cible) ? 1 : 2);
    return fiches.sort((a, b) => score(a) - score(b) || (b.annee || '').localeCompare(a.annee || ''));
  }

  // ---------- Open Library ----------

  async function openLibrary(isbn13) {
    const d = await recuperer(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`);
    const b = d[`ISBN:${isbn13}`];
    if (!b) return null;
    return {
      isbn: isbn13,
      titre: b.title || '',
      sousTitre: b.subtitle || '',
      auteurs: (b.authors || []).map((a) => a.name),
      editeur: ((b.publishers || [])[0] || {}).name || '',
      annee: (String(b.publish_date || '').match(/\d{4}/) || [''])[0],
      pages: b.number_of_pages || null,
      couverture: (b.cover && (b.cover.large || b.cover.medium)) || '',
      source: 'openlibrary',
    };
  }

  // ---------- Google Books ----------

  async function googleBooks(isbn13, cleApi) {
    if (!cleApi) return null;
    const d = await recuperer(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}&key=${encodeURIComponent(cleApi)}`);
    const v = d.items && d.items[0] && d.items[0].volumeInfo;
    if (!v) return null;
    const categorie = String((v.categories || [])[0] || '').toLowerCase();
    return {
      isbn: isbn13,
      titre: v.title || '',
      sousTitre: v.subtitle || '',
      auteurs: v.authors || [],
      editeur: v.publisher || '',
      annee: (String(v.publishedDate || '').match(/\d{4}/) || [''])[0],
      pages: v.pageCount || null,
      genre: GENRES_GOOGLE[categorie] || '',
      resume: v.description || '',
      langue: v.language || '',
      couverture: ((v.imageLinks || {}).thumbnail || '').replace(/^http:/, 'https:').replace('&edge=curl', ''),
      source: 'google',
    };
  }

  // ---------- Couvertures ----------

  // Une image « vide » d'un pixel signifie « pas de couverture » chez certains services.
  function imageValide(url, delai = 7000) {
    return new Promise((resoudre) => {
      const img = new Image();
      let fini = false;
      const finir = (ok) => { if (!fini) { fini = true; resoudre(ok); } };
      img.onload = () => finir(img.naturalWidth > 10);
      img.onerror = () => finir(false);
      setTimeout(() => finir(false), delai);
      img.referrerPolicy = 'no-referrer';
      img.src = url;
    });
  }

  const couvertureOpenLibrary = (isbn13) => `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg?default=false`;

  async function meilleureCouverture(isbn13, fiches, essaiOpenLibrary) {
    const urlOl = couvertureOpenLibrary(isbn13);
    if (await (essaiOpenLibrary || imageValide(urlOl, 5000))) return urlOl;
    const autres = [...new Set(fiches.map((f) => f && f.couverture).filter((u) => u && u !== urlOl))];
    for (const url of autres) {
      if (await imageValide(url, 5000)) return url;
    }
    return '';
  }

  // ---------- Recherche combinée ----------

  const vide = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
  const auPlusTard = (promesse, ms) => Promise.race([promesse, new Promise((r) => setTimeout(() => r(null), ms))]);

  /**
   * La BnF fait foi : elle répond en quelques dixièmes de seconde. Open Library et Google
   * ont alors 1,2 s pour combler les trous (pages, résumé…) ; sans fiche BnF, on les attend plus.
   * La couverture se cherche en parallèle dès le départ.
   */
  async function chercherParIsbn(isbn13, isbn10) {
    const cleGoogle = (Bib.donnees && Bib.donnees.etat.reglages.cleGoogle) || ''; // pas de réglages sur le téléphone
    let bnfInjoignable = false;
    const bnf = bnfParIsbn(isbn13, isbn10).catch(() => { bnfInjoignable = true; return null; });
    const secondaires = [openLibrary(isbn13), googleBooks(isbn13, cleGoogle)].map((p) => p.catch(() => null));
    const essaiCouverture = imageValide(couvertureOpenLibrary(isbn13), 5000);

    const ficheBnf = await bnf;
    const [ficheOl, ficheGoogle] = await Promise.all(secondaires.map((p) => auPlusTard(p, ficheBnf ? 1200 : 9000)));
    const trouvees = [ficheBnf, ficheOl, ficheGoogle].filter(Boolean);
    if (!trouvees.length) return { fiche: null, horsLigne: bnfInjoignable };

    const fiche = { ...trouvees[0] };
    for (const autre of trouvees.slice(1)) {
      for (const [champ, valeur] of Object.entries(autre)) {
        if (vide(fiche[champ]) && !vide(valeur)) fiche[champ] = valeur;
      }
    }
    fiche.isbn = isbn13;
    fiche.couverture = await meilleureCouverture(isbn13, trouvees, essaiCouverture);
    return { fiche };
  }

  Bib.catalogues = { chercherParIsbn, chercherParTitre, meilleureCouverture, GENRES_CONNUS };
})();
