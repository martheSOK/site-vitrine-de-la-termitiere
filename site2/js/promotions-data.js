// =========================================================
// LA TERMITIÈRE — Promotions en cours
// Pour ajouter une promotion, dupliquez un objet ci-dessous dans le tableau PROMOTIONS.
// Pour la retirer une fois terminée, supprimez simplement son objet.
// "sector" doit correspondre à une clé de SECTORS (js/sector-data.js) : sport, briqueterie,
// garderie, agro, batiment, logistique. Laissez "sector: null" si la promotion concerne
// tout le groupe.
// =========================================================

const PROMOTIONS = [
  // Exemple (à copier/adapter, puis à sortir de ce commentaire) :
  // {
  //   title: "−10% sur l'abonnement mensuel",
  //   sector: "sport",
  //   description: "Valable sur toute nouvelle inscription à l'abonnement mensuel avec ou sans machines.",
  //   validUntil: "31 août 2026",
  // },
];

if (typeof module !== "undefined") {
  module.exports = { PROMOTIONS };
}
