// Service worker mínimo — necessário para o navegador permitir "instalar" o portal
// como app no celular. Não faz cache agressivo, só repassa as requisições.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
