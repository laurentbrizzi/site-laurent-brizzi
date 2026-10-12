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
    ajouter("Édition", produit.edition.total
      ? `Numérotée, ${produit.edition.total} exemplaires`
      : "Numérotée");
  }

  if (produit.inclus?.length) ajouter("Inclus", produit.inclus.join(" · "));

  ajouter("Fabrication", produit.delaiFabrication);
  ajouter("Livraison", produit.fraisPort);
  ajouter("Retour", produit.retour);

  return mentions;
}


function construireAchat(produit) {
  const zone = document.createElement("p");
  zone.className = "produit__achat";

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
