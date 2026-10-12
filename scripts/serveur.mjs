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

serveur.listen(port, () => {
  console.log("Site servi depuis " + racine);
  console.log("→ http://localhost:" + port + "/temoin.html");
  console.log("Ctrl+C pour arrêter.");
});
