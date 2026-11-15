import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';
import {
  ANILIST_GENRES,
  discoverAnime,
  discoverCharacters,
  getAnimeDetail,
  getCharacterDetail,
  NotFoundError,
} from './server/anilistClient.ts';
import {
  generateGroundedRecommendations,
  parseNaturalLanguageSearch,
} from './server/geminiAssistant.ts';
import {
  ANIMATIONS_CATALOG,
  MODELS_3D_CATALOG,
  WALLPAPERS_CATALOG,
} from './src/data/catalog.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const aiRateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkAiRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = aiRateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    aiRateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (bucket.count >= 20) return false;
  bucket.count += 1;
  return true;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      platform: 'THE ANIME WORLD',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/anime/genres', (_req, res) => {
    res.json({ genres: ANILIST_GENRES });
  });

  app.get('/api/anime/discover', async (req, res) => {
    try {
      const result = await discoverAnime({
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        genre: typeof req.query.genre === 'string' ? req.query.genre : undefined,
        year: typeof req.query.year === 'string' ? req.query.year : undefined,
        season: typeof req.query.season === 'string' ? req.query.season : undefined,
        country: typeof req.query.country === 'string' ? req.query.country : undefined,
        format: typeof req.query.format === 'string' ? req.query.format : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        sort: typeof req.query.sort === 'string' ? req.query.sort : undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        perPage: req.query.perPage ? Number(req.query.perPage) : 20,
      });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch anime catalog';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/anime/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid anime ID' });
      return;
    }
    try {
      const detail = await getAnimeDetail(id);
      res.json(detail);
    } catch (err) {
      const status = err instanceof NotFoundError ? 404 : 502;
      const message = err instanceof Error ? err.message : 'Failed to fetch anime details';
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/characters', async (req, res) => {
    try {
      const result = await discoverCharacters({
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        perPage: req.query.perPage ? Number(req.query.perPage) : 24,
      });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch characters';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/characters/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid character ID' });
      return;
    }
    try {
      const detail = await getCharacterDetail(id);
      res.json(detail);
    } catch (err) {
      const status = err instanceof NotFoundError ? 404 : 502;
      const message = err instanceof Error ? err.message : 'Failed to fetch character details';
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/wallpapers', (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : 'ALL';
    const resolution = typeof req.query.resolution === 'string' ? req.query.resolution : 'ALL';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    const items = WALLPAPERS_CATALOG.filter((w) => {
      if (category !== 'ALL' && w.category !== category && !w.tags.includes(category)) return false;
      if (resolution !== 'ALL' && w.resolution !== resolution) return false;
      if (search && !`${w.title} ${w.artist} ${w.tags.join(' ')}`.toLowerCase().includes(search)) return false;
      return true;
    });
    res.json({ items });
  });

  app.get('/api/wallpapers/:id', (req, res) => {
    const item = WALLPAPERS_CATALOG.find((w) => w.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Wallpaper not found' });
      return;
    }
    res.json(item);
  });

  app.get('/api/3d-models', (_req, res) => {
    res.json({ items: MODELS_3D_CATALOG });
  });

  app.get('/api/3d-models/:id', (req, res) => {
    const item = MODELS_3D_CATALOG.find((m) => m.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: '3D model not found' });
      return;
    }
    res.json(item);
  });

  app.get('/api/animations', (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : 'ALL';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const items = ANIMATIONS_CATALOG.filter((a) => {
      if (category !== 'ALL' && a.category !== category) return false;
      if (search && !`${a.title} ${a.creator} ${a.description}`.toLowerCase().includes(search)) return false;
      return true;
    });
    res.json({ items });
  });

  app.get('/api/animations/:id', (req, res) => {
    const item = ANIMATIONS_CATALOG.find((a) => a.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Animation not found' });
      return;
    }
    res.json(item);
  });

  const videosDir = path.resolve(process.cwd(), 'public', 'videos');
  app.use(
    '/videos',
    express.static(videosDir, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mp4')) {
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Accept-Ranges', 'bytes');
        }
      },
    })
  );

  const resolveVideoAsset = (rawId: string) => {
    const cleanId = rawId.replace(/\.mp4$/i, '');
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(cleanId)) return null;
    const item = ANIMATIONS_CATALOG.find((a) => a.id === cleanId);
    const filePath = path.join(videosDir, `${cleanId}.mp4`);
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size < 1024) return null;
    const safeTitle = (item?.title || cleanId)
      .replace(/[^a-zA-Z0-9\s_-]+/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 64);
    return {
      id: cleanId,
      title: item?.title || cleanId,
      filename: `AnimeWorld_${safeTitle || cleanId}.mp4`,
      filePath,
      sizeBytes: stat.size,
      thumbnailUrl: item?.previewImage || '',
    };
  };

  app.get('/api/videos/:id/info', (req, res) => {
    const asset = resolveVideoAsset(req.params.id);
    if (!asset) {
      res.status(404).json({ error: 'Video file not found or unavailable for download.' });
      return;
    }
    res.json({
      id: asset.id,
      title: asset.title,
      filename: asset.filename,
      contentType: 'video/mp4',
      sizeBytes: asset.sizeBytes,
      thumbnailUrl: asset.thumbnailUrl,
      downloadUrl: `/api/videos/${asset.id}/download`,
    });
  });

  app.get('/api/videos/:id/download', (req, res) => {
    const asset = resolveVideoAsset(req.params.id);
    if (!asset) {
      res.status(404).json({ error: 'Requested MP4 video file was not found.' });
      return;
    }

    const totalSize = asset.sizeBytes;
    const rangeHeader = req.headers.range;

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${asset.filename}"`);

    if (rangeHeader && /^bytes=\d*-\d*$/.test(rangeHeader)) {
      const [startStr, endStr] = rangeHeader.replace(/^bytes=/, '').split('-');
      const start = startStr ? Number(startStr) : 0;
      const end = endStr ? Math.min(Number(endStr), totalSize - 1) : totalSize - 1;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || end >= totalSize) {
        res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
        return;
      }
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      res.setHeader('Content-Length', String(chunkSize));
      const stream = fs.createReadStream(asset.filePath, { start, end });
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).json({ error: 'Video stream failed.' });
        else res.destroy();
      });
      stream.pipe(res);
      return;
    }

    res.status(200);
    res.setHeader('Content-Length', String(totalSize));
    const stream = fs.createReadStream(asset.filePath);
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).json({ error: 'Video stream failed.' });
      else res.destroy();
    });
    stream.pipe(res);
  });

  const formatAiError = (err: unknown, fallback: string): string => {
    const raw = err instanceof Error ? err.message : fallback;
    if (raw.includes('API key not valid') || raw.includes('GEMINI_API_KEY')) {
      return 'Gemini AI requires a valid GEMINI_API_KEY configured in AI Studio Secrets.';
    }
    return raw.length > 220 ? fallback : raw;
  };

  app.post('/api/ai/parse-search', async (req, res) => {
    const ip = req.ip || 'local';
    if (!checkAiRateLimit(ip)) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before trying again.' });
      return;
    }
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (query.length < 2 || query.length > 300) {
      res.status(400).json({ error: 'Query must be between 2 and 300 characters.' });
      return;
    }
    try {
      const filters = await parseNaturalLanguageSearch(query);
      res.json(filters);
    } catch (err) {
      res.status(500).json({ error: formatAiError(err, 'AI search parsing failed') });
    }
  });

  app.post('/api/ai/recommend', async (req, res) => {
    const ip = req.ip || 'local';
    if (!checkAiRateLimit(ip)) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before trying again.' });
      return;
    }
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (message.length < 2 || message.length > 600) {
      res.status(400).json({ error: 'Message must be between 2 and 600 characters.' });
      return;
    }
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];
    const favoriteGenres = Array.isArray(req.body?.favoriteGenres)
      ? req.body.favoriteGenres.filter((g: unknown): g is string => typeof g === 'string').slice(0, 10)
      : [];
    const favoriteTitles = Array.isArray(req.body?.favoriteTitles)
      ? req.body.favoriteTitles.filter((t: unknown): t is string => typeof t === 'string').slice(0, 10)
      : [];

    try {
      const result = await generateGroundedRecommendations({
        message,
        history,
        favoriteGenres,
        favoriteTitles,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: formatAiError(err, 'AI recommendation failed') });
    }
  });

  app.get('/robots.txt', (req, res) => {
    const origin = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dashboard\nSitemap: ${origin}/sitemap.xml\n`
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const origin = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const routes = [
      '/',
      '/explore',
      '/trending',
      '/popular',
      '/upcoming',
      '/seasonal',
      '/characters',
      '/wallpapers',
      '/3d-world',
      '/animations',
      '/ai-assistant',
      '/community',
      '/feedback',
      '/contact',
      '/about',
      '/faq',
      '/privacy',
      '/terms',
      '/copyright',
    ];
    const urls = routes
      .map(
        (r) =>
          `<url><loc>${origin}${r}</loc><changefreq>${r === '/' || r === '/trending' ? 'daily' : 'weekly'}</changefreq></url>`
      )
      .join('');
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`
    );
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build artifacts not found. Run npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`THE ANIME WORLD server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
