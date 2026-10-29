/* ==========================================================================
   portfolio.js — chargement, filtres et affichage de la grille des œuvres.
   La lightbox annoncée au §5 arrivera avec oeuvre.html, à l'étape suivante.

   Le balisage des cartels est construit avec createElement et non avec des
   chaînes HTML : le contenu vient d'un fichier que Laurent édite à la main,
   et un simple « < » dans un texte de matériaux casserait la page.
   ========================================================================== */

import {
  DISCIPLINES,
  libelleDiscipline,
  chargerJson,
  afficherMessage,
  revelerAuScroll,
  lireParametre,
  ecrireParametre,
} from "./utils.js";

const CHEMIN_DONNEES = "data/oeuvres.json";
const DOSSIER_IMAGES = "assets/img/";

/* Les deux premières vignettes sont visibles sans défiler sur la plupart
   des écrans : elles se chargent immédiatement, les autres à l'approche. */
const VIGNETTES_PRIORITAIRES = 2;

const grille = document.querySelector("[data-grille-oeuvres]");
const zoneFiltres = document.querySelector("[data-filtres]");
const compteur = document.querySelector("[data-compteur]");
const zoneUne = document.querySelector("[data-une]");
const zoneFiche = document.querySelector("[data-fiche]");


/* --------------------------------------------------------------------------
   Construction d'un cartel
   -------------------------------------------------------------------------- */

function construireVisuel(oeuvre, prioritaire) {
  const visuel = document.createElement("span");
  visuel.className = "cartel__visuel";

  const principale = oeuvre.images?.[0];

  /* Une œuvre peut être décrite avant d'être photographiée. On réserve
     alors sa place plutôt que d'afficher une image cassée. */
  if (!principale) {
    const attente = document.createElement("span");
    attente.className = "cartel__attente mono";
    attente.textContent = "Visuel à venir";
    visuel.append(attente);
    return visuel;
  }

  const image = document.createElement("img");
  image.className = "cartel__image";

  /* width et height AVANT src. Ce ne sont pas des attributs décoratifs :
     sans eux, aucun format n'étant imposé, la grille sauterait à chaque
     image reçue (§8). Les poser après le src fait signaler à Chrome
     « Lazy-loaded images should have explicit dimensions » — il évalue au
     moment où la source est affectée. */
  if (principale.largeur) image.width = principale.largeur;
  if (principale.hauteur) image.height = principale.hauteur;

  image.alt = principale.alt ?? "";
  image.decoding = "async";
  image.loading = prioritaire ? "eager" : "lazy";
  image.src = DOSSIER_IMAGES + principale.fichier;

  visuel.append(image);

  /* Par convention, images[1] est le détail montré au survol (§5). Elle est
     décorative : l'image principale porte déjà la description. */
  const detail = oeuvre.images[1];

  if (detail) {
    const imageDetail = document.createElement("img");
    imageDetail.className = "cartel__detail";
    if (detail.largeur) imageDetail.width = detail.largeur;
    if (detail.hauteur) imageDetail.height = detail.hauteur;
    imageDetail.alt = "";
    imageDetail.setAttribute("aria-hidden", "true");
    imageDetail.decoding = "async";
    imageDetail.loading = "lazy";
    imageDetail.src = DOSSIER_IMAGES + detail.fichier;
    visuel.append(imageDetail);
  }

  return visuel;
}

function construireChamp(terme, valeur, modificateur) {
  const champ = document.createElement("div");
  champ.className = "cartel__champ";
  if (modificateur) champ.classList.add(`cartel__champ--${modificateur}`);

  const intitule = document.createElement("dt");
  intitule.className = "visuellement-cache";
  intitule.textContent = terme;

  const contenu = document.createElement("dd");
  contenu.textContent = valeur;

  champ.append(intitule, contenu);
  return champ;
}

/* Une œuvre vendue le dit, mais toutes les mentions de statut ne sont pas
   des ventes : un bas-relief installé sous une voûte n'est pas à vendre et
   ne l'a jamais été. On ne met donc en valeur que la vente, et le reste
   s'affiche comme une donnée de cartel ordinaire. */
const estVendue = (oeuvre) => /^vendue?$/i.test((oeuvre.statut ?? "").trim());

