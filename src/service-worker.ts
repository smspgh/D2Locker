// eslint-disable-next-line spaced-comment
/// <reference lib="webworker" />

import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

// Explicitly type `self` as ServiceWorkerGlobalScope for correct type inference
const globalWorker = self as unknown as ServiceWorkerGlobalScope;

// --- Declare the global variables injected by Workbox ---
declare global {
  interface ServiceWorkerGlobalScope {
    __WB_MANIFEST: any[];
    __precacheManifest: any[];
  }
}

// Use globalWorker.__WB_MANIFEST which is injected by Workbox plugin
// The next line contains self.__WB_MANIFEST for Workbox plugin detection
// @ts-expect-error - self.__WB_MANIFEST is injected by Workbox at build time
precacheAndRoute(globalWorker.__WB_MANIFEST || self.__WB_MANIFEST, {});
cleanupOutdatedCaches();

// Once this activates, start handling requests through the service worker immediately.
// No need to wait for a refresh.
clientsClaim();

registerRoute(
  /https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
  new CacheFirst({
    cacheName: 'googleapis',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, purgeOnQuotaError: false }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  'GET',
);

// Since we're a single page app, route all navigation to /index.html
const handler = createHandlerBoundToURL(`${$PUBLIC_PATH}index.html`);
const navigationRoute = new NavigationRoute(handler, {
  // These have their own pages (return.html)
  // This regex matches on query string too, so no anchors!
  denylist: [
    /return\.html/,
    /backup\.html/,
    /\.well-known/,
    /\.(php|json|wasm|js|css|png|jpg|map)(\.(gz|br))?$/,
    /\/data\/d1\/manifests\//,
  ],
});
registerRoute(navigationRoute);

// Skip waiting automatically when a new service worker is installed
self.addEventListener('install', () => {
  globalWorker.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (!event.data) {
    return;
  }

  switch (event.data) {
    case 'skipWaiting':

      globalWorker.skipWaiting();
      break;
    default:
      // NOOP
      break;
  }
});
