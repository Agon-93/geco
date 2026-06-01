// ── SUPABASE SYNC ──
var SUPA_URL = 'https://yvtczuiqlzekdjrsekyz.supabase.co';
var SUPA_KEY = 'sb_publishable_Eub8c2AXkG5t-n1-k0Amzw_nrspxuGy';
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

// Link di monitoraggio
function supaMonitorLink() {
    return 'https://agon-93.github.io/geco/index.html?monitor=' + syncCodice();
}
