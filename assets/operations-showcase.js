/* Lazy presentation of the application's server-rendered category components. */
(() => {
  const showcase = document.querySelector('.operations-showcase');
  if (!showcase) return;
  const frames = [...showcase.querySelectorAll('iframe')];
  const replay = document.getElementById('operationsShowcaseReplay');
  const motionNote = document.getElementById('operationsShowcaseMotionNote');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionCopy = {
    he: ['הפעלה חוזרת', 'התנועה כבויה בהתאם להגדרות הנגישות שלך.'],
    en: ['Replay animation', 'Motion is off according to your accessibility settings.'],
    ru: ['Повторить анимацию', 'Движение отключено согласно настройкам доступности.'],
    ar: ['إعادة الحركة', 'الحركة متوقفة وفق إعدادات إمكانية الوصول لديك.'],
  };
  const captions = {
    he: 'אותו פרויקט. אותה מערכת. מותאמת לכל מסך.',
    en: 'One project. One platform. Adapted to every screen.',
    ru: 'Один проект. Одна система. Для любого экрана.',
    ar: 'مشروع واحد. نظام واحد. يتكيف مع كل شاشة.',
  };
  const frameCss = `
    html,body { margin:0; width:100%; height:100%; overflow:hidden; }
    *,*::before,*::after { box-sizing:border-box; }
    body { font-family:var(--sp-font-ui); }
    .ops-home__main { scrollbar-width:none; }
    .ops-home__main::-webkit-scrollbar { display:none; }
    .sp-project-header,.ops-home__heading-row,.ops-home__lead,.ops-tile { animation: ops-ui-flow .8s cubic-bezier(.2,.8,.2,1) both; }
    .sp-project-header { animation-delay:.6s; }
    .ops-home__heading-row { animation-delay:.82s; }
    .ops-home__lead { animation-delay:.9s; }
    .ops-tile:nth-child(1) { animation-delay:1.04s; }
    .ops-tile:nth-child(2) { animation-delay:1.12s; }
    .ops-tile:nth-child(3) { animation-delay:1.2s; }
    .ops-tile:nth-child(4) { animation-delay:1.28s; }
    @keyframes ops-ui-flow { from { opacity:0; transform:translateY(20px) scale(1.035); } to { opacity:1; transform:none; } }
    html[data-paused="true"] * { animation-play-state:paused !important; }
    html[data-reduce-motion="true"] * { animation:none !important; transition:none !important; }
    @media(prefers-reduced-motion:reduce) { * { animation:none !important; transition:none !important; } }
  `;
  let payload, pending, visible = false, entered = false, renderingKey = '';
  const isActive = () => visible && document.body.dataset.product === 'operations';
  function resize() {
    frames.forEach(frame => {
      const width = Number(frame.dataset.width);
      frame.style.transform = `scale(${frame.parentElement.clientWidth / width})`;
    });
  }
  async function update() {
    const active = isActive() && entered && !document.hidden;
    showcase.dataset.paused = String(!active);
    const reduceMotion = motionPreference.matches || Boolean(document.getElementById('a11y-anim-style')?.textContent.trim());
    const lang = document.documentElement.lang in captions ? document.documentElement.lang : 'he';
    replay.textContent = motionCopy[lang][0];
    replay.disabled = reduceMotion || !payload;
    motionNote.textContent = reduceMotion ? motionCopy[lang][1] : '';
    motionNote.hidden = !reduceMotion;
    frames.forEach(frame => {
      const root = frame.contentDocument?.documentElement;
      if (root) {
        root.dataset.paused = String(!active);
        root.dataset.reduceMotion = String(reduceMotion);
      }
    });
    if (!active) return;
    const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    document.getElementById('operationsShowcaseCaption').textContent = captions[lang];
    if (!payload) {
      try {
        pending ||= fetch('/assets/operations-preview.json').then(response => {
          if (!response.ok) throw new Error('Preview unavailable');
          return response.json();
        });
        payload = await pending;
      } catch (_) {
        pending = null;
        showcase.dataset.failed = 'true';
        return;
      }
      delete showcase.dataset.failed;
      // Product/language may have changed while the static asset was loading.
      update();
      return;
    }
    if (`${lang}:${theme}` !== renderingKey) {
      renderingKey = `${lang}:${theme}`;
      frames.forEach(frame => {
        frame.srcdoc = `<!doctype html><html lang="${lang}" dir="${lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr'}" data-theme="${theme}" data-reduce-motion="${reduceMotion}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${payload.css}\n${frameCss}</style></head><body inert>${payload.screens[lang]}</body></html>`;
      });
      showcase.dataset.ready = 'true';
    }
    resize();
  }
  new ResizeObserver(resize).observe(showcase);
  new IntersectionObserver(entries => {
    const entry = entries[entries.length - 1];
    visible = entry.isIntersecting;
    // A sliver at the bottom of an iPhone must not consume the entire intro.
    if (entry.intersectionRatio >= .4) entered = true;
    update();
  }, { threshold: [0, .4] }).observe(showcase.querySelector('.ops-showcase-stage'));
  replay.addEventListener('click', () => {
    if (replay.disabled) return;
    entered = true;
    renderingKey = '';
    showcase.dataset.ready = 'false';
    // One layout read on explicit replay restarts both CSS device timelines.
    void showcase.offsetWidth;
    update();
  });
  if (motionPreference.addEventListener) motionPreference.addEventListener('change', update);
  else motionPreference.addListener(update);
  new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ['data-product'] });
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'data-theme'] });
  new MutationObserver(records => {
    if (records.some(record => record.target.id === 'a11y-anim-style' ||
      [...record.addedNodes].some(node => node.id === 'a11y-anim-style'))) update();
  }).observe(document.head, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', update);
  frames.forEach(frame => frame.addEventListener('load', update));
})();
