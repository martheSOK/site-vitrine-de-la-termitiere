document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('galerie-grid');
  const filtersWrap = document.getElementById('galerie-filters');
  if (!grid || !filtersWrap || typeof SECTORS === 'undefined') return;

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'gallery-filter active';
  allBtn.textContent = 'Tous';
  allBtn.dataset.filter = 'all';
  filtersWrap.appendChild(allBtn);

  SECTOR_ORDER.forEach(id => {
    const s = SECTORS[id];
    if (!s.photos || !s.photos.length) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gallery-filter';
    btn.textContent = s.name;
    btn.dataset.filter = id;
    filtersWrap.appendChild(btn);

    s.photos.forEach((p, i) => {
      const src = s.photosDir + p;
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'g-thumb gallery-item';
      thumb.dataset.sector = id;
      thumb.setAttribute('data-lightbox', 'img');
      thumb.setAttribute('data-src', src);
      thumb.innerHTML = `<img src="${src}" alt="${s.name} — photo ${i + 1}" loading="lazy">`;
      grid.appendChild(thumb);
    });
  });

  filtersWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.gallery-filter');
    if (!btn) return;
    filtersWrap.querySelectorAll('.gallery-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    grid.querySelectorAll('.gallery-item').forEach(item => {
      item.style.display = (filter === 'all' || item.dataset.sector === filter) ? '' : 'none';
    });
  });
});
