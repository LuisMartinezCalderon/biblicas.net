module.exports = {
  id: "org.seriesbiblicas",
  version: "1.4.0",
  name: "Series Bíblicas",
  description: "Series y películas bíblicas en español latino",
  logo: "https://seriesbiblicas.net/wp-content/uploads/2020/01/logo.png",
  resources: ["catalog", "meta", "stream"],
  types: ["series"],
  idPrefixes: ["sb:"],
  catalogs: [
    {
      type: "series",
      id: "seriesbiblicas-main",
      name: "📖 Series Bíblicas",
      extra: [],
    },
  ],
  behaviorHints: { adult: false, p2p: false },
};
