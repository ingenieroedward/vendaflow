import { Router, Request, Response } from 'express';
import { asyncHandler } from '@/core/middlewares/asyncHandler';

const router = Router();

// Registro de APKs TWA por tenant. La huella SHA-256 es del keystore con el
// que se firmó el APK del tenant (información pública por diseño de assetlinks).
// Al generar un APK nuevo (bubblewrap build), agregar aquí su entrada:
//   keytool -list -v -keystore android.keystore -alias android | grep SHA256
const TWA_APPS: Record<string, { packageId: string; sha256Fingerprints: string[] }> = {
  demo: {
    packageId: 'com.edwsystem.merco.demo',
    sha256Fingerprints: [
      '23:4A:5D:2D:C0:CA:7A:36:D7:AD:BE:E4:46:0B:39:0E:D6:EB:4E:3A:2D:01:E6:5A:A4:D7:02:61:86:FE:8A:6B',
    ],
  },
};

const resolveSlug = (req: Request): string | null => {
  const header = req.headers['x-tenant-slug'];
  if (typeof header === 'string' && header.trim()) return header.trim();

  const host = req.headers.host || '';
  const match = host.match(/^([^.]+)\.merco\.edwsystem\.com$/i);
  if (match && match[1] && !['www', 'api'].includes(match[1].toLowerCase())) return match[1];

  return null;
};

// GET /api/assetlinks — Digital Asset Links del tenant (público, sin auth).
// Android lo consulta en /.well-known/assetlinks.json (nginx lo proxea aquí)
// para verificar el APK TWA y ocultar la barra de URL de Chrome.
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = resolveSlug(req);
    const app = slug ? TWA_APPS[slug] : undefined;

    if (!app) {
      // Sin APK registrado para este tenant — respuesta vacía válida
      res.set('Content-Type', 'application/json').set('Cache-Control', 'public, max-age=3600').json([]);
      return;
    }

    res
      .set('Content-Type', 'application/json')
      .set('Cache-Control', 'public, max-age=3600')
      .json([
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: app.packageId,
            sha256_cert_fingerprints: app.sha256Fingerprints,
          },
        },
      ]);
  })
);

export default router;
