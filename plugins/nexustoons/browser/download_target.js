(function () {
  try {
    var SITE_BASE_URL = "https://nexustoons.com";
    var CRYPTO_KEYS = [
      "ee47fe201c45929db9c9a9212d9c38571965a43326323d63a48f60ac29afebd6",
      "e68082cdd86e5f59365c31e53259327623c393b752cd79f5ebf4a6c01ce5daa5",
      "e2bc4ff2ef9c3713b124114e7f7f87a2e14657faaccc9edcd077e6f4073c4773",
      "771bd0234efb5cec754b953e3678e0d6b2552dedf387328e9d7600dac151b649",
      "d6cd99f678b363376b4c722cc3b13b102c11959ff1ee8a312cb730f9c9142b1a"
    ].map(hexToBytes);

    function text(value) {
      return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
    }

    function warn(message) {
      try {
        if (typeof console !== "undefined" && console.error) {
          console.error("[NexusToons addon] " + message);
        }
      } catch (ignored) {}
    }

    function hexToBytes(hex) {
      var bytes = [];
      for (var index = 0; index < hex.length; index += 2) {
        bytes.push(parseInt(hex.slice(index, index + 2), 16));
      }
      return bytes;
    }

    function initReverseSBox(key) {
      var sbox = [];
      var rsbox = [];
      var cursor = 0;
      var index;

      for (index = 0; index < 256; index++) sbox[index] = index;
      for (index = 0; index < 256; index++) {
        cursor = (cursor + sbox[index] + key[index % key.length]) % 256;
        var temp = sbox[index];
        sbox[index] = sbox[cursor];
        sbox[cursor] = temp;
      }
      for (index = 0; index < 256; index++) rsbox[sbox[index]] = index;
      return rsbox;
    }

    var REVERSE_SBOXES = CRYPTO_KEYS.map(initReverseSBox);

    function rotateRight(value, amount) {
      amount %= 8;
      return ((value >>> amount) | (value << (8 - amount))) & 255;
    }

    function decodeUtf8(bytes) {
      if (typeof TextDecoder !== "undefined") {
        return new TextDecoder().decode(new Uint8Array(bytes));
      }

      var binary = "";
      for (var index = 0; index < bytes.length; index++) {
        binary += String.fromCharCode(bytes[index]);
      }
      return decodeURIComponent(escape(binary));
    }

    function decryptResponse(payload) {
      if (!payload || typeof payload !== "object" || typeof payload.d !== "string") {
        return payload;
      }

      var keyIndex = payload.v === 1 ? 0 : payload.k || 0;
      var key = CRYPTO_KEYS[keyIndex];
      var rsbox = REVERSE_SBOXES[keyIndex];
      if (!key || !rsbox) return payload;

      var binary = atob(payload.d);
      var input = [];
      var output = [];
      var index;

      for (index = 0; index < binary.length; index++) {
        input[index] = binary.charCodeAt(index);
      }

      for (index = input.length - 1; index >= 0; index--) {
        var value = input[index];
        value ^= index > 0 ? input[index - 1] : key[key.length - 1];
        value = rsbox[value];
        value = rotateRight(value, (((key[(index + 3) % key.length] + (index & 255)) & 255) % 7) + 1);
        value ^= key[index % key.length];
        output[index] = value;
      }

      return JSON.parse(decodeUtf8(output));
    }

    function getJson(path) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", SITE_BASE_URL + path, false);
      xhr.setRequestHeader("Accept", "application/json");
      xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
      xhr.send(null);
      if (xhr.status < 200 || xhr.status >= 300) {
        throw new Error("HTTP " + xhr.status + " em " + path);
      }
      return decryptResponse(JSON.parse(xhr.responseText));
    }

    function absoluteUrl(url) {
      if (!url) return "";
      if (/^https?:\/\//i.test(url)) return url;
      return SITE_BASE_URL + (url.charAt(0) === "/" ? url : "/" + url);
    }

    function currentSlug() {
      var path = String(location.pathname || "").replace(/\/+$/g, "");
      var mangaMatch = path.match(/^\/manga\/([^\/?#]+)/i);
      if (mangaMatch) return decodeURIComponent(mangaMatch[1]);

      var readerMatch = path.match(/^\/ler\/([^\/?#]+)\/[^\/?#]+/i);
      if (readerMatch) return decodeURIComponent(readerMatch[1]);

      return "";
    }

    function workUrl(slug) {
      return SITE_BASE_URL + "/manga/" + encodeURIComponent(slug);
    }

    function chapterUrl(slug, chapterId) {
      return SITE_BASE_URL + "/ler/" + encodeURIComponent(slug) + "/" + encodeURIComponent(String(chapterId));
    }

    function numberValue(chapter, fallback) {
      var number = text(chapter && chapter.number);
      if (number) return number;
      var titleMatch = text(chapter && chapter.title).match(/(\d+(?:[.,]\d+)?)/);
      return titleMatch ? titleMatch[1].replace(",", ".") : String(fallback);
    }

    function compareChapters(a, b) {
      var left = parseFloat(numberValue(a, 0));
      var right = parseFloat(numberValue(b, 0));
      if (!isNaN(left) && !isNaN(right) && left !== right) return left - right;
      return String(a && a.createdAt || "").localeCompare(String(b && b.createdAt || ""));
    }

    function canDownloadChapter(chapter) {
      var accessLevel = text(chapter && chapter.accessLevel).toLowerCase();
      var releaseStatus = text(chapter && chapter.releaseStatus).toLowerCase();
      var coinCost = Number(chapter && chapter.coinCost || 0);

      if (releaseStatus && releaseStatus !== "published") return false;
      if (!accessLevel || accessLevel === "public") return coinCost <= 0;
      return false;
    }

    function toPlanChapter(slug, chapter, sortedIndex) {
      if (!chapter || !chapter.id) return null;
      if (!canDownloadChapter(chapter)) {
        warn("Capitulo ignorado por acesso restrito: " + (chapter && chapter.id));
        return null;
      }

      var chapterId = String(chapter.id);
      var number = numberValue(chapter, sortedIndex + 1);
      var rawTitle = text(chapter.title);
      var title = rawTitle ? "Capitulo " + number + " - " + rawTitle : "Capitulo " + number;
      var chapterDataPath = "/api/chapter/" + encodeURIComponent(chapterId);

      return {
        id: "id:" + chapterId,
        number: number,
        title: title,
        contentType: "images",
        label: title,
        url: chapterUrl(slug, chapterId),
        index: sortedIndex,
        chapterDataPath: chapterDataPath
      };
    }

    function selectedChapterMap(ids) {
      var map = {};
      if (!Array.isArray(ids)) return map;
      ids.forEach(function (id) {
        var clean = text(id);
        if (clean) map[clean] = true;
      });
      return map;
    }

    function pageUrl(page) {
      if (typeof page === "string") return absoluteUrl(page);
      if (!page || typeof page !== "object") return "";
      return absoluteUrl(page.imageUrl || page.url || page.src || page.path || "");
    }

    function chapterPages(payload) {
      var data = payload && (payload.chapter || payload.data || payload.item || payload);
      var rawPages = data && (data.pages || data.images);
      var output = [];
      var seen = {};
      if (!Array.isArray(rawPages)) return output;
      rawPages.forEach(function (page) {
        var url = pageUrl(page);
        if (url && !seen[url]) {
          seen[url] = true;
          output.push(url);
        }
      });
      return output;
    }

    window.__nyxoviraPrepareDownloadPlan = function (context) {
      var selected = selectedChapterMap(context && context.selectedChapterIds);
      var plan = context && context.chapterPlan ? context.chapterPlan : {};
      var chapters = Array.isArray(plan.chapters) ? plan.chapters : [];
      var hasSelection = Object.keys(selected).length > 0;
      var selectedChapters = chapters.filter(function (chapter) {
        return chapter && (!hasSelection || selected[text(chapter.id)]);
      });
      if (!selectedChapters.length) {
        throw new Error("Nenhum capitulo selecionado para preparar.");
      }

      var preparedCount = 0;
      selectedChapters.forEach(function (chapter) {
        var chapterDataPath = text(chapter.chapterDataPath || chapter.apiPath || chapter.pagesPath || chapter.apiUrl || chapter.pagesUrl);
        if (!chapterDataPath) {
          throw new Error("Capitulo sem dados para preparar: " + text(chapter.id));
        }
        var payload = getJson(chapterDataPath);
        var pages = chapterPages(payload);
        if (!pages.length) {
          throw new Error("Capitulo sem paginas baixaveis: " + text(chapter.id));
        }
        chapter.contentType = "images";
        chapter.pages = pages;
        preparedCount += 1;
        delete chapter.chapterDataPath;
        delete chapter.apiPath;
        delete chapter.pagesPath;
      });

      if (!preparedCount) {
        throw new Error("Nenhum capitulo foi preparado para download.");
      }
      window.__nyxoviraChapterPlan = JSON.stringify(plan);
      return plan;
    };

    var slug = currentSlug();
    if (!slug) return "";

    var work = getJson("/api/manga/" + encodeURIComponent(slug));
    if (!work || !work.slug) return workUrl(slug);

    var chapters = Array.isArray(work.chapters) ? work.chapters.slice().sort(compareChapters) : [];
    var planChapters = chapters.map(function (chapter, index) {
      return toPlanChapter(work.slug, chapter, index);
    }).filter(Boolean);

    if (!planChapters.length) {
      warn("Nenhum capitulo publico foi encontrado para download.");
      return workUrl(work.slug);
    }

    window.__nyxoviraChapterPlan = JSON.stringify({
      title: text(work.title) || work.slug,
      summary: text(work.description),
      canonicalUrl: workUrl(work.slug),
      coverUrl: absoluteUrl(work.coverImage),
      chapters: planChapters
    });

    return workUrl(work.slug);
  } catch (error) {
    try {
      if (typeof console !== "undefined" && console.error) {
        console.error("[NexusToons addon] " + (error && error.message ? error.message : error));
      }
    } catch (ignored) {}
    return "";
  }
})()
