/* ==========================================================================
   boutique.js — les pièces éditées.

   Pas de panier, pas de moteur e-commerce (§10). Chaque pièce porte un lien
   de paiement Stripe, et c'est tout. Le paiement se passe chez Stripe : le
   site ne voit jamais un numéro de carte.

   Tant qu'une pièce n'a pas de prix ET de lien de paiement, elle s'affiche
   sans bouton d'achat, avec un renvoi vers le contact. C'est un état
   légitime — une édition en préparation — et non une panne.
   ========================================================================== */

import { chargerJson, afficherMessage, revelerAuScroll } from "./utils.js";

const CHEMIN_DONNEES = "data/boutique.json";
const DOSSIER_IMAGES = "assets/img/";

const liste = document.querySelector("[data-boutique]");


/* --------------------------------------------------------------------------
   Le prix
   Jamais en dur dans le HTML (§10). Formaté par le navigateur, qui connaît
   les conventions françaises : espace insécable avant le symbole.
   -------------------------------------------------------------------------- */

function formaterPrix(montant, devise) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: devise || "EUR",
    maximumFractionDigits: montant % 1 === 0 ? 0 : 2,
  }).format(montant);
}


/* ATTENTION, différence avec oeuvres.json : ici, TOUTES les images ont un
   alt rédigé. La règle du §5 qui laisse l'alt vide sur la deuxième image ne
   vaut que pour le portfolio, où cette image est le détail affiché au survol
   d'une vignette — elle montre la même chose que la première, déjà décrite,
   et reste masquée aux lecteurs d'écran. Dans la boutique, les vues
   secondaires sont visibles en même temps que la principale : ce sont des
   images de contenu, et un alt vide les rendrait invisibles à qui ne voit
   pas la page. */

function construireVisuels(produit) {
  const galerie = document.createElement("div");
  galerie.className = "produit__visuels";

  const images = produit.images ?? [];

  if (images.length === 0) {
    const attente = document.createElement("span");
    attente.className = "cartel__attente mono";
    attente.textContent = "Visuel à venir";
    galerie.append(attente);
    return galerie;
  }

  images.forEach((image, rang) => {
    const vignette = document.createElement("img");
    vignette.className = rang === 0 ? "produit__image" : "produit__image produit__image--secondaire";
    if (image.largeur) vignette.width = image.largeur;
    if (image.hauteur) vignette.height = image.hauteur;
    vignette.alt = image.alt ?? "";
    vignette.decoding = "async";
    vignette.loading = rang === 0 ? "eager" : "lazy";
    vignette.src = DOSSIER_IMAGES + image.fichier;
    galerie.append(vignette);
  });

  return galerie;
}


/* --------------------------------------------------------------------------
   Les séries de pièces uniques
   Les veilleuses vitrail ne sont pas sept exemplaires d'un même objet :
   ce sont sept objets différents vendus sous un même intitulé. Une fiche
   porte donc les informations communes — technique, dimensions, prix,
   délai — et une grille en dessous donne le choix, pièce par pièce.

   Chaque pièce a son propre lien de paiement. C'est la conséquence directe
   de l'unicité : avec un seul lien pour sept objets, deux acheteurs peuvent
   payer le même le même jour, et il faut en rembourser un.

   Une pièce vendue reste affichée, marquée « Vendue ». On ne la retire pas :
   la série garde son sens une fois épuisée, et l'acheteur voit que les
   pièces partent.
   -------------------------------------------------------------------------- */

const estUneSerie = (produit) =>
  Array.isArray(produit.variantes) && produit.variantes.length > 0;


/* --------------------------------------------------------------------------
   Les stocks

   Deux mécanismes, et il ne faut pas les confondre.

   UNE SÉRIE se compte toute seule : le nombre de pièces encore libres est
   celui des variantes non vendues. Rien à tenir à jour, donc rien qui
   puisse mentir — c'est la seule façon fiable d'afficher un nombre sur un
   site sans serveur.

   UNE PIÈCE FABRIQUÉE À LA COMMANDE n'a pas de stock au sens habituel :
   elle a un délai. Le champ `stock` ne compte donc que les exemplaires
   DÉJÀ FINIS, prêts à partir le jour même. À zéro, la vente continue :
   la fiche bascule sur le délai de fabrication. Un compteur ne doit jamais
   empêcher d'acheter une pièce que Laurent sait faire.

   Ce nombre-là, personne ne le met à jour à sa place. Stripe ne le sait
   pas, le site ne le sait pas. S'il vend une pièce au château-musée et
   oublie de décrémenter, le site annonce une pièce qui n'existe plus.
   D'où la règle : `null` quand on ne suit pas, et on préfère `null` à un
   chiffre approximatif. Le vrai garde-fou contre la survente est du côté
   de Stripe, qui sait limiter le nombre de paiements d'un lien.
   -------------------------------------------------------------------------- */

