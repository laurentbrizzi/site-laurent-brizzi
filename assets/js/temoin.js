/* ==========================================================================
   temoin.js — FICHIER TEMPORAIRE
   Ne sert qu'à temoin.html. À supprimer avec elle et avec temoin.css avant
   la mise en ligne (§12 du CLAUDE.md).

   Deux écarts assumés aux conventions du §7, valables ICI et nulle part
   ailleurs :

   1. Script classique, pas un module ES. La page témoin s'ouvre par un
      double-clic depuis le disque (file://), or les navigateurs refusent
      les modules ES sur ce protocole. Les vrais scripts du site
      (portfolio.js, boutique.js, utils.js) seront bien des modules : ils
      tourneront sur un serveur.

   2. Le tout est enfermé dans un bloc, ce qui donne l'équivalent d'un
      module côté portée : aucune variable ne remonte au global.
   ========================================================================== */

{
  const bascule = document.querySelector("[data-bascule-fond]");

  /* Bascule le fond général de la page. Le site est en encre : l'état par
     défaut est donc l'absence d'attribut, et la bascule pose data-fond="clair"
     pour montrer à quoi ressemblerait la craie. Rien d'autre à faire — tous
     les composants lisent les rôles contextuels de tokens.css, que cet
     attribut redéfinit. */
  const appliquerFond = (clair) => {
    if (clair) {
      document.body.dataset.fond = "clair";
    } else {
      delete document.body.dataset.fond;
    }

    bascule.setAttribute("aria-pressed", String(clair));
    bascule.textContent = clair ? "Repasser en fond encre" : "Voir en fond craie";
  };

  if (bascule) {
    bascule.addEventListener("click", () => {
      appliquerFond(document.body.dataset.fond !== "clair");
    });
  }
}
