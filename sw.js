const CACHE_NAME = 'pomodoro-dynamic-cache';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// ------ 辅助函数：比较两个 Response 的文本是否相同 ------
async function responsesMatch(cachedRes, networkRes) {
  if (!cachedRes || !networkRes) return false;
  const cachedClone = cachedRes.clone();
  const networkClone = networkRes.clone();
  const cachedText = await cachedClone.text();
  const networkText = await networkClone.text();
  return cachedText === networkText;
}

// ------ 安装：缓存必需文件 ------
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// ------ 拦截请求，后台检测 index.html 变化 ------
self.addEventListener('fetch', event => {
  const requestURL = new URL(event.request.url);

  // 只对 index.html 做智能检测
  if (requestURL.pathname.endsWith('/') || requestURL.pathname.endsWith('/index.html')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cachedResponse = await cache.match(event.request);
        const networkResponsePromise = fetch(event.request);

        // 每次访问时，后台悄悄取回最新 index.html 并更新缓存
        event.waitUntil(
          networkResponsePromise.then(async networkResponse => {
            if (networkResponse && networkResponse.ok) {
              // 如果内容发生变化，通知所有客户端
              const hasChanged = !(await responsesMatch(cachedResponse, networkResponse));
              cache.put(event.request, networkResponse.clone());

              if (hasChanged) {
                const clients = await self.clients.matchAll();
                clients.forEach(client => {
                  client.postMessage({ type: 'UPDATE_AVAILABLE' });
                });
              }
            }
          }).catch(() => {})
        );

        // 立即返回缓存（如果没有缓存，则等网络）
        return cachedResponse || networkResponsePromise;
      })
    );
  } else {
    // 其他文件：使用已有缓存，同时后台更新
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => {});
        return cachedResponse || fetchPromise;
      })
    );
  }
});

// ------ 接受“跳过等待”指令，然后立即激活新版本 ------
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ------ 激活时自动清理不属于当前缓存的旧资源 ------
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});