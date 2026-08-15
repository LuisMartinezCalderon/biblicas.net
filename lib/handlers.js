const axios = require("axios");
const cheerio = require("cheerio");
const SERIES = require("./catalog");
const { extractOkru, extractEpisodesWithSeasons } = require("./okru");

const BASE_URL = "https://seriesbiblicas.net";

const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;
function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return Promise.resolve(hit.value);
  return fn().then((v) => { cache.set(key, { value: v, ts: Date.now() }); return v; });
}

async function fetchHTML(url) {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: BASE_URL,
    },
    timeout: 20000,
  });
  return data;
}

// ── Catalog ───────────────────────────────────────────────────────────────────
async function getCatalog() {
  return cached("catalog", async () => {
    const results = [];
    for (const s of SERIES) {
      let poster = s.poster;
      if (!poster) {
        try {
          const html = await fetchHTML(s.url);
          const $ = cheerio.load(html);
          poster =
            $("meta[property='og:image']").attr("content") ||
            $(".post-thumbnail img").first().attr("src") ||
            $(".entry-content img").first().attr("src") || "";
          console.log(`[catalog] poster para ${s.id}: ${poster}`);
        } catch (e) {
          console.warn(`[catalog] no se pudo obtener poster de ${s.id}:`, e.message);
        }
      }
      results.push({ id: s.id, type: "series", name: s.name, poster, posterShape: "poster", description: s.description });
    }
    return results;
  });
}

// ── Meta ──────────────────────────────────────────────────────────────────────
async function getMeta(id) {
  const series = SERIES.find((s) => s.id === id);
  if (!series) return null;

  return cached(`meta:${id}`, async () => {
    const html = await fetchHTML(series.url);
    const $ = cheerio.load(html);

    const poster =
      $("meta[property='og:image']").attr("content") ||
      $(".post-thumbnail img").first().attr("src") || "";

    const description =
      $("meta[property='og:description']").attr("content") || series.description;

    const episodes = extractEpisodesWithSeasons(html);
    console.log(`[meta] ${id}: ${episodes.length} episodios en ${new Set(episodes.map(e => e.season)).size} temporada(s)`);

    const videos = episodes.map((ep, i) => ({
      id: `${id}:ep${i}`,          // formato simple ep0, ep1... igual que antes
      title: ep.title,
      season: ep.season,
      episode: ep.episode,
      thumbnail: poster,
    }));

    return { id, type: "series", name: series.name, poster, posterShape: "poster", description, videos };
  });
}

// ── Stream (sin caché, tokens frescos siempre) ────────────────────────────────
async function getStreams(id) {
  const parts = id.split(":");
  if (parts.length < 3) return [];

  const seriesId = `${parts[0]}:${parts[1]}`;
  const epIndex = parseInt(parts[2].replace("ep", ""), 10);

  const series = SERIES.find((s) => s.id === seriesId);
  if (!series) return [];

  const html = await fetchHTML(series.url);
  const episodes = extractEpisodesWithSeasons(html);
  console.log(`[stream] ${episodes.length} episodios, solicitando ep${epIndex}`);

  const episode = episodes[epIndex];
  if (!episode?.embedUrl) {
    console.warn(`[stream] no encontrado ep${epIndex}`);
    return [];
  }

  try {
    const video = await extractOkru(episode.embedUrl);
    return buildStreams(video);
  } catch (err) {
    console.error(`[stream] ep${epIndex} falló:`, err.message);
    return [];
  }
}

// ── Streams: URLs directas, sin proxy ────────────────────────────────────────
function buildStreams(video) {
  const streams = [];
  if (video.hls) {
    streams.push({ name: "▶ HLS", title: video.title || "Reproducir", url: video.hls });
  }
  if (video.qualities?.length) {
    [...video.qualities]
      .sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0))
      .forEach((q) => {
        streams.push({ name: `🎬 ${q.quality}`, title: video.title || "Reproducir", url: q.url });
      });
  }
  return streams;
}

module.exports = { getCatalog, getMeta, getStreams };
