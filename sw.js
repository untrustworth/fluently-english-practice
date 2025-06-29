const CACHE_NAME = 'english-learning-app-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/speech.js',
  '/js/api.js',
  '/js/storage.js',
  '/manifest.json',
  '/assets/Fluently.png',
  '/assets/icons/FluentlyIcon_192.png',
  '/assets/icons/FluentlyIcon_512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});