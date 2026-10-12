/* ==========================================================================
   utils.js — ce qui est partagé entre portfolio.js et boutique.js.
   Module ES. Aucune variable globale, aucune dépendance.
   ========================================================================== */


/* --------------------------------------------------------------------------
   Les disciplines
   Liste fermée (§5). Une œuvre dont la discipline n'est pas ici ne sera pas
   filtrable : c'est voulu, c'est le garde-fou contre les fautes de frappe.
   Toute nouvelle discipline s'ajoute D'ABORD ici, avant d'apparaître dans
   oeuvres.json.
   -------------------------------------------------------------------------- */

export const DISCIPLINES = [
  { slug: "peinture",     libelle: "Peinture" },
  { slug: "sculpture",    libelle: "Sculpture" },
  { slug: "bas-relief",   libelle: "Bas-relief" },
  { slug: "street-art",   libelle: "Street art" },
  { slug: "sfx",          libelle: "Effets spéciaux" },
  { slug: "3d",           libelle: "Impression 3D" },
  { slug: "scenographie", libelle: "Scénographie" },
  { slug: "musique",      libelle: "Musique" },
];

export const libelleDiscipline = (slug) =>
  DISCIPLINES.find((discipline) => discipline.slug === slug)?.libelle ?? slug;


/* --------------------------------------------------------------------------
   Chargement des fichiers de contenu
   Chaque échec produit une phrase que Laurent peut comprendre et sur
   laquelle il peut agir. Jamais « TypeError: Failed to fetch », jamais un
   écran vide (§7).
   -------------------------------------------------------------------------- */

export async function chargerJson(chemin) {

  /* Le cas le plus probable, et le plus déroutant : la page a été ouverte
     par un double-clic depuis l'explorateur. Le navigateur refuse alors
     tout fetch, sans message utile. On le dit avant même d'essayer. */
  if (window.location.protocol === "file:") {
    throw new Error(
      "Cette page a été ouverte directement depuis le disque. " +
      "Les navigateurs interdisent alors le chargement des fichiers de contenu. " +
      "Lancez le serveur local avec « node scripts/serveur.mjs », " +
      "puis ouvrez http://localhost:8000/"
    );
  }

  let reponse;

  try {
    reponse = await fetch(chemin, { cache: "no-cache" });
  } catch {
    throw new Error(
      `Le fichier ${chemin} n'a pas pu être atteint. ` +
      "Le serveur local est peut-être arrêté."
    );
  }

  if (!reponse.ok) {
    throw new Error(
      `Le fichier ${chemin} est introuvable (erreur ${reponse.status}). ` +
      "Vérifiez son nom et son emplacement."
    );
  }

  try {
    return await reponse.json();
  } catch {
    throw new Error(
      `Le fichier ${chemin} contient une erreur de syntaxe. ` +
      "C'est presque toujours une virgule en trop après le dernier élément " +
      "d'une liste, ou un guillemet oublié."
    );
  }
}


/* --------------------------------------------------------------------------
   Messages affichés dans l'interface
   -------------------------------------------------------------------------- */

export function afficherMessage(conteneur, titre, detail) {
  conteneur.replaceChildren();

  const bloc = document.createElement("p");
  bloc.className = "message";

  const intitule = document.createElement("strong");
  intitule.textContent = titre;
  bloc.append(intitule);

  if (detail) {
    bloc.append(document.createElement("br"));
    bloc.append(document.createTextNode(detail));
  }

  conteneur.append(bloc);
}


/* --------------------------------------------------------------------------
   Révélation au défilement, en cascade
   Fondu et translation de 12px sur 400 ms (§6). Les éléments qui entrent à
   l'écran ensemble — typiquement une rangée de la grille — ne s'allument pas
   d'un bloc : chacun part un cran après son voisin de gauche.

   Le réglage système « mouvement réduit » désactive tout : on n'ajoute alors
   même pas la classe, pour qu'aucun élément ne puisse rester invisible si le
   script s'interrompait ensuite.
   -------------------------------------------------------------------------- */

/* Deux vignettes d'une même rangée ne commencent presque jamais exactement
   à la même hauteur : leurs images n'ont pas la même proportion et la grille
   les aligne par le haut à quelques pixels près. En deçà de cette tolérance,
   on considère qu'on est sur la même rangée et on cascade de gauche à
   droite ; au-delà, c'est une rangée suivante et on repart du haut. */
const TOLERANCE_RANGEE = 24;

function ordreDeLecture(a, b) {
  const boiteA = a.boundingClientRect;
  const boiteB = b.boundingClientRect;

  if (Math.abs(boiteA.top - boiteB.top) > TOLERANCE_RANGEE) {
    return boiteA.top - boiteB.top;
  }

  return boiteA.left - boiteB.left;
}

export function revelerAuScroll(elements) {
  const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (mouvementReduit || !("IntersectionObserver" in window)) return;

  const observateur = new IntersectionObserver(
    (entrees, obs) => {

      /* L'observateur livre ses entrées dans un ordre qui n'est pas garanti.
         Les remettre dans l'ordre de lecture est ce qui fait la différence
         entre une cascade et un clignotement désordonné. */
      const apparues = entrees
        .filter((entree) => entree.isIntersecting)
        .sort(ordreDeLecture);

      apparues.forEach((entree, rang) => {
        const element = entree.target;

        /* Le retard lui-même est calculé en CSS, à partir de ce rang et des
           réglages de tokens.css. On ne pose ici qu'un numéro d'ordre : la
           durée du pas et son plafond n'ont pas à vivre dans le JavaScript. */
        element.style.setProperty("--rang-cascade", rang);

        /* Et on le retire dès l'apparition finie : laissé en place, ce
           retard s'appliquerait à toutes les transitions ultérieures de
           l'élément, qui paraîtraient alors molles sans raison visible. */
        element.addEventListener(
          "transitionend",
          () => element.style.removeProperty("--rang-cascade"),
          { once: true }
        );

        element.classList.add("reveler--visible");
        obs.unobserve(element);
      });
    },
    { rootMargin: "0px 0px -8% 0px" }
  );

  for (const element of elements) {
    element.classList.add("reveler");
    observateur.observe(element);
  }
}


/* --------------------------------------------------------------------------
   Paramètres d'URL
   Le filtre actif vit dans l'URL : un lien vers « ?discipline=bas-relief »
   doit pouvoir être copié, partagé et rouvert tel quel.
   -------------------------------------------------------------------------- */

export const lireParametre = (nom) =>
  new URLSearchParams(window.location.search).get(nom);

export function ecrireParametre(nom, valeur) {
  const url = new URL(window.location.href);

  if (valeur) {
    url.searchParams.set(nom, valeur);
  } else {
    url.searchParams.delete(nom);
  }

  /* replaceState et non pushState : filtrer n'est pas naviguer, on ne veut
     pas que le bouton Retour reparcoure douze filtres avant de quitter. */
  window.history.replaceState({}, "", url);
}
