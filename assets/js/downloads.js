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

/* История версий (changelog) — показывает последние релизы репозитория */
(function () {
  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    } catch (e) { return ""; }
  }

  function renderChangelog(el, repo) {
    fetch("https://api.github.com/repos/" + repo + "/releases?per_page=6", {
      headers: { Accept: "application/vnd.github+json" }
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (list) {
      if (!list.length) {
        el.innerHTML = '<li class="changelog-empty">Релизов пока нет</li>';
        return;
      }
      el.innerHTML = list.map(function (r) {
        var date = formatDate(r.published_at || r.created_at);
        return '<li><span class="changelog-tag">' + r.tag_name + '</span>' +
               (date ? '<span class="changelog-date">' + date + '</span>' : '') + '</li>';
      }).join("");
    }).catch(function () {
      el.innerHTML = '<li class="changelog-empty">Не удалось загрузить историю версий</li>';
    });
  }

  document.querySelectorAll(".changelog-list[data-repo]").forEach(function (el) {
    renderChangelog(el, el.getAttribute("data-repo"));
  });
})();

/* Описание из README — подтягивает вступительный абзац README.md репозитория.
   Обновите README на GitHub, и текст на сайте обновится сам при следующем
   визите (кэш на 10 минут в рамках вкладки браузера). Если во вступительном
   абзаце нет пригодного для показа текста (пусто, не на русском, только
   список/таблица/цитата) — карточка на странице просто скрывается, ничего
   не ломается и не висит пустым местом. */
(function () {
  "use strict";

  var TTL_OK = 10 * 60 * 1000;
  var TTL_MISS = 5 * 60 * 1000;
  var TIMEOUT = 7000;
  var MAX_LEN = 320;
  var BRANCHES = ["main", "master"];

  function cacheKey(repo) { return "neuro_readme_" + repo; }

  function readCache(repo) {
    try {
      var raw = sessionStorage.getItem(cacheKey(repo));
      if (!raw) return undefined;
      var data = JSON.parse(raw);
      return Date.now() > data.expires ? undefined : data.value;
    } catch (e) { return undefined; }
  }

  function writeCache(repo, value, ttl) {
    try {
      sessionStorage.setItem(cacheKey(repo), JSON.stringify({ value: value, expires: Date.now() + ttl }));
    } catch (e) { /* storage unavailable — degrade silently */ }
  }

  function isNoiseLine(line) {
    var t = line.trim();
    if (t === "") return true;
    if (/^<!--/.test(t)) return true;
    if (/^(\[!\[|!\[)/.test(t)) return true; // badges / изображения
    var withoutTags = t.replace(/<[^>]+>/g, "").trim();
    if (/^</.test(t) && withoutTags === "") return true; // строка — только HTML-теги
    return false;
  }

  function isBalanced(s) {
    var pairs = { "(": ")", "[": "]", "«": "»" };
    var stack = [];
    for (var k = 0; k < s.length; k++) {
      var ch = s[k];
      if (pairs[ch]) stack.push(pairs[ch]);
      else if (ch === ")" || ch === "]" || ch === "»") {
        if (!stack.length || stack[stack.length - 1] !== ch) return false;
        stack.pop();
      }
    }
    return stack.length === 0;
  }

  function trimToSentence(s, maxLen) {
    if (s.length <= maxLen) return s;
    var cut = s.slice(0, maxLen);
    var lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    if (lastStop > maxLen * 0.4) {
      var head = cut.slice(0, lastStop + 1);
      return isBalanced(head) ? head : head.replace(/\([^)]*$/, "").trim();
    }
    var safe = -1;
    for (var pos = cut.lastIndexOf(" "); pos > 0; pos = cut.lastIndexOf(" ", pos - 1)) {
      if (isBalanced(cut.slice(0, pos))) { safe = pos; break; }
    }
    var trimmed = safe > 0 ? cut.slice(0, safe) : cut;
    return trimmed.replace(/[,;:—-]+$/, "") + "…";
  }

  function cleanMarkdown(s) {
    return s
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function looksRussian(s) {
    var cyr = (s.match(/[а-яё]/gi) || []).length;
    var lat = (s.match(/[a-z]/gi) || []).length;
    return cyr > lat;
  }

  function extractDescription(markdown) {
    if (!markdown) return null;
    var lines = markdown.replace(/\r\n/g, "\n").split("\n");
    var i = 0;

    if (lines[0] === "---") {
      var end = lines.indexOf("---", 1);
      if (end !== -1) i = end + 1;
    }

    var titleIdx = -1;
    for (; i < lines.length; i++) {
      if (/^#{1,2}\s+/.test(lines[i])) { titleIdx = i; i++; break; }
      if (!isNoiseLine(lines[i])) break;
    }
    if (titleIdx === -1) return null;

    while (i < lines.length && isNoiseLine(lines[i])) i++;
    if (i >= lines.length || /^#{1,6}\s+/.test(lines[i])) return null;

    var buf = [];
    for (; i < lines.length; i++) {
      var line = lines[i];
      if (line.trim() === "") break;
      if (/^#{1,6}\s+/.test(line)) break;
      if (/^(---+|===+|\*\*\*+)\s*$/.test(line.trim())) break;
      if (/^(>|\||```|-\s|\*\s|\d+\.\s)/.test(line.trim())) break;
      buf.push(line.trim());
    }

    var text = buf.join(" ").trim();
    if (!text) return null;
    if (!looksRussian(text)) return null;

    text = cleanMarkdown(text);
    text = trimToSentence(text, MAX_LEN);
    return text || null;
  }

  function fetchReadme(repo, branchIndex) {
    branchIndex = branchIndex || 0;
    if (branchIndex >= BRANCHES.length) return Promise.resolve(null);

    var controller = ("AbortController" in window) ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT) : null;
    var url = "https://raw.githubusercontent.com/" + repo + "/" + BRANCHES[branchIndex] + "/README.md";

    return fetch(url, { signal: controller ? controller.signal : undefined }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) return fetchReadme(repo, branchIndex + 1);
      return res.text();
    }).catch(function () {
      if (timer) clearTimeout(timer);
      return branchIndex + 1 < BRANCHES.length ? fetchReadme(repo, branchIndex + 1) : null;
    });
  }

  function loadDescription(repo) {
    var cached = readCache(repo);
    if (cached !== undefined) return Promise.resolve(cached);

    return fetchReadme(repo).then(function (markdown) {
      var desc = extractDescription(markdown);
      writeCache(repo, desc, desc ? TTL_OK : TTL_MISS);
      return desc;
    });
  }

  document.querySelectorAll(".readme-desc[data-repo]").forEach(function (el) {
    var repo = el.getAttribute("data-repo");
    var card = el.closest(".side-card") || el;
    var hadFallbackText = el.textContent.trim().length > 0;
    loadDescription(repo).then(function (desc) {
      if (!desc) {
        if (!hadFallbackText) card.style.display = "none";
        return; // README не дал пригодного текста — оставляем то, что уже на странице
      }
      el.textContent = desc;
    });
  });
})();
