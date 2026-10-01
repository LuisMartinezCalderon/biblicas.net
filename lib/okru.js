const axios = require("axios");
const cheerio = require("cheerio");

const OKRU_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function extractOkru(embedUrl) {
  const { data: html } = await axios.get(embedUrl, {
    headers: { "User-Agent": OKRU_UA, Referer: "https://seriesbiblicas.net" },
    timeout: 20000,
  });
  const $ = cheerio.load(html);
  const player = $('div[data-module="OKVideo"]');
  if (!player.length) throw new Error("No se encontró el reproductor OKVideo");
  const options = JSON.parse(player.attr("data-options"));

  // metadata puede venir como string (formato viejo) u objeto (formato nuevo)
  const rawMeta = options.flashvars.metadata;
  const metadata = typeof rawMeta === "string" ? JSON.parse(rawMeta) : rawMeta;

  return {
    id: metadata.movie.id,
    title: metadata.movie.title,
    hls: metadata.hlsManifestUrl,
    qualities: metadata.videos.map((v) => ({ quality: v.name, url: v.url })),
  };
}

/**
 * NUEVO formato (plugin okru-series-streaming): busca la sección
 * <section data-episodes="[...]"> y parsea el JSON de episodios directamente.
 * Cheerio ya decodifica las entidades HTML (&quot; -> ") al leer el atributo,
 * así que el string resultante es JSON válido.
 */
function extractEpisodesFromOkss($) {
  const section = $("section[data-episodes]").first();
  if (!section.length) return null;

  const raw = section.attr("data-episodes");
  if (!raw) return null;

  let episodesRaw;
  try {
    episodesRaw = JSON.parse(raw);
  } catch (e) {
    console.error("[okss] error parseando data-episodes:", e.message);
    return null;
  }

  if (!Array.isArray(episodesRaw) || episodesRaw.length === 0) return null;

  return episodesRaw.map((ep) => {
    const seasonNum = (ep.season_index ?? 0) + 1;
    // "Episodios" es la etiqueta genérica cuando la serie no tiene temporadas reales
    const seasonLabel = ep.season && ep.season !== "Episodios" ? ep.season : null;
    const title =
      ep.title && ep.title.trim()
        ? ep.title.trim()
        : seasonLabel
        ? `${seasonLabel} Capítulo ${ep.number}`
        : `Episodio ${ep.number}`;

    return {
      season: seasonNum,
      episode: ep.number,
      title,
      embedUrl: ep.embed,
      uid: ep.uid,
      thumbnail: ep.thumbnail || null,
    };
  });
}

/**
 * Opcional: el plugin también expone un JSON "en vivo" (data-live-url) que
 * se actualiza independiente del HTML cacheado de la página (para que el
 * front no tenga que esperar un re-render completo al agregar episodios).
 * Si quieres la data más fresca posible, intenta esto primero y usa
 * data-episodes como fallback si falla la petición o el JSON viene vacío.
 */
async function fetchLiveEpisodes($) {
  const section = $("section[data-live-url]").first();
  const liveUrl = section.attr("data-live-url");
  if (!liveUrl) return null;

  try {
    const { data } = await axios.get(liveUrl, {
      headers: { "User-Agent": OKRU_UA, Referer: "https://seriesbiblicas.net" },
      timeout: 15000,
    });
    const episodesRaw = Array.isArray(data) ? data : data?.episodes;
    if (!Array.isArray(episodesRaw) || episodesRaw.length === 0) return null;

    return episodesRaw.map((ep) => {
      const seasonNum = (ep.season_index ?? 0) + 1;
      const seasonLabel = ep.season && ep.season !== "Episodios" ? ep.season : null;
      const title =
        ep.title && ep.title.trim()
          ? ep.title.trim()
          : seasonLabel
          ? `${seasonLabel} Capítulo ${ep.number}`
          : `Episodio ${ep.number}`;
      return {
        season: seasonNum,
        episode: ep.number,
        title,
        embedUrl: ep.embed,
        uid: ep.uid,
        thumbnail: ep.thumbnail || null,
      };
    });
  } catch (e) {
    console.warn("[okss] no se pudo obtener data-live-url, usando data-episodes del HTML:", e.message);
    return null;
  }
}

// ---------- Fallback: formato viejo (páginas que aún no migraron al plugin) ----------

