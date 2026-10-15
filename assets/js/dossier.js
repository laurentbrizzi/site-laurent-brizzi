/* ==========================================================================
   dossier.js — fabrique le dossier artistique à partir du site lui-même.

   Principe, et c'est tout l'intérêt de la page : AUCUN texte n'est écrit
   ici. Les œuvres, le parcours, la presse et les ateliers viennent des
   mêmes fichiers JSON que le site ; la biographie et la démarche sont lues
   dans a-propos.html. Laurent corrige une donnée à un seul endroit, et le
   dossier suit à la prochaine impression.

   L'alternative — recopier les textes dans ce fichier — aurait produit deux
   versions qui se contredisent au premier changement. C'est l'erreur
   classique du dossier PDF fabriqué une fois pour toutes.
   ========================================================================== */

import { chargerJson, libelleDiscipline, afficherMessage } from "./utils.js";

const DOSSIER_IMAGES = "assets/img/";

const document_ = document.getElementById("dossier");


/* --------------------------------------------------------------------------
   Petites fabriques
   -------------------------------------------------------------------------- */

function element(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined && texte !== null && texte !== "") noeud.textContent = texte;
  return noeud;
}

/* Une donnée absente. Visible à l'écran pour que Laurent voie ses trous
   d'un coup d'œil, invisible à l'impression — un dossier ne montre pas ses
   lacunes au lecteur, il les tait. La règle d'impression est dans
   dossier.css ; ne pas la retirer en croyant bien faire. */
function manque(quoi) {
  const marque = element("span", "manque", quoi);
  marque.setAttribute("aria-hidden", "true");
  return marque;
}

/* Assemble les morceaux non vides d'une ligne de cartel, séparés par un
   point médian. Écrit ainsi plutôt qu'en concaténant des chaînes : un champ
   vide ne doit pas laisser derrière lui un séparateur orphelin, et c'est la
   faute qu'on finit toujours par commettre à la main. */
function ligneDeDonnees(morceaux, classe = "cartel__ligne mono") {
  const presents = morceaux.filter(Boolean);
  if (presents.length === 0) return null;
  return element("p", classe, presents.join(" · "));
}

/* Chaque feuille est une page claire posée sur l'encre. data-fond="clair"
   rebascule les rôles de couleur et repeint le fond : c'est le mécanisme
   du site (§6), on ne redéfinit rien à la main ici. */
function feuille(modificateur) {
  const section = element("section", "feuille");
  section.setAttribute("data-fond", "clair");
  if (modificateur) section.classList.add(`feuille--${modificateur}`);
  return section;
}

function titreDeSection(texte) {
  const bloc = element("div", "feuille__entete");
  bloc.append(element("h2", "feuille__titre", texte));
  return bloc;
}

function imageDe(image, classe) {
  const img = element("img", classe);
  img.src = DOSSIER_IMAGES + image.fichier;
  img.alt = image.alt || "";
  img.width = image.largeur;
  img.height = image.hauteur;
  /* Pas de loading="lazy" ici, contrairement au reste du site : une image
     non chargée ne s'imprime pas. Le navigateur doit toutes les avoir en
     main au moment où Laurent lance l'impression. */
  return img;
}


/* --------------------------------------------------------------------------
   Les textes, lus dans a-propos.html

   On télécharge la page et on y prélève les deux blocs repérés par
   data-bloc. Si quelqu'un retire ces attributs un jour, on ne fabrique pas
   un dossier amputé en silence : on le dit à l'écran.
   -------------------------------------------------------------------------- */

async function lireLesTextes() {
  const reponse = await fetch("a-propos.html", { cache: "no-cache" });

  if (!reponse.ok) {
    throw new Error(
      "La page a-propos.html n'a pas pu être lue : c'est elle qui porte la " +
      "biographie et la démarche."
    );
  }

  const page = new DOMParser().parseFromString(await reponse.text(), "text/html");

  const bloc = (nom) => page.querySelector(`[data-bloc="${nom}"]`);

  const prose = (racine) =>
    racine ? [...racine.querySelectorAll("p:not(.mono)")].map((p) => p.innerHTML) : [];

  const biographie = bloc("biographie");

  return {
    biographie: prose(biographie),
    disciplines: biographie?.querySelector(".hors-mesure")?.innerHTML ?? "",
    demarche: prose(bloc("demarche")),
  };
}

