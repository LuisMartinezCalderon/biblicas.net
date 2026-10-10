// Uso: node refresh.js
// Corre esto por cron (ej. cada 6-12 horas) para mantener los JSON al día
// SIN que el addon tenga que arriesgarse a pegarle a la página en medio de
// una request de un usuario. Si la página está caída cuando corre este
// script, simplemente no actualiza esa serie y deja el JSON anterior intacto.

const SERIES = require("./catalog");
const { getSeriesData } = require("./SeriesStore");

(async () => {
  let ok = 0;
  let fail = 0;

  for (const s of SERIES) {
    try {
      const data = await getSeriesData(s, { forceRefresh: true });
      console.log(`OK   ${s.id}: ${data.episodes.length} episodios`);
      ok++;
    } catch (e) {
      console.error(`FALLO ${s.id}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\nListo. ${ok} series actualizadas, ${fail} fallaron (se mantiene su JSON anterior si existía).`);
  process.exit(fail > 0 && ok === 0 ? 1 : 0);
})();