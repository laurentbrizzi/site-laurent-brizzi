#!/usr/bin/env bash
#
# optimiser-images.sh — convertit des photos en WebP pour le site.
#
# Outillage de poste de travail. Ce dossier n'est jamais déployé.
#
#   ./scripts/optimiser-images.sh <dossier-source> [dossier-sortie]
#
# Par défaut, la sortie est assets/img.
#
# Ce que fait le script pour chaque photo :
#   - la ramène à 1600 px de large au maximum, jamais plus (§8) ;
#     une photo déjà plus petite n'est PAS agrandie, ce serait du flou ;
#   - l'encode en WebP à la qualité 82 ;
#   - conserve le profil colorimétrique — sur des tableaux, une dérive de
#     couleur est une faute, pas un détail ;
#   - renomme en minuscules avec des tirets ;
#   - affiche à la fin un bloc JSON prêt à coller dans oeuvres.json, avec
#     les largeurs et hauteurs déjà relevées. C'est l'étape où l'on se
#     trompe le plus souvent à la main.
#
# Le script n'écrase jamais un fichier existant sans -f.

set -euo pipefail

QUALITE=82
LARGEUR_MAX=1600
FORCER=0

usage() {
  cat <<'FIN'
Usage : ./scripts/optimiser-images.sh [options] <dossier-source> [dossier-sortie]

  -q <n>   qualité WebP, de 0 à 100 (défaut : 82)
  -l <n>   largeur maximale en pixels (défaut : 1600)
  -f       écraser les fichiers déjà présents
  -h       cette aide

La qualité 82 a été retenue après comparaison à 100 % sur une peinture à
l'aérographe : au-delà, le fichier grossit sans différence visible.
FIN
}

while getopts "q:l:fh" option; do
  case "$option" in
    q) QUALITE="$OPTARG" ;;
    l) LARGEUR_MAX="$OPTARG" ;;
    f) FORCER=1 ;;
    h) usage; exit 0 ;;
    *) usage; exit 1 ;;
  esac
done
shift $((OPTIND - 1))

if [ $# -lt 1 ]; then
  usage
  exit 1
fi

SOURCE="$1"
SORTIE="${2:-assets/img}"

# --- Trouver cwebp ---------------------------------------------------------
# Il n'est pas installé dans le système : c'est un exécutable autonome.
# On le cherche dans le PATH, puis là où il a été déposé.

trouver_cwebp() {
  if command -v cwebp >/dev/null 2>&1; then
    command -v cwebp
    return
  fi
  local candidat
  for candidat in \
    "$LOCALAPPDATA/libwebp"/*/bin/cwebp.exe \
    "$HOME/AppData/Local/libwebp"/*/bin/cwebp.exe \
    /usr/local/bin/cwebp \
    /opt/homebrew/bin/cwebp
  do
    if [ -x "$candidat" ]; then
      printf '%s' "$candidat"
      return
    fi
  done
  return 1
}

CWEBP="$(trouver_cwebp)" || {
  echo "cwebp est introuvable." >&2
  echo "Téléchargez libwebp depuis :" >&2
  echo "  https://storage.googleapis.com/downloads.webmproject.org/releases/webp/" >&2
  echo "et décompressez l'archive windows-x64 dans %LOCALAPPDATA%\\libwebp" >&2
  exit 1
}

WEBPINFO="$(dirname "$CWEBP")/webpinfo"
[ -x "$WEBPINFO" ] || WEBPINFO="$(dirname "$CWEBP")/webpinfo.exe"

# Git Bash passe des chemins POSIX ; cwebp.exe attend des chemins Windows.
chemin_natif() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
  else
    printf '%s' "$1"
  fi
}

[ -d "$SOURCE" ] || { echo "Dossier source introuvable : $SOURCE" >&2; exit 1; }
mkdir -p "$SORTIE"

# --- Nommage ---------------------------------------------------------------
# Minuscules, tirets, rien d'autre. Les noms produits à partir de fichiers
# venant de Facebook ou d'un téléphone seront illisibles : renommez-les
# ensuite avec le nom de l'œuvre, en gardant le suffixe -01, -02…

slugifier() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -e 's/[^a-z0-9]\+/-/g' -e 's/^-\+//' -e 's/-\+$//'
}

