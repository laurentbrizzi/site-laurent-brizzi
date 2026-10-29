#!/usr/bin/env node
/* ==========================================================================
   dossier.mjs — fabriquer le dossier artistique en PDF, et refuser d'en
   livrer un mauvais.

   POURQUOI CE SCRIPT EXISTE

   Le 29 octobre 2026, le dossier est parti en ligne à 15 Mo au lieu de
   3,5. La page convertit ses images en JPEG avant l'impression — sans
   quoi le PDF réenregistre les WebP sans perte et chaque photo pèse trois
   mégaoctets (voir CLAUDE.md §12). Ce jour-là, Chrome a imprimé quand
   quinze images sur dix-huit étaient converties.

   LA CAUSE EXACTE N'EST PAS ÉTABLIE. Le premier soupçon — un
   `--virtual-time-budget` trop court — a été testé et démenti : même
   avec 400 ms, Chrome attend la fin du script et sort un PDF complet.
   C'est donc une course intermittente, qui dépend sans doute de la
   charge de la machine, et qu'on ne sait pas déclencher à volonté.

   D'où ce script. Puisqu'on ne sait pas empêcher la panne, on
   l'intercepte :

   - il fabrique dans un fichier temporaire, jamais directement sur le
     livrable — un mauvais PDF ne peut donc pas écraser un bon ;
   - il COMPTE les images converties et REFUSE le résultat s'il en manque
     une seule, ou si le poids dépasse le plafond ;
   - il recommence une fois avant d'abandonner.

   Ce qui avait manqué le 29 octobre, ce n'était pas un réglage : c'était
   le contrôle entre la fabrication et la publication.

   USAGE

     node scripts/dossier.mjs              fabrique et vérifie
     node scripts/dossier.mjs --publier    et envoie sur GitHub

   Le serveur local doit tourner (node scripts/serveur.mjs).
   ========================================================================== */

