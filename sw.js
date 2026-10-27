// Service worker: shows a phone notification (each with its own tag, so several stay stacked instead of replacing each other) when the other person sends a heart, and opens the app when it's tapped.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{}}catch(err){d={body:e.data&&e.data.text()}}
  e.waitUntil(self.registration.showNotification(d.title||'Hasta pronto',{body:d.body||'',tag:(d.tag||'tap')+'-'+Date.now(),icon:'icon-192.png',badge:'icon-192.png',data:{url:'./'}}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    for(const c of cs)if('focus' in c)return c.focus();
    return self.clients.openWindow('./');
  }));
});
// Always fetch the page itself fresh, so a new version shows the next time the app opens
// instead of waiting out GitHub Pages' 10-minute cache. Falls back to the normal fetch when offline.
self.addEventListener('fetch',e=>{
  if(e.request.mode!=='navigate')return;
  e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>fetch(e.request)));
});
