/* L'AMOUR NAILS : comportement du site (statique, aucun service externe).
   GSAP + ScrollTrigger + Lenis sont hébergés dans /assets/js.
   Réglage unique à compléter si un jour un numéro est communiqué : CONFIG.phone */
(() => {
'use strict';

const CONFIG = {
  phone: '', // ex. '+33400000000' : tant que c'est vide, aucun bouton « Appeler » n'est affiché
  openDays: [1, 2, 3, 4, 5, 6],
  open: [9, 30],
  close: [19, 0]
};

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const html = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
const NS = 'http://www.w3.org/2000/svg';
let lenis = null;

if (reduce) html.classList.add('is-reduced');
try { history.scrollRestoration = 'manual'; } catch (e) {}

/* ---------- utilitaires ---------- */
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
const fmt = (v, dec = 0) => v.toFixed(dec).replace('.', ',');

/* ---------- séparateurs "goutte de vernis" ---------- */
function dripPath(W, H, base, seed, count) {
  const r = rng(seed);
  const step = W / count;
  let d = `M0 0H${W}V${base}`;
  for (let i = count; i > 0; i--) {
    const cx = i * step - step / 2 + (r() - 0.5) * step * 0.5;
    const hw = 7 + r() * 8;
    const long = r() > 0.38;
    const len = long ? 40 + r() * Math.max(10, H - base - hw - 46) : 14 + r() * 22;
    const yEnd = base + len;
    d += ` H${(cx + hw * 2.4).toFixed(1)}`
      + ` C${(cx + hw * 1.3).toFixed(1)} ${base} ${(cx + hw).toFixed(1)} ${(base + len * 0.2).toFixed(1)} ${(cx + hw).toFixed(1)} ${(base + len * 0.5).toFixed(1)}`
      + ` V${yEnd.toFixed(1)} A${hw.toFixed(1)} ${hw.toFixed(1)} 0 0 1 ${(cx - hw).toFixed(1)} ${yEnd.toFixed(1)}`
      + ` V${(base + len * 0.5).toFixed(1)}`
      + ` C${(cx - hw).toFixed(1)} ${(base + len * 0.2).toFixed(1)} ${(cx - hw * 1.3).toFixed(1)} ${base} ${(cx - hw * 2.4).toFixed(1)} ${base}`;
  }
  return d + ' H0Z';
}
function buildDrips() {
  $$('svg[data-drip]').forEach((svg, i) => {
    const vb = svg.viewBox.baseVal;
    $('path', svg).setAttribute('d', dripPath(vb.width, vb.height, 6, 11 + i * 7, 13));
  });
  const ld = $('path[data-drip-path]');
  if (ld) ld.setAttribute('d', dripPath(1440, 220, 8, 5, 14));
}

/* ---------- découpe de texte (lettres / mots) ---------- */
function split(root, mode) {
  const isHeading = /^H[1-6]$/.test(root.tagName);
  if (isHeading) root.setAttribute('aria-label', root.textContent.replace(/\s+/g, ' ').trim());
  const frag = document.createDocumentFragment();
  const walk = (node, parent) => {
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(p => {
          if (!p) return;
          if (/^\s+$/.test(p)) { parent.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          const wi = document.createElement('span'); wi.className = 'wi';
          if (mode === 'chars') {
            [...p].forEach(ch => { const c = document.createElement('span'); c.className = 'c'; c.textContent = ch; wi.appendChild(c); });
          } else wi.textContent = p;
          w.appendChild(wi); parent.appendChild(w);
        });
      } else if (n.nodeType === 1) {
        if (n.tagName === 'BR') { parent.appendChild(n.cloneNode()); return; }
        const clone = n.cloneNode(false); parent.appendChild(clone); walk(n, clone);
      }
    });
  };
  walk(root, frag);
  root.textContent = '';
  root.appendChild(frag);
  return { words: $$('.wi', root), chars: $$('.c', root) };
}

/* ---------- horaires : "ouvert maintenant" ---------- */
function initHours() {
  const out = $('#openNow'); if (!out) return;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t).value;
  const day = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get('weekday')];
  const mins = (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10);
  const o = CONFIG.open[0] * 60 + CONFIG.open[1], c = CONFIG.close[0] * 60 + CONFIG.close[1];
  const row = $(`tr[data-day="${day}"]`); if (row) row.classList.add('is-today');
  const isOpenDay = CONFIG.openDays.includes(day);
  if (isOpenDay && mins >= o && mins < c) {
    out.textContent = 'Ouvert · ferme à 19h00'; out.classList.add('is-open');
  } else if (isOpenDay && mins < o) {
    out.textContent = 'Fermé · ouvre à 9h30';
  } else {
    const next = day === 6 ? 'lundi' : day === 0 ? 'lundi' : 'demain';
    out.textContent = `Fermé · ouvre ${next} à 9h30`;
  }
}

