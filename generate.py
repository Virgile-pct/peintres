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
    for n, path in enumerate(files, start=1):
        name = os.path.splitext(os.path.basename(path))[0].strip()
        text = extract_text(path)
        with open(os.path.join(fiches_out, f"{n}.json"), "w", encoding="utf-8") as f:
            json.dump({"name": name, "text": text}, f, ensure_ascii=False)
        index.append([name, n])
        if n % 500 == 0:
            print(f"  ... {n} fiches traitees")

    with open(os.path.join(OUT_DIR, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False)

    print(f"Termine : {len(index)} fiches generees dans {OUT_DIR}")


if __name__ == "__main__":
    if not os.path.isdir(FICHES_DIR):
        print(f"ERREUR : dossier introuvable : {FICHES_DIR}")
        sys.exit(1)
    main()
