/* Lights Down Low, round three.
   Shows are dated: anything in the past drops out of the list on its own. A show with a flyer number (`f`) shows its art; one without is listed in type until the art lands. */
(() => {
'use strict';
const D = window.LDL, root = document.documentElement;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const HAS_GSAP = !!window.gsap, HAS_ST = HAS_GSAP && !!window.ScrollTrigger;
// icons: Phosphor (regular), MIT
const ARROW = '<svg class="ph" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z"/></svg>';
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const isSmall = () => innerWidth <= 860;
if (HAS_ST) gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------ smooth scroll */
let lenis = null;
if (FINE && !RM && HAS_ST && window.Lenis) {
  lenis = new Lenis({ lerp: .12 });
  root.classList.add('has-lenis');
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
function jumpTo(node) {
  const y = node.getBoundingClientRect().top + scrollY - (innerHeight - node.offsetHeight) / 2;
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo({ top: y, behavior: 'instant' });
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'); if (!a || !lenis) return;
  const t = document.getElementById(a.getAttribute('href').slice(1)); if (!t) return;
  e.preventDefault();
  if (t.id === 'top') lenis.scrollTo(0, { duration: 1.2 }); else lenis.scrollTo(t, { duration: 1.2 });   // sections carry their own scroll-margin
});

/* ------------------------------------------------------------------- dates */
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function laNow() {
  const p = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false })
    .formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  return { ymd: `${p.year}-${p.month}-${p.day}`, hour: (+p.hour) % 24 };
}
const addDays = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const NOW = laNow();
const isUpcoming = s => s.date >= NOW.ymd || (addDays(s.date, 1) === NOW.ymd && NOW.hour < 6);   // a show stays "upcoming" until 6am the morning after
const dparts = ymd => { const d = new Date(ymd + 'T12:00:00Z'); return { wd: WD[d.getUTCDay()], wdl: WDL[d.getUTCDay()], mo: MO[d.getUTCMonth()], mos: MO[d.getUTCMonth()].slice(0, 3), day: d.getUTCDate(), y: d.getUTCFullYear() }; };
const t12 = hm => { let [h, m] = hm.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + (m ? ':' + pad2(m) : '') + ap; };

const shows = [...D.shows].sort((a, b) => a.date < b.date ? -1 : 1);
const upcoming = shows.filter(isUpcoming);
const next = upcoming[0] || null;
const F = D.flyers, id3 = n => String(n).padStart(3, '0');
const FK = new Map(F.map((f, k) => [f.n, k]));                       // flyer file number -> place on the wall
const flyerK = s => s && s.f != null && FK.has(s.f) ? FK.get(s.f) : -1;
const showTitle = s => s.name || s.head.join(' + ');
const showRest = s => (s.name ? s.head : []).concat(s.support || []);
const showLabel = s => (s.name ? s.name + ': ' : '') + s.head.concat(s.support || []).join(', ');
const price = s => String(s.price || '').replace(/–/g, '-');

