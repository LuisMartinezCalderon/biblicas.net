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

  // metadata puede venir como objeto (nuevo) o como string (viejo formato) -> soportar ambos
  const rawMeta = options.flashvars.metadata;
  const metadata = typeof rawMeta === "string" ? JSON.parse(rawMeta) : rawMeta;

  return {
    id: metadata.movie.id,
    title: metadata.movie.title,
    hls: metadata.hlsManifestUrl,
    qualities: metadata.videos.map((v) => ({ quality: v.name, url: v.url })),
  };
}

function extractOkruUrlsInOrder(html) {
  // Captura ambos formatos y también el ID numérico
  const regex = /https?:\/\/(?:www\.)?ok\.ru\/(?:videoembed|video)\/(\d+)[^\s<>"']*/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    matches.push({
      url: match[0],
      id: match[1]  // ID numérico del video
    });
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

/**
 * Detecta si la página tiene múltiples temporadas buscando
 * al menos dos ocurrencias de "TEMPORADA N" con N diferente.
 */
function detectSeasons(html) {
  const matches = html.match(/TEMPORADA\s+(\d+)/gi) || [];
  const nums = new Set(matches.map((m) => m.match(/\d+/)[0]));
  return nums.size; // cuántas temporadas distintas hay
}

/**
 * Extrae episodios de la página.
 *
 * Si hay múltiples temporadas → el HTML está en orden descendente
 * (última temporada arriba, primera abajo), así que invertimos todo.
 *
 * Si hay una sola temporada o ninguna → orden directo del DOM.
 *
 * Para páginas con temporadas también intentamos extraer el número
 * de temporada de cada URL para asignar season/episode correctamente.
 */
function extractEpisodesWithSeasons(html) {
  const totalSeasons = detectSeasons(html);
  const urls = extractOkruUrlsInOrder(html);

  console.log(`[okru] temporadas detectadas: ${totalSeasons}, URLs: ${urls.length}`);

  if (totalSeasons <= 1) {
    // Sin temporadas (ej: Pablo) → orden directo, todo en T1
    return urls.map((embedUrl, i) => ({
      season: 1,
      episode: i + 1,
      title: `Episodio ${i + 1}`,
      embedUrl,
    }));
  }

  // Con temporadas → invertir URLs (HTML tiene T_last primero, T1 al final)
  // slice(0,-1) omite el último embed del HTML = primer embed antes de invertir = trailer
  const reversed = [...urls.slice(0, -1)].reverse();

  // Intentar asignar temporada/capítulo parseando el HTML en orden inverso
  const episodes = assignSeasonsToUrls(html, reversed, totalSeasons);
  return episodes;
}

/**
 * Recorre el HTML al revés (desde T1 hasta Tmax) para asignar
 * a cada URL su temporada y número de capítulo correcto.
 */
function assignSeasonsToUrls(html, reversedUrls, totalSeasons) {
  const $ = cheerio.load(html);

  // Recoger pares (temporada, url) en orden del DOM
  const pairs = []; // [{season, url}]
  let currentSeason = null;

  $(".entry-content").find("*").each((_, el) => {
    const $el = $(el);
    const tag = el.tagName ? el.tagName.toLowerCase() : "";

    // Detectar TEMPORADA N
    const text = $el.text().trim();
    const seasonMatch = text.match(/TEMPORADA\s+(\d+)/i);
    if (seasonMatch) {
      const num = parseInt(seasonMatch[1]);
      // Solo actualizar si es un nodo pequeño (evitar capturar texto de contenedores grandes)
      if (text.length < 100) {
        currentSeason = num;
      }
    }

    // Detectar href ok.ru
    if (tag === "a" && currentSeason) {
      const href = ($el.attr("href") || "").trim();
      if (href.match(/ok\.ru\/videoembed/i)) {
        pairs.push({ season: currentSeason, url: href.split("?")[0] });
      }
    }
  });

  // Deduplicar pares manteniendo orden
  const seenUrls = new Set();
  const uniquePairs = pairs.filter((p) => {
    if (seenUrls.has(p.url)) return false;
    seenUrls.add(p.url);
    return true;
  });

  // Si no pudimos extraer pares, usar reversedUrls con temporadas estimadas
  if (uniquePairs.length === 0) {
    return reversedUrls.map((embedUrl, i) => ({
      season: 1,
      episode: i + 1,
      title: `Episodio ${i + 1}`,
      embedUrl,
    }));
  }

  // Los pares están en orden DOM (T_last → T1, dentro de cada T: C_last → C1)
  // Invertir para obtener T1 → T_last, C1 → C_last
  const orderedPairs = [...uniquePairs].reverse();

  // Agrupar por temporada y asignar número de episodio
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

module.exports = { extractOkru, extractOkruUrlsInOrder, extractEpisodesWithSeasons };
