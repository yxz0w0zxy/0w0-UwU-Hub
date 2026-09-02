(function () {
  try {
    var SITE_BASE_URL = "https://plumacomics.cloud";

    function text(value) {
      return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
    }

    function warn(message) {
      try {
        if (typeof console !== "undefined" && console.error) {
          console.error("[Pluma Comics addon] " + message);
        }
      } catch (ignored) {}
    }

    function getText(url) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, false);
      xhr.setRequestHeader("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
      xhr.send(null);
      if (xhr.status < 200 || xhr.status >= 300) {
        throw new Error("HTTP " + xhr.status + " em " + url);
      }
      return xhr.responseText || "";
    }

    function getJson(path) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", absoluteUrl(path), false);
      xhr.setRequestHeader("Accept", "application/json");
      xhr.send(null);
      if (xhr.status < 200 || xhr.status >= 300) {
        throw new Error("HTTP " + xhr.status + " em " + path);
      }
      return JSON.parse(xhr.responseText);
    }

    function absoluteUrl(url) {
      if (!url) return "";
      url = String(url).replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
      if (/^https?:\/\//i.test(url)) return url;
      return SITE_BASE_URL + (url.charAt(0) === "/" ? url : "/" + url);
    }

    function decodeHtml(value) {
      return String(value || "")
        .replace(/\\u0026/g, "&")
        .replace(/\\"/g, '"')
        .replace(/\\\//g, "/")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
    }

    function jsonString(value) {
      if (!value || value === "null") return "";
      try {
        return JSON.parse(value);
      } catch (ignored) {
        return value.replace(/^"|"$/g, "");
      }
    }

    function currentWorkSlug() {
      var path = String(location.pathname || "").replace(/\/+$/g, "");
      var titleMatch = path.match(/^\/title\/([^\/?#]+)/i);
      if (titleMatch) return decodeURIComponent(titleMatch[1]).replace(/^\d+-/, "");

      var readerMatch = path.match(/^\/view\/([^\/?#]+)\/ch-[^\/?#]+/i);
      if (readerMatch) return decodeURIComponent(readerMatch[1]).replace(/^\d+-/, "");

      return "";
    }

    function workUrl(slug) {
      return SITE_BASE_URL + "/title/" + encodeURIComponent(slug);
    }

    function chapterUrl(slug, number) {
      return SITE_BASE_URL + "/view/" + encodeURIComponent(slug) + "/ch-" + encodeURIComponent(String(number));
    }

    function metaContent(html, nameOrProperty) {
      var escaped = nameOrProperty.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      var patterns = [
        new RegExp('<meta[^>]+(?:name|property)=["\\\']' + escaped + '["\\\'][^>]+content=["\\\']([^"\\\']*)["\\\']', "i"),
        new RegExp('<meta[^>]+content=["\\\']([^"\\\']*)["\\\'][^>]+(?:name|property)=["\\\']' + escaped + '["\\\']', "i")
      ];
      for (var index = 0; index < patterns.length; index += 1) {
        var match = html.match(patterns[index]);
        if (match) return decodeHtml(match[1]);
      }
      return "";
    }

    function pageTitle(html) {
      var ogTitle = metaContent(html, "og:title");
      if (ogTitle) return ogTitle.replace(/\s*\|\s*Pluma Comics\s*$/i, "");

      var titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      return titleMatch ? decodeHtml(titleMatch[1]).replace(/\s*\|\s*Pluma Comics\s*$/i, "") : "";
    }

    function fullDescription(html) {
      var decoded = decodeHtml(html);
      var match = decoded.match(/"description":"((?:\\.|[^"\\])*)"/);
      if (match) return jsonString('"' + match[1] + '"');
      return metaContent(html, "description");
    }

    function coverUrl(html) {
      var cover = metaContent(html, "og:image") || metaContent(html, "twitter:image");
      if (cover) return absoluteUrl(cover.replace(/^https:\/\/plumacomics\.cloud\/covers\//i, "/api/img/covers/"));

      var decoded = decodeHtml(html);
      var match = decoded.match(/"src":"(\/api\/img\/covers\/[^"]+|covers\/[^"]+)"/);
      if (match) return absoluteUrl(match[1].replace(/^covers\//, "/api/img/covers/"));
      return "";
    }

    function isUnlocked(chapter) {
      if (!chapter.isVipOnly) return true;
      if (!chapter.unlockAt) return false;
      var unlockTime = Date.parse(chapter.unlockAt);
      return !isNaN(unlockTime) && unlockTime <= Date.now();
    }

    function numberValue(value) {
      var number = parseFloat(String(value).replace(",", "."));
      return isNaN(number) ? 0 : number;
    }

    function toPlanChapter(slug, chapter, index) {
      if (!chapter || !chapter.id || !isUnlocked(chapter)) return null;
      var number = text(chapter.number || index + 1);
      var title = text(chapter.title);
      var chapterId = String(chapter.id);
      var label = title && !/^cap[ií]tulo/i.test(title)
        ? "Capitulo " + number + " - " + title
        : (title || "Capitulo " + number);
      var planChapter = {
        id: chapterId,
        number: number,
        title: label,
        contentType: "images",
        label: label,
        url: chapterUrl(slug, number),
        index: index
      };

      if (/^\d+$/.test(chapterId)) {
        planChapter.chapterDataPath = "/api/viewer/bootstrap?c=" + encodeURIComponent(chapterId);
      } else if (chapter.readerPath) {
        planChapter.readerPath = chapter.readerPath;
      }

      return planChapter;
    }

    function chaptersFromRsc(html) {
      var decoded = decodeHtml(html);
      var chapters = [];
      var seen = {};
      var pattern = /\{"id":(\d+),"number":([0-9.]+),"title":(null|"((?:\\.|[^"\\])*)"),"isVipOnly":(true|false),"unlockAt":(null|"((?:\\.|[^"\\])*)"),"publishedAt":"(?:\$D)?([^"]*)"\}/g;
      var match;

      while ((match = pattern.exec(decoded))) {
        if (seen[match[1]]) continue;
        seen[match[1]] = true;
        chapters.push({
          id: match[1],
          number: match[2],
          title: jsonString(match[3]),
          isVipOnly: match[5] === "true",
          unlockAt: jsonString(match[6]),
          publishedAt: match[8] || ""
        });
      }

      return chapters.sort(function (a, b) {
        var left = numberValue(a.number);
        var right = numberValue(b.number);
        if (left !== right) return left - right;
        return String(a.publishedAt || "").localeCompare(String(b.publishedAt || ""));
      });
    }

    function chaptersFromLinks(html, slug) {
      var decoded = decodeHtml(html);
      var chapters = [];
      var seen = {};
      var pattern = new RegExp('href="/view/' + slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '/ch-([0-9.]+)"', "g");
      var match;

      while ((match = pattern.exec(decoded))) {
        var number = match[1];
        if (seen[number]) continue;
        seen[number] = true;
        chapters.push({
          id: "url:" + number,
          number: number,
          title: "",
          isVipOnly: false,
          unlockAt: null,
          readerPath: "/view/" + slug + "/ch-" + number
        });
      }

      return chapters.sort(function (a, b) {
        return numberValue(a.number) - numberValue(b.number);
      });
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

    function imageUrl(page) {
      if (typeof page === "string") return absoluteUrl(page);
      if (!page || typeof page !== "object") return "";
      return absoluteUrl(page.u || page.url || page.imageUrl || page.src || page.path || "");
    }

    function pagesFromBootstrap(payload) {
      var pages = payload && Array.isArray(payload.pages) ? payload.pages : [];
      var output = [];
      var seen = {};
      pages.sort(function (a, b) {
        return Number(a && (a.i || a.pageNumber) || 0) - Number(b && (b.i || b.pageNumber) || 0);
      }).forEach(function (page) {
        var url = imageUrl(page);
        if (url && !seen[url]) {
          seen[url] = true;
          output.push(url);
        }
        if (page && Array.isArray(page.s)) {
          page.s.forEach(function (strip) {
            var stripUrl = imageUrl(strip);
            if (stripUrl && !seen[stripUrl]) {
              seen[stripUrl] = true;
              output.push(stripUrl);
            }
          });
        }
      });
      return output;
    }

    function chapterIdFromReaderHtml(html) {
      var decoded = decodeHtml(html);
      var match = decoded.match(/"chapterId":(\d+)/) || decoded.match(/chapterId\\":(\d+)/);
      return match ? match[1] : "";
    }

    function pagesFromReaderHtml(html) {
      var decoded = decodeHtml(html);
      var output = [];
      var seen = {};
      var pattern = /https:\/\/cdn\.orionmanhuas\.com\/chapters\/[^"'<\s]+?\.(?:webp|png|jpe?g)(?:\?[^"'<\s]*)?/g;
      var match;

      while ((match = pattern.exec(decoded))) {
        var url = absoluteUrl(match[0].replace(/\\+$/g, ""));
        if (url && !seen[url]) {
          seen[url] = true;
          output.push(url);
        }
      }

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

      selectedChapters.forEach(function (chapter) {
        var pages = [];
        var dataPath = text(chapter.chapterDataPath || chapter.apiPath || chapter.pagesPath);
        if (dataPath) {
          pages = pagesFromBootstrap(getJson(dataPath));
        } else if (chapter.readerPath) {
          var html = getText(absoluteUrl(chapter.readerPath));
          var chapterId = chapterIdFromReaderHtml(html);
          pages = chapterId
            ? pagesFromBootstrap(getJson("/api/viewer/bootstrap?c=" + encodeURIComponent(chapterId)))
            : pagesFromReaderHtml(html);
        }

        if (!pages.length) {
          throw new Error("Capitulo sem paginas baixaveis: " + text(chapter.id));
        }

        chapter.contentType = "images";
        chapter.pages = pages;
        chapter.images = pages;
        delete chapter.chapterDataPath;
        delete chapter.apiPath;
        delete chapter.pagesPath;
        delete chapter.readerPath;
      });

      window.__nyxoviraChapterPlan = JSON.stringify(plan);
      return plan;
    };

    var slug = currentWorkSlug();
    if (!slug) return "";

    var html = /^\/title\//i.test(location.pathname || "")
      ? document.documentElement.innerHTML
      : getText(workUrl(slug));
    var chapters = chaptersFromRsc(html);
    if (!chapters.length) chapters = chaptersFromLinks(html, slug);

    var planChapters = chapters.map(function (chapter, index) {
      return toPlanChapter(slug, chapter, index);
    }).filter(Boolean);

    if (!planChapters.length) {
      warn("Nenhum capitulo publico foi encontrado para download.");
      return workUrl(slug);
    }

    window.__nyxoviraChapterPlan = JSON.stringify({
      title: text(pageTitle(html)) || slug,
      summary: text(fullDescription(html)),
      canonicalUrl: workUrl(slug),
      coverUrl: coverUrl(html),
      chapters: planChapters
    });

    return workUrl(slug);
  } catch (error) {
    try {
      if (typeof console !== "undefined" && console.error) {
        console.error("[Pluma Comics addon] " + (error && error.message ? error.message : error));
      }
    } catch (ignored) {}
    return "";
  }
})()
