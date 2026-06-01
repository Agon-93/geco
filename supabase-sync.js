// ── SUPABASE SYNC — fetch diretto, nessuna libreria ──
var SUPA_URL = 'https://yvtczuiqlzekdjrsekyz.supabase.co';
var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2dGN6dWlxbHpla2RqcnNla3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyOTM1NjIsImV4cCI6MjA5NTg2OTU2Mn0.WkwhtPC3goGQReihuPGYr5I5iAKrnQGQoSkOe7Udw38';

var _activeSyncCodice = null;
function setSyncCodice(c) { _activeSyncCodice = c; }

function syncCodice() {
    if (_activeSyncCodice) return _activeSyncCodice;
    var c = localStorage.getItem('syncCodice');
    if (!c) {
        c = 'g' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
        localStorage.setItem('syncCodice', c);
    }
    return c;
}

function supaHeaders() {
    return {
        'apikey':        SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type':  'application/json',
        'Prefer':        'resolution=merge-duplicates'
    };
}

// Sincronizza gechi, note, galleria e TUTTI i pasti
function supaSync() {
    var geckos = [];
    try { geckos = JSON.parse(localStorage.getItem('geckos') || '[]'); } catch(e) {}

    var galleria = {};
    geckos.forEach(function(g) {
        var key  = 'gallery_' + g.id;
        var data = localStorage.getItem(key);
        if (data) try { galleria[key] = JSON.parse(data); } catch(e) {}
    });

    var codice = syncCodice();

    // Sync geckos + note + galleria
    fetch(SUPA_URL + '/rest/v1/sync_data', {
        method:  'POST',
        headers: supaHeaders(),
        body:    JSON.stringify({
            codice:     codice,
            geckos:     geckos,
            nota:       localStorage.getItem('gecoNotes') || '',
            galleria:   galleria,
            aggiornato: new Date().toISOString()
        })
    }).catch(function(){});

    // Sync TUTTI i pasti dal localStorage
    var pasti = [];
    for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('feed_') === 0 && localStorage.getItem(k) === 'true') {
            pasti.push({ codice: codice, chiave: k.substring(5), fatto: true });
        }
    }
    if (pasti.length > 0) {
        fetch(SUPA_URL + '/rest/v1/sync_pasti?on_conflict=codice,chiave', {
            method:  'POST',
            headers: supaHeaders(),
            body:    JSON.stringify(pasti)
        }).catch(function(){});
    }
}

// Sincronizza singolo pasto
function supaSyncPasto(geckoId, mese, giorno, fatto) {
    var body = JSON.stringify({
        codice: syncCodice(),
        chiave: geckoId + '_' + mese + '_' + giorno,
        fatto:  !!fatto
    });
    fetch(SUPA_URL + '/rest/v1/sync_pasti', {
        method:  'POST',
        headers: supaHeaders(),
        body:    body
    }).catch(function(){});
}

// Legge dati di un altro utente (monitor/co-gestione)
function supaLeggi(codice, callback) {
    var h = { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY, 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };
    var t = '&_t=' + Date.now(); // cache buster
    Promise.all([
        fetch(SUPA_URL + '/rest/v1/sync_data?codice=eq.' + encodeURIComponent(codice) + '&limit=1' + t, { headers: h, cache: 'no-store' })
            .then(function(r){ return r.json(); }),
        fetch(SUPA_URL + '/rest/v1/sync_pasti?codice=eq.' + encodeURIComponent(codice) + t, { headers: h, cache: 'no-store' })
            .then(function(r){ return r.json(); })
    ]).then(function(results) {
        callback(results[0][0] || null, results[1] || []);
    }).catch(function() { callback(null, []); });
}

// Link co-gestione
function supaMonitorLink() {
    return 'https://agon-93.github.io/geco/index.html?monitor=' + syncCodice();
}

// Ripristina tutti i dati da Supabase
function supaRipristina(codice, onSuccess, onError) {
    supaLeggi(codice, function(data, pasti) {
        if (!data) { if (onError) onError('Codice non trovato'); return; }
        localStorage.setItem('geckos', JSON.stringify(data.geckos || []));
        if (data.nota) localStorage.setItem('gecoNotes', data.nota);
        pasti.forEach(function(p) {
            if (p.fatto) localStorage.setItem('feed_' + p.chiave, 'true');
        });
        var geckos = data.geckos || [];
        if (geckos.length > 0 && !localStorage.getItem('activeGeckoId')) {
            localStorage.setItem('activeGeckoId', geckos[0].id);
            if (geckos[0].colore) localStorage.setItem('activeColor', geckos[0].colore);
        }
        localStorage.setItem('syncCodice', codice);
        if (onSuccess) onSuccess(geckos.length);
    });
}
