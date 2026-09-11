const CACHE_NAME="wtg-shell-0.1H9g";
const APP_SHELL=[
  "./","./index.html","./app.html","./manifest.webmanifest",
  "./icons/wtg-180.png","./icons/wtg-192.png","./icons/wtg-512.png","./icons/wtg-maskable-512.png",
  "./wtg-header-art.png","./wtg-stadium-bg.png","./wtg-mlb-streaming-patch.js","./wtg-multichannel-patch.js",
  "./wtg-player-interface-patch.js","./wtg-gender-tags-patch.js","./wtg-gold-channel-patch.js","./wtg-rugby-display-patch.js"
];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy))}
    return response;
  }).catch(async()=>{
    const cached=await caches.match(event.request,{ignoreSearch:true});
    if(cached)return cached;
    if(event.request.mode==="navigate")return caches.match("./index.html");
    return Response.error();
  }));
});
