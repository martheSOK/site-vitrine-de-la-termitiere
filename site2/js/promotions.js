document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('promotions-grid');
  const empty = document.getElementById('promotions-empty');
  if (!grid || typeof PROMOTIONS === 'undefined') return;

  if (!PROMOTIONS.length) {
    empty.style.display = '';
    return;
  }

  grid.style.display = '';
  PROMOTIONS.forEach(promo => {
    const sector = promo.sector && typeof SECTORS !== 'undefined' ? SECTORS[promo.sector] : null;
    const card = document.createElement('div');
    card.className = 'promo-card';
    if (sector) card.style.setProperty('--accent', sector.color);
    card.innerHTML = `
      ${sector ? `<span class="promo-card-tag">${sector.name}</span>` : ''}
      <h3>${promo.title}</h3>
      <p>${promo.description}</p>
      ${promo.validUntil ? `<p class="promo-card-valid">Valable jusqu'au ${promo.validUntil}</p>` : ''}
      <a href="index.html#contact" class="btn btn-primary">En profiter</a>`;
    grid.appendChild(card);
  });
});