function construireCartel(oeuvre, prioritaire) {
  const figure = document.createElement("figure");
  figure.className = "cartel";

  figure.append(construireVisuel(oeuvre, prioritaire));

  const legende = document.createElement("figcaption");
  legende.className = "cartel__legende";

  const lien = document.createElement("a");
  lien.className = "cartel__lien";
  lien.href = `oeuvre.html?id=${encodeURIComponent(oeuvre.id)}`;
  lien.textContent = oeuvre.titre || "Titre à renseigner";
  legende.append(lien);

  const donnees = document.createElement("dl");
  donnees.className = "cartel__donnees";

  /* Un champ vide n'est pas affiché : une œuvre en cours de saisie ne doit
     pas produire de lignes fantômes dans le cartel. */
  if (oeuvre.annee) donnees.append(construireChamp("Année", String(oeuvre.annee)));
  if (oeuvre.materiaux) donnees.append(construireChamp("Matériaux", oeuvre.materiaux));
  if (oeuvre.dimensions) donnees.append(construireChamp("Dimensions", oeuvre.dimensions));

  /* Le statut vient en dernier, après les données de fabrication : c'est
     une information sur le sort de l'œuvre, pas sur sa nature. */
  if (oeuvre.statut) {
    donnees.append(construireChamp("Statut", oeuvre.statut, estVendue(oeuvre) ? "vendue" : null));
  }

  if (donnees.children.length > 0) legende.append(donnees);

  figure.append(legende);
  return figure;
}


/* --------------------------------------------------------------------------
   L'œuvre à la une, en tête de l'accueil
   L'image occupe toute la largeur de l'écran, son cartel revient dans la
   bande, aligné sur le reste de la page. Pas de cartel posé SUR l'image :
   ce serait la carte flottante que le §6 interdit, et un texte sur une
   peinture n'est lisible sur aucune des deux.
   -------------------------------------------------------------------------- */

function construireUne(oeuvre) {
  const image = oeuvre.images?.[0];
  if (!image) return;

  const lien = document.createElement("a");
  lien.className = "une__lien";
  lien.href = `oeuvre.html?id=${encodeURIComponent(oeuvre.id)}`;

  const visuel = document.createElement("span");
  visuel.className = "une__visuel";

  const vignette = document.createElement("img");
  vignette.className = "une__image";
  if (image.largeur) vignette.width = image.largeur;
  if (image.hauteur) vignette.height = image.hauteur;
  vignette.alt = image.alt ?? "";
  vignette.decoding = "async";
  /* La plus grande image de la page, et la première visible : jamais en
     chargement différé, ce serait retarder ce que le visiteur regarde. */
  vignette.loading = "eager";
  vignette.setAttribute("fetchpriority", "high");
  vignette.src = DOSSIER_IMAGES + image.fichier;

  visuel.append(vignette);
  lien.append(visuel);

  const bande = document.createElement("div");
  bande.className = "bande";

  const legende = document.createElement("span");
  legende.className = "une__legende";

  const titre = document.createElement("span");
  titre.className = "une__titre";
  titre.textContent = oeuvre.titre || "Titre à renseigner";
  legende.append(titre);

  const donnees = [oeuvre.annee, oeuvre.materiaux, oeuvre.dimensions]
    .filter(Boolean)
    .join(" · ");

  if (donnees) {
    const details = document.createElement("span");
    details.className = "une__donnees";
    details.textContent = donnees;
    legende.append(details);
  }

  bande.append(legende);
  lien.append(bande);
  zoneUne.replaceChildren(lien);
}


/* --------------------------------------------------------------------------
   La vue agrandie
   Construite sur <dialog> : la fermeture par Échap, le piège à focus, le
   retour du focus sur l'image cliquée et l'inertie de l'arrière-plan sont
   assurés par le navigateur. Le §8 est satisfait sans réécrire ce que la
   plateforme fait déjà mieux.
   -------------------------------------------------------------------------- */

const loupe = document.querySelector("[data-loupe]");
const loupeCadre = document.querySelector("[data-loupe-cadre]");
const loupeLegende = document.querySelector("[data-loupe-legende]");

let loupeImages = [];
let loupeRang = 0;

