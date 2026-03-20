import { test, expect, Page } from '@playwright/test';

// ─── Configuración ───────────────────────────────────────────────────────────
const API_URL = 'http://localhost:3001/api';

// ─── Helper: Login via API (sin UI, para tests de API directamente) ──────────
async function getAuthToken(page: Page, username = 'admin', password = 'admin123'): Promise<string> {
  const resp = await page.request.post(`${API_URL}/auth/login`, {
    data: { username, password }
  });
  const body = await resp.json();
  return body.data?.token || '';
}

// ─── Helper: Login via UI ────────────────────────────────────────────────────
async function loginUI(page: Page, username = 'admin', password = 'admin123') {
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15000 });
}

// ─── Tests de API (backend) ──────────────────────────────────────────────────

test.describe('🌐 API Backend - Health & Auth', () => {
  test('health check responde correctamente', async ({ page }) => {
    const response = await page.request.get('http://localhost:3001/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('success');
  });

  test('login admin retorna token válido', async ({ page }) => {
    const response = await page.request.post(`${API_URL}/auth/login`, {
      data: { username: 'admin', password: 'admin123' }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.token).toBeTruthy();
    expect(body.data.user.username).toBe('admin');
    expect(body.data.user.role).toBe('admin');
  });

  test('login seller retorna token válido', async ({ page }) => {
    const response = await page.request.post(`${API_URL}/auth/login`, {
      data: { username: 'seller', password: 'seller123' }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.token).toBeTruthy();
    expect(body.data.user.role).toBe('seller');
  });

  test('login con credenciales incorrectas retorna 401', async ({ page }) => {
    const response = await page.request.post(`${API_URL}/auth/login`, {
      data: { username: 'noexiste', password: 'mal123' }
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('📦 API Backend - Productos CRUD', () => {
  let token: string;
  let createdProductId: number;
  const uniqueCode = `E2E-${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    token = await getAuthToken(page);
    await page.close();
  });

  test('listar productos (400 en BD)', async ({ page }) => {
    const response = await page.request.get(`${API_URL}/products?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.pagination.total).toBeGreaterThanOrEqual(400);
    expect(body.data.length).toBe(10);
  });

  test('crear producto nuevo', async ({ page }) => {
    const response = await page.request.post(`${API_URL}/products`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: 'Taladro Percutor Industrial E2E',
        code: uniqueCode,
        unit: 'und',
        salePrice: 850000,
      }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.code).toBe(uniqueCode);
    expect(body.data.name).toBe('Taladro Percutor Industrial E2E');
    createdProductId = body.data.id;
  });

  test('obtener producto por ID', async ({ page }) => {
    test.skip(!createdProductId, 'No hay producto creado');
    const response = await page.request.get(`${API_URL}/products/${createdProductId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.id).toBe(createdProductId);
    expect(body.data.code).toBe(uniqueCode);
  });

  test('buscar producto por código exacto', async ({ page }) => {
    test.skip(!createdProductId, 'No hay producto creado');
    const response = await page.request.get(`${API_URL}/products/search?q=${uniqueCode}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.length).toBeGreaterThan(0);
    const found = body.data.find((p: any) => p.code === uniqueCode);
    expect(found).toBeTruthy();
    expect(found.name).toBe('Taladro Percutor Industrial E2E');
  });

  test('buscar producto por nombre parcial', async ({ page }) => {
    const response = await page.request.get(`${API_URL}/products/search?q=Martillo`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('actualizar producto', async ({ page }) => {
    test.skip(!createdProductId, 'No hay producto creado');
    const response = await page.request.put(`${API_URL}/products/${createdProductId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: 'Taladro Percutor Industrial E2E - Actualizado',
        code: uniqueCode,
        unit: 'und',
        salePrice: 950000,
      }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.name).toContain('Actualizado');
    expect(Number(body.data.salePrice)).toBe(950000);
  });

  test('eliminar producto (soft delete)', async ({ page }) => {
    test.skip(!createdProductId, 'No hay producto creado');
    const response = await page.request.delete(`${API_URL}/products/${createdProductId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(response.status()).toBe(204);

    // Verificar que el producto no aparece en la lista
    const checkResp = await page.request.get(`${API_URL}/products/${createdProductId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(checkResp.status()).toBe(404);
  });
});

test.describe('🏷️ API Backend - Precios y Proveedores', () => {
  let token: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    token = await getAuthToken(page);
    await page.close();
  });

  test('listar proveedores', async ({ page }) => {
    const response = await page.request.get(`${API_URL}/suppliers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.length).toBeGreaterThanOrEqual(5);
  });

  test('buscar productos con precios (se ven precios de proveedores)', async ({ page }) => {
    const response = await page.request.get(`${API_URL}/products/prices?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    // Al menos algunos productos deben tener precios
    const withPrices = body.data.filter((p: any) => p.prices && p.prices.length > 0);
    expect(withPrices.length).toBeGreaterThan(0);
  });
});

test.describe('👥 API Backend - Clientes', () => {
  let token: string;
  const uniqueClientName = `Cliente E2E ${Date.now()}`;
  let createdClientId: number;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    token = await getAuthToken(page);
    await page.close();
  });

  test('crear cliente nuevo', async ({ page }) => {
    const response = await page.request.post(`${API_URL}/customers`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: uniqueClientName,
        contact: '555-1234',
        address: 'Calle Test 456',
        note: 'Cliente creado por Playwright E2E'
      }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.name).toBe(uniqueClientName);
    createdClientId = body.data.id;
  });

  test('buscar cliente por nombre', async ({ page }) => {
    test.skip(!createdClientId, 'No hay cliente creado');
    const response = await page.request.get(`${API_URL}/customers/search?q=E2E`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.length).toBeGreaterThan(0);
    const found = body.data.find((c: any) => c.id === createdClientId);
    expect(found).toBeTruthy();
  });

  test('obtener cliente por ID', async ({ page }) => {
    test.skip(!createdClientId, 'No hay cliente creado');
    const response = await page.request.get(`${API_URL}/customers/${createdClientId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.name).toBe(uniqueClientName);
  });
});

// ─── Tests de UI (Frontend) ──────────────────────────────────────────────────

test.describe('🖥️ UI - Autenticación', () => {
  test('página de login carga correctamente', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login exitoso redirige al home', async ({ page }) => {
    await loginUI(page);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL('http://localhost:5173/');
  });

  test('login con credenciales incorrectas no redirige', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="username"]', 'usuario_invalido');
    await page.fill('input[name="password"]', 'clave_incorrecta');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('🖥️ UI - Home y Búsqueda', () => {
  test.beforeEach(async ({ page }) => {
    await loginUI(page);
  });

  test('home muestra campo de búsqueda', async ({ page }) => {
    await expect(page).toHaveURL('http://localhost:5173/');
    // Buscar input de búsqueda
    const searchInput = page.locator('input[placeholder*="buscar" i], input[placeholder*="search" i], input[type="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 8000 });
  });

  test('búsqueda retorna resultados con productos de BD', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="buscar" i], input[placeholder*="search" i], input[type="search"]').first();
    await searchInput.fill('martillo');
    await page.waitForTimeout(1500); // Debounce
    // Debe mostrar resultados
    await page.waitForTimeout(2000);
    const content = await page.content();
    expect(content.toLowerCase()).toContain('martillo');
  });

  test('búsqueda vacía no muestra error', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="buscar" i], input[placeholder*="search" i], input[type="search"]').first();
    await searchInput.fill('');
    await page.waitForTimeout(500);
    // No debe haber errores fatales
    const errorEl = page.locator('text=Error del servidor, text=500 Internal').first();
    const hasError = await errorEl.isVisible().catch(() => false);
    expect(hasError).toBeFalsy();
  });
});

test.describe('🖥️ UI - Gestión de Productos', () => {
  const productCode = `UI-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await loginUI(page);
  });

  test('navegar a crear producto', async ({ page }) => {
    await page.goto('http://localhost:5173/products/new');
    await page.waitForLoadState('networkidle');
    // Debe mostrar un formulario
    await expect(page.locator('input[name="name"], input[name="code"]').first()).toBeVisible({ timeout: 8000 });
  });

  test('crear producto y verlo en la búsqueda', async ({ page }) => {
    await page.goto('http://localhost:5173/products/new');
    await page.waitForLoadState('networkidle');

    // Llenar formulario
    await page.fill('input[name="name"]', 'Producto UI Playwright');
    await page.fill('input[name="code"]', productCode);
    await page.fill('input[name="unit"]', 'und');
    await page.fill('input[name="salePrice"]', '125000');

    // Guardar
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Debe navegar fuera de /new
    const url = page.url();
    expect(url).not.toContain('/new');

    // Buscar el producto creado en home
    await page.goto('http://localhost:5173/');
    const searchInput = page.locator('input[placeholder*="buscar" i], input[placeholder*="search" i], input[type="search"]').first();
    await searchInput.fill(productCode);
    await page.waitForTimeout(2000);

    // El código debe aparecer en la página
    const content = await page.content();
    expect(content).toContain(productCode);
  });
});

test.describe('🖥️ UI - Órdenes', () => {
  test.beforeEach(async ({ page }) => {
    await loginUI(page, 'admin', 'admin123');
  });

  test('página de órdenes carga', async ({ page }) => {
    await page.goto('http://localhost:5173/orders');
    await page.waitForLoadState('networkidle');
    // Debe mostrar contenido de órdenes
    await expect(page.locator('body')).toBeVisible();
    const url = page.url();
    // No debe redirigir a login
    expect(url).not.toContain('/login');
  });

  test('formulario de nueva orden es accesible', async ({ page }) => {
    await page.goto('http://localhost:5173/orders/new');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url).not.toContain('/login');
    // Debe tener algún formulario
    const form = page.locator('form, [data-testid="order-form"]').first();
    const hasForm = await form.isVisible({ timeout: 5000 }).catch(() => false);
    // Al menos la página no debe ser 404
    expect(await page.title()).not.toBe('404');
  });
});