import { existsSync, readFileSync, renameSync, statSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const ADRESSE = "http://localhost:8000/dossier.html";

/* Le livrable porte le nom de Laurent, exprès : il atterrit dans le
   dossier de téléchargement d'un chargé de mission qui en reçoit trente
   (CLAUDE.md §12). Le fichier de travail, lui, porte un nom neutre — les
   outils en ligne de commande de l'assistant ne savent pas relire un
   fichier dont le nom contient « laurent-brizzi ». */
const LIVRABLE = join(RACINE, "docs", "dossier-laurent-brizzi.pdf");
const TEMPORAIRE = join(RACINE, "docs", "dossier-en-cours.pdf");

/* Plafond de poids. La plupart des portails de candidature refusent
   au-delà de dix mégaoctets ; on se garde une marge confortable. */
const POIDS_MAX = 6 * 1024 * 1024;

/* Deux tentatives. Le budget n'est pas la cause connue de l'incident,
   mais le laisser large ne coûte rien : Chrome rend la main dès que la
   page est prête. */
const BUDGETS = [90_000, 180_000];


/* --------------------------------------------------------------------------
   Trouver Chrome
   -------------------------------------------------------------------------- */

function sortir(message, code = 1) {
  console.error("\n  " + message + "\n");
  process.exit(code);
}

function chercherChrome() {
  const pistes = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  const trouve = pistes.find((p) => p && existsSync(p));
  if (trouve) return trouve;

  sortir(
    "Chrome est introuvable.\n" +
    "  Il ne sert qu'à imprimer la page en PDF ; ce n'est pas une\n" +
    "  dépendance du site. Installez-le, ou ouvrez vous-même la page\n" +
    "  avec « scripts/Ouvrir le dossier.bat » et imprimez à la main."
  );
}


/* --------------------------------------------------------------------------
   Mesurer ce qui est sorti

   On lit le PDF comme du texte latin-1 : les en-têtes d'objets y sont en
   clair, même quand les flux sont compressés. Suffisant pour compter, et
   cela n'ajoute aucune dépendance.
   -------------------------------------------------------------------------- */

function mesurer(chemin) {
  const brut = readFileSync(chemin, "latin1");
  return {
    octets: statSync(chemin).size,
    pages: (brut.match(/\/Type\s*\/Page[^s]/g) ?? []).length,
    images: (brut.match(/\/Subtype\s*\/Image/g) ?? []).length,
    jpeg: (brut.match(/\/DCTDecode/g) ?? []).length,
  };
}

const mo = (octets) => (octets / 1024 / 1024).toFixed(2) + " Mo";


/* --------------------------------------------------------------------------
   Fabrication
   -------------------------------------------------------------------------- */

const chrome = chercherChrome();
const publier = process.argv.includes("--publier");

/* Le serveur doit répondre : sans lui la page se charge sans ses fiches,
   et le PDF sortirait vide de tout contenu — un échec silencieux. */
try {
  const reponse = await fetch(ADRESSE, { method: "HEAD" });
  if (!reponse.ok) throw new Error(String(reponse.status));
} catch {
  sortir(
    "Le serveur local ne répond pas sur " + ADRESSE + "\n" +
    "  Lancez-le d'abord :  node scripts/serveur.mjs"
  );
}

let bilan = null;

for (const [rang, budget] of BUDGETS.entries()) {
  if (existsSync(TEMPORAIRE)) unlinkSync(TEMPORAIRE);

  console.log(`\n  Fabrication ${rang + 1}/${BUDGETS.length}…`);

  execFileSync(chrome, [
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    `--virtual-time-budget=${budget}`,
    `--print-to-pdf=${TEMPORAIRE}`,
    ADRESSE,
  ], { stdio: "ignore" });

  if (!existsSync(TEMPORAIRE)) {
    console.log("  Chrome n'a rien écrit. On recommence.");
    continue;
  }

  const essai = mesurer(TEMPORAIRE);
  console.log(
    `  ${essai.pages} pages · ${essai.jpeg}/${essai.images} images converties · ${mo(essai.octets)}`
  );

  const complet = essai.images > 0 && essai.jpeg === essai.images;

  if (complet && essai.octets <= POIDS_MAX && essai.pages > 0) {
    bilan = essai;
    break;
  }

  if (!complet) {
    console.log(
      `  Incomplet : ${essai.images - essai.jpeg} image(s) encore en WebP, ` +
      "ce qui alourdit le fichier."
    );
  } else if (essai.octets > POIDS_MAX) {
    console.log(`  Trop lourd : ${mo(essai.octets)} pour un plafond de ${mo(POIDS_MAX)}.`);
  }
}


/* --------------------------------------------------------------------------
   Verdict

   En cas d'échec on NE TOUCHE PAS au livrable. Garder un dossier un peu
   vieux vaut mieux qu'en publier un que personne ne pourra téléverser.
   -------------------------------------------------------------------------- */

if (!bilan) {
  const essai = existsSync(TEMPORAIRE) ? mesurer(TEMPORAIRE) : null;
  if (existsSync(TEMPORAIRE)) unlinkSync(TEMPORAIRE);
  sortir(
    "Le PDF obtenu n'est pas conforme" +
    (essai ? ` (${essai.jpeg}/${essai.images} images converties, ${mo(essai.octets)})` : "") +
    ".\n  Le dossier en ligne n'a PAS été remplacé : l'ancien, correct, reste en place.\n" +
    "  Fermez ce qui charge la machine et relancez, ou imprimez à la main\n" +
    "  depuis le navigateur avec « scripts/Ouvrir le dossier.bat »."
  );
}

renameSync(TEMPORAIRE, LIVRABLE);

console.log(
  `\n  Dossier à jour : ${bilan.pages} pages, ${mo(bilan.octets)}, ` +
  "toutes les images converties."
);

if (publier) {
  const git = (...a) => execFileSync("git", a, { cwd: RACINE, encoding: "utf8" });
  try {
    git("add", "docs/dossier-laurent-brizzi.pdf");
    git("commit", "-m", "Dossier artistique regenere");
    git("push", "origin", "main");
    console.log("  Publié sur GitHub.\n");
  } catch (erreur) {
    console.error(
      "\n  Le PDF est bon, mais la publication a échoué :\n  " +
      String(erreur.stderr || erreur.message).trim() +
      "\n  Rien n'est perdu, le fichier attend dans docs/.\n"
    );
    process.exit(1);
  }
} else {
  console.log("  Pour le mettre en ligne, ajoutez --publier\n");
}

/* Penser à corriger le poids et la date à côté des deux liens, dans
   a-propos.html et contact.html, quand l'un ou l'autre change. */
