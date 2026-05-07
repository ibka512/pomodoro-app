const CACHE_NAME = 'pomodoro-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// 安装时缓存文件
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// 运行时拦截请求，优先使用缓存（实现离线访问）
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // 命中缓存，直接返回
        }
        return fetch(event.request); // 没命中，走网络请求
      }
    )
  );
});