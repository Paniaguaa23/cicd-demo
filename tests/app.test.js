'use strict';

const request = require('supertest');
const { crearApp } = require('../src/app');

describe('Aplicación de demostración CI/CD', () => {
  const app = crearApp();

  test('GET /health responde 200 con estado ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ok');
  });

  test('GET /api/info devuelve versión y entorno', async () => {
    const res = await request(app).get('/api/info');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('entorno');
    expect(typeof res.body.mensaje).toBe('string');
  });

  test('GET /api/tareas devuelve una lista', async () => {
    const res = await request(app).get('/api/tareas');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('POST /api/tareas crea una tarea válida', async () => {
    const res = await request(app).post('/api/tareas').send({ titulo: 'Probar el rollback' });
    expect(res.status).toBe(201);
    expect(res.body.titulo).toBe('Probar el rollback');
    expect(res.body.hecha).toBe(false);
  });

  test('POST /api/tareas rechaza un título vacío', async () => {
    const res = await request(app).post('/api/tareas').send({ titulo: '   ' });
    expect(res.status).toBe(400);
  });

  test('GET / muestra la página principal en HTML', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('Versión desplegada');
  });
});
