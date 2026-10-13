/// <reference path="./kino.d.ts" />

const BASE = "https://pelispro.net";
const UA =
  "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

const HOME_ROWS = [
  { slug: "peliculas", title: "\u00daltimas Pel\u00edculas", genre: "peliculas" },
  { slug: "estrenos", title: "Pel\u00edculas en Estreno", genre: "peliculas" },
  { slug: "series", title: "\u00daltimas Series", genre: "series" },
  { slug: "accion", title: "Acci\u00f3n", genre: "peliculas" },
  { slug: "comedia", title: "Comedia", genre: "peliculas" },
  { slug: "drama", title: "Drama", genre: "peliculas" },
  { slug: "terror", title: "Terror", genre: "peliculas" },
  { slug: "animacion", title: "Animaci\u00f3n", genre: "peliculas" },
  { slug: "aventura", title: "Aventura", genre: "peliculas" },
  { slug: "ciencia-ficcion", title: "Ciencia Ficci\u00f3n", genre: "peliculas" },
  { slug: "suspense", title: "Suspense", genre: "peliculas" },
  { slug: "romance", title: "Romance", genre: "peliculas" }
];

const IMG_LANGS = {
  latino: "Latino",
  castellano: "Castellano",
  espanol: "Espa\u00f1ol",
  "espa\u00f1ol": "Espa\u00f1ol",
  subtitulado: "Subtitulado",
  subtitulada: "Subtitulado",
  ingles: "Ingl\u00e9s",
  dual: "Dual",
  vose: "VOSE"
};

