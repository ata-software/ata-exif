// ATA EXIF Service Worker for PWA Installation
const CACHE_NAME = 'ata-exif-v8';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass through fetch
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