function montrerDansLoupe(rang) {
  if (!loupeImages.length) return;

  /* Modulo pour boucler : après la dernière on revient à la première. */
  loupeRang = (rang + loupeImages.length) % loupeImages.length;
  const image = loupeImages[loupeRang];

  /* L'image est recréée à chaque vue plutôt que recyclée : source,
     dimensions et alt sont ainsi toujours posés ensemble, et le document ne
     contient jamais d'image sans source. */
  const vue = document.createElement("img");
  vue.className = "loupe__image";
  if (image.largeur) vue.width = image.largeur;
  if (image.hauteur) vue.height = image.hauteur;
  vue.alt = image.alt ?? "";
  vue.decoding = "async";
  vue.src = DOSSIER_IMAGES + image.fichier;
  loupeCadre.replaceChildren(vue);

  loupeLegende.textContent = loupeImages.length > 1
    ? `Vue ${loupeRang + 1} sur ${loupeImages.length}`
    : "";

  /* Une seule image : les flèches n'ont rien à faire là. On les retire du
     parcours clavier au lieu de les laisser inertes. */
  for (const bouton of loupe.querySelectorAll("[data-loupe-precedent], [data-loupe-suivant]")) {
    bouton.hidden = loupeImages.length < 2;
  }
}

function ouvrirLoupe(images, rang) {
  if (!loupe || !images.length) return;
  loupeImages = images;
  montrerDansLoupe(rang);
  loupe.showModal();
}

if (loupe) {
  loupe.querySelector("[data-loupe-fermer]")?.addEventListener("click", () => loupe.close());
  loupe.querySelector("[data-loupe-precedent]")?.addEventListener("click", () => montrerDansLoupe(loupeRang - 1));
  loupe.querySelector("[data-loupe-suivant]")?.addEventListener("click", () => montrerDansLoupe(loupeRang + 1));

  loupe.addEventListener("keydown", (evenement) => {
    if (evenement.key === "ArrowLeft") montrerDansLoupe(loupeRang - 1);
    if (evenement.key === "ArrowRight") montrerDansLoupe(loupeRang + 1);
  });

  /* Clic en dehors de l'image : on ferme. Le clic sur la barre du bas ou sur
     l'image elle-même ne doit rien déclencher. */
  loupe.addEventListener("click", (evenement) => {
    if (evenement.target === loupe) loupe.close();
  });
}


/* --------------------------------------------------------------------------
   La fiche d'une œuvre
   -------------------------------------------------------------------------- */

function creerSection(classes) {
  const section = document.createElement("div");
  section.className = classes;
  const bande = document.createElement("div");
  bande.className = "bande";
  section.append(bande);
  return { section, bande };
}

function construireCartelFiche(oeuvre) {
  const cartel = document.createElement("dl");
  cartel.className = "fiche__cartel mono";

  const ajouter = (terme, valeur) => {
    if (!valeur) return;
    const ligne = document.createElement("div");
    ligne.className = "fiche__champ";
    const intitule = document.createElement("dt");
    intitule.textContent = terme;
    const contenu = document.createElement("dd");
    contenu.textContent = valeur;
    ligne.append(intitule, contenu);
    cartel.append(ligne);
  };

  ajouter("Année", oeuvre.annee ? String(oeuvre.annee) : "");
  ajouter("Discipline", libelleDiscipline(oeuvre.discipline));
  ajouter("Matériaux", oeuvre.materiaux);
  ajouter("Dimensions", oeuvre.dimensions);
  ajouter("Lieu", oeuvre.lieu);
  ajouter("Statut", oeuvre.statut);

  return cartel;
}

function construireVisuelsFiche(oeuvre) {
  const galerie = document.createElement("div");
  galerie.className = "fiche__visuels";

  const images = oeuvre.images ?? [];

  if (images.length === 0) {
    const attente = document.createElement("span");
    attente.className = "cartel__attente mono";
    attente.textContent = "Visuel à venir";
    galerie.append(attente);
    return galerie;
  }

  images.forEach((image, rang) => {
    /* Un <button> et non un <div> cliquable : la vue agrandie est une
       action, elle doit être atteignable au clavier et annoncée comme
       telle. */
    const declencheur = document.createElement("button");
    declencheur.type = "button";
    declencheur.className = rang === 0 ? "fiche__visuel" : "fiche__visuel fiche__visuel--secondaire";
    declencheur.addEventListener("click", () => ouvrirLoupe(images, rang));

    const vignette = document.createElement("img");
    if (image.largeur) vignette.width = image.largeur;
    if (image.hauteur) vignette.height = image.hauteur;
    vignette.alt = image.alt ?? "";
    vignette.decoding = "async";
    vignette.loading = rang === 0 ? "eager" : "lazy";
    if (rang === 0) vignette.setAttribute("fetchpriority", "high");
    vignette.src = DOSSIER_IMAGES + image.fichier;

    declencheur.append(vignette);
    galerie.append(declencheur);
  });

  return galerie;
}

