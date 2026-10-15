/* ==========================================================================
   serveur.mjs — petit serveur de développement, sans aucune dépendance.

   Le §4 du CLAUDE.md prévoyait « python3 -m http.server ». Python n'est pas
   installé sur la machine de Laurent (seul le raccourci Microsoft Store
   répond), alors que Node l'est. Ce fichier remplace la commande, avec les
   mêmes effets et zéro paquet à installer.

   Un serveur est nécessaire pour deux raisons :
     - les fetch() de fichiers JSON échouent en file://
     - les navigateurs refusent de charger une @font-face en file://,
       donc la typographie ne s'affiche pas correctement sans serveur.

   Lancement :   node scripts/serveur.mjs
   Puis ouvrir : http://localhost:8000/temoin.html
   Arrêt :       Ctrl+C

   Port différent : node scripts/serveur.mjs 3000
   ========================================================================== */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.argv[2]) || 8000;

const typesMime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

/* Empêche qu'une URL du type ../../ ne remonte hors du dossier du site. */
const cheminDemande = (url) => {
  const relatif = decodeURIComponent(url.split("?")[0]);
  const cible = normalize(join(racine, relatif === "/" ? "index.html" : relatif));
  return cible.startsWith(racine) ? cible : null;
};

const serveur = createServer(async (requete, reponse) => {
  const cible = cheminDemande(requete.url);

  if (!cible) {
    reponse.writeHead(403, { "Content-Type": typesMime[".txt"] });
    reponse.end("Accès refusé.");
    return;
  }

  try {
    const contenu = await readFile(cible);
    reponse.writeHead(200, {
      "Content-Type": typesMime[extname(cible)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    reponse.end(contenu);
  } catch {
    /* Un 404 est signalé dans la console : c'est souvent une image ou un
       JSON dont le chemin a été mal saisi. */
    console.warn("404  " + requete.url);
    reponse.writeHead(404, { "Content-Type": typesMime[".txt"] });
    reponse.end("Fichier introuvable : " + requete.url);
  }
});

/* Ouvre le navigateur sur le site une fois le serveur prêt. Activé par
   l'option --ouvrir, que le raccourci « Ouvrir le site » passe. On ne le
   fait pas par défaut : les contrôles automatisés lancent ce serveur eux
   aussi, et n'ont aucune raison de faire surgir une fenêtre. */
const ouvrirNavigateur = (adresse) => {
  const commandes = {
    win32: ["cmd", ["/c", "start", "", adresse]],
    darwin: ["open", [adresse]],
  };
  const [commande, args] = commandes[process.platform] ?? ["xdg-open", [adresse]];

  try {
    spawn(commande, args, { detached: true, stdio: "ignore" }).unref();
  } catch {
    /* Pas grave : l'adresse est affichée juste au-dessus, elle se recopie. */
  }
};

/* Le cas le plus fréquent : le site tourne déjà, dans une autre fenêtre
   restée ouverte. Sans ce garde-fou, Node crache une pile d'appels de
   quinze lignes — illisible, et alarmante pour qui n'est pas développeur.
   On le dit en français, on ouvre le navigateur, et on s'arrête. */
serveur.on("error", (erreur) => {
  if (erreur.code !== "EADDRINUSE") throw erreur;

  const adresse = "http://localhost:" + port + "/";
  console.log("Le site tourne déjà sur " + adresse);
  console.log("(une autre fenêtre est sans doute restée ouverte)");
  if (process.argv.includes("--ouvrir")) ouvrirNavigateur(adresse);
  process.exit(0);
});

serveur.listen(port, () => {
  const adresse = "http://localhost:" + port + "/";
  console.log("Site servi depuis " + racine);
  console.log("→ " + adresse);
  console.log("Ctrl+C pour arrêter.");
  if (process.argv.includes("--ouvrir")) ouvrirNavigateur(adresse);
});