const piecesRestantes = (produit) =>
  produit.variantes.filter((variante) => !variante.vendue).length;

/* Le stock n'est suivi que si c'est un nombre. Absent, null, ou écrit par
   mégarde en toutes lettres : on considère qu'il n'y a pas de suivi, et on
   n'affiche rien plutôt que « NaN pièces prêtes ». */
const suitLeStock = (produit) => Number.isInteger(produit.stock) && produit.stock >= 0;


/* --------------------------------------------------------------------------
   La pause

   Pour une résidence, des vacances, une imprimante en panne. Le champ
   `pause` porte une date au format AAAA-MM-JJ — le seul qui ne soit pas
   ambigu, et le seul que la page sache relire.

   Elle se lève toute seule le jour dit : Laurent la pose avant de partir
   et n'a rien à faire au retour. C'est le but, et c'est ce qui la rend
   utilisable par quelqu'un qui ne touchera pas au fichier pendant un mois.

   Si la date est illisible, la pause reste active et le texte est affiché
   tel quel. Le mauvais réflexe serait de l'ignorer : entre vendre ce qu'on
   ne peut pas livrer et suspendre un jour de trop, le choix est vite fait.
   -------------------------------------------------------------------------- */

function pauseEnCours(produit) {
  const brut = typeof produit.pause === "string" ? produit.pause.trim() : "";
  if (!brut) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(brut)) return { texte: brut, date: null };

  /* Sans l'heure, un navigateur lit « 2027-03-15 » en temps universel et
     peut lever la pause la veille au soir pour qui vit à l'est. */
  const jour = new Date(`${brut}T00:00:00`);
  if (Number.isNaN(jour.getTime())) return { texte: brut, date: null };

  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  if (jour <= aujourdhui) return null;

  return {
    texte: new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(jour),
    date: jour,
  };
}


function construireVariante(produit, variante) {
  const bloc = document.createElement("li");
  bloc.className = "variante";

  const total = produit.edition?.total ?? produit.variantes.length;

  /* La photo est le seul moyen de choisir entre des pièces uniques. Tant
     qu'elle manque, on montre un emplacement plutôt que rien : le visiteur
     voit la série entière, et laquelle n'est pas encore photographiée. */
  if (variante.image?.fichier) {
    const image = document.createElement("img");
    image.className = "variante__image";
    if (variante.image.largeur) image.width = variante.image.largeur;
    if (variante.image.hauteur) image.height = variante.image.hauteur;
    image.alt = variante.image.alt ?? "";
    image.decoding = "async";
    image.loading = "lazy";
    image.src = DOSSIER_IMAGES + variante.image.fichier;
    bloc.append(image);
  } else {
    const attente = document.createElement("div");
    attente.className = "variante__attente mono";
    attente.textContent = "Photo à venir";
    bloc.append(attente);
  }

  const numero = document.createElement("p");
  numero.className = "variante__numero mono";
  numero.textContent = `N° ${variante.numero} sur ${total}`;
  bloc.append(numero);

  const etat = document.createElement("p");
  etat.className = "variante__etat mono";

  if (variante.vendue) {
    etat.classList.add("variante__etat--vendue");
    etat.textContent = "Vendue";
  } else if (produit.prix != null && variante.lienStripe) {
    const bouton = document.createElement("a");
    bouton.className = "bouton";
    bouton.href = variante.lienStripe;
    bouton.rel = "noopener";
    bouton.textContent = "Choisir";
    /* Sept boutons « Choisir » identiques dans une grille : sans ce
       complément, rien ne dit au lecteur d'écran lequel il active. */
    bouton.setAttribute("aria-label", `Choisir la veilleuse n° ${variante.numero} sur ${total}`);
    etat.append(bouton);
  } else {
    etat.textContent = "Disponible";
  }

  bloc.append(etat);
  return bloc;
}


function construireSerie(produit) {
  const bloc = document.createElement("div");
  bloc.className = "produit__serie";

  const intitule = document.createElement("h3");
  intitule.className = "mono mono--etiquette produit__serie-titre";
  intitule.textContent = "Choisir une pièce";
  bloc.append(intitule);

  const liste = document.createElement("ul");
  liste.className = "serie";

  for (const variante of produit.variantes) {
    liste.append(construireVariante(produit, variante));
  }

  bloc.append(liste);
  return bloc;
}


