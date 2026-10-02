import { Router, Request, Response } from 'express';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { Tenant } from './tenant.model';

const router = Router();

const DEFAULT_NAME = 'Merco';
const DEFAULT_THEME_COLOR = '#0057ff';

const ICONS = [
  { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-192x192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
  { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

// Extrae el slug del tenant: header X-Tenant-Slug (lo pone nginx),
// query ?slug= (útil para bubblewrap/debug) o subdominio del Host
const resolveSlug = (req: Request): string | null => {
  const header = req.headers['x-tenant-slug'];
  if (typeof header === 'string' && header.trim()) return header.trim();

  const query = req.query['slug'];
  if (typeof query === 'string' && query.trim()) return query.trim();

  const host = req.headers.host || '';
  const match = host.match(/^([^.]+)\.merco\.edwsystem\.com$/i);
  if (match && match[1] && !['www', 'api'].includes(match[1].toLowerCase())) return match[1];

  return null;
};

// GET /api/manifest — manifest.json dinámico por tenant (público, sin auth).
// Base del white-label PWA/TWA: nombre y theme_color salen del tenant.
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = resolveSlug(req);
    const tenant = slug ? await Tenant.findOne({ where: { slug } }) : null;

    const name = tenant?.name || DEFAULT_NAME;
    const shortName = name.length <= 12 ? name : name.slice(0, 12).trimEnd();
    const themeColor = tenant?.primaryColor || DEFAULT_THEME_COLOR;
    // Branding: si el tenant tiene logo, la PWA/APK instala con su logo
    const icons = tenant?.logoUrl
      ? [
          { src: tenant.logoUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: tenant.logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
        ]
      : ICONS;

    res
      .set('Content-Type', 'application/manifest+json')
      .set('Cache-Control', 'public, max-age=300')
      .json({
        name,
        short_name: shortName,
        description: 'Gestión de productos, precios y órdenes',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#ffffff',
        theme_color: themeColor,
        categories: ['business', 'productivity'],
        lang: 'es-ES',
        dir: 'ltr',
        prefer_related_applications: false,
        icons,
        shortcuts: [
          {
            name: 'Nueva Orden',
            short_name: 'Orden',
            description: 'Crear una nueva orden de venta',
            url: '/orders/new',
            icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Buscar Productos',
            short_name: 'Productos',
            description: 'Buscar y comparar productos',
            url: '/',
            icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      });
  })
);

export default router;