function headers(extra) {
  const h = { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9" };
  if (extra) for (const k in extra) h[k] = extra[k];
  return h;
}

function decode(s) {
  if (!s) return "";
  return String(s)
    .replace(/&#0?38;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#0?34;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(parseInt(n, 10)));
}

function text(html) {
  return decode(String(html || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function safeId(s) {
  return String(s).replace(/[^A-Za-z0-9._~-]/g, "-").slice(0, 128);
}

function decodeImage(u) {
  if (!u) return undefined;
  let s = decode(u).trim();
  try {
    if (/%[0-9a-f]{2}/i.test(s)) s = decodeURIComponent(s);
  } catch (e) {}
  if (s.indexOf("//") === 0) s = "https:" + s;
  if (!/^https:\/\//i.test(s)) return undefined;
  return s;
}

function svgImageUrls(html) {
  const urls = [];
  const re = /src="data:image\/svg\+xml;base64,([A-Za-z0-9+/=\s]+)"/gi;
  let m;
  while ((m = re.exec(html))) {
    let svg = "";
    try {
      svg = atob(m[1].replace(/\s+/g, ""));
    } catch (e) {
      continue;
    }
    const du = svg.match(/data-u="([^"]+)"/i);
    if (du) {
      const u = decodeImage(du[1]);
      if (u) urls.push(u);
    }
  }
  return urls;
}

function firstImage(block) {
  const m = block.match(/data-u="([^"]+)"/i);
  if (m) return decodeImage(m[1]);
  const urls = svgImageUrls(block);
  return urls.length ? urls[0] : undefined;
}

function langName(img) {
  if (!img) return undefined;
  const file = img.split("/").pop().split("?")[0].replace(/\.[a-z0-9]+$/i, "").toLowerCase();
  if (IMG_LANGS[file]) return IMG_LANGS[file];
  return file ? file.charAt(0).toUpperCase() + file.slice(1) : undefined;
}

function langOf(block) {
  const m = block.match(/<span class="lang">([\s\S]*?)<\/span>/i);
  if (!m) return undefined;
  return langName(firstImage(m[1]));
}

function absolute(url) {
  const u = decode(url);
  if (u.indexOf("http") === 0) return u;
  return BASE + (u.charAt(0) === "/" ? "" : "/") + u;
}

function slugOf(url, type) {
  const part = url.split("/" + type + "/")[1] || "";
  return part.replace(/\/+$/, "").split("?")[0].split("#")[0];
}

function ratingOf(block) {
  const m = block.match(/class="vote"[^>]*>[\s\S]*?<\/span>\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  if (!isFinite(n) || n <= 0) return undefined;
  return Math.min(10, n);
}

function itemsFromHtml(html, opts) {
  const out = [];
  const seen = {};
  const re = /<article\b[^>]*>([\s\S]*?)<\/article>/gi;
  let m;
  while ((m = re.exec(html))) {
    const block = m[1];
    const lm = block.match(/href="([^"]*?\/(pelicula|serie|episodio)\/[^"#?]+)"/i);
    if (!lm) continue;
    const url = absolute(lm[1]);
    const type = lm[2].toLowerCase();
    const slug = slugOf(url, type);
    if (!slug) continue;

    let kind, ref, id, title;
    const tm = block.match(/<h2[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i);
    title = tm ? text(tm[1]) : "";

    if (type === "episodio") {
      if (!opts || !opts.episodeAsSeries) continue;
      const seriesSlug = slug.replace(/-\d+x\d+$/i, "");
      if (!seriesSlug || seriesSlug === slug) continue;
      kind = "series";
      ref = "p:serie/" + seriesSlug;
      id = "sr-" + safeId(seriesSlug);
      title = title.replace(/\s*\d+x\d+\s*$/i, "").trim() || seriesSlug;
    } else if (type === "serie") {
      kind = "series";
      ref = "p:serie/" + slug;
      id = "sr-" + safeId(slug);
    } else {
      kind = "movie";
      ref = "p:pelicula/" + slug;
      id = "mv-" + safeId(slug);
    }

    if (seen[ref]) continue;
    seen[ref] = true;

    const item = { id, ref, title: title || slug, kind };
    const img = firstImage(block);
    if (img) item.poster = img;
    const ym = block.match(/<span class="year">\s*([0-9]{4})/i);
    if (ym) item.year = ym[1];
    const rt = ratingOf(block);
    if (rt) item.rating = rt;
    const qm = block.match(/<span class="Qlty">\s*([^<]+?)\s*<\/span>/i);
    if (qm) item.quality = text(qm[1]);
    const lang = langOf(block);
    if (lang) item.lang = lang;
    out.push(item);
  }
  return out;
}

function paginationRegion(html) {
  const i = html.indexOf('class="navigation pagination"');
  if (i === -1) return "";
  return html.slice(i, i + 2000);
}

function nextPage(html, page) {
  const region = paginationRegion(html);
  if (!region) return undefined;
  let max = page;
  const re = /\/page\/(\d+)/g;
  let m;
  while ((m = re.exec(region))) {
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  return max > page ? String(page + 1) : undefined;
}

async function fetchPath(slug, page) {
  const url = BASE + "/" + slug + (page > 1 ? "/page/" + page : "");
  const r = await kino.fetch(url, { headers: headers(), timeoutMs: 15000 });
  if (!r.ok) throw kino.error("unavailable", "pelispro respondi\u00f3 " + r.status);
  return r.text();
}

function parseSeasons(html) {
  let postId = null;
  const nums = [];
  const seen = {};
  const pre = /data-post="(\d+)"/g;
  let m;
  while ((m = pre.exec(html))) {
    if (postId === null) postId = m[1];
  }
  const sre = /data-season="(\d+)"/g;
  while ((m = sre.exec(html))) {
    const n = parseInt(m[1], 10);
    if (!isFinite(n) || seen[n]) continue;
    seen[n] = true;
    nums.push(n);
  }
  nums.sort((a, b) => a - b);
  return { postId, numbers: nums };
}

async function fetchSeason(postId, season) {
  const r = await kino.fetch(BASE + "/wp-admin/admin-ajax.php", {
    method: "POST",
    headers: headers({ "X-Requested-With": "XMLHttpRequest" }),
    body: { form: { action: "action_select_season", season: String(season), post: String(postId) } },
    timeoutMs: 15000
  });
  if (!r.ok) return "";
  return r.text();
}

function parseEpisodeCards(html) {
  const out = [];
  const re = /<article\b[^>]*>([\s\S]*?)<\/article>/gi;
  let m;
  while ((m = re.exec(html))) {
    const block = m[1];
    const lm = block.match(/href="([^"]*?\/episodio\/[^"#?]+)"/i);
    if (!lm) continue;
    const url = absolute(lm[1]);
    const slug = slugOf(url, "episodio");
    if (!slug) continue;
    const em = block.match(/<span class="num-epi">\s*(\d+)x(\d+)\s*<\/span>/i);
    const season = em ? parseInt(em[1], 10) : 1;
    const number = em ? parseInt(em[2], 10) : 0;
    const ep = { season, number, ref: "p:episodio/" + slug };
    const tm = block.match(/<h2[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i);
    if (tm) {
      const t = text(tm[1]);
      if (t) ep.title = t;
    }
    const img = firstImage(block);
    if (img) ep.still = img;
    out.push(ep);
  }
  return out;
}

function seriesInfo(html) {
  const info = {};
  const tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (tm) {
    const t = text(tm[1]);
    if (t) info.title = t;
  }
  const dm = html.match(/<div class="description">([\s\S]*?)<\/div>/i);
  if (dm) {
    const o = text(dm[1]);
    if (o) info.overview = o;
  }
  const im =
    html.match(/property="og:image"\s+content="([^"]+)"/i) ||
    html.match(/content="([^"]+)"\s+property="og:image"/i);
  if (im) info.poster = decode(im[1]);
  const gm = html.match(/<span class="genres">([\s\S]*?)<\/span>/i);
  if (gm) {
    const genres = [];
    const gre = /<a[^>]*>([\s\S]*?)<\/a>/gi;
    let g;
    while ((g = gre.exec(gm[1]))) {
      const name = text(g[1]);
      if (name) genres.push(name);
    }
    if (genres.length) info.genres = genres.slice(0, 5);
  }
  const ym = html.match(/<span class="year">\s*([0-9]{4})/i);
  if (ym) info.year = ym[1];
  return info;
}

function listEmbeds(html) {
  const labels = {};
  const listBlock = html.match(/<ul class="aa-tbs aa-tbs-video"[^>]*>([\s\S]*?)<\/ul>/i);
  if (listBlock) {
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let li;
    while ((li = liRe.exec(listBlock[1]))) {
      const hm = li[1].match(/href="#options-(\d+)"/i);
      if (!hm) continue;
      const sm = li[1].match(/<span class="server">([\s\S]*?)<\/span>/i);
      labels[hm[1]] = sm ? text(sm[1]) : "";
    }
  }
  const out = [];
  const optRe = /<div id="options-(\d+)"[^>]*>([\s\S]*?)<\/div>/gi;
  let m;
  while ((m = optRe.exec(html))) {
    const im = m[2].match(/(?:data-src|src)="([^"]*trembed[^"]*)"/i);
    if (!im) continue;
    const url = decode(im[1]).replace(/&#0?38;/g, "&").replace(/&amp;/g, "&");
    out.push({ index: parseInt(m[1], 10), url, label: labels[m[1]] || "" });
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

function labelFor(s) {
  let label = (s.label || "").replace(/\s+/g, " ").trim();
  label = label.replace(/^[-•·]\s*/, "").trim();
  if (!label) label = "Servidor " + (s.index + 1);
  return label.slice(0, 48);
}

function cleanHeaders(h) {
  const out = {};
  if (h) {
    for (const k in h) {
      const lk = k.toLowerCase();
      if (lk === "host" || lk === "accept-encoding" || lk === "range" || lk === "content-length") continue;
      if (typeof h[k] === "string" && h[k]) out[k] = h[k];
    }
  }
  return out;
}

function directMedia(html) {
  const m = html.match(/https?:\/\/[^"'\s<>\\]+\.(?:m3u8|mp4)[^"'\s<>\\]*/i);
  if (!m) return null;
  const url = m[0].replace(/&amp;/g, "&");
  if (!/^https:\/\//i.test(url)) return null;
  return { url, headers: headers({ Referer: BASE + "/" }) };
}

function capturedStream(cap) {
  const media = (cap && cap.media) || [];
  if (!media.length) return null;
  const first = media[0];
  const stream = { url: first.url, headers: cleanHeaders(first.headers) };
  if (first.mime && /^video\//i.test(first.mime)) stream.mime = first.mime;
  const subs = [];
  const capSubs = (cap && cap.subtitles) || [];
  for (let i = 0; i < capSubs.length && subs.length < 3; i++) {
    subs.push({ url: capSubs[i].url, lang: "es" });
  }
  if (subs.length) stream.subtitles = subs;
  const alts = [];
  for (let i = 1; i < media.length && alts.length < 6; i++) {
    alts.push({ url: media[i].url, headers: cleanHeaders(media[i].headers) });
  }
  if (alts.length) stream.alternatives = alts;
  return stream;
}

async function resolveServer(server) {
  try {
    const r = await kino.fetch(server.url, { headers: headers({ Referer: BASE + "/" }), timeoutMs: 8000 });
    if (r.ok) {
      const direct = directMedia(r.text());
      if (direct) return direct;
    }
  } catch (e) {}
  let cap;
  try {
    cap = await kino.browser.capture(server.url, {
      headers: { Referer: BASE + "/", "Accept-Language": "es-ES,es;q=0.9" },
      timeoutMs: 20000
    });
  } catch (e) {
    throw kino.error("unavailable", "No se pudo abrir el reproductor");
  }
  const stream = capturedStream(cap);
  if (!stream) throw kino.error("unavailable", "El reproductor no envi\u00f3 ning\u00fan v\u00eddeo");
  return stream;
}

export async function search(query) {
  const q = (query && query.q) || "";
  if (!q.trim()) return { items: [] };
  const page = Math.max(1, parseInt((query && query.cursor) || "1", 10) || 1);
  const enc = encodeURIComponent(q.trim());
  const url = page > 1 ? BASE + "/page/" + page + "?s=" + enc : BASE + "/?s=" + enc;
  const r = await kino.fetch(url, { headers: headers(), timeoutMs: 13000 });
  if (!r.ok) return { items: [] };
  const html = r.text();
  const items = itemsFromHtml(html, { episodeAsSeries: true }).slice(0, 100);
  const next = nextPage(html, page);
  return next ? { items, next } : { items };
}

export async function home() {
  const results = await Promise.all(
    HOME_ROWS.map((row) =>
      fetchPath(row.slug, 1).then(
        (html) => ({ row, html }),
        () => ({ row, html: null })
      )
    )
  );
  const rows = [];
  for (const res of results) {
    if (!res.html) continue;
    const items = itemsFromHtml(res.html, { episodeAsSeries: false }).slice(0, 30);
    if (!items.length) continue;
    rows.push({
      id: "row-" + safeId(res.row.slug),
      title: res.row.title,
      items,
      ref: "b:" + res.row.slug,
      genre: res.row.genre
    });
  }
  return rows;
}

export async function browse(ref, cursor) {
  const slug = String(ref || "").replace(/^b:/, "");
  if (!/^[a-z0-9-]+$/i.test(slug)) return { items: [] };
  const page = Math.max(1, parseInt(cursor || "1", 10) || 1);
  const html = await fetchPath(slug, page);
  const items = itemsFromHtml(html, { episodeAsSeries: false }).slice(0, 100);
  const next = nextPage(html, page);
  return next ? { items, next } : { items };
}

export async function episodes(ref) {
  const path = String(ref || "").replace(/^p:/, "");
  if (!path) throw kino.error("invalid_request", "Referencia inv\u00e1lida");
  const r = await kino.fetch(BASE + "/" + path + "/", { headers: headers(), timeoutMs: 15000 });
  if (!r.ok) throw kino.error("unavailable", "pelispro respondi\u00f3 " + r.status);
  const html = r.text();
  const series = seriesInfo(html);

  const list = [];
  const seen = {};
  function push(ep) {
    if (!ep || !ep.number) return;
    const key = ep.season + "x" + ep.number;
    if (seen[key]) return;
    seen[key] = true;
    list.push(ep);
  }

  const onPage = parseEpisodeCards(html);
  const pageSeasons = {};
  for (const ep of onPage) {
    pageSeasons[ep.season] = true;
    push(ep);
  }

  const seasons = parseSeasons(html);
  if (seasons.postId && seasons.numbers.length) {
    const pending = seasons.numbers.filter((n) => !pageSeasons[n]);
    const pages = await Promise.all(
      pending.map((n) =>
        fetchSeason(seasons.postId, n).then(
          (h) => h,
          () => ""
        )
      )
    );
    for (const h of pages) {
      if (!h) continue;
      for (const ep of parseEpisodeCards(h)) push(ep);
    }
  }

  list.sort((a, b) => (a.season - b.season) || (a.number - b.number));
  const answer = { episodes: list };
  if (series.title || series.poster || series.overview || series.genres) answer.series = series;
  return answer;
}

export async function resolve(ref) {
  let baseRef = String(ref || "");
  let serverId = null;
  const sep = baseRef.indexOf("|");
  if (sep !== -1) {
    serverId = baseRef.slice(sep + 1);
    baseRef = baseRef.slice(0, sep);
  }
  const path = baseRef.replace(/^p:/, "");
  if (!path) throw kino.error("invalid_request", "Referencia inv\u00e1lida");

  const r = await kino.fetch(BASE + "/" + path + "/", { headers: headers(), timeoutMs: 15000 });
  if (!r.ok) throw kino.error("unavailable", "pelispro respondi\u00f3 " + r.status);
  const servers = listEmbeds(r.text());
  if (!servers.length) throw kino.error("not_found", "Este t\u00edtulo no tiene servidores");

  if (serverId !== null) {
    const idx = parseInt(serverId, 10);
    const server = servers[idx];
    if (!server) throw kino.error("not_found", "Servidor no encontrado");
    return resolveServer(server);
  }

  let lastError = null;
  const tries = Math.min(servers.length, 3);
  for (let i = 0; i < tries; i++) {
    try {
      const stream = await resolveServer(servers[i]);
      stream.label = labelFor(servers[i]);
      const alts = [];
      const localAlts = stream.alternatives || [];
      for (let j = 0; j < localAlts.length && alts.length < 8; j++) alts.push(localAlts[j]);
      const lazy = [];
      for (let j = 0; j < servers.length; j++) {
        if (j === i) continue;
        lazy.push({ label: labelFor(servers[j]), ref: baseRef + "|" + j });
      }
      for (let j = 0; j < lazy.length && alts.length < 8; j++) alts.push(lazy[j]);
      if (alts.length) stream.alternatives = alts;
      else delete stream.alternatives;
      return stream;
    } catch (e) {
      lastError = e;
      const code = e && e.code;
      if (code === "blocked" || code === "timeout" || code === "unavailable" || code === "busy") continue;
      throw e;
    }
  }
  throw lastError || kino.error("unavailable", "Ning\u00fan servidor respondi\u00f3");
}
