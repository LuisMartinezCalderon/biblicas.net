const { addonBuilder, getRouter } = require("stremio-addon-sdk");
const http = require("http");
const { getCatalog, getMeta, getStreams } = require("./lib/handlers");
const manifest = require("./lib/manifest");

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async ({ type, id }) => {
  console.log(`[catalog] ${type} ${id}`);
  try { return { metas: await getCatalog() }; }
  catch (err) { console.error("[catalog]", err.message); return { metas: [] }; }
});

builder.defineMetaHandler(async ({ type, id }) => {
  console.log(`[meta] ${type} ${id}`);
  try { return { meta: await getMeta(id) }; }
  catch (err) { console.error("[meta]", err.message); return { meta: null }; }
});

builder.defineStreamHandler(async ({ type, id }) => {
  console.log(`[stream] ${type} ${id}`);
  try { return { streams: await getStreams(id) }; }
  catch (err) { console.error("[stream]", err.message); return { streams: [] }; }
});

const PORT = process.env.PORT || 7000;
const addonRouter = getRouter(builder.getInterface());

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }
  addonRouter(req, res, () => { res.writeHead(404); res.end("Not found"); });
});

server.listen(PORT, () => {
  console.log(`\n✅ SeriesBiblicas Addon v${manifest.version}`);
  console.log(`📡 http://localhost:${PORT}/manifest.json\n`);
});
