// ── AUTH MODULE — Supabase Auth REST API ──
var SUPA_URL      = 'https://yvtczuiqlzekdjrsekyz.supabase.co';
var SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2dGN6dWlxbHpla2RqcnNla3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyOTM1NjIsImV4cCI6MjA5NTg2OTU2Mn0.WkwhtPC3goGQReihuPGYr5I5iAKrnQGQoSkOe7Udw38';

// ── SESSION ──
function _authGetSession() {
    try { return JSON.parse(localStorage.getItem('auth_session') || 'null'); } catch(e) { return null; }
}
function _authSetSession(s) {
    if (s) localStorage.setItem('auth_session', JSON.stringify(s));
    else   localStorage.removeItem('auth_session');
}
function authGetToken()    { var s = _authGetSession(); return s ? s.access_token : null; }
function authGetUser()     { var s = _authGetSession(); return s ? (s.user || null) : null; }
function authIsLoggedIn()  {
    var s = _authGetSession();
    if (!s || !s.access_token) return false;
    if (s.expires_at && Math.floor(Date.now()/1000) > s.expires_at - 30) return false;
    return true;
}
function authGetNickname() {
    var u = authGetUser();
    if (!u) return '';
    return (u.user_metadata && u.user_metadata.nickname) || u.email.split('@')[0] || '';
}
function authGetEmail() { var u = authGetUser(); return u ? u.email : ''; }

// ── REGISTER ──
function authSignUp(email, password, nickname, callback) {
    fetch(SUPA_URL + '/auth/v1/signup', {
        method: 'POST',
        headers: { 'apikey': SUPA_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password, data: { nickname: nickname.trim() } })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.error || d.error_code) {
            callback(null, d.error_description || d.msg || d.error || 'Errore durante la registrazione');
            return;
        }
        callback({ needsVerification: true }, null);
    })
    .catch(function() { callback(null, 'Errore di rete'); });
}

// ── LOGIN ──
function authSignIn(email, password, callback) {
    fetch(SUPA_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'apikey': SUPA_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.error || d.error_code) {
            var msg = d.error_description || d.msg || d.error || 'Credenziali non valide';
            if (msg.toLowerCase().indexOf('confirm') > -1) msg = 'Verifica la tua email prima di accedere';
            callback(null, msg);
            return;
        }
        _authSetSession(d);
        _authEnsureProfile(d.access_token, d.user, function() { callback(d, null); });
    })
    .catch(function() { callback(null, 'Errore di rete'); });
}

// ── LOGOUT ──
function authSignOut(callback) {
    var token = authGetToken();
    fetch(SUPA_URL + '/auth/v1/logout', {
        method: 'POST',
        headers: { 'apikey': SUPA_ANON_KEY, 'Authorization': 'Bearer ' + (token || '') }
    }).catch(function(){}).then(function() {
        _authSetSession(null);
        if (callback) callback();
    });
}

// ── REFRESH TOKEN ──
function authRefreshToken(callback) {
    var s = _authGetSession();
    if (!s || !s.refresh_token) { callback(false); return; }
    fetch(SUPA_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'apikey': SUPA_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: s.refresh_token })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.access_token) { _authSetSession(d); callback(true); }
        else { _authSetSession(null); callback(false); }
    })
    .catch(function() { callback(false); });
}

// ── PROFILE ──
function _authCreateProfile(userId, nickname, token, callback) {
    var codice = 'g' + Date.now().toString(36) + Math.random().toString(36).substr(2,6);
    fetch(SUPA_URL + '/rest/v1/profiles', {
        method: 'POST',
        headers: {
            'apikey': SUPA_ANON_KEY, 'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json', 'Prefer': 'return=representation'
        },
        body: JSON.stringify({ id: userId, nickname: nickname, sync_codice: codice })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        var p = Array.isArray(d) ? d[0] : d;
        if (p && p.sync_codice) localStorage.setItem('syncCodice', p.sync_codice);
        if (callback) callback(p);
    })
    .catch(function() { if (callback) callback(null); });
}

function _authLoadProfile(token, callback) {
    fetch(SUPA_URL + '/rest/v1/profiles?select=*', {
        headers: { 'apikey': SUPA_ANON_KEY, 'Authorization': 'Bearer ' + token }
    })
    .then(function(r) { return r.json(); })
    .then(function(d) { callback(Array.isArray(d) && d.length > 0 ? d[0] : null); })
    .catch(function() { callback(null); });
}