/* --------------------------------------------------------------------------
   Les mentions obligatoires
   Le §10 impose que chaque fiche affiche l'édition, ce qui est inclus, le
   délai de fabrication, les frais de port et les conditions de retour. Une
   ligne dont la valeur manque n'est pas affichée : mieux vaut une fiche
   courte qu'une fiche qui promet un délai vide.
   -------------------------------------------------------------------------- */

function construireMentions(produit) {
  const mentions = document.createElement("dl");
  mentions.className = "produit__mentions mono";

  const ajouter = (terme, valeur) => {
    if (!valeur) return;
    const ligne = document.createElement("div");
    ligne.className = "produit__mention";

    const intitule = document.createElement("dt");
    intitule.textContent = terme;

    const contenu = document.createElement("dd");
    contenu.textContent = valeur;

    ligne.append(intitule, contenu);
    mentions.append(ligne);
  };

  ajouter("Technique", produit.technique);
  ajouter("Dimensions", produit.dimensions);

  if (produit.edition?.numerotee) {
    /* « 7 exemplaires » conviendrait à sept copies du même objet. Une série
       de pièces uniques, c'est l'inverse : sept pièces différentes, qui se
       trouvent porter un numéro. La phrase doit le dire, sinon l'acheteur
       croit choisir entre des exemplaires interchangeables. */
    if (estUneSerie(produit)) {
      ajouter("Édition", `Série numérotée de ${produit.edition.total ?? produit.variantes.length}, pièces uniques`);
    } else {
      ajouter("Édition", produit.edition.total
        ? `Numérotée, ${produit.edition.total} exemplaires`
        : "Numérotée");
    }
  }

  if (produit.inclus?.length) ajouter("Inclus", produit.inclus.join(" · "));

  /* La disponibilité, dite en clair et avant le prix. Pour une série, elle
     est calculée ; pour une pièce d'atelier, elle vient du champ `stock`.
     Les deux phrases sont différentes parce que les deux réalités le
     sont : d'un côté des pièces uniques qui s'épuisent pour de bon, de
     l'autre un objet qu'on refait. */
  if (estUneSerie(produit)) {
    const libres = piecesRestantes(produit);
    const total = produit.edition?.total ?? produit.variantes.length;

    ajouter("Disponibilité", libres === 0
      ? "Série épuisée"
      : `${libres} pièce${libres > 1 ? "s" : ""} encore disponible${libres > 1 ? "s" : ""} sur ${total}`);

  } else if (suitLeStock(produit)) {
    ajouter("Disponibilité", produit.stock === 0
      ? "Fabriquée à la commande"
      : `${produit.stock} pièce${produit.stock > 1 ? "s" : ""} prête${produit.stock > 1 ? "s" : ""} à expédier`);
  }

  /* Deux réalités, un seul emplacement. Une pièce fabriquée à la commande
     annonce un délai de fabrication ; une pièce déjà faite — les séries
     uniques, terminées avant la mise en vente — annonce un délai
     d'expédition. Une fiche porte l'un ou l'autre, jamais les deux, et
     ajouter() saute la ligne dont la valeur manque.

     Ce n'est pas cosmétique : la vente à distance oblige à indiquer une
     date ou un délai de livraison avant le paiement. « Rien à fabriquer »
     ne dispense pas d'annoncer sous combien de temps le colis part. */
  /* Quand des pièces sont prêtes, le délai de fabrication ne concerne plus
     que celles d'après. L'écrire sans ce « Au-delà » ferait lire « 2 pièces
     prêtes » et « 5 jours » comme une contradiction. */
  const enReserve = !estUneSerie(produit) && suitLeStock(produit) && produit.stock > 0;

  ajouter("Fabrication", produit.delaiFabrication && enReserve
    ? `Au-delà, ${produit.delaiFabrication.charAt(0).toLowerCase()}${produit.delaiFabrication.slice(1)}`
    : produit.delaiFabrication);

  ajouter("Expédition", produit.delaiExpedition);
  ajouter("Livraison", produit.fraisPort);
  ajouter("Retour", produit.retour);

  return mentions;
}


