(function () {
    let franken = localStorage.__FRANKEN__
        ? JSON.parse(localStorage.__FRANKEN__)
        : { mode: 'light' };

    if (franken.mode === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    localStorage.__FRANKEN__ = JSON.stringify(franken);
})();