function construireNavigationFiche(oeuvre, oeuvres) {
  /* On circule à l'intérieur d'une discipline, dans l'ordre de
     oeuvres.json — le même que celui de la grille. */
  const voisines = oeuvres.filter((autre) => autre.discipline === oeuvre.discipline);
  const rang = voisines.indexOf(oeuvre);

  const navigation = document.createElement("nav");
  navigation.className = "fiche__navigation mono mono--etiquette";
  navigation.setAttribute("aria-label", `Autres œuvres en ${libelleDiscipline(oeuvre.discipline).toLowerCase()}`);

  const ajouter = (voisine, intitule, modificateur) => {
    if (!voisine) return;
    const lien = document.createElement("a");
    lien.className = `fiche__lien ${modificateur}`;
    lien.href = `oeuvre.html?id=${encodeURIComponent(voisine.id)}`;
    lien.textContent = `${intitule} · ${voisine.titre}`;
    navigation.append(lien);
  };

  ajouter(voisines[rang - 1], "Précédente", "fiche__lien--precedent");
  ajouter(voisines[rang + 1], "Suivante", "fiche__lien--suivant");

  return navigation.children.length ? navigation : null;
}

/* Données structurées VisualArtwork, exigées par le §8. Injectées en
   JavaScript faute d'étape de build : Google exécute le script, mais les
   robots qui ne le font pas ne les verront pas. C'est la même limite que
   pour l'Open Graph de cette page, et elle a été acceptée à l'étape 0. */
function injecterDonneesStructurees(oeuvre) {
  const donnees = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: oeuvre.titre,
    creator: { "@type": "Person", name: "Laurent Brizzi" },
  };

  if (oeuvre.annee) donnees.dateCreated = String(oeuvre.annee);
  if (oeuvre.materiaux) donnees.artMedium = oeuvre.materiaux;
  if (oeuvre.discipline) donnees.artform = libelleDiscipline(oeuvre.discipline);
  if (oeuvre.dimensions) donnees.size = oeuvre.dimensions;
  if (oeuvre.texte) donnees.description = oeuvre.texte;
  if (oeuvre.images?.length) {
    donnees.image = new URL(DOSSIER_IMAGES + oeuvre.images[0].fichier, window.location.href).href;
  }

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(donnees, null, 2);
  document.head.append(script);
}