/* ---------- composer sa visite ---------- */
function initComposer() {
  const picker = $('#picker'); if (!picker) return;
  const items = [];
  let n = 0;
  $$('.panel[id^="cat-"]').forEach((panel, gi) => {
    const details = document.createElement('details');
    details.className = 'pick-group';
    if (gi === 0) details.open = true;
    const sum = document.createElement('summary');
    const label = document.createElement('span'); label.textContent = $('h3', panel).textContent.trim();
    const count = document.createElement('span'); count.className = 'count'; count.setAttribute('aria-hidden', 'true');
    sum.append(label, count);
    const list = document.createElement('div'); list.className = 'pick-list';
    details.append(sum, list);
    $$('.svc', panel).forEach(li => {
      const name = $('.svc__name', li).textContent.trim();
      const tRaw = $('.svc__time', li).textContent;
      const pRaw = $('.svc__price', li).textContent;
      const h = /(\d+)\s*h/.exec(tRaw), m = /(\d+)\s*min/.exec(tRaw);
      const min = (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0);
      const price = parseInt(/(\d+)/.exec(pRaw)[1], 10);
      const from = /dès/i.test(pRaw);
      const item = { id: 's' + (++n), name, min, price, from, tRaw, pRaw, group: gi, count };
      items.push(item);
      const lab = document.createElement('label'); lab.className = 'pick';
      lab.innerHTML = '<input type="checkbox"><span class="box"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-heart"/></svg></span><span class="pick__name"></span><span class="pick__meta"></span>';
      $('input', lab).value = item.id;
      $('.pick__name', lab).textContent = name;
      const meta = $('.pick__meta', lab);
      meta.append(document.createTextNode(tRaw.trim()));
      const b = document.createElement('b'); b.textContent = pRaw.trim(); meta.appendChild(b);
      item.input = $('input', lab);
      list.appendChild(lab);
    });
    picker.appendChild(details);
  });

  const listEl = $('#ticketList'), tTime = $('#ticketTime'), tTotal = $('#ticketTotal'), hint = $('#ticketHint');
  const fmtMin = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`;
  const state = () => items.filter(i => i.input.checked);
  function update() {
    const sel = state();
    listEl.textContent = '';
    if (!sel.length) {
      const li = document.createElement('li'); li.className = 'ticket__empty'; li.textContent = 'Aucune prestation choisie pour l\'instant.'; listEl.appendChild(li);
    } else sel.forEach(i => {
      const li = document.createElement('li');
      const s = document.createElement('span'); s.textContent = i.name;
      const b = document.createElement('b'); b.textContent = i.pRaw.trim();
      li.append(s, b); listEl.appendChild(li);
    });
    const total = sel.reduce((a, i) => a + i.price, 0), time = sel.reduce((a, i) => a + i.min, 0);
    tTotal.textContent = (sel.some(i => i.from) ? 'dès ' : '') + total + ' €';
    tTime.textContent = fmtMin(time);
    hint.textContent = sel.length
      ? 'Sur Planity, choisissez ces mêmes prestations, puis votre créneau.'
      : 'Sur Planity, retrouvez les mêmes prestations puis choisissez votre créneau.';
    const perGroup = {};
    sel.forEach(i => perGroup[i.group] = (perGroup[i.group] || 0) + 1);
    items.forEach(i => {
      const c = i.count, v = perGroup[i.group] || 0;
      c.textContent = v || ''; c.classList.toggle('is-on', !!v);
    });
  }
  picker.addEventListener('change', update);
  update();

  const copyBtn = $('#ticketCopy'), status = $('#copyStatus');
  copyBtn.addEventListener('click', async () => {
    const sel = state();
    const lines = sel.length
      ? ['Ma visite chez L\'AMOUR NAILS (Aix-en-Provence) :', ...sel.map(i => `- ${i.name} (${i.tRaw.trim()}, ${i.pRaw.trim()})`), `Total : ${tTotal.textContent} · ${tTime.textContent}`]
      : ['Je n\'ai pas encore choisi de prestation chez L\'AMOUR NAILS.'];
    const text = lines.join('\n');
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) {} ta.remove(); }
    const old = copyBtn.textContent; copyBtn.textContent = 'Copié ✓'; status.textContent = 'Votre sélection a été copiée.';
    setTimeout(() => { copyBtn.textContent = old; status.textContent = ''; }, 2200);
  });
}

/* ---------- Nail studio : essayeur de teinte sur une vraie main ---------- */
function initStudio() {
  const svg = $('#studioSvg'); if (!svg) return;
  const defs = $('defs', svg), layer = $('#studioLayer');
  /* contours des 5 ongles relevés sur la photo (repère de l'image) + milieu de la cuticule */
  const NAILS = [
    { pts: '88,358 104,357 120,364 135,378 148,396 160,414 163,427 150,433 132,438 114,437 98,431 84,422 72,408 65,392 66,375 76,364', cut: [136, 434] },
    { pts: '196,273 212,270 228,276 242,290 254,308 266,327 276,345 281,355 265,360 245,358 225,356 208,350 194,338 184,320 180,303 184,288', cut: [243, 358] },
    { pts: '342,322 355,315 370,317 384,328 397,347 410,370 416,391 405,400 385,399 365,394 348,384 335,368 327,350 328,334', cut: [385, 398] },
    { pts: '546,480 560,476 576,482 590,496 604,515 616,536 619,549 608,550 592,546 575,540 560,530 548,515 538,500 536,488', cut: [590, 546] },
    { pts: '92,850 100,833 115,820 134,809 160,806 183,812 200,828 212,850 216,875 212,900 205,920 192,935 175,945 160,942 140,930 120,912 105,890 95,868', cut: [190, 934] }
  ];
  const f = v => +v.toFixed(1);
  const smooth = pts => {            /* courbe fermée lisse (Catmull-Rom) passant par les points */
    const n = pts.length; let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`;
    }
    return d + 'Z';
  };

  const wraps = NAILS.map((n, i) => {
    const pts = n.pts.split(' ').map(s => s.split(',').map(Number));
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    let ux = cx - n.cut[0], uy = cy - n.cut[1]; const m = Math.hypot(ux, uy); ux /= m; uy /= m;
    let L = 0, W = 0;                /* longueur (cuticule → pointe) et demi-largeur de l'ongle */
    pts.forEach(p => { const dx = p[0] - n.cut[0], dy = p[1] - n.cut[1]; L = Math.max(L, dx * ux + dy * uy); W = Math.max(W, Math.abs(-dx * uy + dy * ux)); });
    const phi = Math.atan2(ux, -uy) * 180 / Math.PI;   /* repère local : -y pointe vers le bout de l'ongle */

    const clip = el('clipPath', { id: 'nc' + i }, defs); el('path', { d: smooth(pts) }, clip);
    const gb = el('linearGradient', { id: 'gb' + i, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: f(-L) }, defs);
    el('stop', { offset: 0, style: 'stop-color:var(--nail)' }, gb);
    el('stop', { offset: 0.38, style: 'stop-color:var(--nail)' }, gb);
    el('stop', { offset: 1, 'stop-color': '#fff8f3' }, gb);

    const wrap = el('g', { class: 'nailwrap' }, layer);
    const g = el('g', { class: 'nail', 'clip-path': `url(#nc${i})` }, wrap);
    const loc = el('g', { transform: `translate(${n.cut[0]} ${n.cut[1]}) rotate(${f(phi)})` }, g);
    const ext = { x: f(-W * 1.7), y: f(-L * 1.5), width: f(W * 3.4), height: f(L * 1.6) };
    el('rect', Object.assign({ class: 'l l-solid' }, ext), loc);
    el('rect', Object.assign({ class: 'l l-milk' }, ext), loc);
    el('path', { class: 'l l-tip', d: `M${f(-W * 1.7)} ${f(-L * 1.5)}H${f(W * 1.7)}V${f(-L * 0.86)}Q0 ${f(-L * 0.46)} ${f(-W * 1.7)} ${f(-L * 0.86)}Z` }, loc);
    el('rect', Object.assign({ class: 'l l-baby', fill: `url(#gb${i})` }, ext), loc);
    el('rect', Object.assign({ class: 'l l-chrome' }, ext), loc);
    el('ellipse', { class: 'gloss', cx: f(-W * 0.22), cy: f(-L * 0.55), rx: f(W * 0.1), ry: f(L * 0.24) }, loc);
    el('ellipse', { class: 'gloss gloss--s', cx: f(W * 0.3), cy: f(-L * 0.78), rx: f(W * 0.05), ry: f(L * 0.08) }, loc);
    const sh = el('rect', { class: 'shine-r', x: f(-W * 1.4), y: f(-L * 1.4), width: f(W * 0.6), height: f(L * 1.5) }, loc);
    sh.style.animationDelay = (-i * 0.4) + 's';
    /* la photo elle-même, en relief seulement : reflets et ombres du vrai ongle par-dessus la couleur */
    el('image', { class: 'tex', href: 'assets/hand.jpg', x: 30, y: 235, width: 870, height: 905 }, g);
    return wrap;
  });

  const root = $('#studioNails');
  const finishBtns = $$('#finishGroup [role=radio]'), swatches = $$('#swatchGroup [role=radio]');
  const note = $('#studioNote'), cname = $('#colorName');
  const NOTES = {
    classic: 'Classique : le vernis seul, brillant et net.',
    french: 'French : base nude, pointe dans la teinte choisie. +5 €.',
    baby: 'Baby Boomer : un dégradé tout en douceur, de votre teinte vers une pointe lumineuse. +5 €.',
    chrome: 'Effet chrome : un reflet miroir qui change avec la lumière. +5 €.'
  };
  const flash = () => { if (hasGsap && !reduce) gsap.fromTo(wraps, { opacity: 0.15 }, { opacity: 1, duration: 0.7, ease: 'power2.out', stagger: 0.07, overwrite: true }); };
  const setFinish = f2 => { svg.dataset.finish = f2; note.textContent = NOTES[f2]; };
  const setColor = (c, name) => { root.style.setProperty('--nail', c); cname.textContent = name; };
  const radio = (btns, btn) => btns.forEach(b => b.setAttribute('aria-checked', String(b === btn)));
  const arrows = (btns, e) => {
    const i = btns.indexOf(document.activeElement); if (i < 0) return;
    let j = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % btns.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + btns.length) % btns.length;
    else return;
    e.preventDefault(); btns[j].focus(); btns[j].click();
  };
  finishBtns.forEach(b => b.addEventListener('click', () => { radio(finishBtns, b); setFinish(b.dataset.finish); flash(); }));
  swatches.forEach(b => b.addEventListener('click', () => { radio(swatches, b); setColor(b.dataset.color, b.dataset.name); flash(); }));
  $('#finishGroup').addEventListener('keydown', e => arrows(finishBtns, e));
  $('#swatchGroup').addEventListener('keydown', e => arrows(swatches, e));
  setFinish('classic'); setColor('#c8102e', 'Rouge amour');
}
/* ---------- visionneuse photo ---------- */
function initLightbox() {
  const box = $('#lightbox'); if (!box) return;
  const items = $$('.gi'); const img = $('#lbImg'), cap = $('#lbCap');
  let idx = 0, last = null;
  const show = i => {
    idx = (i + items.length) % items.length;
    const a = items[idx], im = $('img', a);
    img.src = a.getAttribute('href'); img.alt = im ? im.alt : ''; cap.textContent = a.dataset.cap || '';
  };
  const open = i => {
    last = document.activeElement; show(i); box.hidden = false; $('#lbClose').focus();
    if (lenis) lenis.stop(); else html.style.overflow = 'hidden';
  };
  const close = () => {
    box.hidden = true; if (lenis) lenis.start(); else html.style.overflow = '';
    if (last) last.focus();
  };
  items.forEach((a, i) => a.addEventListener('click', e => { e.preventDefault(); open(i); }));
  $('#lbClose').addEventListener('click', close);
  $('#lbPrev').addEventListener('click', () => show(idx - 1));
  $('#lbNext').addEventListener('click', () => show(idx + 1));
  box.addEventListener('click', e => { if (e.target === box) close(); });
  document.addEventListener('keydown', e => {
    if (box.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(idx - 1);
    else if (e.key === 'ArrowRight') show(idx + 1);
    else if (e.key === 'Tab') {
      const f = $$('button', box), first = f[0], lastB = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastB.focus(); }
      else if (!e.shiftKey && document.activeElement === lastB) { e.preventDefault(); first.focus(); }
    }
  });
}

