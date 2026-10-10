const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const { extractEpisodesWithSeasons } = require("./okru");

const BASE_URL = "https://seriesbiblicas.net";

// Cambia esto si quieres guardar los JSON en otro lado (ej. un volumen montado en Docker)
const DATA_DIR = path.join(__dirname, "data", "series");

// Cuánto tiempo se considera "fresco" el JSON antes de intentar refrescar contra la página.
// No es un límite duro: si la página falla, se sigue usando lo que haya en disco aunque
// esté vencido, así que subir este número es seguro y reduce aún más el tráfico al sitio.
const REFRESH_TTL = 12 * 60 * 60 * 1000; // 12 horas

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(id) {
  // sanitiza el id para que sirva como nombre de archivo (ids tipo "sb:pablo")
  const safeId = id.replace(/[^a-zA-Z0-9:_-]/g, "_");
  return path.join(DATA_DIR, `${safeId}.json`);
}

function loadFromDisk(id) {
  try {
    const raw = fs.readFileSync(filePath(id), "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return null; // no existe todavía o está corrupto
  }
}

function saveToDisk(id, data) {
  try {
    fs.writeFileSync(filePath(id), JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error(`[store] no se pudo guardar ${id}:`, e.message);
  }
}

async function fetchHTML(url) {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: BASE_URL,
    },
    timeout: 20000,
  });
  return data;
}

async function refreshFromSite(series) {
  const html = await fetchHTML(series.url);
  const $ = cheerio.load(html);

  const poster =
    $("meta[property='og:image']").attr("content") ||
    $(".post-thumbnail img").first().attr("src") ||
    series.poster ||
    "";

  const description =
    $("meta[property='og:description']").attr("content") || series.description || "";

  const episodes = await extractEpisodesWithSeasons(html);
  if (!episodes || episodes.length === 0) {
    throw new Error("extractEpisodesWithSeasons devolvió 0 episodios");
  }

  return {
    id: series.id,
    name: series.name,
    poster,
    description,
    episodes,
    updatedAt: Date.now(),
  };
}

/**
 * Devuelve la data de la serie (poster, descripción, episodios con embedUrl).
 *
 * - Si hay JSON en disco y no está vencido -> lo devuelve directo, sin red.
 * - Si no hay JSON, o está vencido, o forceRefresh=true -> intenta refrescar.
 * - Si el refresh falla pero había JSON viejo -> devuelve el JSON viejo
 *   (la página caída no tumba el addon).
 * - Si el refresh falla y NO hay nada en disco -> ahí sí no queda otra que
 *   propagar el error, no hay nada que servir.
 */
async function getSeriesData(series, { forceRefresh = false } = {}) {
  const onDisk = loadFromDisk(series.id);
  const isStale = !onDisk || Date.now() - onDisk.updatedAt > REFRESH_TTL;

  if (!forceRefresh && onDisk && !isStale) {
    return onDisk;
  }

  try {
    const fresh = await refreshFromSite(series);
    saveToDisk(series.id, fresh);
    console.log(`[store] ${series.id}: refrescado, ${fresh.episodes.length} episodios`);
    return fresh;
  } catch (e) {
    if (onDisk) {
      console.warn(
        `[store] ${series.id}: falló el refresh (${e.message}), uso el JSON en caché (actualizado ${new Date(
          onDisk.updatedAt
        ).toISOString()})`
      );
      return onDisk;
    }
    throw e;
  }
}

module.exports = { getSeriesData, loadFromDisk, saveToDisk, filePath, REFRESH_TTL };