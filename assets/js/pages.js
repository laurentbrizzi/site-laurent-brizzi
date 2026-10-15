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


const DOSSIER_IMAGES = "assets/img/";
const DOSSIER_VIDEOS = "assets/video/";

const mouvementReduit = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* La durée du fondu vient de tokens.css, comme toutes les durées du site.
   On la lit au moment de s'en servir plutôt que de la recopier ici : une
   valeur en double finit toujours par diverger. */
function dureeDuFondu() {
  const valeur = getComputedStyle(document.documentElement)
    .getPropertyValue("--duree-court")
    .trim();
  const nombre = parseFloat(valeur);
  if (!Number.isFinite(nombre)) return 180;
  return valeur.endsWith("ms") ? nombre : nombre * 1000;
}


/* --------------------------------------------------------------------------
   La galerie d'un atelier
   Une grande vue, et dessous la série des autres. Cliquer sur une vignette
   la fait passer en grand, en fondu.

   Deux partis pris de mise en page, l'un et l'autre appris en regardant
   l'écran :

   - la grande vue vit dans une scène de hauteur fixe. Sans elle, permuter
     une photo verticale et une photo horizontale déplaçait toute la fiche
     à chaque clic, et les vignettes fuyaient sous le curseur ;
   - les vignettes ont toutes la même hauteur et une largeur libre. En
     colonnes de largeur égale, chacune gardait sa propre hauteur et la
     rangée partait en escalier.

   Les vignettes sont de vrais boutons : on y arrive au clavier, et un
   lecteur d'écran annonce laquelle est affichée.
   -------------------------------------------------------------------------- */

function poserImage(element, image) {
  if (image.largeur) element.width = image.largeur;
  if (image.hauteur) element.height = image.hauteur;
  element.alt = image.alt ?? "";
  element.src = DOSSIER_IMAGES + image.fichier;
}

function construireGalerie(atelier) {
  const galerie = document.createElement("div");
  galerie.className = "atelier__visuels";

  const scene = document.createElement("div");
  scene.className = "atelier__scene";

  const principale = document.createElement("img");
  principale.className = "atelier__image";
  principale.decoding = "async";
  principale.loading = "lazy";
  poserImage(principale, atelier.images[0]);
  scene.append(principale);

  /* Une vidéo ne se lance qu'au clic sur sa vignette. Pas de lecture
     automatique : c'est la règle du §6, et sur un téléphone une vidéo qui
     démarre seule consomme les données du visiteur sans qu'il ait rien
     demandé. Le lecteur est muet et n'est créé que si l'atelier en a une. */
  const aUneVideo = atelier.images.some((image) => image.video);
  let lecteur = null;

  if (aUneVideo) {
    lecteur = document.createElement("video");
    lecteur.className = "atelier__video";
    lecteur.controls = true;
    lecteur.muted = true;
    lecteur.playsInline = true;
    lecteur.preload = "none";
    lecteur.hidden = true;
    scene.append(lecteur);
  }

  const montrerImage = () => {
    if (!lecteur) return;
    lecteur.pause();
    lecteur.hidden = true;
    principale.hidden = false;
  };

  galerie.append(scene);

  if (atelier.images.length < 2) return galerie;

  const rangee = document.createElement("div");
  rangee.className = "atelier__secondaires";
  const boutons = [];

  const montrer = async (image, bouton) => {
    if (bouton.getAttribute("aria-current") === "true") return;

    for (const autre of boutons) autre.setAttribute("aria-current", "false");
    bouton.setAttribute("aria-current", "true");

    if (image.video && lecteur) {
      if (!lecteur.src) lecteur.src = DOSSIER_VIDEOS + image.video;
      lecteur.setAttribute("aria-label", image.alt ?? "");
      principale.hidden = true;
      lecteur.hidden = false;
      /* La lecture suit un clic du visiteur : le navigateur l'autorise, et
         si jamais il la refuse, les commandes restent là pour la lancer. */
      lecteur.play().catch(() => {});
      return;
    }

    montrerImage();

    /* On décode avant de permuter : sans ça, la grande vue disparaît le
       temps du téléchargement et l'apparition se fait sur du vide. */
    const suivante = new Image();
    suivante.src = DOSSIER_IMAGES + image.fichier;
    try { await suivante.decode(); } catch { /* image manquante : on tente quand même */ }

    /* L'image est posée tout de suite, puis elle apparaît en fondu. Elle
       n'est jamais retirée avant d'être remplacée.

       Les deux versions précédentes faisaient l'inverse : effacer, attendre
       la fin de l'effacement, puis échanger. Les deux se bloquaient dès que
       ce signal de fin n'arrivait pas — onglet en arrière-plan, animation
       suspendue par le navigateur — et la galerie restait vide pour de bon.
       Un fondu qui ne démarre pas doit laisser une image visible, pas un
       trou. */
    poserImage(principale, image);

    /* Onglet en arrière-plan : le navigateur suspend les animations, et un
       fondu suspendu à son premier pas laisse l'image à zéro d'opacité.
       On s'en passe, l'image est déjà en place. */
    if (document.hidden || mouvementReduit() || typeof principale.animate !== "function") return;

    /* La durée est lue dans tokens.css : elle ne vit qu'à un seul endroit. */
    principale.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: dureeDuFondu(), easing: "ease-out" }
    );
  };

  atelier.images.forEach((image, rang) => {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "atelier__vignette";
    bouton.setAttribute("aria-current", rang === 0 ? "true" : "false");
    bouton.setAttribute("aria-label", image.video
      ? `Lire la vidéo : ${image.alt ?? ""}`
      : `Afficher en grand : ${image.alt ?? "vue " + (rang + 1)}`);

    const vignette = document.createElement("img");
    vignette.className = "atelier__image--secondaire";
    vignette.decoding = "async";
    vignette.loading = "lazy";
    vignette.alt = "";
    if (image.largeur) vignette.width = image.largeur;
    if (image.hauteur) vignette.height = image.hauteur;
    vignette.src = DOSSIER_IMAGES + (image.affiche ?? image.fichier);

    bouton.append(vignette);

    /* Sans repère, rien ne distingue une vidéo d'une photo. Le triangle est
       décoratif : ce que le bouton fait est déjà dit dans son aria-label. */
    if (image.video) {
      const repere = document.createElement("span");
      repere.className = "atelier__lecture";
      repere.setAttribute("aria-hidden", "true");
      bouton.append(repere);
    }
    bouton.addEventListener("click", () => montrer(image, bouton));
    boutons.push(bouton);
    rangee.append(bouton);
  });

  galerie.append(rangee);
  return galerie;
}


/* --------------------------------------------------------------------------
   Les ateliers
   -------------------------------------------------------------------------- */

function construireAtelier(atelier) {
  const article = document.createElement("article");
  article.className = "atelier";

  /* Les visuels passent avant le titre, comme sur un cartel : l'image, puis
     le filet, puis les données. Une structure qui cherche un intervenant
     regarde d'abord ce qui sort de l'atelier. Un atelier sans photo
     n'affiche rien de plus : c'est un manque, pas une panne. */
  if (atelier.images?.length) {
    article.append(construireGalerie(atelier));
  }

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