function construireAchat(produit) {
  const zone = document.createElement("p");
  zone.className = "produit__achat";

  /* La pause passe avant tout le reste, prix compris. Laisser un bouton
     « Commander » sous une phrase qui annonce des commandes suspendues
     serait la pire des deux options : l'acheteur paie, et personne
     n'expédie. */
  const pause = pauseEnCours(produit);

  if (pause) {
    const mention = document.createElement("span");
    mention.className = "produit__prix produit__prix--pause mono";
    mention.textContent = pause.date
      ? `Commandes suspendues jusqu'au ${pause.texte}`
      : `Commandes suspendues — ${pause.texte}`;

    const contact = document.createElement("a");
    contact.href = "contact.html";
    contact.textContent = "Se renseigner";

    zone.append(mention, contact);
    return zone;
  }

  /* Une série se commande pièce par pièce : le bouton vit sur chaque
     vignette, jamais ici. Cette zone ne porte que le prix, et le renvoi au
     courriel tant qu'aucune pièce n'a son lien de paiement. */
  if (estUneSerie(produit)) {
    const epuisee = piecesRestantes(produit) === 0;

    const prix = document.createElement("span");
    prix.className = "produit__prix mono";

    /* Une série épuisée garde son prix affiché : il dit ce que valait la
       pièce, et la série 2 se vendra dans le même ordre de grandeur. Mais
       elle ne renvoie plus vers « Commander par courriel » — il n'y a plus
       rien à commander. */
    prix.textContent = produit.prix != null
      ? `${formaterPrix(produit.prix, produit.devise)} la pièce`
      : "Tarif à venir";
    zone.append(prix);

    if (epuisee) {
      const fin = document.createElement("span");
      fin.className = "produit__prix produit__prix--epuise mono";
      fin.textContent = "Série épuisée";
      zone.append(fin);
      return zone;
    }

    if (produit.variantes.every((variante) => !variante.lienStripe)) {
      const contact = document.createElement("a");
      contact.href = "contact.html";
      contact.textContent = produit.prix != null ? "Commander par courriel" : "Se renseigner";
      zone.append(contact);
    }

    return zone;
  }

  const achetable = produit.disponible && produit.prix != null && produit.lienStripe;

  if (achetable) {
    const prix = document.createElement("span");
    prix.className = "produit__prix mono";
    prix.textContent = formaterPrix(produit.prix, produit.devise);

    const bouton = document.createElement("a");
    bouton.className = "bouton";
    bouton.href = produit.lienStripe;
    bouton.rel = "noopener";
    bouton.textContent = "Commander";

    zone.append(prix, bouton);
    return zone;
  }

  /* Pas de bouton : soit la pièce est indisponible, soit il manque le prix,
     soit il manque le lien de paiement. Ces trois cas ne se disent pas de la
     même façon.

     Le troisième est le plus facile à mal écrire : une pièce dont le prix
     est fixé mais dont le lien Stripe n'est pas encore créé afficherait
     « Tarif à venir » alors que le tarif, lui, est connu. On montre donc le
     prix et on renvoie vers le courriel. L'acheteur sait ce que ça coûte et
     par où passer ; c'est la règle du §10 — pas de bouton sans lien réel —
     sans mentir sur le prix. */

  const prixConnu = produit.prix != null;

  const mention = document.createElement("span");
  mention.className = "produit__prix mono";

  if (!produit.disponible) {
    mention.textContent = "Indisponible";
  } else if (prixConnu) {
    mention.textContent = formaterPrix(produit.prix, produit.devise);
  } else {
    mention.textContent = "Tarif à venir";
  }

  const contact = document.createElement("a");
  contact.href = "contact.html";
  contact.textContent = produit.disponible && prixConnu
    ? "Commander par courriel"
    : "Se renseigner";

  zone.append(mention, contact);
  return zone;
}


function construireProduit(produit) {
  const article = document.createElement("article");
  article.className = "produit";

  article.append(construireVisuels(produit));

  const texte = document.createElement("div");
  texte.className = "produit__texte";

  const titre = document.createElement("h2");
  titre.className = "produit__titre";
  titre.textContent = produit.titre;
  texte.append(titre);

  if (produit.sousTitre) {
    const sous = document.createElement("p");
    sous.className = "produit__sous-titre mono";
    sous.textContent = produit.sousTitre;
    texte.append(sous);
  }

  texte.append(construireMentions(produit));
  texte.append(construireAchat(produit));

  article.append(texte);

  /* La grille des pièces est posée sous les deux colonnes, pas dans la
     colonne de texte : sept vignettes dans une colonne étroite seraient
     illisibles. */
  if (estUneSerie(produit)) article.append(construireSerie(produit));

  return article;
}


async function demarrer() {
  if (!liste) return;

  let produits;

  try {
    produits = await chargerJson(CHEMIN_DONNEES);
  } catch (erreur) {
    afficherMessage(liste, "La boutique n'a pas pu être chargée.", erreur.message);
    return;
  }

  if (!Array.isArray(produits) || produits.length === 0) {
    afficherMessage(
      liste,
      "Aucune pièce n'est proposée pour le moment.",
      "Les pièces s'ajoutent dans data/boutique.json."
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const produit of produits) fragment.append(construireProduit(produit));
  liste.replaceChildren(fragment);

  revelerAuScroll([...liste.children].slice(1));
}

demarrer();