/* ---------- navigation, menu mobile, barre d'action ---------- */
let menuOpen = false;
function initNav() {
  const nav = $('#nav'), bar = $('#progressBar'), dock = $('#dock');
  const burger = $('#burger'), menu = $('#menu');
  const inertTargets = [$('#main'), $('.footer'), dock];
  const setMenu = open => {
    menuOpen = open;
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    inertTargets.forEach(t => t && (t.inert = open));
    if (lenis) open ? lenis.stop() : lenis.start(); else html.style.overflow = open ? 'hidden' : '';
    if (open) nav.classList.remove('nav--hidden');
  };
  burger.addEventListener('click', () => setMenu(!menuOpen));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); } });
  window.closeMenu = () => menuOpen && setMenu(false);

  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY, max = document.documentElement.scrollHeight - innerHeight;
    nav.classList.toggle('nav--solid', y > 60);
    if (!menuOpen) {
      if (y > 320 && y > lastY + 4) nav.classList.add('nav--hidden');
      else if (y < lastY - 4 || y < 320) nav.classList.remove('nav--hidden');
    }
    lastY = y;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    dock.classList.toggle('is-visible', y > innerHeight * 0.7);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); if (id.length < 2) return;
    const t = $(id); if (!t) return;
    e.preventDefault();
    if (window.closeMenu) window.closeMenu();
    const go = () => lenis ? lenis.scrollTo(t, { offset: 0, duration: 1.7, easing: x => 1 - Math.pow(1 - x, 4) }) : t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    menuOpen ? setTimeout(go, 400) : go();
    history.replaceState(null, '', id);
  }));

  /* si un numéro est un jour ajouté dans CONFIG.phone : boutons « Appeler » (tel:) */
  if (CONFIG.phone) {
    const tel = document.createElement('a');
    tel.className = 'btn btn--ghost-dark'; tel.href = 'tel:' + CONFIG.phone;
    tel.innerHTML = '<span class="btn__fill"></span><span class="btn__label">Appeler</span>';
    dock.appendChild(tel);
  }
}

