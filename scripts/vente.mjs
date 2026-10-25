#!/usr/bin/env node
/* ==========================================================================
   vente.mjs — enregistrer une vente et ajuster le stock de la boutique.

   POURQUOI UN SCRIPT PLUTÔT QU'UNE CONSIGNE

   Laurent tient sa comptabilité dans une autre discussion. Il voulait que
   déclarer une vente là-bas mette le site à jour ici. Rien ne relie deux
   conversations : aucune ne voit ce que l'autre raconte, et une consigne
   donnée dans l'une est oubliée dans l'autre.

   Ce qui se partage, en revanche, c'est le dépôt. Une commande qui vit
   ici est exécutable par n'importe qui — Laurent, une autre session, un
   raccourci — et elle fait toujours la même chose, dans le même ordre,
   sans rien oublier. C'est la seule forme d'automatisme qui tienne.

   USAGE

     node scripts/vente.mjs basilique-1-300
     node scripts/vente.mjs basilique-1-300 3
     node scripts/vente.mjs veilleuse-vitrail-serie-1 --numero 4
     node scripts/vente.mjs basilique-1-200 --annuler
     node scripts/vente.mjs                          (état des stocks)

   Ajouter --publier pour enregistrer et envoyer sur GitHub dans la foulée.

   CE QUE CE SCRIPT N'ÉCRIT PAS

   Ni montant, ni acheteur, ni date de vente. Le dépôt est PUBLIC : un
   carnet de ventes commité ici serait lisible par n'importe qui. La
   comptabilité reste dans le dossier où elle est, ce script ne touche
   qu'au nombre de pièces en stock.
   ========================================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const FICHIER = join(RACINE, "data", "boutique.json");

const lire = () => JSON.parse(readFileSync(FICHIER, "utf8"));
const ecrire = (b) => writeFileSync(FICHIER, JSON.stringify(b, null, 2) + "\n", "utf8");

const estUneSerie = (p) => Array.isArray(p.variantes) && p.variantes.length > 0;
const libres = (p) => p.variantes.filter((v) => !v.vendue).length;

function sortir(message, code = 1) {
  console.error("\n  " + message + "\n");
  process.exit(code);
}


/* --- État des stocks, quand on appelle le script sans rien ---------------- */

function afficherEtat(boutique) {
  console.log("\n  Stocks de la boutique\n");
  for (const p of boutique) {
    let etat;
    if (estUneSerie(p)) {
      const reste = libres(p);
      etat = reste === 0 ? "série épuisée" : `${reste} pièce(s) sur ${p.variantes.length}`;
    } else if (Number.isInteger(p.stock)) {
      etat = p.stock === 0 ? "aucune pièce prête (fabrication à la commande)" : `${p.stock} prête(s)`;
    } else {
      etat = "stock non suivi";
    }
    console.log(`    ${p.id.padEnd(28)} ${etat}`);
  }
  console.log("\n  Pour enregistrer une vente :");
  console.log("    node scripts/vente.mjs <identifiant> [quantité]");
  console.log("    node scripts/vente.mjs <identifiant d'une série> --numero <n>\n");
}


/* --- Lecture des arguments ------------------------------------------------ */

const args = process.argv.slice(2);
const boutique = lire();

if (args.length === 0) {
  afficherEtat(boutique);
  process.exit(0);
}

const annuler = args.includes("--annuler");
const publier = args.includes("--publier");

const posNumero = args.indexOf("--numero");
const numero = posNumero !== -1 ? Number(args[posNumero + 1]) : null;

const positionnels = args.filter((a, i) =>
  !a.startsWith("--") && !(posNumero !== -1 && i === posNumero + 1));

const identifiant = positionnels[0];
const quantite = positionnels[1] ? Number(positionnels[1]) : 1;

const produit = boutique.find((p) => p.id === identifiant);

if (!produit) {
  sortir(
    `Aucune pièce ne porte l'identifiant « ${identifiant} ».\n` +
    `  Les identifiants connus sont :\n    ` +
    boutique.map((p) => p.id).join("\n    ")
  );
}