function construireFiche(oeuvre, oeuvres) {
  const fragment = document.createDocumentFragment();

  /* 1. Le retour, le titre, le cartel. Le titre passe en Display ici : sur
        la fiche, il devient le titre de la page (§6). */
  const entete = creerSection("section section--serree");

  const retour = document.createElement("p");
  retour.className = "fiche__retour mono mono--etiquette";
  const lienRetour = document.createElement("a");
  lienRetour.href = `oeuvres.html?discipline=${encodeURIComponent(oeuvre.discipline)}`;
  lienRetour.textContent = `Toutes les œuvres · ${libelleDiscipline(oeuvre.discipline)}`;
  retour.append(lienRetour);

  const titre = document.createElement("h1");
  titre.className = "fiche__titre";
  titre.textContent = oeuvre.titre || "Titre à renseigner";

  entete.bande.append(retour, titre, construireCartelFiche(oeuvre));
  fragment.append(entete.section);

  /* 2. Les images, en pleine bande. */
  const visuels = creerSection("section section--serree");
  visuels.bande.append(construireVisuelsFiche(oeuvre));
  fragment.append(visuels.section);

  /* 3. Le texte, s'il existe. Deux phrases maximum (§5) — donc une colonne
        étroite, pas la largeur de la page. */
  if (oeuvre.texte) {
    const propos = creerSection("section section--serree");
    propos.bande.classList.add("bande--etroite");
    const texte = document.createElement("p");
    texte.className = "fiche__texte";
    texte.textContent = oeuvre.texte;
    propos.bande.append(texte);
    fragment.append(propos.section);
  }

  /* 4. Les voisines dans la discipline. */
  const navigation = construireNavigationFiche(oeuvre, oeuvres);
  if (navigation) {
    const pied = creerSection("section section--serree section--filet");
    pied.bande.append(navigation);
    fragment.append(pied.section);
  }

  zoneFiche.replaceChildren(fragment);

  /* Le titre de l'onglet et la description sont réécrits ici : ils servent
     aux favoris, à l'historique et aux moteurs qui exécutent le script. */
  document.title = `${oeuvre.titre} — Laurent Brizzi, artiste plasticien`;
  const description = document.querySelector('meta[name="description"]');
  if (description) {
    const details = [libelleDiscipline(oeuvre.discipline), oeuvre.annee, oeuvre.materiaux]
      .filter(Boolean)
      .join(", ");
    description.setAttribute("content", `${oeuvre.titre} — ${details}. Œuvre de Laurent Brizzi, artiste plasticien à Boulogne-sur-Mer.`);
  }

  injecterDonneesStructurees(oeuvre);
}


/* --------------------------------------------------------------------------
   Les filtres
   Ce sont de vrais liens : « ?discipline=bas-relief » se copie, se partage
   et se rouvre. Le clic est intercepté pour éviter un rechargement, mais
   l'URL reste juste dans tous les cas.
   -------------------------------------------------------------------------- */

function construireFiltres(oeuvres, disciplineActive, surChangement) {
  const presentes = new Set(oeuvres.map((oeuvre) => oeuvre.discipline));

  const liste = document.createElement("ul");
  liste.className = "filtres mono mono--etiquette";

  const ajouter = (slug, libelle) => {
    const element = document.createElement("li");
    const lien = document.createElement("a");

    lien.className = "filtres__lien";
    lien.href = slug ? `oeuvres.html?discipline=${slug}` : "oeuvres.html";
    lien.textContent = libelle;

    if ((slug ?? null) === disciplineActive) lien.setAttribute("aria-current", "true");

    lien.addEventListener("click", (evenement) => {
      evenement.preventDefault();
      surChangement(slug ?? null);
    });

    element.append(lien);
    liste.append(element);
  };

  ajouter(null, `Tout (${oeuvres.length})`);

  /* On parcourt DISCIPLINES et non les données : l'ordre des filtres est
     ainsi stable et décidé, il ne dépend pas de l'ordre de saisie. */
  for (const discipline of DISCIPLINES) {
    if (!presentes.has(discipline.slug)) continue;
    const nombre = oeuvres.filter((oeuvre) => oeuvre.discipline === discipline.slug).length;
    ajouter(discipline.slug, `${discipline.libelle} (${nombre})`);
  }

  zoneFiltres.replaceChildren(liste);
}


/* --------------------------------------------------------------------------
   Affichage
   -------------------------------------------------------------------------- */

function afficherOeuvres(oeuvres, discipline) {
  const retenues = discipline
    ? oeuvres.filter((oeuvre) => oeuvre.discipline === discipline)
    : oeuvres;

  if (retenues.length === 0) {
    afficherMessage(
      grille,
      "Aucune œuvre dans cette discipline pour le moment.",
      "Choisissez un autre filtre, ou revenez à l'ensemble des œuvres."
    );
    if (compteur) compteur.textContent = "Aucune œuvre affichée.";
    return;
  }

  const fragment = document.createDocumentFragment();

  retenues.forEach((oeuvre, rang) => {
    fragment.append(construireCartel(oeuvre, rang < VIGNETTES_PRIORITAIRES));
  });

  grille.replaceChildren(fragment);

  if (compteur) {
    const intitule = discipline ? ` en ${libelleDiscipline(discipline).toLowerCase()}` : "";
    compteur.textContent = retenues.length === 1
      ? `1 œuvre affichée${intitule}.`
      : `${retenues.length} œuvres affichées${intitule}.`;
  }

  /* Toutes les vignettes sont révélées, y compris celles du haut. On en
     exceptait les deux premières, pour ne pas retarder ce que le visiteur
     regarde déjà — mais la grille fait trois colonnes sur grand écran : la
     première rangée arrivait alors en deux temps, deux vignettes d'un bloc
     et la troisième en fondu. La cascade n'a de sens que si la rangée est
     traitée comme une rangée.

     VIGNETTES_PRIORITAIRES continue de décider du chargement des images,
     qui est une tout autre question : ces deux-là se chargent toujours
     immédiatement. */
  revelerAuScroll([...grille.children]);
}