/* innerHTML et non textContent : les textes contiennent des espaces
   insécables et des <br>, qui sont de la typographie, pas du balisage
   décoratif. Le contenu vient d'un fichier du dépôt, écrit par Laurent et
   par moi — ce n'est pas une source extérieure. */
function paragraphesHtml(listeHtml, classe) {
  return listeHtml.map((html) => {
    const p = element("p", classe);
    p.innerHTML = html;
    return p;
  });
}


/* --------------------------------------------------------------------------
   1. La couverture
   -------------------------------------------------------------------------- */

function construireCouverture(oeuvres) {
  const page = feuille("couverture");

  const une = oeuvres.find((oeuvre) => oeuvre.aLaUne) ?? oeuvres[0];

  if (une?.images?.[0]) {
    const cadre = element("div", "couverture__image");
    cadre.append(imageDe(une.images[0], "couverture__visuel"));
    page.append(cadre);
  }

  const bas = element("div", "couverture__bas");

  bas.append(element("p", "couverture__sur-titre mono mono--etiquette", "Dossier artistique"));
  bas.append(element("h1", "couverture__nom", "Laurent Brizzi"));
  bas.append(element("p", "couverture__qualite", "Artiste plasticien — Boulogne-sur-Mer"));

  if (une) {
    const legende = ligneDeDonnees(
      [une.titre, une.annee, une.materiaux],
      "couverture__legende mono"
    );
    if (legende) bas.append(legende);
  }

  const contact = element("p", "couverture__contact mono");
  contact.append(document.createTextNode("atelierlaurentbrizzi@gmail.com"));
  contact.append(element("br"));
  contact.append(document.createTextNode("06 65 69 73 72"));
  contact.append(element("br"));
  contact.append(document.createTextNode("laurentbrizzi.fr"));
  bas.append(contact);

  /* La date se recalcule à chaque impression. Un dossier daté de l'an
     dernier se repère au premier coup d'œil et dessert son auteur. */
  const mois = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" })
    .format(new Date());
  bas.append(element("p", "couverture__date mono mono--etiquette", mois));

  page.append(bas);
  return page;
}


/* --------------------------------------------------------------------------
   2. Biographie, disciplines et démarche
   -------------------------------------------------------------------------- */

function construireTextes(textes) {
  const pages = [];

  const presentation = feuille("texte");
  presentation.append(titreDeSection("Laurent Brizzi"));

  const colonnes = element("div", "deux-colonnes");

  const gauche = element("div", "flux");
  gauche.append(...paragraphesHtml(textes.biographie));
  colonnes.append(gauche);

  if (textes.disciplines) {
    const droite = element("aside", "encadre");
    droite.append(element("p", "encadre__titre mono mono--etiquette", "Disciplines"));
    const liste = element("p", "encadre__corps mono");
    liste.innerHTML = textes.disciplines;
    droite.append(liste);
    colonnes.append(droite);
  }

  presentation.append(colonnes);
  pages.push(presentation);

  const demarche = feuille("texte");
  demarche.append(titreDeSection("La démarche"));
  const corps = element("div", "flux prose");
  corps.append(...paragraphesHtml(textes.demarche));
  demarche.append(corps);
  pages.push(demarche);

  return pages;
}


/* --------------------------------------------------------------------------
   3. Les œuvres
   -------------------------------------------------------------------------- */