/* ------------------------------------------------------------------- hero */
// One slide per upcoming show: its words bottom-left, its flyer alone on the right. With nothing booked, the newest flyer and a line saying so.
const hero = $('#shows'), reel = $('#reel'), copy = $('#hero-copy'), tabs = $('#hero-tabs');
const slides = upcoming.length ? upcoming.map(s => ({ s, k: flyerK(s) })) : [{ s: null, k: F.length ? 0 : -1 }];
let items = [], tabBtns = [], tabLine = null, active = -1, panST = null, copyTimer = 0;
function copyHTML(s) {
  if (!s) return `<h2 class="hero__title" id="hero-title" style="--ts:.62">Nothing on the books right now</h2><p class="hero__sub">New shows land on Resident Advisor first.</p>` +
    `<p class="hero__cta"><a class="btn" href="https://ra.co/promoters/20694" target="_blank" rel="noopener">Follow on RA ${ARROW}</a></p>`;
  const d = dparts(s.date), rest = showRest(s), sold = s.status === 'soldout', title = showTitle(s), n = title.length;
  const ts = n <= 9 ? 1 : n <= 13 ? .86 : n <= 18 ? .72 : n <= 24 ? .62 : .54;
  return `<p class="hero__date"><time datetime="${s.date}">${d.wdl}, ${d.mo} ${d.day}</time></p>` +
    `<h2 class="hero__title" id="hero-title" style="--ts:${ts};--tw:${n > 18 ? 90 : 100}%">${esc(title)}</h2>` +
    `<p class="hero__sub">${t12(s.start)} to ${t12(s.end)}, ${esc(s.area)}.${rest.length ? ' With ' + esc(rest.slice(0, 3).join(', ')) + (rest.length > 3 ? ' and more.' : '.') : ''} <span class="nb">${esc(price(s))}, ${esc(s.age)}.</span></p>` +
    `<p class="hero__cta"><a class="btn" href="${s.ra}" target="_blank" rel="noopener">${sold ? 'Resale on RA' : 'Tickets on RA'} ${ARROW}</a></p>`;
}
function moveLine(instant) {
  const b = tabBtns[active]; if (!b || !tabLine) return;
  if (instant) tabLine.style.transition = 'none';
  tabLine.style.transform = `translateX(${b.offsetLeft}px) scaleX(${b.offsetWidth})`;
  if (instant) { void tabLine.offsetWidth; tabLine.style.transition = ''; }
}
function setActive(i, animate) {
  i = clamp(i, 0, slides.length - 1); if (i === active) return; active = i;
  items.forEach((n, j) => n.classList.toggle('is-active', j === i));
  tabBtns.forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
  moveLine(!animate);
  if (tabs.scrollWidth > tabs.clientWidth && tabBtns[i]) tabs.scrollTo({ left: tabBtns[i].offsetLeft - 20, behavior: animate && !RM ? 'smooth' : 'auto' });
  clearTimeout(copyTimer);
  const put = () => { copy.innerHTML = copyHTML(slides[active].s); };
  if (!animate || RM) { put(); return; }
  copy.classList.add('is-hiding');
  copyTimer = setTimeout(() => { put(); copy.classList.remove('is-hiding', 'is-shown'); void copy.offsetWidth; copy.classList.add('is-shown'); }, 180);
}
function sizeReel() {
  // each flyer is as tall as the room allows, without a wide one crowding the words
  const pan = hero.classList.contains('is-pan'), small = isSmall(), W = reel.clientWidth, H = reel.clientHeight;
  items.forEach((n, j) => { const k = slides[j].k, ar = k > -1 ? F[k].w / F[k].h : .8; n.style.setProperty('--h', Math.round(Math.min(H * (small ? .88 : .74), W * (pan ? .42 : small ? .74 : .62) / ar)) + 'px'); });
  moveLine(true);
}
function goTo(i) {
  if (panST && lenis) lenis.scrollTo(panST.start + (panST.end - panST.start) * i / (slides.length - 1), { duration: 1 });
  else { const n = items[i]; reel.scrollTo({ left: n.offsetLeft - (reel.clientWidth - n.offsetWidth) / 2, behavior: RM ? 'auto' : 'smooth' }); setActive(i, true); }
}
function renderHero() {
  items = slides.map(({ s, k }, j) => {
    let n;
    if (k > -1) {
      const f = F[k]; n = el('button', 'reel__item'); n.type = 'button'; n.dataset.k = k;
      n.style.cssText = `--ar:${f.w}/${f.h};--c:${f.c}`;
      n.setAttribute('aria-label', `Flyer for ${s ? showLabel(s) : 'the most recent show'}. Open larger.`);
      n.innerHTML = `<img src="f/l/${id3(f.n)}.webp" alt="" decoding="async" draggable="false">`;
    } else n = el('div', 'reel__item reel__item--none', '<span>Flyer to come</span>');
    n.dataset.i = j;
    return n;
  });
  reel.replaceChildren(...items);
  if (slides.length > 1) {
    tabs.hidden = false;
    tabs.innerHTML = '<span class="tabs__line" aria-hidden="true"></span>' + slides.map(({ s }, j) => { const d = dparts(s.date); return `<button class="tab" type="button" data-i="${j}"><span class="tab__date">${d.wd}, ${d.mos} ${d.day}</span><span class="tab__name">${esc(showTitle(s))}</span></button>`; }).join('');
    tabLine = $('.tabs__line', tabs); tabBtns = $$('.tab', tabs);
    tabs.addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) goTo(+b.dataset.i); });
  }
  setActive(0, false); sizeReel();
  reel.addEventListener('click', e => {
    const n = e.target.closest('.reel__item'); if (!n) return;
    const i = +n.dataset.i;
    if (i !== active) goTo(i); else if (n.dataset.k != null) openViewer(+n.dataset.k, n);
  });
  // swiping the strip: whichever flyer sits in the middle is the show being described
  const io = new IntersectionObserver(es => { if (hero.classList.contains('is-pan')) return; es.forEach(e => { if (e.isIntersecting) setActive(+e.target.dataset.i, true); }); }, { root: reel, threshold: .6 });
  items.forEach(n => io.observe(n));
  addEventListener('resize', debounce(() => { sizeReel(); if (HAS_ST) ScrollTrigger.refresh(); }, 160));
  if (slides.length < 2 || RM || !HAS_ST || !lenis) return;
  // desktop: the hero holds still and the page scroll carries the flyers sideways, one show at a time
  const rest = t => t * t * t * (t * (t * 6 - 15) + 10);          // settles on each show instead of gliding past it
  gsap.matchMedia().add('(min-width: 861px)', () => {
    hero.classList.add('is-pan'); reel.scrollLeft = 0; sizeReel();
    const n = slides.length;
    const draw = p => {
      const raw = p * (n - 1), b = Math.min(n - 2, Math.floor(raw)), P = b + rest(raw - b), W = reel.clientWidth;
      items.forEach((node, i) => {
        const o = i - P;
        const x = o <= 0 ? o * W * .34 : Math.min(o, 1.6) * W * .46;                        // leaves to the left, waits at the right edge
        const sc = o <= 0 ? 1 + Math.max(o, -1) * .12 : 1 - Math.min(o, 1) * .14;
        const a = o <= 0 ? 1 + o * 1.45 : o <= 1 ? 1 - o * .6 : .4 - (o - 1) * .9;
        node.style.setProperty('--x', x.toFixed(1) + 'px'); node.style.setProperty('--s', sc.toFixed(4)); node.style.setProperty('--a', clamp(a, 0, 1).toFixed(3));
        node.style.visibility = a <= .01 ? 'hidden' : '';
      });
      setActive(Math.round(P), true);
    };
    panST = ScrollTrigger.create({ trigger: hero, start: 'top top', end: () => '+=' + Math.round(innerHeight * .9 * (n - 1)), pin: true, anticipatePin: 1, invalidateOnRefresh: true, onUpdate: s => draw(s.progress), onRefresh: s => draw(s.progress) });
    draw(panST.progress);
    return () => { panST.kill(); panST = null; hero.classList.remove('is-pan'); items.forEach(node => { ['--x', '--s', '--a'].forEach(v => node.style.removeProperty(v)); node.style.visibility = ''; }); sizeReel(); };
  });
}
function intro() {
  reel.classList.add('is-ready'); copy.classList.add('is-shown');
  if (RM || !HAS_GSAP) return;
  gsap.fromTo(items, { '--ia': 0, '--y': '26px' }, { '--ia': 1, '--y': '0px', duration: 1, ease: 'expo.out', stagger: .08 });
}

