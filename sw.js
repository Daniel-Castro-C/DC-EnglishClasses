// The portal is online-first: let the browser handle requests directly.
// Do not intercept authentication, CDN, navigation or download requests.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
