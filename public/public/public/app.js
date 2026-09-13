const API = ''; // same origin
const app = document.getElementById('app');

// ========== UTIL ==========
function loading(text = 'Memuat...') {
  app.innerHTML = `<div class="loader"><div class="spinner"></div>${text}</div>`;
}
function error(msg) {
  app.innerHTML = `<div class="loader">❌ ${msg}</div>`;
}

// ========== HOME ==========
async function goHome() {
  loading('Memuat beranda...');
  try {
    const [latest, popular] = await Promise.all([
      fetch(`${API}/api/manga?limit=12&order=latest`).then(r => r.json()),
      fetch(`${API}/api/manga?limit=12&order=popular`).then(r => r.json())
    ]);

    app.innerHTML = `
      <div class="container">
        <div class="section-title">🔥 Request Terbaru 2026 <span class="badge">HOT</span></div>
        <div class="carousel" id="carousel"></div>

        <div class="section-title">📅 Update Terbaru</div>
        <div class="grid" id="latest-grid"></div>

        <div class="section-title">⭐ Populer</div>
        <div class="grid" id="popular-grid"></div>
      </div>
    `;

    // Carousel dari populer
    document.getElementById('carousel').innerHTML = popular.results.slice(0, 10).map((m, i) => `
      <div class="req-card" onclick="loadDetail('${m.id}')">
        <img src="${m.cover}" alt="${m.title}">
        <span class="tg">${['HOT','NEW','2026','TRENDING'][i%4]}</span>
        <div class="ov">${m.title}</div>
      </div>
    `).join('');

    renderGrid('latest-grid', latest.results);
    renderGrid('popular-grid', popular.results);
  } catch (e) {
    error('Gagal memuat data: ' + e.message);
  }
}

function renderGrid(id, list) {
  const grid = document.getElementById(id);
  if (!list?.length) { grid.innerHTML = '<p style="color:#999">Tidak ada data</p>'; return; }
  grid.innerHTML = list.map(m => `
    <div class="card" onclick="loadDetail('${m.id}')">
      <img src="${m.cover || 'https://via.placeholder.com/300x400/222/666?text=No+Cover'}" loading="lazy" alt="${m.title}">
      <span class="type-badge">${m.type}</span>
      <div class="info">
        <div class="title">${m.title}</div>
        <div class="meta">
          <span>${m.year || '-'}</span>
          <span>${m.status || ''}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// ========== CATEGORY ==========
async function loadCategory(type) {
  loading(`Memuat ${type}...`);
  try {
    const { results } = await fetch(`${API}/api/manga?type=${type}&limit=40`).then(r => r.json());
    app.innerHTML = `
      <div class="container">
        <div class="section-title">📚 ${type.toUpperCase()}</div>
        <div class="grid" id="cat-grid"></div>
      </div>
    `;
    renderGrid('cat-grid', results);
  } catch (e) { error('Gagal: ' + e.message); }
}

// ========== SEARCH ==========
async function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  loading(`Mencari "${q}"...`);
  try {
    const { results } = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`).then(r => r.json());
    app.innerHTML = `
      <div class="container">
        <div class="section-title">🔍 Hasil: "${q}" (${results.length})</div>
        <div class="grid" id="search-grid"></div>
      </div>
    `;
    renderGrid('search-grid', results);
  } catch (e) { error('Search gagal: ' + e.message); }
}

