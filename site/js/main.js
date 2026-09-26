/* ==========================================================================
   The House of Coffee — interactions
   Plain JS + GSAP/ScrollTrigger + Lenis (all vendored, works from file:// too)
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mapRange = (v, a, b) => clamp((v - a) / (b - a));

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmall = () => window.innerWidth <= 900;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  /* ------------------------------------------------------------------
     Smooth scroll
     ------------------------------------------------------------------ */
  let lenis = null;
  if (!reduced && typeof window.Lenis !== 'undefined' && hasGSAP) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id === '#top' ? document.body : $(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6 });
      else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    });
  });

  /* ------------------------------------------------------------------
     Video helper: load a whole clip into memory when possible so that
     scrubbing never waits on the network. Falls back to a plain src
     (e.g. when the page is opened straight from disk).
     ------------------------------------------------------------------ */
  function loadScrubVideo(video, url, onProgress) {
    return new Promise((resolve) => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(video); } };
      const plain = () => {
        video.src = url;
        video.load();
        video.addEventListener('loadeddata', done, { once: true });
        video.addEventListener('error', done, { once: true });
        setTimeout(done, 6000);
      };
      if (location.protocol === 'file:' || !window.fetch || !window.ReadableStream) { plain(); return; }
      fetch(url).then(async (res) => {
        if (!res.ok || !res.body) throw new Error('fetch failed');
        const total = +res.headers.get('content-length') || 0;
        const reader = res.body.getReader();
        const chunks = []; let got = 0;
        for (;;) {
          const { done: d, value } = await reader.read();
          if (d) break;
          chunks.push(value); got += value.length;
          if (total && onProgress) onProgress(got / total);
        }
        video.src = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
        video.load();
        video.addEventListener('loadeddata', done, { once: true });
        video.addEventListener('error', done, { once: true });
        setTimeout(done, 4000);
      }).catch(plain);
    });
  }

  /* Smoothly chase a target time on a paused <video>, one seek at a time. */
  function makeScrubber(video) {
    const s = { target: 0, current: 0, seeking: false, since: 0 };
    const clear = () => { s.seeking = false; };
    ['seeked', 'loadeddata', 'emptied', 'error'].forEach((ev) => video.addEventListener(ev, clear));
    s.tick = () => {
      if (!video.duration || video.readyState < 1) return;
      const now = performance.now();
      if (s.seeking && now - s.since > 300) s.seeking = false; // never get stuck
      s.current = lerp(s.current, s.target, 0.18);
      if (!s.seeking && Math.abs(video.currentTime - s.current) > 0.012) {
        s.seeking = true; s.since = now;
        try { video.currentTime = s.current; } catch (_) { s.seeking = false; }
      }
    };
    s.settled = () => Math.abs(s.current - s.target) < 0.01;
    return s;
  }

  /* ------------------------------------------------------------------
     Preloader
     ------------------------------------------------------------------ */
  const loader = $('.loader');
  const countEl = $('[data-count]');
  const barEl = $('.loader__bar i');
  let shown = 0, goal = 0;
  const setGoal = (v) => { goal = Math.max(goal, v); };
  const loaderTick = () => {
    shown = lerp(shown, goal, 0.12);
    const v = Math.round(shown);
    countEl.textContent = v;
    barEl.style.width = v + '%';
    if (shown < 99.5) requestAnimationFrame(loaderTick);
  };
  requestAnimationFrame(loaderTick);

  const heroVideo = $('[data-hero-video]');
  const heroSrc = isSmall() ? heroVideo.dataset.srcSm : heroVideo.dataset.srcLg;
  heroVideo.pause();

  const waits = [
    loadScrubVideo(heroVideo, heroSrc, (f) => setGoal(10 + f * 75)),
    document.fonts ? document.fonts.ready : Promise.resolve(),
  ];
  setGoal(12);
  const timeout = new Promise((r) => setTimeout(r, 7000));
  Promise.race([Promise.all(waits), timeout]).then(() => {
    setGoal(100);
    setTimeout(reveal, 450);
  });

  function reveal() {
    loader.classList.add('is-done');
    document.body.classList.remove('is-loading');
    if (lenis) lenis.start();
    if (hasGSAP && !reduced) {
      gsap.from('.hero__title .line > span', { yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.09, delay: 0.25 });
      gsap.from('.hero__title .eyebrow', { opacity: 0, y: 12, duration: 1, delay: 0.5 });
    }
    setTimeout(() => loader.remove(), 1400);
    if (hasGSAP) ScrollTrigger.refresh();
  }

  if (!hasGSAP) { // libraries missing: keep the page usable
    $$('.hero__chapters li').forEach((li) => { li.style.opacity = 1; li.style.visibility = 'visible'; });
    return;
  }

  /* ------------------------------------------------------------------
     Pointer (shared, smoothed)
     ------------------------------------------------------------------ */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  gsap.ticker.add(() => {
    pointer.sx = lerp(pointer.sx, pointer.x, 0.06);
    pointer.sy = lerp(pointer.sy, pointer.y, 0.06);
  });

  /* ------------------------------------------------------------------
     Nav
     ------------------------------------------------------------------ */
  const nav = $('[data-nav]');
  let lastY = 0, travel = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      nav.classList.toggle('is-solid', y > 40);
      const dy = y - lastY;
      lastY = y;
      // accumulate travel in one direction so slow-scroll jitter can't flip the nav
      travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
      if (y <= 400) { nav.classList.remove('is-hidden'); return; }
      if (travel > 80) nav.classList.add('is-hidden');
      else if (travel < -80) nav.classList.remove('is-hidden');
    },
  });

  /* ------------------------------------------------------------------
     1. HERO — the reel scrubs with scroll; the frame lives on a 3D rig
     ------------------------------------------------------------------ */
  const hero = $('.hero');
  const rig = $('[data-hero-rig]');
  const heroTitle = $('[data-hero-title]');
  const chapters = $$('.hero__chapters li').map((el) => ({ el, from: +el.dataset.from, to: +el.dataset.to }));
  const heroBar = $('[data-hero-bar]');
  const timecode = $('[data-timecode]');
  const ambient = $('.hero__ambient');
  const actx = ambient.getContext('2d');
  ambient.width = 36; ambient.height = 64;
  const heroScrub = makeScrubber(heroVideo);
  let heroP = 0, heroActive = true, ambientFrame = 0;

  if (reduced) {
    heroVideo.loop = true; heroVideo.play().catch(() => {});
  } else {
    ScrollTrigger.create({
      trigger: hero, start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => { heroP = self.progress; },
      onToggle: (self) => { heroActive = self.isActive; },
    });

    gsap.ticker.add(() => {
      if (!heroActive && heroScrub.settled() && heroP >= 1) return;
      const p = heroP;
      const small = isSmall();

      // video time: the reel plays across 6%..96% of the section
      const vp = mapRange(p, 0.06, 0.96);
      if (heroVideo.duration) heroScrub.target = vp * (heroVideo.duration - 0.05);
      heroScrub.tick();

      // rig: starts lying back like a card on a table, stands up, then sways as you scroll
      const intro = gsap.parseEase('power3.out')(mapRange(p, 0, 0.1));
      const outro = gsap.parseEase('power2.in')(mapRange(p, 0.93, 1));
      const sway = Math.sin(p * Math.PI * 4) * 7;
      const rx = lerp(64, 4, intro) + pointer.sy * -5 - outro * 8;
      const ry = lerp(-8, 0, intro) + sway * intro + pointer.sx * 9;
      const rz = lerp(-12, 0, intro);
      const ty = lerp(small ? 26 : 38, small ? -8 : 0, intro);
      const tx = small ? 0 : lerp(0, 16, intro);
      const sc = lerp(0.82, 1, intro) + outro * 0.5;
      rig.style.transform =
        `translate3d(${tx}vw, ${ty}vh, 0) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${sc})`;
      rig.style.opacity = 1 - outro;

      // title leaves as the rig stands up
      const t = mapRange(p, 0.0, 0.07);
      heroTitle.style.opacity = 1 - t;
      heroTitle.style.transform = `translateY(calc(-50% - ${t * 12}vh)) scale(${1 - t * 0.06})`;

      // chapters
      for (const c of chapters) {
        const fadeIn = mapRange(p, c.from, c.from + 0.035);
        const fadeOut = 1 - mapRange(p, c.to - 0.035, c.to);
        const o = Math.min(fadeIn, fadeOut) * (1 - outro);
        c.el.style.opacity = o;
        c.el.style.visibility = o > 0.01 ? 'visible' : 'hidden';
        const shift = (1 - fadeIn) * 28 - (1 - fadeOut) * 28;
        c.el.style.transform = small ? `translateY(${shift}px)` : `translateY(calc(-50% + ${shift}px))`;
      }

      // HUD
      heroBar.style.transform = `scaleX(${vp})`;
      const secs = heroVideo.currentTime || 0;
      timecode.textContent = '00:' + String(Math.floor(secs)).padStart(2, '0');

      // ambient glow sampled from the current frame (cheap: 36x64 canvas, blurred by CSS)
      if (++ambientFrame % 4 === 0 && heroVideo.readyState >= 2) {
        try { actx.drawImage(heroVideo, 0, 0, 36, 64); } catch (_) { /* ignore */ }
      }
    });
  }

  /* ------------------------------------------------------------------
     2. Statement — words light up as you read
     ------------------------------------------------------------------ */
  const statement = $('[data-words]');
  if (statement) {
    const words = statement.textContent.trim().split(/\s+/);
    statement.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
    const spans = $$('.w', statement);
    if (!reduced) {
      ScrollTrigger.create({
        trigger: statement, start: 'top 80%', end: 'bottom 40%', scrub: true,
        onUpdate: (self) => {
          const lit = self.progress * spans.length * 1.1;
          spans.forEach((s, i) => { s.style.opacity = clamp(0.16 + (lit - i) * 0.5, 0.16, 1); });
        },
      });
    }
    gsap.set('.pcard--up', { yPercent: -12 });
    if (!reduced) {
      $$('.pcard').forEach((c, i) => {
        gsap.from(c, {
          rotationX: 38, rotationY: i === 0 ? 14 : i === 2 ? -14 : 0, y: 120, opacity: 0, transformOrigin: '50% 100%',
          duration: 1.4, ease: 'expo.out', delay: i * 0.08,
          scrollTrigger: { trigger: '.statement__cards', start: 'top 85%' },
        });
      });
    }
  }

  /* ------------------------------------------------------------------
     Pointer tilt for cards (desktop only)
     ------------------------------------------------------------------ */
  if (finePointer && !reduced) {
    $$('[data-tilt]').forEach((el) => {
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        ry(x * 12); rx(-y * 10);
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  /* ------------------------------------------------------------------
     3. Menu — tabs, cursor-following photo, inline thumbs on mobile
     ------------------------------------------------------------------ */
  const tabs = $$('.tabs [role="tab"]');
  const panels = $$('[data-panel]');
  function selectTab(tab) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p) => {
      const on = p.dataset.panel === tab.dataset.tab;
      p.hidden = !on;
      p.classList.remove('is-in');
      if (on) { void p.offsetWidth; p.classList.add('is-in'); }
    });
    ScrollTrigger.refresh();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      n.focus(); selectTab(n);
    });
  });

  // inline thumbnails (shown by CSS on small screens)
  $$('.menu__list li[data-img]').forEach((li) => {
    const img = document.createElement('img');
    img.className = 'mi__thumb'; img.alt = ''; img.loading = 'lazy'; img.src = li.dataset.img;
    li.prepend(img);
  });

  const peek = $('.menu__peek');
  const peekImg = $('img', peek);
  if (finePointer && peek) {
    const st = { x: 0, y: 0, tx: 0, ty: 0, on: false, vx: 0 };
    $$('.menu__list li').forEach((li) => {
      li.addEventListener('pointerenter', () => {
        if (!li.dataset.img) { peek.classList.remove('is-on'); st.on = false; return; }
        if (!peekImg.src.endsWith(li.dataset.img)) peekImg.src = li.dataset.img;
        peek.classList.add('is-on'); st.on = true;
      });
    });
    $('.menu__body').addEventListener('pointerleave', () => { peek.classList.remove('is-on'); st.on = false; });
    window.addEventListener('pointermove', (e) => { st.tx = e.clientX; st.ty = e.clientY; }, { passive: true });
    gsap.ticker.add(() => {
      const px = st.x;
      st.x = lerp(st.x, st.tx + 150, 0.14);
      st.y = lerp(st.y, st.ty, 0.14);
      st.vx = lerp(st.vx, st.x - px, 0.2);
      const s = st.on ? 1 : 0.7;
      peek.style.transform =
        `translate3d(${st.x}px, ${st.y}px, 0) translate(-50%, -50%) perspective(700px) rotateY(${clamp(st.vx * 1.2, -24, 24)}deg) rotateZ(${clamp(st.vx * 0.25, -6, 6)}deg) scale(${s})`;
    });
  }

  /* ------------------------------------------------------------------
     4. Kitchen — second scrub, phone turns in 3D, steps follow along
     ------------------------------------------------------------------ */
  const kVideo = $('[data-kitchen-video]');
  const phone = $('[data-kitchen-phone]');
  const steps = $$('[data-step]');
  if (kVideo) {
    kVideo.pause();
    if (reduced) {
      kVideo.loop = true; kVideo.play().catch(() => {});
      steps.forEach((s) => s.classList.add('is-active'));
    } else {
      const kScrub = makeScrubber(kVideo);
      let kP = 0, kOn = false;
      ScrollTrigger.create({
        trigger: '.kitchen', start: 'top top', end: 'bottom bottom',
        onUpdate: (self) => { kP = self.progress; },
        onToggle: (self) => { kOn = self.isActive; },
      });
      // lazy-upgrade to an in-memory copy the first time we get near
      ScrollTrigger.create({
        trigger: '.kitchen', start: 'top 250%', once: true,
        onEnter: () => loadScrubVideo(kVideo, kVideo.getAttribute('src')),
      });
      gsap.ticker.add(() => {
        if (!kOn && kScrub.settled()) return;
        if (kVideo.duration) kScrub.target = mapRange(kP, 0.02, 0.98) * (kVideo.duration - 0.05);
        kScrub.tick();
        const ry = lerp(-26, 22, kP) + pointer.sx * 6;
        const rx = 8 - pointer.sy * 4;
        phone.style.transform = `rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${lerp(-3, 3, kP)}deg)`;
        const idx = Math.min(steps.length - 1, Math.floor(mapRange(kP, 0.02, 0.98) * steps.length));
        steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
      });
    }
  }

  /* ------------------------------------------------------------------
     5. Looping reels — play only while visible
     ------------------------------------------------------------------ */
  const loops = $$('video[data-autoplay]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const v = en.target;
        if (en.isIntersecting) {
          if (v.preload === 'none') { v.preload = 'auto'; v.load(); }
          if (!reduced) v.play().catch(() => {});
        } else v.pause();
      });
    }, { rootMargin: '120px' });
    loops.forEach((v) => io.observe(v));
  }
  if (!reduced) {
    $$('.vcard').forEach((c, i) => {
      gsap.from(c, {
        rotationY: (i - 1) * -26, rotationX: 18, z: -200, y: 80, opacity: 0,
        duration: 1.5, ease: 'expo.out', delay: i * 0.1,
        scrollTrigger: { trigger: '.ice__cards', start: 'top 85%' },
      });
    });
  }

  /* ------------------------------------------------------------------
     6. Inside — a CSS 3D corridor of photographs, walked by scroll
     ------------------------------------------------------------------ */
  const world = $('[data-world]');
  const planes = $$('.plane', world).map((el) => ({
    el,
    x: +el.dataset.x, y: +el.dataset.y, z: +el.dataset.z, r: +el.dataset.r, w: +el.dataset.w,
    door: el.classList.contains('plane--door'),
  }));
  const maxZ = Math.max(...planes.map((p) => p.z));
  const insideA = $('[data-inside-a]');
  const insideB = $('[data-inside-b]');
  const insideBar = $('[data-inside-bar]');
  let inP = reduced ? 1 : 0, inOn = reduced;

  function layoutPlanes() {
    const vw = window.innerWidth / 100, vh = window.innerHeight / 100;
    const small = isSmall();
    planes.forEach((p) => {
      const w = (small ? Math.min(p.w * 2.1, 82) : p.w) * vw;
      const x = (small ? p.x * 0.55 : p.x) * vw;
      const y = p.y * vh * (small ? 0.8 : 1);
      p.el.style.width = w + 'px';
      p.base = `translate3d(${x}px, ${y}px, ${-p.z}px) translate(-50%, -50%) rotateY(${p.r}deg)`;
      p.el.style.transform = p.base;
    });
  }
  layoutPlanes();
  window.addEventListener('resize', layoutPlanes);

  if (!reduced) {
    ScrollTrigger.create({
      trigger: '.inside', start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => { inP = self.progress; },
      onToggle: (self) => { inOn = self.isActive; },
    });
  }
  const renderInside = () => {
    const p = gsap.parseEase('power1.inOut')(inP);
    const cam = p * (maxZ - 230);
    world.style.transform =
      `translateZ(${cam}px) rotateX(${pointer.sy * 3}deg) rotateY(${pointer.sx * -5}deg)`;
    for (const pl of planes) {
      const d = pl.z - cam; // distance ahead of the camera
      const far = pl.door ? clamp((2600 - d) / 900) : clamp((1700 - d) / 650);
      const near = pl.door ? 1 : clamp((d - 40) / 280);
      pl.el.style.opacity = (far * near).toFixed(3);
      pl.el.style.visibility = far * near < 0.01 ? 'hidden' : 'visible';
    }
    const a = 1 - mapRange(inP, 0.5, 0.62);
    const b = mapRange(inP, 0.78, 0.9);
    insideA.style.opacity = a; insideA.style.transform = `translateY(${(1 - a) * -30}px)`;
    insideB.style.opacity = b; insideB.style.transform = `translateY(${(1 - b) * 30}px)`;
    insideBar.style.transform = `scaleX(${inP})`;
  };
  renderInside();
  gsap.ticker.add(() => { if (inOn) renderInside(); });

  /* ------------------------------------------------------------------
     7. Proof — count-up
     ------------------------------------------------------------------ */
  $$('[data-countup]').forEach((el) => {
    const to = +el.dataset.countup;
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 85%', once: true,
      onEnter: () => gsap.to(o, { v: to, duration: reduced ? 0 : 1.6, ease: 'power3.out', onUpdate: () => { el.textContent = o.v.toFixed(1); } }),
    });
  });
  if (!reduced) {
    gsap.from('.proof__strip img', {
      y: 60, rotationX: 30, opacity: 0, stagger: 0.08, duration: 1.2, ease: 'expo.out',
      scrollTrigger: { trigger: '.proof__strip', start: 'top 90%' },
    });
  }

  /* ------------------------------------------------------------------
     8. Visit + footer
     ------------------------------------------------------------------ */
  if (!reduced) {
    gsap.to('.visit__bg', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.visit', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from('.outlet', {
      y: 80, rotationX: 22, opacity: 0, stagger: 0.12, duration: 1.3, ease: 'expo.out', transformOrigin: '50% 100%',
      scrollTrigger: { trigger: '.outlets', start: 'top 85%' },
    });
    gsap.to('[data-spin]', { rotation: 360, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });
    $$('section .display--md').forEach((h) => {
      if (h.closest('.inside') || h.closest('.hero')) return;
      gsap.from(h, { y: 40, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 88%' } });
    });
  }
  const yr = $('[data-year]'); if (yr) yr.textContent = new Date().getFullYear();

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
