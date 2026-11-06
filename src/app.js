'use strict';

const express = require('express');

// Datos que el pipeline inyecta en la imagen al construirla.
const APP_VERSION = process.env.APP_VERSION || 'local';
const APP_ENV = process.env.APP_ENV || 'desarrollo';
const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();

// Cambiar este mensaje (y hacer push) es la demostración práctica.
const MENSAJE = 'Hola UNICAES - Exposición Cómputo en la Nube';

// Lista de tareas en memoria: suficiente para probar una API real.
const tareas = [
  { id: 1, titulo: 'Crear el repositorio', hecha: true },
  { id: 2, titulo: 'Configurar GitHub Actions', hecha: true },
  { id: 3, titulo: 'Desplegar en ECS Fargate', hecha: false }
];

// Evita inyección de HTML con los títulos que envían los usuarios.
function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function crearApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ estado: 'ok', version: APP_VERSION });
  });

  app.get('/api/info', (_req, res) => {
    res.json({ version: APP_VERSION, entorno: APP_ENV, construida: BUILD_TIME, mensaje: MENSAJE });
  });

  app.get('/api/tareas', (_req, res) => {
    res.json(tareas);
  });

  app.post('/api/tareas', (req, res) => {
    const titulo = typeof req.body?.titulo === 'string' ? req.body.titulo.trim() : '';
    if (!titulo) {
      return res.status(400).json({ error: 'El campo "titulo" es obligatorio' });
    }
    const nueva = { id: tareas.length + 1, titulo, hecha: false };
    tareas.push(nueva);
    return res.status(201).json(nueva);
  });

  app.get('/', (_req, res) => {
    const colorEntorno = APP_ENV === 'demo' ? '#1b7f4b' : APP_ENV === 'staging' ? '#b26a00' : '#4a5568';
    res.type('html').send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Demo CI/CD · UNICAES</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #f4f6f8; color: #1a202c; }
    header { background: ${colorEntorno}; color: #fff; padding: 24px 16px; }
    main { max-width: 720px; margin: 24px auto; padding: 0 16px; }
    .card { background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.08); margin-bottom: 16px; }
    code { background: #edf2f7; padding: 2px 6px; border-radius: 4px; }
    li.hecha { text-decoration: line-through; color: #718096; }
  </style>
</head>
<body>
  <header>
    <h1 style="margin:0">${MENSAJE}</h1>
    <p style="margin:8px 0 0">Entorno: <strong>${APP_ENV}</strong></p>
  </header>
  <main>
    <div class="card">
      <p>Versión desplegada: <code>${APP_VERSION}</code></p>
      <p>Imagen construida: <code>${BUILD_TIME}</code></p>
    </div>
    <div class="card">
      <h2>Tareas del proyecto</h2>
      <ul>${tareas.map((t) => `<li class="${t.hecha ? 'hecha' : ''}">${escaparHtml(t.titulo)}</li>`).join('')}</ul>
    </div>
  </main>
</body>
</html>`);
  });

  return app;
}

module.exports = { crearApp, MENSAJE };
