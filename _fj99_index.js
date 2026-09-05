if (document.documentMode === 10) {
    document.documentElement.className += 'ie10';
}

if (document.documentMode === 11) {
    document.documentElement.className += 'ie11';
}

function saveFn(callback) {
    window.callback = callback;
    window.save();
}

function prevFn() {
    window.prev();
}

var _czc = _czc || [];
(function () {
    var um = document.createElement("script");
    um.src = "https://s4.cnzz.com/z.js?id=1281304093&async=1";
    var s = document.getElementsByTagName("script")[0];
    s.parentNode.insertBefore(um, s);
})();