function extractOkruUrlsInOrder(html) {
  const regex = /https?:\/\/(?:www\.)?ok\.ru\/(?:videoembed|video)\/(\d+)[^\s<>"']*/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    matches.push({ url: match[0], id: match[1] });
  }
  const seenIds = new Set();
  const result = [];
  for (const { url, id } of matches) {
    const baseUrl = url.split("?")[0];
    if (!seenIds.has(id)) {
      seenIds.add(id);
      result.push(baseUrl);
    }
  }
  return result;
}

function detectSeasons(html) {
  const matches = html.match(/TEMPORADA\s+(\d+)/gi) || [];
  const nums = new Set(matches.map((m) => m.match(/\d+/)[0]));
  return nums.size;
}

function assignSeasonsToUrls(html, reversedUrls, totalSeasons) {
  const $ = cheerio.load(html);
  const pairs = [];
  let currentSeason = null;

  $(".entry-content").find("*").each((_, el) => {
    const $el = $(el);
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    const text = $el.text().trim();
    const seasonMatch = text.match(/TEMPORADA\s+(\d+)/i);
    if (seasonMatch && text.length < 100) {
      currentSeason = parseInt(seasonMatch[1]);
    }
    if (tag === "a" && currentSeason) {
      const href = ($el.attr("href") || "").trim();
      if (href.match(/ok\.ru\/videoembed/i)) {
        pairs.push({ season: currentSeason, url: href.split("?")[0] });
      }
    }
  });

  const seenUrls = new Set();
  const uniquePairs = pairs.filter((p) => {
    if (seenUrls.has(p.url)) return false;
    seenUrls.add(p.url);
    return true;
  });

  if (uniquePairs.length === 0) {
    return reversedUrls.map((embedUrl, i) => ({
      season: 1,
      episode: i + 1,
      title: `Episodio ${i + 1}`,
      embedUrl,
    }));
  }

  const orderedPairs = [...uniquePairs].reverse();
  const bySeason = new Map();
  for (const { season, url } of orderedPairs) {
    if (!bySeason.has(season)) bySeason.set(season, []);
    bySeason.get(season).push(url);
  }

  const result = [];
  const sortedSeasons = [...bySeason.keys()].sort((a, b) => a - b);
  for (const seasonNum of sortedSeasons) {
    bySeason.get(seasonNum).forEach((embedUrl, i) => {
      result.push({
        season: seasonNum,
        episode: i + 1,
        title: `Temporada ${seasonNum} Capítulo ${i + 1}`,
        embedUrl,
      });
    });
  }
  return result;
}

function extractEpisodesLegacy(html) {
  const totalSeasons = detectSeasons(html);
  const urls = extractOkruUrlsInOrder(html);
  console.log(`[legacy] temporadas detectadas: ${totalSeasons}, URLs: ${urls.length}`);

  if (totalSeasons <= 1) {
    return urls.map((embedUrl, i) => ({
      season: 1,
      episode: i + 1,
      title: `Episodio ${i + 1}`,
      embedUrl,
    }));
  }

  const reversed = [...urls.slice(0, -1)].reverse();
  return assignSeasonsToUrls(html, reversed, totalSeasons);
}

// ---------- Punto de entrada: intenta el formato nuevo, cae al viejo ----------

async function extractEpisodesWithSeasons(html, { preferLive = false } = {}) {
  const $ = cheerio.load(html);

  if (preferLive) {
    const liveEpisodes = await fetchLiveEpisodes($);
    if (liveEpisodes) {
      console.log(`[okss] episodios obtenidos de data-live-url: ${liveEpisodes.length}`);
      return liveEpisodes;
    }
  }

  const okssEpisodes = extractEpisodesFromOkss($);
  if (okssEpisodes) {
    console.log(`[okss] episodios obtenidos de data-episodes: ${okssEpisodes.length}`);
    return okssEpisodes;
  }

  console.log("[okss] no se encontró data-episodes, usando extractor legacy (TEMPORADA/anchors)");
  return extractEpisodesLegacy(html);
}

module.exports = {
  extractOkru,
  extractOkruUrlsInOrder,
  extractEpisodesWithSeasons,
  extractEpisodesFromOkss,
  fetchLiveEpisodes,
};