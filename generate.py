# -*- coding: utf-8 -*-
"""
Generateur du site "Moteur de recherche des peintres".

Parcourt le dossier des fiches .odt, extrait le texte de chacune,
et construit dans le dossier ./docs :
  - index.json        : liste de tous les noms (recherche instantanee)
  - fiches/<n>.json   : contenu de chaque fiche (charge a la demande)

Relancer ce script (ou double-cliquer "Mettre a jour.bat")
chaque fois que des peintres sont ajoutes/modifies.
"""

import zipfile
import re
import os
import json
import html
import glob
import sys

# --- Reglages ---------------------------------------------------------------
FICHES_DIR = r"C:\Users\FRDPO\OneDrive\Bureau\Dessins et peintures"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs")
# ---------------------------------------------------------------------------


def extract_text(path):
    """Extrait le texte d'un fichier .odt en preservant les sauts de ligne."""
    try:
        with zipfile.ZipFile(path) as z:
            xml = z.read("content.xml").decode("utf-8", "ignore")
    except Exception as e:
        return f"(Impossible de lire la fiche : {e})"

    # On garde seulement le corps du texte
    m = re.search(r"<office:body>(.*)</office:body>", xml, re.S)
    if m:
        xml = m.group(1)

    # Sauts de ligne logiques
    xml = re.sub(r"<text:tab\s*/>", " ", xml)
    xml = re.sub(r"<text:line-break\s*/>", "\n", xml)
    xml = re.sub(r"</text:p>", "\n", xml)
    xml = re.sub(r"</text:h>", "\n", xml)
    # Suppression des autres balises
    xml = re.sub(r"<[^>]+>", "", xml)
    txt = html.unescape(xml)
    # Nettoyage des espaces / lignes vides multiples
    txt = txt.replace("\r", "")
    txt = re.sub(r"[ \t]+\n", "\n", txt)
    txt = re.sub(r"\n{3,}", "\n\n", txt)
    return txt.strip()


def analyse(text):
    """Renvoie (annee_naissance|None, nb_oeuvres, [sources_nettoyees])."""
    lines = text.split("\n")
    birth = None
    date_idx = -1
    for i, ln in enumerate(lines[:6]):
        m = re.search(r"\((?:[^)]*?)(1[0-9]{3}|20[0-2][0-9])", ln)
        if m:
            birth = int(m.group(1))
            date_idx = i
            break

    oeuvres = 0
    sources = []
    for ln in lines[date_idx + 1:]:
        if not ln.strip():
            continue
        if re.match(r"^\s+\S", ln):  # ligne en retrait = source
            s = ln.strip()
            s = re.sub(r"\s*n[°ºo]\s*[\dIVXLC].*$", "", s, flags=re.I)
            s = re.sub(r"\s*pp?\.?\s*[\dIVXLC].*$", "", s, flags=re.I)
            s = s.strip(" .,;:-")
            if s and not re.fullmatch(r"[\d\s.,;:/p-]+", s):
                sources.append(s)
        else:  # ligne sans retrait = titre d'oeuvre
            oeuvres += 1
    return birth, oeuvres, sources


def main():
    fiches_out = os.path.join(OUT_DIR, "fiches")
    os.makedirs(fiches_out, exist_ok=True)

    # Nettoyage des anciennes fiches (au cas ou des peintres auraient ete supprimes)
    for old in glob.glob(os.path.join(fiches_out, "*.json")):
        os.remove(old)

    files = sorted(
        glob.glob(os.path.join(FICHES_DIR, "*.odt")),
        key=lambda p: os.path.basename(p).lower(),
    )
    print(f"{len(files)} fiches trouvees.")

    index = []
    from collections import Counter
    century = Counter()
    sources_count = Counter()
    top_painters = []
    n_dates = 0
    total_oeuvres = 0

    for n, path in enumerate(files, start=1):
        name = os.path.splitext(os.path.basename(path))[0].strip()
        text = extract_text(path)
        with open(os.path.join(fiches_out, f"{n}.json"), "w", encoding="utf-8") as f:
            json.dump({"name": name, "text": text}, f, ensure_ascii=False)
        index.append([name, n])

        birth, oeuvres, sources = analyse(text)
        if birth:
            n_dates += 1
            century[(birth - 1) // 100 + 1] += 1
        total_oeuvres += oeuvres
        top_painters.append((name, oeuvres, n))
        for s in sources:
            sources_count[s] += 1

        if n % 500 == 0:
            print(f"  ... {n} fiches traitees")

    with open(os.path.join(OUT_DIR, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False)

    top_painters.sort(key=lambda x: x[1], reverse=True)
    stats = {
        "total": len(index),
        "with_dates": n_dates,
        "total_oeuvres": total_oeuvres,
        "by_century": [[c, century[c]] for c in sorted(century)],
        "top_sources": sources_count.most_common(20),
        "top_painters": [[nm, ov, idx] for nm, ov, idx in top_painters[:20] if ov > 0],
        "n_sources_distinctes": len(sources_count),
    }
    with open(os.path.join(OUT_DIR, "stats.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False)

    print(f"Termine : {len(index)} fiches generees dans {OUT_DIR}")


if __name__ == "__main__":
    if not os.path.isdir(FICHES_DIR):
        print(f"ERREUR : dossier introuvable : {FICHES_DIR}")
        sys.exit(1)
    main()
