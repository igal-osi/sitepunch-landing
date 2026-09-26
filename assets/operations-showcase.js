/* Static product components; scroll only controls their presentation. */
(() => {
  const showcase = document.querySelector('.operations-showcase');
  if (!showcase) return;
  const stage = showcase.querySelector('.ops-showcase-stage');
  const tablet = showcase.querySelector('.ops-tablet-position');
  const phone = showcase.querySelector('.ops-phone-position');
  const frames = [...showcase.querySelectorAll('iframe')];
  const hint = document.getElementById('operationsShowcaseMotionHint');
  const note = document.getElementById('operationsShowcaseMotionNote');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const copy = {
    he: ['אותו פרויקט. אותה מערכת. מותאמת לכל מסך.', 'גללו: בחירת פרויקט · כניסה לפרויקט · בחירת תחום', 'התנועה כבויה בהתאם להגדרות הנגישות שלך.'],
    en: ['One project. One platform. Adapted to every screen.', 'Scroll: choose a project · open it · choose a workspace', 'Motion is off according to your accessibility settings.'],
    ru: ['Один проект. Одна система. Для любого экрана.', 'Прокрутите: выбор проекта · вход · выбор раздела', 'Движение отключено согласно настройкам доступности.'],
    ar: ['مشروع واحد. نظام واحد. يتكيف مع كل شاشة.', 'مرّر: اختر مشروعاً · افتحه · اختر مجال العمل', 'الحركة متوقفة وفق إعدادات إمكانية الوصول لديك.'],
  };
  const frameCss = `
    html,body { margin:0; width:100%; height:100%; overflow:hidden; }
    *,*::before,*::after { box-sizing:border-box; }
    body { font-family:var(--sp-font-ui); }
    .ops-preview-project-scene,.ops-preview-workspace { position:absolute; inset:0; overflow:hidden; }
    .ops-preview-workspace { opacity:0; }
    .ops-preview-workspace > .sp-dshell { height:100%; }
    .ops-home__main { scrollbar-width:none; }
    .ops-home__main::-webkit-scrollbar { display:none; }
    .ops-preview-projects .proj-card { position:relative; animation:none; transition:none; }
    .ops-preview-projects .proj-card::after { content:''; position:absolute; inset-inline-end:38px; top:38%; width:32px; height:32px; border:3px solid var(--sp-primary-ink); border-radius:50%; opacity:var(--tap-opacity,0); transform:scale(var(--tap-scale,.5)); pointer-events:none; }
    html[data-paused="true"] * { animation-play-state:paused !important; }
    html[data-reduce-motion="true"] * { animation:none !important; transition:none !important; }
    html[data-reduce-motion="true"] .ops-preview-project-scene { opacity:0 !important; }
    html[data-reduce-motion="true"] .ops-preview-workspace { opacity:1 !important; }
    @media(prefers-reduced-motion:reduce) { * { animation:none !important; transition:none !important; } }
  `;
  let payload, pending, visible = false, renderingKey = '', reduced = false, tick = 0;
  const cache = new WeakMap();
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => 1 - (1 - clamp(value)) ** 3;
  const active = () => visible && document.body.dataset.product === 'operations' && !document.hidden;
  function setPose(element, opacity, transform) {
    if (!element) return;
    element.style.opacity = String(opacity);
    element.style.transform = transform;
  }
  function paint() {
    if (!payload || document.hidden || document.body.dataset.product !== 'operations') return;
    const height = window.visualViewport?.height || window.innerHeight;
    const bounds = stage.getBoundingClientRect();
    const progress = reduced ? 1 : clamp((height * .85 - bounds.top) / Math.max(1, Math.min(bounds.height, height) * .9));
    showcase.dataset.progress = progress.toFixed(3);
    showcase.dataset.settled = String(progress >= 1 && !reduced);
    const t = ease(progress / .22), p = ease((progress - .025) / .25);
    setPose(tablet, t, `translate(${-35 * (1-t)}px,${30 * (1-t)}px) scale(${.92+.08*t}) rotateY(${-17+8*t}deg) rotateX(${8-3*t}deg) rotateZ(${-3+t}deg)`);
    setPose(phone, p, `translate(${-24 * (1-p)}px,${50 * (1-p)}px) scale(${.9+.1*p}) rotateY(${12-19*p}deg) rotateZ(${7-3*p}deg)`);
    frames.forEach(frame => {
      const root = frame.contentDocument?.documentElement;
      if (!root) return;
      let nodes = cache.get(root);
      if (!nodes) {
        const workspace = root.querySelector('.ops-preview-workspace');
        if (!workspace) return;
        nodes = {
          workspace, projects: root.querySelector('.ops-preview-project-scene'), card: root.querySelector('.proj-card'),
          ui: [...workspace.querySelectorAll('.sp-dnav,.sp-project-header,.ops-home__heading-row,.ops-home__lead,.ops-command-launcher,.ops-tile')],
        };
        cache.set(root, nodes);
      }
      const open = ease((progress - .43) / .14);
      setPose(nodes.projects, 1-open, `translateY(${-18*open}px) scale(${1-.025*open})`);
      setPose(nodes.workspace, open, `translateY(${18*(1-open)}px) scale(${1+.025*(1-open)})`);
      const tap = clamp((progress-.28)/.15);
      const press = Math.sin(tap*Math.PI);
      if (nodes.card) {
        nodes.card.style.transform = `scale(${1-.025*press})`;
        nodes.card.style.setProperty('--tap-opacity', String(press));
        nodes.card.style.setProperty('--tap-scale', String(.45+tap*1.2));
      }
      nodes.ui.forEach((node, index) => {
        const amount = reduced ? 1 : ease((progress - .49 - index*.055) / .16);
        setPose(node, amount, `translateY(${20*(1-amount)}px) scale(${.97+.03*amount})`);
      });
    });
  }
  function schedulePaint() {
    if (tick || !active()) return;
    tick = requestAnimationFrame(() => { tick = 0; paint(); });
  }
  function resize() {
    frames.forEach(frame => { frame.style.transform = `scale(${frame.parentElement.clientWidth / Number(frame.dataset.width)})`; });
    schedulePaint();
  }
  async function update() {
    const running = active();
    showcase.dataset.paused = String(!running);
    reduced = preference.matches || Boolean(document.getElementById('a11y-anim-style')?.textContent.trim());
    const lang = document.documentElement.lang in copy ? document.documentElement.lang : 'he';
    hint.textContent = copy[lang][1];
    hint.hidden = reduced;
    note.textContent = reduced ? copy[lang][2] : '';
    note.hidden = !reduced;
    frames.forEach(frame => {
      const root = frame.contentDocument?.documentElement;
      if (root) { root.dataset.paused = String(!running); root.dataset.reduceMotion = String(reduced); }
    });
    if (!running) { paint(); return; }
    document.getElementById('operationsShowcaseCaption').textContent = copy[lang][0];
    if (!payload) {
      try {
        pending ||= fetch('/assets/operations-preview.json?v=3').then(response => {
          if (!response.ok) throw new Error('Preview unavailable');
          return response.json();
        });
        payload = await pending;
      } catch (_) { pending = null; showcase.dataset.failed = 'true'; return; }
      delete showcase.dataset.failed;
      update();
      return;
    }
    const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    if (`${lang}:${theme}` !== renderingKey) {
      renderingKey = `${lang}:${theme}`;
      frames.forEach(frame => {
        const workspace = frame.dataset.width === '1280' ? payload.desktopScreens[lang] : payload.screens[lang];
        frame.srcdoc = `<!doctype html><html lang="${lang}" dir="${lang==='he'||lang==='ar'?'rtl':'ltr'}" data-theme="${theme}" data-reduce-motion="${reduced}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${payload.css}\n${frameCss}</style></head><body inert><div class="ops-preview-project-scene">${payload.projectScreens[lang]}</div><div class="ops-preview-workspace">${workspace}</div></body></html>`;
      });
      showcase.dataset.ready = 'true';
    }
    resize();
    paint();
  }
  new ResizeObserver(resize).observe(showcase);
  new IntersectionObserver(entries => { visible = entries[entries.length-1].isIntersecting; update(); }, { threshold:0 }).observe(stage);
  window.addEventListener('scroll', schedulePaint, { passive:true });
  window.addEventListener('resize', resize, { passive:true });
  window.visualViewport?.addEventListener('resize', schedulePaint, { passive:true });
  window.addEventListener('pageshow', update);
  if (preference.addEventListener) preference.addEventListener('change', update);
  else preference.addListener(update);
  new MutationObserver(update).observe(document.body, { attributes:true, attributeFilter:['data-product'] });
  new MutationObserver(update).observe(document.documentElement, { attributes:true, attributeFilter:['lang','data-theme'] });
  new MutationObserver(records => {
    if (records.some(record => record.target.id === 'a11y-anim-style' || [...record.addedNodes].some(node => node.id === 'a11y-anim-style'))) update();
  }).observe(document.head, { childList:true, subtree:true });
  document.addEventListener('visibilitychange', update);
  frames.forEach(frame => frame.addEventListener('load', update));
})();
