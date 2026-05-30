(function () {
    var style = document.createElement('style');
    style.textContent =
        'body{animation:_pgIn .3s cubic-bezier(.25,.46,.45,.94) both}' +
        '@keyframes _pgIn{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}' +
        '@keyframes _pgOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(-7px)}}' +
        'body._leaving{animation:_pgOut .2s ease both;pointer-events:none}';
    document.head.appendChild(style);

    document.addEventListener('click', function (e) {
        var a = e.target.closest('a[href]');
        if (!a) return;
        var href = a.getAttribute('href');
        if (!href || href.charAt(0) === '#' ||
            href.indexOf('http') === 0 ||
            href.indexOf('javascript') === 0) return;
        e.preventDefault();
        document.body.classList.add('_leaving');
        setTimeout(function () { window.location.href = href; }, 210);
    }, true);
})();