function construireOeuvre(oeuvre) {
  const bloc = element("figure", "piece");

  if (oeuvre.images?.[0]) {
    bloc.append(imageDe(oeuvre.images[0], "piece__image"));
  }

  const cartel = element("figcaption", "cartel");
  cartel.append(element("h3", "cartel__titre", oeuvre.titre));

  /* Première ligne : année, technique, dimensions. C'est ce que le lecteur
     cherche en premier, et l'absence d'année est la lacune la plus voyante
     d'un dossier — d'où la marque, à l'écran seulement. */
  const premiere = element("p", "cartel__ligne mono");

  if (oeuvre.annee) {
    premiere.append(document.createTextNode(String(oeuvre.annee)));
  } else {
    premiere.append(manque("année à compléter"));
  }

  for (const donnee of [oeuvre.materiaux, oeuvre.dimensions]) {
    if (!donnee) continue;
    premiere.append(document.createTextNode(" · " + donnee));
  }

  if (!oeuvre.dimensions) {
    premiere.append(document.createTextNode(" "));
    premiere.append(manque("dimensions à compléter"));
  }

  cartel.append(premiere);

  const seconde = ligneDeDonnees([
    oeuvre.lieu,
    oeuvre.statut,
    libelleDiscipline(oeuvre.discipline),
  ], "cartel__ligne cartel__ligne--secondaire mono");
  if (seconde) cartel.append(seconde);

  if (oeuvre.texte) {
    cartel.append(element("p", "cartel__texte", oeuvre.texte));
  }

  bloc.append(cartel);
  return bloc;
}

function construireOeuvres(oeuvres) {
  const page = feuille("oeuvres");
  page.append(titreDeSection("Œuvres"));

  const grille = element("div", "grille-pieces");
  for (const oeuvre of oeuvres) grille.append(construireOeuvre(oeuvre));
  page.append(grille);

  return page;
}


/* --------------------------------------------------------------------------
   4. Le parcours
   -------------------------------------------------------------------------- */

/* L'ordre compte : une structure qui lit un dossier cherche d'abord la
   résidence en cours et la commande publique. Les expositions viennent
   après — ce sont elles qui remplissent le plus de lignes et le moins de
   crédit. */
const RUBRIQUES = [
  { categorie: "residence",     titre: "Résidences" },
  { categorie: "commande",      titre: "Commandes publiques" },
  { categorie: "projet",        titre: "Projets et recherche" },
  { categorie: "exposition",    titre: "Expositions" },
  { categorie: "collaboration", titre: "Collaborations" },
  { categorie: "diffusion",     titre: "Diffusion" },
];

function construireEntree(entree) {
  const ligne = element("div", "entree");

  ligne.append(element("p", "entree__periode mono", entree.periode || ""));

  const droite = element("div", "entree__corps");
  droite.append(element("p", "entree__intitule", entree.intitule));

  const lieu = ligneDeDonnees(
    [entree.lieu, entree.partenaire],
    "entree__lieu mono"
  );
  if (lieu) droite.append(lieu);

  if (entree.description) {
    droite.append(element("p", "entree__description", entree.description));
  }

  ligne.append(droite);
  return ligne;
}

function construireParcours(parcours) {
  const page = feuille("parcours");
  page.append(titreDeSection("Parcours"));

  for (const rubrique of RUBRIQUES) {
    const entrees = parcours.filter((e) => e.categorie === rubrique.categorie);
    if (entrees.length === 0) continue;

    const bloc = element("div", "rubrique");
    bloc.append(element("h3", "rubrique__titre mono mono--etiquette", rubrique.titre));

    const liste = element("div", "rubrique__liste");
    for (const entree of entrees) liste.append(construireEntree(entree));
    bloc.append(liste);

    page.append(bloc);
  }

  return page;
}


/* --------------------------------------------------------------------------
   5. Les ateliers
   -------------------------------------------------------------------------- */

function construireAteliers(ateliers) {
  const page = feuille("ateliers");
  page.append(titreDeSection("Ateliers"));

  for (const atelier of ateliers) {
    const bloc = element("article", "atelier-fiche");

    const entete = element("div", "atelier-fiche__entete");
    entete.append(element("h3", "atelier-fiche__titre", atelier.titre));

    const donnees = ligneDeDonnees(
      [atelier.public, atelier.duree, atelier.effectif],
      "atelier-fiche__donnees mono"
    );
    if (donnees) entete.append(donnees);

    if (atelier.description) {
      entete.append(element("p", "atelier-fiche__texte", atelier.description));
    } else {
      const vide = element("p", "atelier-fiche__texte");
      vide.append(manque("description de l'atelier à écrire"));
      entete.append(vide);
    }

    bloc.append(entete);

    /* Deux photographies par atelier. Le dossier montre, il ne catalogue
       pas : au-delà, la section devient un album et noie le reste. */
    const photos = (atelier.images ?? []).filter((i) => i.fichier).slice(0, 2);

    if (photos.length > 0) {
      const bande = element("div", "atelier-fiche__images");
      for (const photo of photos) bande.append(imageDe(photo, "atelier-fiche__image"));
      bloc.append(bande);
    }

    page.append(bloc);
  }

  return page;
}