/* ----------------------------------------------------------------- archive */
const yearsHost = $('#years');
const tiles = [];          // by flyer index
const yearSecs = [];       // { y, sec, cols, items:[{node, ratio}], st:[] }
let vio = null, inIO = null;
function makeTile(f, k) {
  const b = el('button', 'tile'); b.type = 'button'; b.dataset.k = k;
  b.style.setProperty('--ar', f.w + ' / ' + f.h); b.style.setProperty('--c', f.c);
  b.setAttribute('aria-label', `Flyer ${k + 1} of ${F.length}, ${f.y}. Open larger.`);
  const img = new Image();
  img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.width = f.w; img.height = f.h; img.className = 'is-loading';
  img.addEventListener('load', () => img.classList.remove('is-loading'), { once: true });
  img.addEventListener('error', () => img.classList.remove('is-loading'), { once: true });
  img.src = `f/t/${id3(f.n)}.webp`;
  if (img.complete) img.classList.remove('is-loading');
  b.append(img);
  if (f.v && !RM) b.dataset.v = `f/v/${id3(f.n)}.mp4`;
  tiles[k] = b;
  return b;
}
const colCount = w => w >= 1180 ? 5 : w >= 760 ? 4 : w >= 500 ? 3 : 2;
const LAG = [0, 54, 16, 70, 30];          // px each column gains over the length of a year: enough to feel depth, not enough to notice the trick
function layoutYear(Y) {
  const n = colCount(Y.cols.clientWidth);
  const cols = Array.from({ length: n }, () => el('div', 'col')), hts = new Array(n).fill(0);
  for (const it of Y.items) {
    let j = 0; for (let i = 1; i < n; i++) if (hts[i] < hts[j] - .001) j = i;
    it.node.style.setProperty('--dl', (j * .05).toFixed(2) + 's');
    cols[j].append(it.node); hts[j] += it.ratio + .05;
  }
  Y.st.forEach(t => { if (t.scrollTrigger) t.scrollTrigger.kill(); t.kill(); }); Y.st = [];
  Y.cols.replaceChildren(...cols);
  if (RM || !HAS_ST || isSmall()) return;
  const f = clamp(Y.sec.offsetHeight / 1600, .35, 1);      // tops stay level until the year reaches the bar, short years drift less
  cols.forEach((c, i) => { const k = LAG[i % LAG.length] * f; if (k) Y.st.push(gsap.fromTo(c, { y: 0 }, { y: -k, ease: 'none', scrollTrigger: { trigger: Y.sec, start: 'top 112px', end: 'bottom top', scrub: true } })); });
}
function renderArchive() {
  const byYear = new Map();
  F.forEach((f, k) => { if (!byYear.has(f.y)) byYear.set(f.y, []); byYear.get(f.y).push({ node: makeTile(f, k), ratio: f.h / f.w }); });
  const years = [...byYear.keys()].sort((a, b) => b - a);
  $('#archive-count').textContent = `${F.length} flyers, ${years[years.length - 1]} to ${years[0]}. Newest first.`;
  const nav = $('#years-nav');
  nav.innerHTML = years.map(y => `<a href="#y-${y}">${y}</a>`).join('');
  for (const y of years) {
    const items = byYear.get(y), n = items.length;
    const sec = el('section', 'year', `<div class="year__head"><h3 class="year__num" id="yh-${y}">${y}</h3><p class="year__count">${n} flyer${n > 1 ? 's' : ''}</p></div><div class="cols"></div>`);
    sec.id = 'y-' + y; sec.setAttribute('aria-labelledby', 'yh-' + y);
    yearsHost.append(sec);
    const Y = { y, sec, cols: $('.cols', sec), items, st: [] };
    yearSecs.push(Y); layoutYear(Y);
  }
  let lastW = yearsHost.clientWidth;
  addEventListener('resize', debounce(() => { if (Math.abs(yearsHost.clientWidth - lastW) < 2) return; lastW = yearsHost.clientWidth; yearSecs.forEach(layoutYear); if (HAS_ST) ScrollTrigger.refresh(); }, 160));

  // which year is under the reader
  const links = $$('a', nav);
  const yo = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(a => { const on = a.getAttribute('href') === '#' + e.target.id; a.setAttribute('aria-current', String(on)); if (on && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.offsetWidth / 2, behavior: RM ? 'auto' : 'smooth' }); });
  }), { rootMargin: '-45% 0px -54% 0px' });
  yearSecs.forEach(Y => yo.observe(Y.sec));

  inIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); inIO.unobserve(e.target); } }), { rootMargin: '0px 0px -5% 0px' });
  tiles.forEach(b => inIO.observe(b));

  // the flyers that move only play while they are on screen
  if (!RM) {
    vio = new IntersectionObserver(es => es.forEach(e => {
      const b = e.target; let v = $('video', b);
      if (e.isIntersecting) {
        if (!v) { v = el('video'); v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'metadata'; v.src = b.dataset.v; v.setAttribute('aria-hidden', 'true'); b.append(v); }
        const p = v.play(); if (p && p.catch) p.catch(() => {});
      } else if (v) v.pause();
    }), { threshold: .55 });
    tiles.forEach(b => { if (b.dataset.v) vio.observe(b); });
  }
  yearsHost.addEventListener('click', e => { const b = e.target.closest('button.tile'); if (b) openViewer(+b.dataset.k, b); });
}

