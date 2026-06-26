import { test, expect } from '@playwright/test';

const API = 'https://api.jjlm.edwsystem.com/api';
const UI  = 'https://jjlm.edwsystem.com';
const CREDS = { username: 'dev', password: 'Ed+010918' };

// Cliente de prueba con timestamp para evitar colisiones
const TS = Date.now();
const TEST_CUSTOMER = {
  name: `Test Cliente ${TS}`,
  nit:  `900${TS.toString().slice(-6)}`,
  contact: 'test@prueba.com',
  address: 'Calle Prueba 123',
  note: 'Cliente creado por test automatizado',
};

test.describe('👤 Clientes — Crear y Editar', () => {
  let token: string;
  let createdId: number;

  // ── API: Crear cliente ────────────────────────────────────────────────────
  test('API: crear cliente sin NIT (opcional)', async ({ page }) => {
    const lr = await page.request.post(`${API}/auth/login`, { data: CREDS });
    const lb = await lr.json();
    token = lb.data.token;

    const r = await page.request.post(`${API}/customers`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: TEST_CUSTOMER.name, contact: TEST_CUSTOMER.contact },
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    createdId = body.data.id;
    expect(body.data.name).toBe(TEST_CUSTOMER.name);
    expect(body.data.nit == null).toBeTruthy(); // null o undefined cuando no se envía
    console.log('✅ Cliente creado sin NIT — ID:', createdId);
  });

  test('API: editar cliente — actualizar campos y borrar nota', async ({ page }) => {
    if (!token) {
      const lr = await page.request.post(`${API}/auth/login`, { data: CREDS });
      token = (await lr.json()).data.token;
    }

    // Primero creamos uno para editar
    const cr = await page.request.post(`${API}/customers`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `Edit Target ${TS}`, nit: '123456', note: 'nota inicial' },
    });
    const cb = await cr.json();
    const editId = cb.data.id;

    // Editamos: cambiamos nombre, borramos nota (null)
    const ur = await page.request.put(`${API}/customers/${editId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `Editado ${TS}`, note: null, contact: null },
    });
    expect(ur.ok()).toBeTruthy();
    const ub = await ur.json();
    expect(ub.data.name).toBe(`Editado ${TS}`);
    expect(ub.data.note).toBeNull();
    expect(ub.data.contact).toBeNull();
    console.log('✅ Cliente editado — nota y contacto borrados correctamente');

    // Limpiar
    await page.request.delete(`${API}/customers/${editId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test('API: crear cliente con NIT duplicado retorna error', async ({ page }) => {
    if (!token) {
      const lr = await page.request.post(`${API}/auth/login`, { data: CREDS });
      token = (await lr.json()).data.token;
    }
    const nit = `DUP${TS}`;
    await page.request.post(`${API}/customers`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `Dup A ${TS}`, nit },
    });
    const r2 = await page.request.post(`${API}/customers`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `Dup B ${TS}`, nit },
    });
    expect(r2.status()).toBeGreaterThanOrEqual(400);
    console.log('✅ NIT duplicado rechazado con status:', r2.status());
  });

  // ── UI: Flujo completo ────────────────────────────────────────────────────
  test('UI: login → navegar a clientes → abrir modal Nuevo', async ({ page }) => {
    await page.goto(`${UI}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="username"]', CREDS.username);
    await page.fill('input[name="password"]', CREDS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });

    await page.goto(`${UI}/customers`);
    await page.waitForLoadState('networkidle');

    // Buscar botón "Nuevo cliente"
    const btnNuevo = page.getByRole('button', { name: /nuevo cliente/i });
    await expect(btnNuevo).toBeVisible({ timeout: 8000 });
    await btnNuevo.click();

    // Modal debe aparecer
    await expect(page.getByText('Registrar nuevo cliente')).toBeVisible({ timeout: 5000 });
    console.log('✅ Modal de nuevo cliente abre correctamente');
  });

  test('UI: crear cliente desde el formulario', async ({ page }) => {
    await page.goto(`${UI}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="username"]', CREDS.username);
    await page.fill('input[name="password"]', CREDS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });

    await page.goto(`${UI}/customers`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /nuevo cliente/i }).click();
    await expect(page.getByText('Registrar nuevo cliente')).toBeVisible({ timeout: 5000 });

    // Llenar formulario — NIT vacío (opcional)
    const uiName = `UI Test ${TS}`;
    await page.locator('input[placeholder*="nombre completo" i]').fill(uiName);
    await page.locator('input[placeholder*="email o teléfono" i]').fill('ui@test.com');

    // Crear
    await page.getByRole('button', { name: /^crear$/i }).click();

    // Toast de éxito
    await expect(page.getByText(/cliente creado/i)).toBeVisible({ timeout: 8000 });
    console.log('✅ Cliente creado desde UI con toast de confirmación');
  });

  test('UI: editar cliente — abrir modal y cambiar nombre', async ({ page }) => {
    await page.goto(`${UI}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="username"]', CREDS.username);
    await page.fill('input[name="password"]', CREDS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });

    await page.goto(`${UI}/customers`);
    await page.waitForLoadState('networkidle');

    // Clic en primer botón de editar
    const editBtn = page.locator('button[aria-label*="ditar" i], button:has(svg.lucide-edit), [title*="ditar" i]').first();
    const fallbackEdit = page.getByRole('button').filter({ has: page.locator('svg') }).nth(1);

    const btn = (await editBtn.count()) > 0 ? editBtn : fallbackEdit;
    await btn.click();

    // Modal de edición
    await expect(page.getByText('Editar cliente')).toBeVisible({ timeout: 5000 });

    // Cambiar nombre
    const nameInput = page.locator('input[placeholder*="nombre completo" i]');
    await nameInput.clear();
    await nameInput.fill(`Editado UI ${TS}`);

    await page.locator('form').getByRole('button', { name: /actualizar/i }).click();
    await expect(page.getByText(/cliente actualizado/i)).toBeVisible({ timeout: 8000 });
    console.log('✅ Cliente editado desde UI con toast de confirmación');
  });
});
