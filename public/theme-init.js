(function () {
  try {
    var theme = JSON.parse(localStorage.getItem('app_theme')) || 'matcha';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    // ignore theme read errors
  }
})();
