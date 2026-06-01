const CACHE = 'geco-v56';
const ASSETS = [
    './index.html', './calendario.html', './note.html',
    './notifiche.html', './profili.html', './riproduzione.html',
    './galleria.html', './scheda.html', './impostazioni.html',
    './transitions.js', './manifest.json', './icon.svg'
];

// Installa — non blocca se mancano file opzionali
self.addEventListener('install', function(e) {
    e.waitUntil(
        caches.open(CACHE).then(function(c) {
            return Promise.all(ASSETS.map(function(url) {
                return c.add(url).catch(function() {});
            }));
        })
    );
    self.skipWaiting();
});

// Attiva — pulisce cache vecchie
self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(keys.filter(function(k) {
                return k !== CACHE;
            }).map(function(k) { return caches.delete(k); }));
        }).then(function() { return self.clients.claim(); })
    );
});

// Fetch — navigazione va SEMPRE alla rete, assets usano cache
self.addEventListener('fetch', function(e) {
    // Richieste di navigazione (click su link): rete diretta
    if (e.request.mode === 'navigate') {
        e.respondWith(
            fetch(e.request).catch(function() {
                return caches.match('./index.html');
            })
        );
        return;
    }
    // Tutto il resto: cache prima, poi rete
    e.respondWith(
        caches.match(e.request).then(function(r) {
            return r || fetch(e.request).catch(function() {});
        })
    );
});

// Notifiche
var _notifTimer = null;
self.addEventListener('message', function(event) {
    if (!event.data) return;
    if (event.data.type === 'SCHEDULE_NOTIFICATION') {
        if (_notifTimer) clearTimeout(_notifTimer);
        var delay = event.data.delay;
        var title = event.data.title;
        var body  = event.data.body;
        _notifTimer = setTimeout(function() {
            self.registration.showNotification(title, {
                body: body, icon: './icon.svg', badge: './icon.svg',
                tag: 'geco-pasto', renotify: true, vibrate: [200,100,200]
            });
        }, delay);
    }
    if (event.data.type === 'CANCEL_NOTIFICATION') {
        if (_notifTimer) { clearTimeout(_notifTimer); _notifTimer = null; }
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type:'window', includeUncontrolled:true }).then(function(wins) {
            if (wins.length > 0) { wins[0].navigate('./calendario.html'); return wins[0].focus(); }
            return clients.openWindow('./calendario.html');
        })
    );
});