/* ---------- lecture de la vidéo d'ouverture ---------- */
function initVideo() {
  const v = $('#heroVideo'); if (!v) return;
  const saveData = navigator.connection && navigator.connection.saveData;
  const small = matchMedia('(max-width: 767px)').matches;
  if (reduce || saveData || small) return;           /* image de secours (poster) uniquement */
  v.src = v.dataset.src; v.muted = true;
  const p = v.play(); if (p && p.catch) p.catch(() => {});
  document.addEventListener('visibilitychange', () => { document.hidden ? v.pause() : v.play().catch(() => {}); });
}

/* =====================================================================
   MOUVEMENT
   ===================================================================== */
function initMotion() {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const mm = gsap.matchMedia();

  /* --- magnétisme des boutons --- */
  if (finePointer && !reduce) {
    $$('.magnetic').forEach(b => {
      const lab = $('.btn__label', b);
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        gsap.to(b, { x: dx * 0.28, y: dy * 0.4, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
        if (lab) gsap.to(lab, { x: dx * 0.12, y: dy * 0.16, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
      });
      b.addEventListener('pointerleave', () => gsap.to([b, lab], { x: 0, y: 0, duration: 1, ease: 'elastic.out(1,.4)', overwrite: 'auto' }));
    });
  }

  /* --- inclinaison 3D + reflet --- */
  if (finePointer && !reduce) {
    $$('[data-tilt], [data-tilt-soft]').forEach(card => {
      const k = card.hasAttribute('data-tilt-soft') ? 6 : 13;
      gsap.set(card, { transformPerspective: 900 });
      const rx = gsap.quickTo(card, 'rotationX', { duration: 0.7, ease: 'power3' });
      const ry = gsap.quickTo(card, 'rotationY', { duration: 0.7, ease: 'power3' });
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        ry(px * k); rx(-py * k);
        card.style.setProperty('--mx', (px + 0.5) * 100 + '%'); card.style.setProperty('--my', (py + 0.5) * 100 + '%');
      });
      card.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  /* --- curseur contextuel --- */
  if (finePointer) {
    const cur = $('#cursor'), lab = $('span', cur);
    const qx = gsap.quickTo(cur, 'x', { duration: 0.45, ease: 'power3' }), qy = gsap.quickTo(cur, 'y', { duration: 0.45, ease: 'power3' });
    window.addEventListener('pointermove', e => { qx(e.clientX); qy(e.clientY); }, { passive: true });
    $$('.gi').forEach(g => g.dataset.cursor = 'Voir');
    $$('[data-cursor]').forEach(t => {
      t.addEventListener('pointerenter', () => { lab.textContent = t.dataset.cursor; gsap.to(cur, { opacity: 1, scale: 1, duration: 0.45, ease: 'expo.out' }); });
      t.addEventListener('pointerleave', () => gsap.to(cur, { opacity: 0, scale: 0.2, duration: 0.4, ease: 'power3.out' }));
    });
  }

  /* --- découpe des titres --- */
  const heroChars = split($('[data-hero-title]', document), 'chars');
  const heroTitles = $$('[data-hero-title]');
  const heroSplit = heroTitles.map((t, i) => i === 0 ? heroChars : split(t, 'chars'));
  const reveals = [];
  $$('[data-split]').forEach(t => {
    if (t.hasAttribute('data-hero-title')) return;
    const mode = t.dataset.split === 'chars' ? 'chars' : 'words';
    const s = split(t, mode);
    reveals.push({ t, targets: mode === 'chars' ? s.chars : s.words });
  });
  const scrub = $$('[data-scrub-words]').map(t => ({ t, words: split(t, 'words').words }));
  const footerGiant = $('[data-footer-giant]');
  const giantChars = footerGiant ? split(footerGiant, 'chars').chars : [];

  /* --- réglages initiaux (cachés tant que le loader est là) --- */
  if (!reduce) {
    heroSplit.forEach(s => gsap.set(s.chars, { yPercent: 118 }));
    gsap.set($$('[data-hero-in]'), { opacity: 0, y: 40 });
    gsap.set($$('.float'), { opacity: 0, scale: 0.6, yPercent: 20 });
    reveals.forEach(r => gsap.set(r.targets, { yPercent: 112 }));
    gsap.set(giantChars, { yPercent: 108 });
    scrub.forEach(s => gsap.set(s.words, { opacity: 0.4 }));
  }

  /* ---------- LOADER + INTRO ---------- */
  const loader = $('#loader');
  let started = false;
  function startSite() {
    if (started) return; started = true;
    html.classList.remove('is-loading');
    if (lenis) lenis.start();
    if (reduce) return;
    const tl = gsap.timeline();
    tl.from('.hero__media', { scale: 1.28, duration: 2.6, ease: 'expo.out' }, 0)
      .to(heroSplit.flatMap(s => s.chars), { yPercent: 0, duration: 1.5, ease: 'expo.out', stagger: 0.05 }, 0.1)
      .to($$('[data-hero-in]'), { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', stagger: 0.1 }, 0.5)
      .to($$('.float'), { opacity: 1, scale: 1, yPercent: 0, duration: 1.6, ease: 'expo.out', stagger: 0.12 }, 0.4);
  }
  function runLoader() {
    if (reduce || !loader) { if (loader) loader.remove(); startSite(); return; }
    const num = $('#loaderNum'), counter = { v: 0 };
    const tl = gsap.timeline({ onComplete: () => loader.remove() });
    tl.from('.loader__heart', { scale: 0, rotate: -30, duration: 0.9, ease: 'back.out(2)' })
      .from('.loader__brand span, .loader__brand em', { yPercent: 125, duration: 1, ease: 'expo.out', stagger: 0.12 }, 0.1)
      .to(counter, { v: 100, duration: 1.7, ease: 'power2.inOut', onUpdate: () => { num.textContent = Math.round(counter.v); } }, 0)
      .to('.loader__heart', { scale: 1.5, duration: 0.5, ease: 'power2.in' }, 1.5)
      .to('.loader__ink', { scale: 6.5, duration: 1.15, ease: 'expo.inOut' }, 1.6)
      .to(loader, { y: () => -(innerHeight + 280), duration: 1.25, ease: 'expo.inOut' }, 2.75)
      .add(startSite, 3.2);
  }
  if (document.readyState === 'complete') runLoader(); else window.addEventListener('load', runLoader, { once: true });
  setTimeout(() => { if (!started) { if (loader) loader.remove(); startSite(); } }, 9000);

  /* ---------- LENIS (défilement doux) ---------- */
  if (!reduce) {
    lenis = new Lenis({ duration: 1.2, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  /* ---------- Parallax du hero (multicouche) ---------- */
  if (!reduce) {
    const st = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('.hero__media', { yPercent: 16, ease: 'none', scrollTrigger: st });
    gsap.to('.hero__ghost', { yPercent: 22, ease: 'none', scrollTrigger: st });
    gsap.to('.hero__floats', { yPercent: -16, ease: 'none', scrollTrigger: st });
    gsap.to('.hero__inner', { yPercent: -10, ease: 'none', scrollTrigger: st });
    if (finePointer) {
      const layers = $$('[data-hero-layer]').map(l => ({
        f: parseFloat(l.dataset.heroLayer),
        x: gsap.quickTo(l, 'x', { duration: 1.4, ease: 'power3' }),
        y: gsap.quickTo(l, 'y', { duration: 1.4, ease: 'power3' })
      }));
      $('#hero').addEventListener('pointermove', e => {
        const x = e.clientX - innerWidth / 2, y = e.clientY - innerHeight / 2;
        layers.forEach(l => { l.x(x * l.f * 10); l.y(y * l.f * 10); });
      });
    }
  }

  /* ---------- Marquee (vitesse + direction pilotées par le scroll) ---------- */
  if (!reduce) {
    const rows = $$('[data-marquee]').map(row => {
      const track = $('.marquee__track', row);
      const w0 = track.scrollWidth;
      const base = track.innerHTML;
      let guard = 0;
      while (track.scrollWidth < innerWidth + w0 * 2 && guard++ < 6) track.insertAdjacentHTML('beforeend', base);
      return { track, w: w0, x: 0, dir: +row.dataset.marquee, ts: +row.dataset.marquee, speed: 70 };
    });
    let vel = 0, sdir = 1;
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: s => { vel = Math.abs(s.getVelocity()); if (s.direction) sdir = s.direction; } });
    gsap.ticker.add((time, dt) => {
      const d = Math.min(dt, 60) / 1000;
      vel *= 0.93;
      rows.forEach(m => {
        const target = m.dir * sdir * (1 + Math.min(vel / 140, 7));
        m.ts += (target - m.ts) * 0.07;
        m.x -= m.speed * m.ts * d;
        if (m.x <= -m.w) m.x += m.w;
        if (m.x > 0) m.x -= m.w;
        m.track.style.transform = `translate3d(${m.x.toFixed(2)}px,0,0)`;
      });
    });
  }

  /* ---------- Parallax simple des photos du manifeste ---------- */
  if (!reduce) $$('[data-parallax]').forEach(e => {
    const f = parseFloat(e.dataset.parallax) * 100;
    gsap.fromTo(e, { yPercent: -f / 2 }, { yPercent: f / 2, ease: 'none', scrollTrigger: { trigger: e.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* ---------- RITUEL : section épinglée (étapes) ---------- */
  mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
    const sec = $('#rituel'), pin = $('[data-rituel-pin]'), steps = $$('[data-step]');
    sec.classList.add('rituel--stage');
    const bar = $('[data-rituel-bar]'), count = $('[data-rituel-count]');
    const n = steps.length;
    gsap.set(steps, { autoAlpha: 0 }); gsap.set(steps[0], { autoAlpha: 1 });
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: sec, start: 'top top', end: '+=' + (n * 85) + '%', pin, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: self => {
          const i = Math.min(n - 1, Math.round(self.progress * (n - 1)));
          count.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
          pin.style.setProperty('--p', self.progress);
          bar.parentElement.style.setProperty('--p', self.progress);
        }
      }
    });
    steps.forEach((s, i) => {
      const fig = $('.step__fig', s), img = $('img', s), body = $('.step__body', s);
      if (i > 0) {
        tl.fromTo(s, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, i - 0.22)
          .fromTo(fig, { yPercent: 14, rotate: 4, scale: 0.92 }, { yPercent: 0, rotate: 0, scale: 1, duration: 0.5, ease: 'power2.out' }, i - 0.22)
          .fromTo(body, { y: 70 }, { y: 0, duration: 0.5, ease: 'power2.out' }, i - 0.18);
      }
      tl.fromTo(img, { scale: 1.25 }, { scale: 1, duration: 0.95 }, i - 0.2);
      if (i < n - 1) tl.to(s, { autoAlpha: 0, duration: 0.25 }, i + 0.78).to(fig, { yPercent: -10, rotate: -3, duration: 0.3, ease: 'power2.in' }, i + 0.75);
    });
    tl.to({}, { duration: 0.25 }, n - 0.25);
    return () => { sec.classList.remove('rituel--stage'); pin.style.removeProperty('--p'); };
  });

  /* ---------- CARTE : défilement horizontal piloté par le scroll vertical ---------- */
  mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
    const sec = $('#carte'), pin = $('[data-carte-pin]'), track = $('[data-carte-track]'), bar = $('[data-carte-bar]');
    sec.classList.add('carte--stage');
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    const tw = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: pin, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.7, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: s => { bar.style.transform = `scaleX(${s.progress})`; }
      }
    });
    $$('.panel', track).forEach((p, i) => {
      if (i < 2) return;
      gsap.from(p, { y: 80, rotate: 2.5, opacity: 0.2, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: p, containerAnimation: tw, start: 'left 96%', toggleActions: 'play none none reverse' } });
      const rows = $$('.svc', p);
      if (rows.length) gsap.from(rows, { x: 36, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.07, scrollTrigger: { trigger: p, containerAnimation: tw, start: 'left 88%', toggleActions: 'play none none reverse' } });
    });
    return () => { sec.classList.remove('carte--stage'); bar.style.transform = ''; };
  });

  /* ---------- Titres : apparition (masque qui monte) ---------- */
  if (!reduce) {
    reveals.forEach(r => gsap.to(r.targets, {
      yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: r.targets.length > 14 ? 0.035 : 0.07,
      scrollTrigger: { trigger: r.t, start: 'top 86%', once: true }
    }));
    scrub.forEach(s => gsap.to(s.words, {
      opacity: 1, ease: 'none', stagger: 0.12,
      scrollTrigger: { trigger: s.t, start: 'top 90%', end: 'bottom 88%', scrub: true }
    }));
    if (giantChars.length) gsap.to(giantChars, {
      yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.05,
      scrollTrigger: { trigger: footerGiant, start: 'top 98%', once: true },
      onComplete: () => gsap.set(giantChars, { clearProps: 'transform' })
    });
  }

  /* ---------- Gouttes : elles s'allongent à l'arrivée ---------- */
  if (!reduce) $$('svg[data-drip]').forEach(svg => {
    gsap.fromTo(svg, { scaleY: 0.05 }, { scaleY: 1, duration: 1.8, ease: 'elastic.out(1,.55)', scrollTrigger: { trigger: svg, start: 'top 98%', once: true } });
  });

  /* ---------- Chiffres animés ---------- */
  $$('[data-count]').forEach(c => {
    const end = parseFloat(c.dataset.count), dec = +c.dataset.decimals || 0;
    if (reduce) { c.textContent = fmt(end, dec); return; }
    const o = { v: 0 }; c.textContent = fmt(0, dec);
    ScrollTrigger.create({ trigger: c, start: 'top 92%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 2.4, ease: 'power3.out', onUpdate: () => { c.textContent = fmt(o.v, dec); } }) });
  });
  if (!reduce) {
    gsap.fromTo('.numbers__ghost', { xPercent: 6 }, { xPercent: -34, ease: 'none', scrollTrigger: { trigger: '.numbers', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.numbers__bg img', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.numbers', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from('.num', { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.numbers__grid', start: 'top 85%', once: true } });
  }

  /* ---------- Studio ---------- */
  if (!reduce) {
    gsap.from('.studio__nails', { scale: 0.88, opacity: 0, y: 60, duration: 1.5, ease: 'expo.out', scrollTrigger: { trigger: '.studio__stage', start: 'top 82%', once: true } });
    gsap.from('.studio__panel > *', { y: 40, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.12, scrollTrigger: { trigger: '.studio__stage', start: 'top 76%', once: true } });
  }

  /* ---------- Galerie : révélation par masque + parallax interne ---------- */
  $$('.gi').forEach(g => {
    const inner = $('.gi__in', g), im = $('img', g);
    if (reduce) return;
    gsap.fromTo(inner, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.out', scrollTrigger: { trigger: g, start: 'top 90%', once: true } });
    gsap.fromTo(im, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: g, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  if (!reduce) {
    gsap.from('.insta-card', { y: 70, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: '.insta-card', start: 'top 92%', once: true } });
  }

  /* ---------- Salon : le cadre s'ouvre (masque) + Ken Burns ---------- */
  if (!reduce) {
    const stg = { trigger: '.salon__stage', start: 'top 88%', end: 'top 12%', scrub: true };
    gsap.fromTo('.salon__img', { clipPath: 'inset(16% 22% 16% 22% round 240px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', scrollTrigger: stg });
    gsap.fromTo('.salon__img img', { scale: 1.4 }, { scale: 1, ease: 'none', scrollTrigger: { ...stg, end: 'bottom top' } });
    gsap.from('.salon__feats li', { y: 36, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.salon__feats', start: 'top 92%', once: true } });
  }

  /* ---------- Avis : étoiles, barres, carrousel infini glissable ---------- */
  $$('[data-stars]').forEach(s => {
    const v = parseFloat(s.dataset.stars) / 5, i = $('i', s);
    i.style.setProperty('--fill', v);
    if (!reduce) gsap.fromTo(i, { scaleX: 0 }, { scaleX: v, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 92%', once: true } });
  });
  if (!reduce) $$('.subscores i').forEach((b, k) => {
    const v = parseFloat(b.style.getPropertyValue('--v')) || 1;
    gsap.fromTo(b, { '--v': 0 }, { '--v': v, duration: 1.6, ease: 'expo.out', delay: k * 0.1, scrollTrigger: { trigger: b, start: 'top 94%', once: true } });
  });
  initReviewsRail();

  /* ---------- Nous trouver ---------- */
  if (!reduce) {
    gsap.from('.find__map', { clipPath: 'inset(0% 0% 100% 0% round 34px)', duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.find__map', start: 'top 85%', once: true } });
    gsap.from('.hours tr', { x: -30, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.06, scrollTrigger: { trigger: '.hours', start: 'top 88%', once: true } });
  }

  /* ---------- Rafraîchissements ---------- */
  const refresh = () => ScrollTrigger.refresh();
  window.addEventListener('load', () => setTimeout(refresh, 200));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(refresh, 100));
}

/* ---------- Carrousel d'avis : défilement infini + glisser ---------- */
function initReviewsRail() {
  const rail = $('[data-reviews]'); if (!rail) return;
  const track = $('.reviews__track', rail);
  const pauseBtn = $('#reviewsPause');
  if (reduce) {
    rail.style.overflowX = 'auto'; rail.style.cursor = 'auto'; rail.tabIndex = 0;
    if (pauseBtn) pauseBtn.hidden = true; return;
  }
  const originals = [...track.children];
  originals.forEach(li => { const c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.setAttribute('inert', ''); track.appendChild(c); });
  let w0 = 0;
  const measure = () => { w0 = track.children[originals.length].offsetLeft - track.children[0].offsetLeft; };
  measure(); window.addEventListener('resize', measure);
  const BASE = 46;
  let x = 0, vx = -BASE, dragging = false, lastX = 0, lastT = 0, hover = false, paused = false;
  rail.addEventListener('pointerenter', () => hover = true);
  rail.addEventListener('pointerleave', () => hover = false);
  rail.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastT = e.timeStamp; vx = 0; rail.classList.add('is-drag'); rail.setPointerCapture(e.pointerId); });
  rail.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dt = Math.max(1, e.timeStamp - lastT);
    x += dx; vx = dx / dt * 1000; lastX = e.clientX; lastT = e.timeStamp;
  });
  const end = () => { dragging = false; rail.classList.remove('is-drag'); };
  rail.addEventListener('pointerup', end); rail.addEventListener('pointercancel', end);
  if (pauseBtn) pauseBtn.addEventListener('click', () => {
    paused = !paused; pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.textContent = paused ? 'Reprendre le défilement' : 'Mettre en pause';
  });
  gsap.ticker.add((t, dt) => {
    const d = Math.min(dt, 60) / 1000;
    if (!dragging) {
      const target = paused ? 0 : (hover ? -BASE * 0.25 : -BASE);
      vx += (target - vx) * Math.min(1, d * 2.6);
      x += vx * d;
    }
    if (w0) { if (x <= -w0) x += w0; if (x > 0) x -= w0; }
    track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
  });
}

/* ---------- démarrage ---------- */
function boot() {
  buildDrips();
  initHours();
  initComposer();
  initStudio();
  initLightbox();
  initNav();
  initVideo();
  if (hasGsap) {
    try { initMotion(); }
    catch (err) { console.error(err); const l = $('#loader'); if (l) l.remove(); html.classList.remove('is-loading'); }
  } else {
    const l = $('#loader'); if (l) l.remove(); html.classList.remove('is-loading');
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
