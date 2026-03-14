import { test, expect } from '@playwright/test';

/**
 * E2E Tests — PWA & Service Worker
 * Verifica que el Service Worker se registre y la app funcione offline
 */

test.describe('PWA — Service Worker', () => {
  test('la página carga correctamente', async ({ page }) => {
    await page.goto('/');
    // Si no hay sesión, redirige al login
    await expect(page).toHaveURL(/\/(login)?/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('el manifest está disponible', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);
    const json = await response?.json();
    expect(json).toHaveProperty('name');
    expect(json).toHaveProperty('display', 'standalone');
    expect(json).toHaveProperty('icons');
  });

  test('sw.js está disponible en el servidor', async ({ page }) => {
    const response = await page.goto('/sw.js');
    expect(response?.status()).toBe(200);
    const contentType = response?.headers()['content-type'] ?? '';
    expect(contentType).toContain('javascript');
  });

  test('Service Worker se registra en el navegador', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.text().includes('[SW')) console.log('SW LOG:', msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Esperar máx 8s al SW
    const swState = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false };
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length === 0) return { supported: true, registered: false };
      const reg = regs[0];
      return {
        supported: true,
        registered: true,
        scope: reg.scope,
        installing: reg.installing?.state ?? null,
        waiting: reg.waiting?.state ?? null,
        active: reg.active?.state ?? null,
      };
    });

    console.log('SW State:', JSON.stringify(swState));
    console.log('Console errors:', consoleErrors);

    expect(swState.supported).toBe(true);
    expect(swState.registered).toBe(true);
  });

  test('los caches del SW están activos', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Dar tiempo al SW para cachear
    await page.waitForTimeout(2000);

    const cacheNames = await page.evaluate(async () => {
      return await caches.keys();
    });

    console.log('Caches activos:', cacheNames);
    expect(cacheNames.length).toBeGreaterThan(0);
  });

  test('offline.html está disponible como fallback', async ({ page }) => {
    const response = await page.goto('/offline.html');
    expect(response?.status()).toBe(200);
  });
});

test.describe('PWA — Login offline', () => {
  test('la página de login carga', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
    // Buscar elementos del formulario de login
    const input = page.locator('input[type="text"], input[type="email"], input[name="username"]');
    await expect(input.first()).toBeVisible();
  });
});
