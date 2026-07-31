document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('offres-grid');
  const empty = document.getElementById('offres-empty');
  if (!grid || typeof OFFRES === 'undefined') return;

  if (!OFFRES.length) {
    empty.style.display = '';
    return;
  }

  grid.style.display = '';
  OFFRES.forEach(offre => {
    const sector = offre.sector && typeof SECTORS !== 'undefined' ? SECTORS[offre.sector] : null;
    const mailSubject = encodeURIComponent(`Candidature — ${offre.title}`);
    const mailBody = encodeURIComponent(`Bonjour,\n\nJe souhaite postuler à l'offre "${offre.title}".\n\nCordialement.`);
    const card = document.createElement('div');
    card.className = 'offre-card';
    if (sector) card.style.setProperty('--accent', sector.color);
    card.innerHTML = `
      <div class="offre-card-head">
        <span class="offre-card-type">${offre.type}</span>
        ${sector ? `<span class="offre-card-tag">${sector.name}</span>` : ''}
      </div>
      <h3>${offre.title}</h3>
      ${offre.location ? `<p class="offre-card-location">${offre.location}</p>` : ''}
      <p>${offre.description}</p>
      <a class="btn btn-primary" href="mailto:latermitiere2021@gmail.com?subject=${mailSubject}&body=${mailBody}">Postuler</a>`;
    grid.appendChild(card);
  });
});
