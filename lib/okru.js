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
 // extractOkruUrlsInOrder,
  extractEpisodesWithSeasons,
  extractEpisodesFromOkss,
  fetchLiveEpisodes,
};