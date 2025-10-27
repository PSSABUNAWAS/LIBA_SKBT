// Service Worker untuk LIBA v2.0 (offline cache-first)
const CACHE_NAME = 'liba-v2-cache';
const ASSETS = [
  './',
  './index.html',
  './liba.css',
  './app.js',
  './manifest.json',
  './icons/logo1.png',
  './icons/logo2.png',
  './icons/logo3.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