/* --------------------------------------------------------------------------
   Démarrage
   -------------------------------------------------------------------------- */

async function demarrer() {
  /* Le même module sert trois pages : le portfolio complet, l'accueil où
     l'on ne montre qu'une sélection sans filtres, et la fiche d'une œuvre.
     C'est le balisage qui décide, par ses attributs data-. */
  if (!grille && !zoneUne && !zoneFiche) return;

  let oeuvres;

  try {
    oeuvres = await chargerJson(CHEMIN_DONNEES);
  } catch (erreur) {
    if (grille) afficherMessage(grille, "Les œuvres n'ont pas pu être chargées.", erreur.message);
    if (zoneUne) afficherMessage(zoneUne, "Les œuvres n'ont pas pu être chargées.", erreur.message);
    if (zoneFiche) afficherMessage(zoneFiche, "Cette œuvre n'a pas pu être chargée.", erreur.message);
    if (zoneFiltres) zoneFiltres.replaceChildren();
    return;
  }

  if (!Array.isArray(oeuvres) || oeuvres.length === 0) {
    if (grille) {
      afficherMessage(
        grille,
        "Aucune œuvre n'est encore enregistrée.",
        "Les œuvres s'ajoutent dans data/oeuvres.json."
      );
    }
    if (zoneUne) zoneUne.replaceChildren();
    return;
  }

  /* Fiche d'une œuvre : on cherche l'identifiant demandé dans l'URL. */
  if (zoneFiche) {
    const demande = lireParametre("id");
    const oeuvre = oeuvres.find((autre) => autre.id === demande);

    if (!oeuvre) {
      afficherMessage(
        zoneFiche,
        demande ? "Cette œuvre n'existe pas ou a été renommée." : "Aucune œuvre n'a été demandée.",
        "Revenez au portfolio pour la retrouver."
      );
      const retour = document.createElement("p");
      const lien = document.createElement("a");
      lien.href = "oeuvres.html";
      lien.textContent = "Voir toutes les œuvres";
      retour.append(lien);
      zoneFiche.querySelector(".message")?.after(retour);
      return;
    }

    construireFiche(oeuvre, oeuvres);
    return;
  }

  const selection = oeuvres.filter((oeuvre) => oeuvre.aLaUne);

  if (zoneUne) {
    /* La première œuvre marquée « à la une » ouvre la page. L'ordre dans
       oeuvres.json fait la mise en avant : rien à régler ailleurs. */
    const premiere = selection.find((oeuvre) => oeuvre.images?.length);
    if (premiere) construireUne(premiere);
    else zoneUne.replaceChildren();
  }

  if (!grille) return;

  /* Accueil : une sélection, pas de filtres, pas de compteur. */
  if (grille.hasAttribute("data-a-la-une")) {
    const reste = selection.filter((oeuvre) => oeuvre !== selection[0]);
    afficherOeuvres(reste.length ? reste : selection, null);
    return;
  }

  if (!zoneFiltres) return;

  /* Une discipline inconnue dans l'URL est ignorée plutôt que d'aboutir à
     une page vide inexplicable. */
  const demandee = lireParametre("discipline");
  const connue = DISCIPLINES.some((discipline) => discipline.slug === demandee);
  let active = connue ? demandee : null;

  if (demandee && !connue) ecrireParametre("discipline", null);

  const changer = (discipline) => {
    active = discipline;
    ecrireParametre("discipline", discipline);
    construireFiltres(oeuvres, active, changer);
    afficherOeuvres(oeuvres, active);
  };

  construireFiltres(oeuvres, active, changer);
  afficherOeuvres(oeuvres, active);
}

demarrer();
