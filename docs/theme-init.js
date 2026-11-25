(function () {
  var theme = "light";
  try {
    var saved = localStorage.getItem("faith-theme");
    if (saved === "dark" || saved === "light") {
      theme = saved;
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      theme = "dark";
    }
  } catch (error) {
    theme = "light";
  }
  document.documentElement.dataset.theme = theme;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#1b1814" : "#f4efe4";
})();
