require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const MDX = 'https://api.mangadex.org';
const UPLOADS = 'https://uploads.mangadex.org';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== HISTORY FILE DB ==========
const HISTORY_FILE = path.join(__dirname, 'data', 'history.json');
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]');

function readHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE)); } catch { return []; }
}
function writeHistory(data) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
}

// ========== HELPER: GET COVER URL ==========
function getCoverUrl(manga) {
  const rel = manga.relationships?.find(r => r.type === 'cover_art');
  const file = rel?.attributes?.fileName;
  if (!file) return null;
  return `${UPLOADS}/covers/${manga.id}/${file}.512.jpg`;
}

// ========== ROUTES ==========

// 1. List manga populer / terbaru
app.get('/api/manga', async (req, res) => {
  try {
    const { type = '', limit = 24, offset = 0, order = 'latest' } = req.query;

    const params = {
      limit,
      offset,
      includes: ['cover_art'],
      contentRating: ['safe', 'suggestive'],
      order: order === 'popular' ? { followedCount: 'desc' } : { latestUploadedChapter: 'desc' }
    };

    // Filter tipe: manga, manhwa, manhua
    if (type === 'manhwa') params.originalLanguage = ['ko'];
    if (type === 'manhua') params.originalLanguage = ['zh'];
    if (type === 'manga') params.originalLanguage = ['ja'];

    const { data } = await axios.get(`${MDX}/manga`, { params });

    const results = data.data.map(m => ({
      id: m.id,
      title: m.attributes.title.en || Object.values(m.attributes.title)[0] || 'Untitled',
      description: m.attributes.description?.en || '',
      status: m.attributes.status,
      year: m.attributes.year,
      tags: m.attributes.tags.map(t => t.attributes.name.en),
      cover: getCoverUrl(m),
      type: m.attributes.originalLanguage === 'ko' ? 'Manhwa'
           : m.attributes.originalLanguage === 'zh' ? 'Manhua'
           : m.attributes.originalLanguage === 'ja' ? 'Manga' : 'Other'
    }));

    res.json({ total: data.total, results });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal ambil data manga' });
  }
});

// 2. Detail manga
app.get('/api/manga/:id', async (req, res) => {
  try {
    const { data } = await axios.get(`${MDX}/manga/${req.params.id}`, {
      params: { includes: ['cover_art', 'author', 'artist'] }
    });
    const m = data.data;
    res.json({
      id: m.id,
      title: m.attributes.title.en || Object.values(m.attributes.title)[0],
      description: m.attributes.description?.en || '',
      status: m.attributes.status,
      year: m.attributes.year,
      tags: m.attributes.tags.map(t => t.attributes.name.en),
      cover: getCoverUrl(m)
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal ambil detail' });
  }
});

// 3. Chapter list
app.get('/api/manga/:id/chapters', async (req, res) => {
  try {
    const { data } = await axios.get(`${MDX}/manga/${req.params.id}/feed`, {
      params: {
        limit: 500,
        translatedLanguage: ['en', 'id'],
        order: { chapter: 'desc' },
        contentRating: ['safe', 'suggestive']
      }
    });
    const chapters = data.data.map(c => ({
      id: c.id,
      chapter: c.attributes.chapter,
      title: c.attributes.title,
      pages: c.attributes.pages,
      lang: c.attributes.translatedLanguage,
      publishAt: c.attributes.publishAt
    }));
    res.json({ chapters });
  } catch (err) {
    res.status(500).json({ error: 'Gagal ambil chapter' });
  }
});

// 4. Chapter images
app.get('/api/chapter/:id', async (req, res) => {
  try {
    const { data } = await axios.get(`${MDX}/at-home/server/${req.params.id}`);
    const { baseUrl, chapter } = data;
    const images = chapter.data.map(f => `${baseUrl}/data/${chapter.hash}/${f}`);
    res.json({ images, pages: images.length });
  } catch (err) {
    res.status(500).json({ error: 'Gagal ambil gambar' });
  }
});

// 5. Search
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ results: [] });
    const { data } = await axios.get(`${MDX}/manga`, {
      params: { title: q, limit: 20, includes: ['cover_art'], contentRating: ['safe', 'suggestive'] }
    });
    res.json({
      results: data.data.map(m => ({
        id: m.id,
        title: m.attributes.title.en || Object.values(m.attributes.title)[0],
        cover: getCoverUrl(m),
        type: m.attributes.originalLanguage === 'ko' ? 'Manhwa'
             : m.attributes.originalLanguage === 'zh' ? 'Manhua' : 'Manga'
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Search gagal' });
  }
});

// 6. HISTORY
app.get('/api/history', (req, res) => res.json(readHistory()));

app.post('/api/history', (req, res) => {
  const item = req.body;
  let h = readHistory().filter(x => x.id !== item.id);
  h.unshift({ ...item, readAt: new Date().toISOString() });
  h = h.slice(0, 50);
  writeHistory(h);
  res.json({ ok: true });
});

app.delete('/api/history', (req, res) => {
  writeHistory([]);
  res.json({ ok: true });
});

// ========== START ==========
app.listen(PORT, () => {
  console.log(`\n📖 Manga Rz7 running: http://localhost:${PORT}\n`);
});
