// =========================================================
// LA TERMITIÈRE — Offres d'emploi & de stage
// Pour publier une offre, dupliquez un objet ci-dessous dans le tableau OFFRES.
// Pour la retirer une fois pourvue, supprimez simplement son objet.
// "sector" doit correspondre à une clé de SECTORS (js/sector-data.js) : sport, briqueterie,
// garderie, agro, batiment, logistique. Laissez "sector: null" si l'offre concerne le siège
// ou plusieurs secteurs. "type" : "CDI", "CDD", "Stage", ou "Bénévolat".
// =========================================================

const OFFRES = [
  // Exemple (à copier/adapter, puis à sortir de ce commentaire) :
  // {
  //   title: "Coach sportif",
  //   type: "CDI",
  //   sector: "sport",
  //   location: "Agoè-Daliko, Lomé",
  //   description: "Encadrement des séances individuelles et collectives, suivi des adhérents.",
  // },
];

if (typeof module !== "undefined") {
  module.exports = { OFFRES };
}
