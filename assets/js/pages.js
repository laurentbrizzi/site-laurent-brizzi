/* ==========================================================================
   pages.js — le contenu des pages Ateliers et À propos.

   Un seul module pour deux pages, parce que les deux font la même chose :
   lire un JSON et en poser une liste. Deux fonctions courtes, chacune
   déclenchée par la présence de son conteneur dans le balisage — pas de
   rendu générique qui tenterait de traiter les deux formes à la fois, elles
   n'ont pas les mêmes champs.

   Comme ailleurs, le balisage est construit avec createElement : le contenu
   vient de fichiers que Laurent édite à la main, et un « < » dans un texte
   ne doit pas pouvoir casser la page.
   ========================================================================== */

import { chargerJson, afficherMessage, revelerAuScroll } from "./utils.js";

const zoneAteliers = document.querySelector("[data-ateliers]");
const zoneParcours = document.querySelector("[data-parcours]");


/* --------------------------------------------------------------------------
   Les ateliers
   -------------------------------------------------------------------------- */

function construireAtelier(atelier) {
  const article = document.createElement("article");
  article.className = "atelier";

  const titre = document.createElement("h3");
  titre.className = "atelier__titre";
  titre.textContent = atelier.titre;
  article.append(titre);

  /* Les caractéristiques pratiques : c'est ce qu'une structure regarde en
     premier pour savoir si l'atelier entre dans son cadre. Un champ vide
     n'est pas affiché — mieux vaut une fiche courte qu'une durée blanche. */
  const details = document.createElement("dl");
  details.className = "atelier__details mono";

  const ajouter = (terme, valeur) => {
    if (!valeur) return;
    const ligne = document.createElement("div");
    ligne.className = "atelier__detail";
    const intitule = document.createElement("dt");
    intitule.textContent = terme;
    const contenu = document.createElement("dd");
    contenu.textContent = valeur;
    ligne.append(intitule, contenu);
    details.append(ligne);
  };

  ajouter("Public", atelier.public);
  ajouter("Durée", atelier.duree);
  ajouter("Effectif", atelier.effectif);
  ajouter("Matériel", atelier.materiel);

  if (details.children.length) article.append(details);

  if (atelier.description) {
    const texte = document.createElement("p");
    texte.className = "atelier__texte";
    texte.textContent = atelier.description;
    article.append(texte);
  }

  return article;
}

async function afficherAteliers() {
  let ateliers;

  try {
    ateliers = await chargerJson("data/ateliers.json");
  } catch (erreur) {
    afficherMessage(zoneAteliers, "Les ateliers n'ont pas pu être chargés.", erreur.message);
    return;
  }

  if (!Array.isArray(ateliers) || ateliers.length === 0) {
    afficherMessage(
      zoneAteliers,
      "Aucun atelier n'est encore décrit.",
      "Les ateliers s'ajoutent dans data/ateliers.json."
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const atelier of ateliers) fragment.append(construireAtelier(atelier));
  zoneAteliers.replaceChildren(fragment);

  revelerAuScroll([...zoneAteliers.children].slice(1));
}


/* --------------------------------------------------------------------------
   Le parcours
   Les entrées sont regroupées par catégorie, dans l'ordre fixé ici et non
   dans celui du fichier : on décide de ce qu'une institution lit en premier.
   -------------------------------------------------------------------------- */

const CATEGORIES = [
  { slug: "residence", libelle: "Résidences" },
  { slug: "commande", libelle: "Commandes publiques" },
  { slug: "projet", libelle: "Projets" },
  { slug: "exposition", libelle: "Expositions" },
  { slug: "collaboration", libelle: "Collaborations" },
  { slug: "diffusion", libelle: "Diffusion" },
];

function construireEntree(entree) {
  const ligne = document.createElement("li");
  ligne.className = "parcours__entree";

  const periode = document.createElement("span");
  periode.className = "parcours__periode mono";
  periode.textContent = entree.periode || "";
  ligne.append(periode);

  const detail = document.createElement("span");
  detail.className = "parcours__detail";

  const intitule = document.createElement("span");
  intitule.className = "parcours__intitule";
  intitule.textContent = entree.intitule;
  detail.append(intitule);

  const complement = [entree.lieu, entree.partenaire].filter(Boolean).join(" · ");

  if (complement) {
    const secondaire = document.createElement("span");
    secondaire.className = "parcours__complement mono";
    secondaire.textContent = complement;
    detail.append(secondaire);
  }

  ligne.append(detail);
  return ligne;
}

async function afficherParcours() {
  let entrees;

  try {
    entrees = await chargerJson("data/parcours.json");
  } catch (erreur) {
    afficherMessage(zoneParcours, "Le parcours n'a pas pu être chargé.", erreur.message);
    return;
  }

  if (!Array.isArray(entrees) || entrees.length === 0) {
    afficherMessage(
      zoneParcours,
      "Le parcours n'est pas encore renseigné.",
      "Les entrées s'ajoutent dans data/parcours.json."
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const categorie of CATEGORIES) {
    const retenues = entrees.filter((entree) => entree.categorie === categorie.slug);
    if (!retenues.length) continue;

    const groupe = document.createElement("section");
    groupe.className = "parcours__groupe";

    const titre = document.createElement("h3");
    titre.className = "parcours__titre mono mono--etiquette";
    titre.textContent = categorie.libelle;

    const liste = document.createElement("ul");
    liste.className = "parcours__liste";
    for (const entree of retenues) liste.append(construireEntree(entree));

    groupe.append(titre, liste);
    fragment.append(groupe);
  }

  /* Une catégorie inconnue serait silencieusement perdue. On le dit. */
  const connues = new Set(CATEGORIES.map((c) => c.slug));
  const orphelines = entrees.filter((entree) => !connues.has(entree.categorie));

  if (orphelines.length) {
    const alerte = document.createElement("p");
    alerte.className = "message";
    alerte.textContent =
      `${orphelines.length} entrée(s) de parcours ont une catégorie inconnue et ne sont pas affichées : ` +
      [...new Set(orphelines.map((e) => e.categorie))].join(", ") +
      ". Les catégories admises se déclarent dans assets/js/pages.js.";
    fragment.append(alerte);
  }

  zoneParcours.replaceChildren(fragment);
}


if (zoneAteliers) afficherAteliers();
if (zoneParcours) afficherParcours();