# --- Mesure d'un WebP ------------------------------------------------------
# On mesure le fichier produit, pas la source. Deux raisons :
#
# 1. L'option -resize de cwebp AGRANDIT une image plus petite que la cible.
#    Vérifié : une photo de 442 px est ressortie à 1600 px, floue et trois
#    fois plus lourde. Il faut donc ne redimensionner que vers le bas, et
#    pour cela connaître la largeur d'origine.
#
# 2. Lire cette largeur avec `file` s'est révélé faux : la sortie contient
#    « density 1x1 » avant les vraies dimensions, et deux photos de 2914 et
#    2048 px sont passées à travers sans être réduites. Plutôt que d'affiner
#    une expression régulière qui se cassera sur un autre format, on encode
#    une première fois sans redimensionner, on mesure, et on recommence
#    seulement si c'est trop large. Un encodage de plus, mais aucune
#    supposition.

dimensions_webp() {
  "$WEBPINFO" "$(chemin_natif "$1")" 2>/dev/null \
    | sed -n -e 's/^ *Width: *\([0-9]\+\).*/\1/p' -e 's/^ *Height: *\([0-9]\+\).*/\1/p' \
    | head -2 \
    | tr '\n' ' '
}

echo "cwebp      : $CWEBP"
echo "source     : $SOURCE"
echo "sortie     : $SORTIE"
echo "qualité    : $QUALITE     largeur max : $LARGEUR_MAX px"
echo

BLOC_JSON=""
TRAITEES=0
IGNOREES=0

while IFS= read -r -d '' fichier; do
  base="$(basename "$fichier")"
  base="${base%.*}"
  nom="$(slugifier "$base").webp"
  cible="$SORTIE/$nom"

  if [ -e "$cible" ] && [ "$FORCER" -eq 0 ]; then
    echo "  ignoré (existe déjà) : $nom"
    IGNOREES=$((IGNOREES + 1))
    continue
  fi

  # Premier encodage, à la taille d'origine.
  "$CWEBP" -q "$QUALITE" -m 6 -sharp_yuv -metadata icc -quiet \
    "$(chemin_natif "$fichier")" -o "$(chemin_natif "$cible")"

  read -r largeur hauteur <<< "$(dimensions_webp "$cible")"

  # Trop large : on recommence en réduisant. -resize L 0 conserve les
  # proportions. On ne passe jamais ici pour une image déjà plus petite,
  # donc aucune image n'est agrandie.
  if [ -n "$largeur" ] && [ "$largeur" -gt "$LARGEUR_MAX" ]; then
    "$CWEBP" -q "$QUALITE" -m 6 -sharp_yuv -metadata icc \
      -resize "$LARGEUR_MAX" 0 -quiet \
      "$(chemin_natif "$fichier")" -o "$(chemin_natif "$cible")"
    read -r largeur hauteur <<< "$(dimensions_webp "$cible")"
  fi

  poids="$(du -k "$cible" | cut -f1)"

  # Une vignette fait environ 410 px de large, soit 820 px sur un écran à
  # densité double. En dessous, l'image est visiblement molle à côté des
  # autres. On le signale plutôt que de le laisser découvrir en ligne.
  alerte=""
  if [ -n "$largeur" ] && [ "$largeur" -lt 820 ]; then
    alerte="   ← définition faible"
  fi

  printf '  %-46s %5s Ko   %s x %s%s\n' "$nom" "$poids" "${largeur:-?}" "${hauteur:-?}" "$alerte"

  BLOC_JSON="$BLOC_JSON
    {
      \"fichier\": \"$nom\",
      \"largeur\": ${largeur:-0},
      \"hauteur\": ${hauteur:-0},
      \"alt\": \"\"
    },"

  TRAITEES=$((TRAITEES + 1))
done < <(find "$SOURCE" -maxdepth 1 -type f \
           \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.tif' -o -iname '*.tiff' \) \
           -print0 | sort -z)

echo
echo "$TRAITEES converties, $IGNOREES ignorées."

if [ "$TRAITEES" -gt 0 ]; then
  cat <<'FIN'

--------------------------------------------------------------------------
À coller dans data/oeuvres.json, dans le tableau "images" de chaque œuvre.
Retirez la virgule après la dernière accolade, et rédigez les "alt" :
une phrase qui décrit l'image, jamais « image1 ».
--------------------------------------------------------------------------
FIN
  # On retire la virgule finale : c'est l'erreur de syntaxe la plus courante.
  printf '%s\n' "${BLOC_JSON%,}"
fi