/* ------------------------------------------------------------------ viewer */
const viewer = $('#viewer'), vStage = $('#viewer-stage'), vMedia = $('#viewer-media'), vImg = $('#viewer-img');
const vShade = $('.viewer__shade'), vYear = $('#viewer-year'), vCount = $('#viewer-count');
const vPrev = $('#viewer-prev'), vNext = $('#viewer-next'), vClose = $('#viewer-close');
const vChrome = [$('.viewer__bar'), vPrev, vNext, vClose];
let vk = -1, vRect = null, vBusy = false, vHidden = null, vSrc = null, vSrcK = -1;
function targetRect(f) {
  const vw = innerWidth, vh = innerHeight, small = vw < 860;
  const px = small ? 10 : 88, top = small ? 60 : 28, bottom = small ? 92 : 60;
  const mw = vw - px * 2, mh = vh - top - bottom, s = Math.min(mw / f.w, mh / f.h, 1.6);
  const w = f.w * s, h = f.h * s;
  return { x: (vw - w) / 2, y: top + (mh - h) / 2, w, h };
}
const tf = (r, sx = 1, sy = 1, dx = 0, dy = 0) => `translate3d(${(r.x + dx).toFixed(1)}px,${(r.y + dy).toFixed(1)}px,0) scale(${sx},${sy})`;
function place() {
  vRect = targetRect(F[vk]);
  vMedia.style.width = vRect.w.toFixed(1) + 'px'; vMedia.style.height = vRect.h.toFixed(1) + 'px';
  vMedia.style.transform = tf(vRect);
}
function setMedia() {
  const f = F[vk], k = vk, thumb = `f/t/${id3(f.n)}.webp`, large = `f/l/${id3(f.n)}.webp`;
  const old = $('video', vMedia); if (old) old.remove();
  vImg.src = thumb;
  const big = new Image(); big.src = large;
  (big.decode ? big.decode() : Promise.resolve()).then(() => { if (vk === k) vImg.src = large; }).catch(() => { if (vk === k) vImg.src = large; });
  if (f.v) {
    const v = el('video'); v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.autoplay = !RM; v.controls = RM; v.poster = thumb; v.src = `f/v/${id3(f.n)}.mp4`;
    vMedia.append(v);
  }
  vYear.textContent = f.y; vCount.textContent = `${k + 1} / ${F.length}`;
  vPrev.disabled = k === 0; vNext.disabled = k === F.length - 1;
  vPrev.style.visibility = k === 0 ? 'hidden' : ''; vNext.style.visibility = k === F.length - 1 ? 'hidden' : '';
  [k - 1, k + 1].forEach(i => { if (F[i]) { const p = new Image(); p.src = `f/l/${id3(F[i].n)}.webp`; } });
}
function openViewer(k, src) {
  if (vBusy || viewer.open) return;
  vk = k; vSrc = src || tiles[k]; vSrcK = k;
  const a = vSrc.getBoundingClientRect();
  place(); setMedia(); viewer.showModal(); if (lenis) lenis.stop();
  vHidden = vSrc; vSrc.style.visibility = 'hidden';
  if (RM) return;
  // the flyer grows out of where it was hanging
  vMedia.animate([{ transform: tf({ x: a.left, y: a.top }, a.width / vRect.w, a.height / vRect.h) }, { transform: tf(vRect) }], { duration: 460, easing: 'cubic-bezier(.23,1,.32,1)' });
  vShade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
  vChrome.forEach(n => n.animate([{ opacity: 0 }, { opacity: 0, offset: .4 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' }));
}
function closeViewer() {
  if (vBusy || !viewer.open) return;
  const fromWall = vSrc.classList.contains('tile');
  let target = fromWall ? tiles[vk] : (vSrcK === vk ? vSrc : null);      // a hero flyer only takes back the one it gave
  const done = () => {
    viewer.close(); if (lenis) lenis.start();
    if (vHidden) vHidden.style.visibility = ''; if (target) target.style.visibility = '';
    vHidden = null; vBusy = false; vImg.removeAttribute('src'); const v = $('video', vMedia); if (v) v.remove();
    if (target && target.tabIndex !== -1) target.focus({ preventScroll: true });
  };
  if (vHidden && vHidden !== target) { vHidden.style.visibility = ''; vHidden = null; }
  let a = target && target.getBoundingClientRect();
  if (fromWall && (a.bottom < 70 || a.top > innerHeight - 20)) { target.classList.add('is-in'); jumpTo(target); a = target.getBoundingClientRect(); }
  if (target && !fromWall && (a.width < 8 || a.bottom < 0 || a.top > innerHeight || a.right < 0 || a.left > innerWidth)) { target.style.visibility = ''; target = null; }
  if (RM) { done(); return; }
  vBusy = true;
  const cur = getComputedStyle(vMedia).transform;
  let an;
  if (target) {
    target.style.visibility = 'hidden';
    an = vMedia.animate([{ transform: cur }, { transform: tf({ x: a.left, y: a.top }, a.width / vRect.w, a.height / vRect.h) }], { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
  } else {
    an = vMedia.animate([{ transform: cur, opacity: 1 }, { transform: tf(vRect, .96, .96, vRect.w * .02, vRect.h * .02 + 12), opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
  }
  vShade.animate([{ opacity: getComputedStyle(vShade).opacity }, { opacity: 0 }], { duration: 280, easing: 'ease-out', fill: 'forwards' });
  vChrome.forEach(n => n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }));
  an.finished.then(() => { done(); [vMedia, vShade, ...vChrome].forEach(n => n.getAnimations().forEach(x => x.cancel())); vMedia.style.transform = ''; vShade.style.opacity = ''; });
}
function go(dir, viaKey) {
  if (vBusy || !viewer.open) return;
  const k2 = vk + dir;
  if (k2 < 0 || k2 >= F.length) {            // end of the wall: a short nudge, no wrap
    if (!RM && !viaKey) vMedia.animate([{ transform: tf(vRect) }, { transform: tf(vRect, 1, 1, -dir * 14) }, { transform: tf(vRect) }], { duration: 240, easing: 'ease-out' });
    return;
  }
  if (vHidden) { vHidden.style.visibility = ''; vHidden = null; }
  vk = k2; place(); setMedia();
  // arrow keys get an instant swap; a click or a swipe gets a short slide in from the side it came from
  if (!RM && !viaKey) vMedia.animate([{ transform: tf(vRect, 1, 1, dir * 40), opacity: 0 }, { transform: tf(vRect), opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.23,1,.32,1)' });
}
vClose.addEventListener('click', closeViewer);
vPrev.addEventListener('click', () => go(-1));
vNext.addEventListener('click', () => go(1));
viewer.addEventListener('cancel', e => { e.preventDefault(); closeViewer(); });
viewer.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1, true); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1, true); } });
addEventListener('resize', debounce(() => { if (viewer.open) place(); }, 100));
// drag: sideways to move through the wall, down to put it back
(() => {
  let id = null, sx = 0, sy = 0, t0 = 0, dx = 0, dy = 0, axis = null, moved = false, onMedia = false;
  vStage.addEventListener('pointerdown', e => { if (vBusy || id !== null) return; id = e.pointerId; onMedia = !!e.target.closest('.viewer__media'); sx = e.clientX; sy = e.clientY; t0 = performance.now(); dx = dy = 0; axis = null; moved = false; vStage.setPointerCapture(id); });
  vStage.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    if (!axis && Math.abs(dx) + Math.abs(dy) > 8) { axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; moved = true; }
    if (axis === 'x') vMedia.style.transform = tf(vRect, 1, 1, dx);
    else if (axis === 'y') { const d = dy > 0 ? dy : dy * .25, s = 1 - Math.min(.25, Math.max(0, d) / 1400); vMedia.style.transform = tf(vRect, s, s, vRect.w * (1 - s) / 2, d); vShade.style.opacity = String(1 - Math.min(.7, Math.max(0, d) / 520)); }
  });
  const end = e => {
    if (e.pointerId !== id) return; id = null;
    const dt = Math.max(1, performance.now() - t0), vx = Math.abs(dx) / dt, vy = dy / dt;
    if (!moved) { if (!onMedia) closeViewer(); return; }
    if (axis === 'x' && (Math.abs(dx) > 64 || vx > .45)) { go(dx < 0 ? 1 : -1); vShade.style.opacity = ''; return; }
    if (axis === 'y' && (dy > 110 || vy > .55)) { closeViewer(); return; }
    const cur = vMedia.style.transform; vMedia.style.transform = tf(vRect); vShade.style.opacity = '';
    if (!RM) vMedia.animate([{ transform: cur }, { transform: tf(vRect) }], { duration: 220, easing: 'cubic-bezier(.23,1,.32,1)' });
  };
  vStage.addEventListener('pointerup', end); vStage.addEventListener('pointercancel', end);
})();

/* ------------------------------------------------------- page-level pieces */
function initPage() {
  const nav = $('.nav');
  new IntersectionObserver(es => nav.classList.toggle('is-stuck', !es[0].isIntersecting)).observe($('.nav-sentinel'));
  const navLinks = $$('.nav__links a');
  const so = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) navLinks.forEach(a => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + e.target.id)));
  }), { rootMargin: '-40% 0px -55% 0px' });
  ['shows', 'list', 'archive', 'about'].forEach(i => { const n = document.getElementById(i); if (n) so.observe(n); });

  // sign-up: Laylo's own form (phone and email). The draft preview cannot load other sites' frames, so it shows a note instead.
  const list = $('#list'), lf = $('#list-form');
  if (list && lf) {
    const user = (list.dataset.laylo || '').trim(), live = document.documentElement.hasAttribute('data-live');
    const page = user ? 'https://laylo.com/' + encodeURIComponent(user) : '';
    if (live && !user) { list.hidden = true; navLinks.forEach(a => { if (a.getAttribute('href') === '#list') a.hidden = true; }); }
    else if (live) {
      const f = document.createElement('iframe');
      f.src = page + '/profile/embed?theme=dark&background=transparent';
      f.title = 'Sign up for Lights Down Low texts and emails'; f.loading = 'lazy';
      f.setAttribute('scrolling', 'no'); f.setAttribute('allowtransparency', 'true');
      const alt = document.createElement('p'); alt.className = 'list__alt';
      alt.innerHTML = `Form not showing? <a class="link" href="${page}" target="_blank" rel="noopener">Sign up on Laylo</a>.`;
      lf.append(f, alt);
    } else {
      const d = document.createElement('div'); d.className = 'list__draft';
      d.innerHTML = '<p>Draft preview only: the Cymbal sign-up form for phone and email loads here on the live site.</p>' + (user ? `<a class="btn" href="${page}" target="_blank" rel="noopener">Open Laylo</a>` : '');
      lf.append(d);
    }
  }

  // section openings rise into place once
  $$('.head > *, .list__copy > *, .list__form, .about__copy > *, .about__photo').forEach(n => { n.setAttribute('data-rise', ''); n.style.setProperty('--i', n.matches('.head > *, .list__copy > *, .about__copy > *') ? [...n.parentElement.children].indexOf(n) : 0); });
  const ro = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); ro.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('[data-rise]').forEach(n => ro.observe(n));

  if (RM || !HAS_ST) return;
  gsap.fromTo('.about__photo img', { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: '.about__photo', start: 'top bottom', end: 'bottom top', scrub: true } });
}

/* -------------------------------------------------------------------- boot */
function boot() {
  renderHero(); renderArchive(); initPage();
  if (HAS_ST) ScrollTrigger.refresh();
  // hold the opening until the hero flyers have their pictures (or a second has passed)
  const first = $$('img', reel).slice(0, 2).map(im => im.decode ? im.decode().catch(() => {}) : Promise.resolve());
  Promise.race([Promise.all(first), new Promise(r => setTimeout(r, 1000))]).then(intro);
}
const fontReady = document.fonts && document.fonts.load ? document.fonts.load('600 48px "Instrument Sans"').then(() => document.fonts.ready) : Promise.resolve();
Promise.race([fontReady, new Promise(r => setTimeout(r, 2000))]).then(boot, boot);
})();
