# 📖 SeriesBiblicas Stremio Addon

Addon para Stremio que sirve series bíblicas en español latino desde SeriesBiblicas.net.

## Deploy en Railway (recomendado)

### Paso 1 — Subir a GitHub
```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/seriesbiblicas-addon.git
git push -u origin main
```

### Paso 2 — Deploy en Railway
1. Ve a [railway.app](https://railway.app) e inicia sesión con GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Selecciona el repo `seriesbiblicas-addon`
4. Railway detecta el Dockerfile automáticamente y despliega

### Paso 3 — Obtener la URL pública
1. En Railway ve a tu proyecto → **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Te da una URL tipo: `https://seriesbiblicas-addon-production.up.railway.app`

### Paso 4 — Instalar en Stremio
Abre Stremio → Configuración → Addons → "+ Add addon" y pega:
```
https://TU-URL.railway.app/manifest.json
```

## Correr localmente
```bash
npm install
npm start
# → http://localhost:7000/manifest.json
```

## Agregar más series
En `lib/handlers.js`, agrega al array `SERIES_CATALOG`:
```js
{
  id: "sb:slug-de-la-serie",
  name: "Nombre de la Serie",
  poster: "",           // se obtiene automáticamente
  description: "...",
  url: "https://seriesbiblicas.net/slug-de-la-serie/",
}
```
