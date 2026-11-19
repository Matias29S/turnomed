import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

async function withServer(run) {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET /api/health responde ok', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });
});

test('una ruta inexistente devuelve 404 en JSON', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/no-existe`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.code, 'NOT_FOUND');
  });
});

test('una ruta protegida sin sesión devuelve 401', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/appointments/me`);
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.code, 'NOT_AUTHENTICATED');
  });
});

test('una ruta de administración sin sesión devuelve 401', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/admin/users`);
    assert.equal(response.status, 401);
  });
});

test('un id no numérico devuelve 400 y no llega a la base', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/doctors/abc/availability?date=2026-11-18`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
  });
});
