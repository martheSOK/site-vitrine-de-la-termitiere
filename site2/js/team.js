document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('team-grid');
  if (!grid || typeof SECTORS === 'undefined') return;
  SECTOR_ORDER.forEach(id => {
    const s = SECTORS[id];
    const logo = s.logo ? `<img src="${s.logo}" alt="Logo ${s.name}">` : `<span class="letter-badge">${s.letter}</span>`;
    const card = document.createElement('div');
    card.className = 'team-member-card';
    card.style.setProperty('--accent', s.color);
    card.innerHTML = `
      <div class="team-member-avatar">${logo}</div>
      <h4>Responsable ${s.name}</h4>
      <p>Nom et présentation à venir</p>`;
    grid.appendChild(card);
  });
});
