import { test, expect } from '@playwright/test';

const API = 'https://api.jjlm.edwsystem.com/api';
const UI  = 'https://jjlm.edwsystem.com';

test.describe('🌐 Producción - Health & Auth', () => {
  test('health check', async ({ page }) => {
    const r = await page.request.get('https://jjlm.edwsystem.com/health');
    const body = await r.json();
    expect(body.status).toBe('success');
  });

  test('login dev retorna token válido', async ({ page }) => {
    const r = await page.request.post(`${API}/auth/login`, {
      data: { username: 'dev', password: 'Ed+010918' }
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.data.token).toBeTruthy();
    console.log('Rol:', body.data.user.role, '| Username:', body.data.user.username);
  });

  test('login incorrecto retorna 401', async ({ page }) => {
    const r = await page.request.post(`${API}/auth/login`, {
      data: { username: 'dev', password: 'wrong_password' }
    });
    expect(r.status()).toBe(401);
  });
});

test.describe('📦 Producción - API con auth', () => {
  let token: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const r = await page.request.post(`${API}/auth/login`, {
      data: { username: 'dev', password: 'Ed+010918' }
    });
    const body = await r.json();
    token = body.data.token;
    await page.close();
  });

  test('listar productos', async ({ page }) => {
    const r = await page.request.get(`${API}/products?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.data.length).toBeGreaterThan(0);
    console.log('Total productos:', body.pagination.total);
  });

  test('listar clientes', async ({ page }) => {
    const r = await page.request.get(`${API}/customers?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    console.log('Total clientes:', body.pagination?.total ?? body.data?.length);
  });

  test('listar órdenes', async ({ page }) => {
    const r = await page.request.get(`${API}/orders?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    console.log('Total órdenes:', body.pagination?.total ?? body.data?.length);
  });
});

test.describe('🖥️ Producción - UI Login', () => {
  test('página de login carga', async ({ page }) => {
    await page.goto(`${UI}/login`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login UI exitoso redirige al home', async ({ page }) => {
    await page.goto(`${UI}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="username"]', 'dev');
    await page.fill('input[name="password"]', 'Ed+010918');
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/login/);
    console.log('Redirigido a:', page.url());
  });

  test('home muestra campo de búsqueda', async ({ page }) => {
    await page.goto(`${UI}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="username"]', 'dev');
    await page.fill('input[name="password"]', 'Ed+010918');
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15000 });
    const search = page.locator('input[placeholder*="buscar" i], input[placeholder*="search" i], input[type="search"]').first();
    await expect(search).toBeVisible({ timeout: 8000 });
  });
});