if (!Number.isInteger(quantite) || quantite < 1) {
  sortir(`La quantité « ${positionnels[1]} » n'est pas un nombre entier positif.`);
}


/* --- Une série : on marque la pièce numérotée ----------------------------- */

if (estUneSerie(produit)) {
  if (!Number.isInteger(numero)) {
    sortir(
      `« ${produit.titre} » est une série de pièces uniques : il faut dire LAQUELLE.\n` +
      `  Exemple : node scripts/vente.mjs ${produit.id} --numero 3\n` +
      `  Pièces encore libres : ` +
      produit.variantes.filter((v) => !v.vendue).map((v) => v.numero).join(", ")
    );
  }

  const variante = produit.variantes.find((v) => v.numero === numero);
  if (!variante) sortir(`La série ne contient pas de pièce n° ${numero}.`);

  if (!annuler && variante.vendue) {
    sortir(`La pièce n° ${numero} est déjà marquée vendue. Rien n'a été changé.`);
  }
  if (annuler && !variante.vendue) {
    sortir(`La pièce n° ${numero} n'était pas vendue. Rien n'a été changé.`);
  }

  variante.vendue = !annuler;
  ecrire(boutique);

  const reste = libres(produit);
  console.log(
    `\n  Pièce n° ${numero} ${annuler ? "remise en vente" : "marquée vendue"}.` +
    `\n  Il reste ${reste} pièce(s) sur ${produit.variantes.length}.` +
    (reste === 0 ? "\n  La série est épuisée : la fiche l'affichera." : "")
  );

} else {

  /* --- Une pièce d'atelier : on décompte les exemplaires finis ------------ */

  if (!Number.isInteger(produit.stock)) {
    sortir(
      `Le stock de « ${produit.titre} » n'est pas suivi (il vaut null).\n` +
      `  Écrire d'abord un nombre dans data/boutique.json, ou demander à Claude.`
    );
  }

  const avant = produit.stock;

  if (annuler) {
    produit.stock = avant + quantite;
  } else if (avant === 0) {
    /* Vendre à zéro n'est pas une erreur : la pièce se fabrique à la
       commande. On ne descend pas sous zéro, et on le dit — sinon le
       prochain réapprovisionnement repartirait d'un nombre négatif. */
    console.log(
      `\n  Stock déjà à zéro : cette vente part en fabrication (5 jours).` +
      `\n  Le stock reste à 0, il n'y a rien à décompter.`
    );
    process.exit(0);
  } else if (quantite > avant) {
    sortir(
      `Vous déclarez ${quantite} vente(s) mais il n'y a que ${avant} pièce(s) prête(s).\n` +
      `  Rien n'a été changé. Si une partie part en fabrication, enregistrez\n` +
      `  d'abord les ${avant} pièce(s) en stock : node scripts/vente.mjs ${produit.id} ${avant}`
    );
  } else {
    produit.stock = avant - quantite;
  }

  ecrire(boutique);

  console.log(
    `\n  ${produit.titre}` +
    `\n  ${annuler ? "Annulation" : "Vente"} de ${quantite} pièce(s) : ${avant} → ${produit.stock}.` +
    (produit.stock === 0
      ? "\n  Plus aucune pièce prête : la fiche passera sur « Fabriquée à la commande »."
      : "")
  );
}


/* --- Publication ---------------------------------------------------------- */

if (publier) {
  const git = (...a) => execFileSync("git", a, { cwd: RACINE, encoding: "utf8" });
  try {
    git("add", "data/boutique.json");
    git("commit", "-m", `Stock: ${annuler ? "annulation" : "vente"} ${identifiant}`);
    git("push", "origin", "main");
    console.log("  Publié sur GitHub. Le site sera à jour dans une minute.\n");
  } catch (erreur) {
    console.error(
      "\n  Le fichier est bien modifié, mais la publication a échoué :\n  " +
      (erreur.stderr || erreur.message).trim() +
      "\n  Le changement n'est pas perdu : il attend dans le dossier.\n"
    );
    process.exit(1);
  }
} else {
  console.log("  Le site local est à jour. Pour le mettre en ligne, ajoutez --publier.\n");
}
