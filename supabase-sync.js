// ── SUPABASE SYNC ──
var SUPA_URL = 'https://yvtczuiqlzekdjrsekyz.supabase.co';
var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2dGN6dWlxbHpla2RqcnNla3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyOTM1NjIsImV4cCI6MjA5NTg2OTU2Mn0.WkwhtPC3goGQReihuPGYr5I5iAKrnQGQoSkOe7Udw38';
var _supa = null;

function supaClient() {
    if (!_supa && window.supabase) {
        _supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    }
    return _supa;
}

// Codice univoco dell'utente (può essere sovrascritto in co-gestione)
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

// Sincronizza gechi e note
function supaSync() {
    var sb = supaClient();
    if (!sb) return;
    var geckos = [];
    try { geckos = JSON.parse(localStorage.getItem('geckos') || '[]'); } catch(e) {}
    sb.from('sync_data').upsert({
        codice:     syncCodice(),
        geckos:     geckos,
        nota:       localStorage.getItem('gecoNotes') || '',
        aggiornato: new Date().toISOString()
    });
}

// Sincronizza singolo pasto
function supaSyncPasto(geckoId, mese, giorno, fatto) {
    var sb = supaClient();
    if (!sb) return;
    sb.from('sync_pasti').upsert({
        codice: syncCodice(),
        chiave: geckoId + '_' + mese + '_' + giorno,
        fatto:  !!fatto
    });
}

// Link di co-gestione
function supaMonitorLink() {
    return 'https://agon-93.github.io/geco/index.html?monitor=' + syncCodice();
}

// Ripristina tutti i dati da Supabase dato un codice
function supaRipristina(codice, onSuccess, onError) {
    var sb = supaClient();
    if (!sb) { if (onError) onError('Connessione non disponibile'); return; }

    Promise.all([
        sb.from('sync_data').select('*').eq('codice', codice).single(),
        sb.from('sync_pasti').select('*').eq('codice', codice)
    ]).then(function(results) {
        var dataRes  = results[0];
        var pastiRes = results[1];

        if (!dataRes.data) {
            if (onError) onError('Codice non trovato — controlla di averlo inserito correttamente.');
            return;
        }

        // Ripristina gechi e note
        localStorage.setItem('geckos', JSON.stringify(dataRes.data.geckos || []));
        if (dataRes.data.nota) localStorage.setItem('gecoNotes', dataRes.data.nota);

        // Ripristina pasti
        if (pastiRes.data) {
            pastiRes.data.forEach(function(p) {
                if (p.fatto) {
                    localStorage.setItem('feed_' + p.chiave, 'true');
                }
            });
        }

        // Imposta geco attivo
        var geckos = dataRes.data.geckos || [];
        if (geckos.length > 0 && !localStorage.getItem('activeGeckoId')) {
            localStorage.setItem('activeGeckoId', geckos[0].id);
            if (geckos[0].colore) localStorage.setItem('activeColor', geckos[0].colore);
        }

        // Salva il codice per sync futuro
        localStorage.setItem('syncCodice', codice);

        if (onSuccess) onSuccess(geckos.length);
    }).catch(function(e) {
        if (onError) onError('Errore di connessione');
    });
}