/* --------------------------------------------------------------------------
   6. La presse
   -------------------------------------------------------------------------- */

function construirePresse(presse) {
  const page = feuille("presse");
  page.append(titreDeSection("Dans la presse"));

  const liste = element("div", "rubrique__liste");

  for (const article of presse) {
    const bloc = element("div", "coupure-dossier");

    const source = ligneDeDonnees(
      [article.media, article.date],
      "coupure-dossier__source mono mono--etiquette"
    );
    if (source) bloc.append(source);

    if (article.titre) {
      bloc.append(element("p", "coupure-dossier__titre", article.titre));
    }

    if (article.citation) {
      /* Les guillemets sont posés ici et non dans le JSON : la citation y
         est stockée nue, pour pouvoir être reprise ailleurs sans les
         traîner. */
      bloc.append(element(
        "blockquote",
        "coupure-dossier__citation",
        `« ${article.citation} »`
      ));
    }

    const bas = ligneDeDonnees(
      [article.signature, article.lien],
      "coupure-dossier__bas mono"
    );
    /* L'adresse est écrite en toutes lettres, pas cachée derrière un lien :
       sur une feuille imprimée, un lien cliquable ne mène nulle part. */
    if (bas) bloc.append(bas);

    liste.append(bloc);
  }

  page.append(liste);
  return page;
}


/* --------------------------------------------------------------------------
   7. Contact
   -------------------------------------------------------------------------- */

function construireContact() {
  const page = feuille("contact");
  page.append(titreDeSection("Contact"));

  const bloc = element("div", "contact-dossier");

  const lignes = [
    ["Laurent Brizzi", "Artiste plasticien"],
    ["Atelier", "Saint-Martin-Boulogne (62)"],
    ["Courriel", "atelierlaurentbrizzi@gmail.com"],
    ["Téléphone", "06 65 69 73 72"],
    ["Site", "laurentbrizzi.fr"],
    ["ArtMajeur", "artmajeur.com/laurent-brizzi"],
    ["Statut", "Artiste-auteur · SIRET 433 596 517 00022"],
  ];

  for (const [intitule, valeur] of lignes) {
    const ligne = element("div", "contact-dossier__ligne");
    ligne.append(element("span", "contact-dossier__intitule mono mono--etiquette", intitule));
    ligne.append(element("span", "contact-dossier__valeur mono", valeur));
    bloc.append(ligne);
  }

  page.append(bloc);

  page.append(element(
    "p",
    "contact-dossier__mention",
    "Les visuels de ce dossier sont la propriété de Laurent Brizzi. " +
    "Toute reproduction demande son accord écrit."
  ));

  return page;
}


/* --------------------------------------------------------------------------
   Assemblage
   -------------------------------------------------------------------------- */

async function construireLeDossier() {
  const [textes, oeuvres, parcours, ateliers, presse] = await Promise.all([
    lireLesTextes(),
    chargerJson("data/oeuvres.json"),
    chargerJson("data/parcours.json"),
    chargerJson("data/ateliers.json"),
    chargerJson("data/presse.json"),
  ]);

  const pages = [
    construireCouverture(oeuvres),
    ...construireTextes(textes),
    construireOeuvres(oeuvres),
    construireParcours(parcours),
    construireAteliers(ateliers),
    construirePresse(presse),
    construireContact(),
  ];

  document_.replaceChildren(...pages);
}

try {
  await construireLeDossier();
} catch (erreur) {
  afficherMessage(
    document_,
    "Le dossier n'a pas pu être assemblé.",
    erreur.message
  );
}

document.getElementById("imprimer")?.addEventListener("click", () => window.print());
