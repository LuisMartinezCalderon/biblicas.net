const SERIES = require("./catalog");
const { extractOkru } = require("./okru");
const { getSeriesData } = require("./Seriesstore");

// ── Catalog ───────────────────────────────────────────────────────────────────
async function getCatalog() {
  const results = [];
  for (const s of SERIES) {
    try {
      const data = await getSeriesData(s);
      results.push({
        id: s.id,
        type: "series",
        name: s.name,
        poster: data.poster || s.poster || "",
        posterShape: "poster",
        description: data.description || s.description,
      });
    } catch (e) {
      console.warn(`[catalog] ${s.id} no disponible (sin JSON y sin acceso a la página):`, e.message);
      // Fallback mínimo: al menos aparece en el catálogo con lo que ya
      // tenías hardcodeado en catalog.js, aunque no tengamos poster fresco.
      results.push({
        id: s.id,
        type: "series",
        name: s.name,
        poster: s.poster || "",
        posterShape: "poster",
        description: s.description,
      });
    }
  }
  return results;
}

// ── Meta ──────────────────────────────────────────────────────────────────────
async function getMeta(id) {
  const series = SERIES.find((s) => s.id === id);
  if (!series) return null;

  const data = await getSeriesData(series);

  const videos = data.episodes.map((ep, i) => ({
    id: `${id}:ep${i}`, // mismo formato que antes: ep0, ep1...
    title: ep.title,
    season: ep.season,
    episode: ep.episode,
    thumbnail: data.poster,
  }));

  return {
    id,
    type: "series",
    name: series.name,
    poster: data.poster,
    posterShape: "poster",
    description: data.description,
    videos,
  };
}

// ── Stream (esto SIEMPRE va en vivo: los tokens de ok.ru expiran en horas) ────
async function getStreams(id) {
  const parts = id.split(":");
  if (parts.length < 3) return [];

  const seriesId = `${parts[0]}:${parts[1]}`;
  const epIndex = parseInt(parts[2].replace("ep", ""), 10);

  const series = SERIES.find((s) => s.id === seriesId);
  if (!series) return [];

  // Esto normalmente NO toca la red: lee el JSON en disco salvo que esté vencido.
  const data = await getSeriesData(series);

  const episode = data.episodes[epIndex];
  if (!episode?.embedUrl) {
    console.warn(`[stream] no encontrado ep${epIndex} en ${seriesId}`);
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