// ========== DETAIL ==========
async function loadDetail(id) {
  loading('Memuat detail...');
  try {
    const [detail, chapters] = await Promise.all([
      fetch(`${API}/api/manga/${id}`).then(r => r.json()),
      fetch(`${API}/api/manga/${id}/chapters`).then(r => r.json())
    ]);

    app.innerHTML = `
      <div class="container">
        <div class="detail-header">
          <img src="${detail.cover}" alt="${detail.title}">
          <div class="detail-info">
            <h1>${detail.title}</h1>
            <p><strong>Status:</strong> ${detail.status} • <strong>Tahun:</strong> ${detail.year || '-'}</p>
            <div class="tags">${(detail.tags || []).slice(0, 8).map(t => `<span>${t}</span>`).join('')}</div>
            <p>${(detail.description || 'Tidak ada deskripsi.').slice(0, 400)}</p>
            <button class="btn" onclick="goHome()">🏠 Beranda</button>
          </div>
        </div>
        <div class="section-title">📖 Daftar Chapter (${chapters.chapters.length})</div>
        <div class="chapter-list" id="chapterList"></div>
      </div>
    `;

    const list = document.getElementById('chapterList');
    if (!chapters.chapters.length) {
      list.innerHTML = '<p style="color:#999">Belum ada chapter bahasa Inggris/Indonesia.</p>';
    } else {
      list.innerHTML = chapters.chapters.map(c => `
        <div class="chapter-item" onclick="readChapter('${c.id}', '${detail.title.replace(/'/g,'')}', ${c.chapter || 0})">
          Ch. ${c.chapter || '?'} ${c.title ? '- ' + c.title : ''} <span style="color:#999;font-size:11px">[${c.lang}]</span>
        </div>
      `).join('');
    }
  } catch (e) { error('Gagal: ' + e.message); }
}

// ========== READER (dengan iklan 20 detik) ==========
let pendingRead = null;

function readChapter(chapterId, title, chNum) {
  pendingRead = async () => {
    loading('Memuat halaman...');
    try {
      const { images } = await fetch(`${API}/api/chapter/${chapterId}`).then(r => r.json());

      // Simpan history
      await fetch(`${API}/api/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: chapterId, title, chapter: chNum, cover: '' })
      });

      app.innerHTML = `
        <div class="reader">
          <h2 style="color:#fff;text-align:center;margin-bottom:20px;">${title} — Chapter ${chNum}</h2>
          ${images.map(img => `<img src="${img}" loading="lazy" alt="page">`).join('')}
          <div class="reader-nav">
            <button onclick="goHome()">🏠 Home</button>
            <span style="color:#fff;font-size:13px;">${images.length} halaman</span>
          </div>
        </div>
      `;
      window.scrollTo(0, 0);
    } catch (e) { error('Gagal memuat chapter: ' + e.message); }
  };
  showAd();
}

function showAd() {
  const overlay = document.getElementById('adOverlay');
  const timer = document.getElementById('adTimer');
  const skip = document.getElementById('adSkip');
  overlay.classList.add('active');
  let count = 20;
  timer.textContent = count;
  skip.disabled = true;
  skip.textContent = `Tunggu ${count}s...`;

  const int = setInterval(() => {
    count--;
    timer.textContent = count;
    skip.textContent = `Tunggu ${count}s...`;
    if (count <= 0) {
      clearInterval(int);
      skip.disabled = false;
      skip.textContent = '✅ Lanjut Baca';
      skip.onclick = () => {
        overlay.classList.remove('active');
        if (pendingRead) { pendingRead(); pendingRead = null; }
      };
    }
  }, 1000);
}

// ========== HISTORY ==========
async function showHistory() {
  loading('Memuat riwayat...');
  try {
    const list = await fetch(`${API}/api/history`).then(r => r.json());
    if (!list.length) {
      app.innerHTML = `<div class="container"><div class="section-title">🕒 Riwayat</div>
        <p style="color:#999;padding:40px;text-align:center;">Belum ada riwayat baca.</p></div>`;
      return;
    }
    app.innerHTML = `
      <div class="container">
        <div class="section-title">🕒 Riwayat Baca (${list.length})</div>
        <button class="btn" onclick="clearHistory()">🗑 Hapus Semua</button>
        <div class="history-list" style="margin-top:20px;">
          ${list.map(h => `
            <div class="hist-item" onclick="readChapter('${h.id}', '${h.title.replace(/'/g,'')}', ${h.chapter})">
              <div style="width:55px;height:75px;background:#333;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px;">📖</div>
              <div>
                <div class="h-t">${h.title}</div>
                <div class="h-c">Chapter ${h.chapter}</div>
                <div class="h-ti">🕒 ${new Date(h.readAt).toLocaleString('id-ID')}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (e) { error('Gagal: ' + e.message); }
}

async function clearHistory() {
  if (!confirm('Hapus semua riwayat?')) return;
  await fetch(`${API}/api/history`, { method: 'DELETE' });
  showHistory();
}

// ========== INIT ==========
goHome();