function _authEnsureProfile(token, user, callback) {
    _authLoadProfile(token, function(p) {
        if (p) {
            if (p.sync_codice) localStorage.setItem('syncCodice', p.sync_codice);
            callback(p);
        } else {
            var nick = (user && user.user_metadata && user.user_metadata.nickname)
                    || (user && user.email.split('@')[0]) || 'Utente';
            _authCreateProfile(user.id, nick, token, callback);
        }
    });
}

// ── HANDLE EMAIL VERIFICATION REDIRECT ──
function authHandleRedirect(callback) {
    var hash = window.location.hash;
    if (!hash || hash.indexOf('access_token') === -1) { callback(false); return; }
    var params       = new URLSearchParams(hash.substring(1));
    var accessToken  = params.get('access_token');
    var refreshToken = params.get('refresh_token');
    var expiresIn    = parseInt(params.get('expires_in') || '3600');
    if (!accessToken) { callback(false); return; }
    fetch(SUPA_URL + '/auth/v1/user', {
        headers: { 'apikey': SUPA_ANON_KEY, 'Authorization': 'Bearer ' + accessToken }
    })
    .then(function(r) { return r.json(); })
    .then(function(user) {
        _authSetSession({
            access_token: accessToken, refresh_token: refreshToken,
            expires_at: Math.floor(Date.now()/1000) + expiresIn, user: user
        });
        _authEnsureProfile(accessToken, user, function() { callback(true); });
    })
    .catch(function() { callback(false); });
}

// ── AUTH GUARD — skip se in monitor (co-gestione) ──
function authGuard(onReady) {
    // Co-gestione: l'amico non ha account, bypassa il guard
    var monitorParam = new URLSearchParams(location.search).get('monitor');
    var monitorCodice = monitorParam || localStorage.getItem('coGestioneCodice');
    if (monitorCodice) { if (onReady) onReady(); return; }

    if (!_authGetSession()) { window.location.href = 'login.html'; return; }
    if (!authIsLoggedIn()) {
        authRefreshToken(function(ok) {
            if (!ok) { window.location.href = 'login.html'; return; }
            var s = _authGetSession();
            _authEnsureProfile(s.access_token, s.user, function() { if (onReady) onReady(); });
        });
    } else {
        if (onReady) onReady();
    }
}

// ── WIDGET UTENTE (top-right) ──
function authRenderWidget() {
    var header = document.querySelector('header');
    if (!header) return;
    // Non mostrare in monitor mode
    var monitorParam = new URLSearchParams(location.search).get('monitor');
    if (monitorParam || localStorage.getItem('coGestioneCodice')) return;

    var existing = document.getElementById('auth-widget');
    if (existing) existing.remove();
    var oldSheet = document.getElementById('auth-sheet');
    if (oldSheet) oldSheet.remove();

    var nick    = authGetNickname();
    var email   = authGetEmail();
    var initial = nick ? nick[0].toUpperCase() : '?';

    var btn = document.createElement('div');
    btn.id = 'auth-widget';
    btn.style.cssText = 'width:34px;height:34px;border-radius:50%;background:rgba(255,153,64,.15);border:2px solid rgba(255,153,64,.4);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#ff9940;cursor:pointer;flex-shrink:0;';
    btn.textContent = initial;

    var sheet = document.createElement('div');
    sheet.id = 'auth-sheet';
    sheet.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;';
    sheet.innerHTML =
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,.65);" id="auth-sheet-bg"></div>' +
        '<div style="position:absolute;bottom:0;left:0;right:0;background:#1a1a1a;border-radius:22px 22px 0 0;padding:28px 20px calc(24px + env(safe-area-inset-bottom));max-width:500px;left:50%;transform:translateX(-50%);">' +
            '<div style="text-align:center;margin-bottom:24px;">' +
                '<div style="width:64px;height:64px;border-radius:50%;background:rgba(255,153,64,.15);border:3px solid rgba(255,153,64,.4);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#ff9940;margin:0 auto 12px;">' + initial + '</div>' +
                '<div style="font-size:18px;font-weight:800;color:#f0f0f0;">' + nick + '</div>' +
                '<div style="font-size:12px;color:#666;margin-top:4px;">' + email + '</div>' +
            '</div>' +
            '<button id="auth-logout-btn" style="width:100%;background:#1e0808;border:1px solid rgba(239,68,68,.3);color:#ef4444;border-radius:14px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;">Logout</button>' +
        '</div>';
    document.body.appendChild(sheet);
    document.getElementById('auth-sheet-bg').onclick = function() { sheet.style.display = 'none'; };
    document.getElementById('auth-logout-btn').onclick = function() {
        authSignOut(function() { window.location.href = 'login.html'; });
    };
    btn.onclick = function() { sheet.style.display = 'block'; };
    header.appendChild(btn);
}
