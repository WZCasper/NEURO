/* NEURO — dynamic downloads.
   Reads the latest GitHub release for each program directly from the
   GitHub REST API and wires the "Скачать" buttons to the real asset.
   No hand-maintained links: publish a release on GitHub and the button
   updates itself for every visitor. */
(function () {
  "use strict";

  var TTL_OK = 10 * 60 * 1000;
  var TTL_MISS = 5 * 60 * 1000;
  var TIMEOUT = 7000;

  function formatSize(bytes) {
    if (!bytes) return "";
    var mb = bytes / (1024 * 1024);
    return mb >= 1 ? mb.toFixed(1).replace(/\.0$/, "") + " МБ" : Math.max(1, Math.round(bytes / 1024)) + " КБ";
  }

  function pickAsset(assets) {
    if (!assets || !assets.length) return null;
    var find = function (re) { return assets.filter(function (a) { return re.test(a.name); })[0]; };
    return find(/setup.*\.exe$/i) || find(/\.exe$/i) || find(/\.msi$/i) || find(/\.zip$/i) || assets[0];
  }

  function cacheKey(repo) { return "neuro_release_" + repo; }

  function readCache(repo) {
    try {
      var raw = sessionStorage.getItem(cacheKey(repo));
      if (!raw) return null;
      var data = JSON.parse(raw);
      return Date.now() > data.expires ? null : data.value;
    } catch (e) { return null; }
  }

  function writeCache(repo, value, ttl) {
    try {
      sessionStorage.setItem(cacheKey(repo), JSON.stringify({ value: value, expires: Date.now() + ttl }));
    } catch (e) { /* storage unavailable — degrade silently */ }
  }

  function fetchLatest(repo) {
    var cached = readCache(repo);
    if (cached) return Promise.resolve(cached);

    var controller = ("AbortController" in window) ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT) : null;

    return fetch("https://api.github.com/repos/" + repo + "/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (res.status === 404) {
        var none = { state: "none" };
        writeCache(repo, none, TTL_MISS);
        return none;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json().then(function (data) {
        var asset = pickAsset(data.assets);
        var ready = {
          state: "ready",
          tag: data.tag_name,
          url: asset ? asset.browser_download_url : data.html_url,
          isFile: !!asset,
          size: asset ? asset.size : null
        };
        writeCache(repo, ready, TTL_OK);
        return ready;
      });
    }).catch(function () {
      if (timer) clearTimeout(timer);
      var fallback = { state: "fallback" };
      writeCache(repo, fallback, TTL_MISS);
      return fallback;
    });
  }

  function setSoon(el) {
    el.classList.remove("btn-primary", "btn-loading");
    el.classList.add("btn-soon");
    el.removeAttribute("href");
    el.removeAttribute("aria-busy");
    el.setAttribute("aria-disabled", "true");
    var label = el.querySelector(".js-download-label");
    if (label) label.textContent = "Скоро";
    var meta = el.parentElement && el.parentElement.querySelector(".dl-meta");
    if (meta) meta.textContent = "В разработке — дата выхода будет объявлена в Telegram";
  }

  function setFallback(el, repo) {
    el.classList.remove("btn-loading");
    el.removeAttribute("aria-busy");
    el.setAttribute("href", "https://github.com/" + repo + "/releases");
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener");
    var label = el.querySelector(".js-download-label");
    if (label) label.textContent = "Скачать на GitHub";
  }

  function setReady(el, info) {
    el.classList.remove("btn-loading");
    el.removeAttribute("aria-busy");
    el.removeAttribute("aria-disabled");
    el.setAttribute("href", info.url);
    if (info.isFile) {
      el.removeAttribute("target");
      el.removeAttribute("rel");
    } else {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener");
    }
    var label = el.querySelector(".js-download-label");
    if (label) label.textContent = "Скачать" + (info.size ? " · " + formatSize(info.size) : "");
    var meta = el.parentElement && el.parentElement.querySelector(".dl-meta");
    if (meta) meta.textContent = "Версия " + info.tag + (info.size ? " · " + formatSize(info.size) : "");
  }

  document.querySelectorAll(".js-download[data-repo]").forEach(function (el) {
    var repo = el.getAttribute("data-repo");
    fetchLatest(repo).then(function (info) {
      if (info.state === "none") return setSoon(el);
      if (info.state === "fallback") return setFallback(el, repo);
      setReady(el, info);
    });
  });
})();
