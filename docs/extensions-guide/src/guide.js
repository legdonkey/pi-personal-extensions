// 讲解页运行时：主题切换、朗读播放器、段落高亮、图表 cue、录屏播放。
// NARRATION 由 build.mjs 注入：{ src, duration, segs: [{ id, ch, start, end }] }。
(() => {
  const N = window.NARRATION;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const audio = new Audio();

  // ---------- 主题 ----------
  const themeBtns = $$(".theme-switch button");
  const applyTheme = (mode) => {
    if (mode === "light" || mode === "dark") document.documentElement.dataset.theme = mode;
    else delete document.documentElement.dataset.theme;
    themeBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === (mode || "system"))));
  };
  applyTheme(store.get("guide-theme"));
  themeBtns.forEach((b) => b.addEventListener("click", () => {
    store.set("guide-theme", b.dataset.mode);
    applyTheme(b.dataset.mode);
  }));

  // ---------- 目录高亮（滚动） ----------
  const tocLinks = new Map($$(".toc a").map((a) => [a.getAttribute("href").slice(1), a]));
  const chapters = $$(".chapter");
  const setCurrentToc = (id) => tocLinks.forEach((a, k) => a.setAttribute("aria-current", String(k === id)));
  const io = new IntersectionObserver((entries) => {
    if (!audio.paused) return;
    const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (vis) setCurrentToc(vis.target.id);
  }, { rootMargin: "-20% 0px -70% 0px" });
  chapters.forEach((c) => io.observe(c));

  // 代码块复制按钮
  $$("pre").forEach((pre) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "copy"; b.textContent = "复制";
    b.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(pre.querySelector("code")?.innerText ?? pre.innerText); b.textContent = "已复制"; }
      catch { b.textContent = "复制失败"; }
      setTimeout(() => { b.textContent = "复制"; }, 1600);
    });
    pre.append(b);
  });
  // 图比栏宽时提示可横向滑动
  const markScroll = () => $$(".fig-scroll").forEach((f) => {
    const over = f.scrollWidth > f.clientWidth + 4;
    let h = f.nextElementSibling?.classList.contains("fig-hint") ? f.nextElementSibling : null;
    if (over && !h) { h = document.createElement("p"); h.className = "fig-hint"; h.textContent = "图较宽，可左右滑动查看。"; f.after(h); }
    if (h) h.hidden = !over;
    f.classList.toggle("is-over", over);
  });
  markScroll(); addEventListener("resize", markScroll);
  $$(".fig-scroll").forEach((f) => f.addEventListener("scroll", () => f.classList.toggle("at-end", f.scrollLeft + f.clientWidth >= f.scrollWidth - 4), { passive: true }));
  // 录屏点击放大到原尺寸，Esc 或再点一次关闭
  $$(".capture .capture-frame").forEach((fr) => {
    const fig = fr.closest(".capture");
    const hint = document.createElement("span"); hint.className = "zoom-hint"; hint.textContent = "点击放大";
    fr.append(hint);
    fr.setAttribute("role", "button"); fr.tabIndex = 0; fr.setAttribute("aria-label", "放大录屏");
    const toggle = () => {
      const z = fig.classList.toggle("is-zoomed");
      fr.setAttribute("aria-label", z ? "关闭放大" : "放大录屏");
      if (z) fig.scrollLeft = 0; // 手机上原尺寸显示时从左边开始看
    };
    fr.addEventListener("click", toggle);
    fr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape") $$(".capture.is-zoomed").forEach((f) => f.classList.remove("is-zoomed")); });
  $$(".mtoc a").forEach((a) => a.addEventListener("click", () => { a.closest("details").open = false; }));

  if (!N || !N.segs?.length) return;

  // ---------- 数据 ----------
  const segs = N.segs.map((s, i) => ({ ...s, i, els: $$(`.seg[data-seg="${s.id}"]`) }));
  const byId = new Map(segs.map((s) => [s.id, s]));
  const chapterOf = new Map();
  for (const s of segs) {
    if (!chapterOf.has(s.ch)) chapterOf.set(s.ch, { id: s.ch, start: s.start, end: s.end, first: s.i, last: s.i });
    const c = chapterOf.get(s.ch); c.end = s.end; c.last = s.i;
  }
  const cues = $$("[data-cue]").map((el) => ({ el, seg: byId.get(el.dataset.cue) })).filter((c) => c.seg);

  // ---------- 音频 ----------
  audio.preload = "metadata";
  audio.src = N.src;
  const playBtn = $("#play"), heroPlay = $("#hero-play");
  const rail = $("#rail"), fill = $("#rail .fill"), knob = $("#rail .knob"), flag = $("#rail .flag");
  const timeEl = $("#time"), nowCh = $("#now-ch"), nowLine = $("#now-line"), msg = $("#dock-msg");
  const total = N.duration;
  rail.setAttribute("aria-valuemax", String(Math.round(total)));
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const chTitle = (id) => $(`#ch-${id} h2`)?.textContent.trim() ?? "";

  const heroDur = $("#hero-dur"); if (heroDur) heroDur.textContent = `约 ${Math.round(total / 60)} 分钟`;
  // 目录时长与刻度
  for (const c of chapterOf.values()) {
    const a = tocLinks.get(`ch-${c.id}`);
    if (a) { const d = a.querySelector(".dur"); if (d) d.textContent = fmt(c.end - c.start); }
    if (c.start > 0) {
      const t = document.createElement("i");
      t.className = "tick"; t.style.left = `${(c.start / total) * 100}%`;
      rail.append(t);
    }
  }

  // 每个含朗读段的段落/图注前插入「从这里朗读」按钮
  const PLAY_ICON = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z" fill="currentColor"/></svg>';
  const blocks = new Set(segs.flatMap((s) => s.els.map((el) => el.closest("p, li, figcaption, td") ?? el.parentElement)));
  for (const b of blocks) {
    const first = b.querySelector(".seg");
    if (!first) continue;
    b.classList.add("playable");
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "say-btn"; btn.innerHTML = PLAY_ICON;
    btn.setAttribute("aria-label", "从这里开始朗读");
    btn.addEventListener("click", (e) => { e.stopPropagation(); playFrom(first.dataset.seg); });
    b.prepend(btn);
  }
  segs.forEach((s) => s.els.forEach((el) => el.addEventListener("click", (e) => {
    if (e.target.closest("a, button, input, select")) return;
    if (getSelection()?.toString()) return;
    playFrom(s.id);
  })));

  // ---------- 状态同步 ----------
  let cur = -1;
  let follow = store.get("guide-follow") !== "0";
  let userScrollAt = 0;
  const followBtn = $("#follow");
  followBtn.setAttribute("aria-pressed", String(follow));
  followBtn.addEventListener("click", () => {
    follow = !follow; store.set("guide-follow", follow ? "1" : "0");
    followBtn.setAttribute("aria-pressed", String(follow));
    if (follow && cur >= 0) scrollToSeg(segs[cur], true);
  });
  addEventListener("wheel", () => { userScrollAt = performance.now(); }, { passive: true });
  addEventListener("touchmove", () => { userScrollAt = performance.now(); }, { passive: true });

  const findSeg = (t) => {
    let lo = 0, hi = segs.length - 1, ans = 0;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (segs[m].start <= t + 0.01) { ans = m; lo = m + 1; } else hi = m - 1; }
    return ans;
  };

  function scrollToSeg(s, force) {
    if (!follow || (!force && performance.now() - userScrollAt < 4000)) return;
    const el = s.els.find((e) => e.offsetParent !== null) ?? s.els[0];
    if (!el) return;
    // 图注里的段：滚到它所属的节拍，让文字和图同时在视野内
    const target = el.closest(".beat-fig") ? el.closest(".beat") ?? el : el;
    const r = target.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--top")) || 60;
    const dock = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dock")) || 76;
    const band = [top + 40, innerHeight - dock - 80];
    const ref = target === el ? r : el.getBoundingClientRect();
    if (!force && ref.top >= band[0] && ref.bottom <= band[1]) return;
    const y = scrollY + (target === el ? r.top - innerHeight * 0.36 : r.top - top - 24);
    scrollTo({ top: Math.max(0, y), behavior: reduced.matches ? "auto" : "smooth" });
  }

  function activate(i) {
    if (i === cur) return;
    const prev = segs[cur];
    cur = i;
    const s = segs[i];
    prev?.els.forEach((e) => e.classList.remove("is-active"));
    s.els.forEach((e) => e.classList.add("is-active"));
    chapters.forEach((c) => c.classList.toggle("is-narrating", c.dataset.chapter === s.ch));
    const beat = s.els[0]?.closest(".beat");
    $$(".beat.is-narrating").forEach((b) => b !== beat && b.classList.remove("is-narrating"));
    beat?.classList.add("is-narrating");
    for (const c of cues) {
      if (c.seg.ch !== s.ch) { c.el.classList.remove("is-active", "is-past"); continue; }
      const wasActive = c.el.classList.contains("is-active");
      const active = c.seg.i === i;
      c.el.classList.toggle("is-active", active);
      c.el.classList.toggle("is-past", c.seg.i < i);
      if (active && !wasActive && !reduced.matches) {
        c.el.querySelectorAll("animate, animateMotion, animateTransform, set").forEach((a) => { try { a.beginElement(); } catch {} });
        // 录屏可直接挂 data-cue：讲到这一句时从头播放
        if (c.el.tagName === "VIDEO") { c.el.currentTime = 0; c.el.play().catch(() => {}); }
      }
    }
    // 录屏：图注段激活时从头播放
    $$(".capture video").forEach((v) => {
      const own = v.closest("figure")?.querySelector(".seg.is-active");
      if (own && v.paused && !reduced.matches) { v.currentTime = 0; v.play().catch(() => {}); }
    });
    nowCh.textContent = chTitle(s.ch);
    nowLine.textContent = (s.els[0]?.textContent ?? "").trim();
    setCurrentToc(`ch-${s.ch}`);
    scrollToSeg(s, false);
  }

  function paint() {
    const t = audio.currentTime || 0;
    const p = Math.min(1, t / total);
    fill.style.width = `${p * 100}%`;
    knob.style.left = `${p * 100}%`;
    rail.setAttribute("aria-valuenow", String(Math.round(t)));
    rail.setAttribute("aria-valuetext", `${fmt(t)} / ${fmt(total)}`);
    timeEl.textContent = `${fmt(t)} / ${fmt(total)}`;
    for (const c of chapterOf.values()) {
      const bar = tocLinks.get(`ch-${c.id}`)?.querySelector(".bar i");
      if (bar) bar.style.width = `${Math.max(0, Math.min(1, (t - c.start) / (c.end - c.start))) * 100}%`;
    }
    if (!audio.paused || audio.currentTime > 0) activate(findSeg(t));
  }

  let raf = 0;
  const loop = () => { paint(); raf = audio.paused ? 0 : requestAnimationFrame(loop); };
  const PLAY = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M5 3l10 6-10 6z" fill="currentColor"/></svg>';
  const PAUSE = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M5 3h3v12H5zM10 3h3v12h-3z" fill="currentColor"/></svg>';
  const syncBtn = () => {
    const playing = !audio.paused;
    playBtn.innerHTML = playing ? PAUSE : PLAY;
    playBtn.setAttribute("aria-label", playing ? "暂停朗读" : "开始朗读");
    if (heroPlay) heroPlay.querySelector("span").textContent = playing ? "暂停朗读" : (audio.currentTime > 0 ? "继续朗读" : "从头朗读全文");
  };
  audio.addEventListener("play", () => { msg.textContent = ""; syncBtn(); if (!raf) raf = requestAnimationFrame(loop); });
  audio.addEventListener("pause", () => { syncBtn(); store.set("guide-pos", String(audio.currentTime)); paint(); });
  audio.addEventListener("ended", () => { store.set("guide-pos", "0"); syncBtn(); });
  audio.addEventListener("seeked", paint);
  audio.addEventListener("error", () => { msg.textContent = "音频加载失败：请确认 audio/narration.mp3 与页面在同一目录。"; });
  setInterval(() => { if (!audio.paused) store.set("guide-pos", String(audio.currentTime)); }, 3000);

  const toggle = () => (audio.paused ? audio.play().catch(() => { msg.textContent = "浏览器阻止了自动播放，请再点一次播放。"; }) : audio.pause());
  function playFrom(id) {
    const s = byId.get(id); if (!s) return;
    audio.currentTime = s.start + 0.001;
    userScrollAt = 0;
    activate(s.i);
    scrollToSeg(s, true);
    audio.play().catch(() => {});
  }
  const step = (d) => { const i = Math.max(0, Math.min(segs.length - 1, (cur < 0 ? 0 : cur) + d)); playFrom(segs[i].id); };

  playBtn.addEventListener("click", toggle);
  heroPlay?.addEventListener("click", toggle);
  $("#prev").addEventListener("click", () => step(-1));
  $("#next").addEventListener("click", () => step(1));
  $$(".toc a").forEach((a) => a.addEventListener("dblclick", () => {
    const c = chapterOf.get(a.getAttribute("href").slice(4)); if (c) playFrom(segs[c.first].id);
  }));
  $$("[data-play-chapter]").forEach((b) => b.addEventListener("click", () => {
    const c = chapterOf.get(b.dataset.playChapter); if (c) playFrom(segs[c.first].id);
  }));

  // 倍速
  const rates = [1, 1.25, 1.5, 0.85];
  const rateBtn = $("#rate");
  let ri = Math.max(0, rates.indexOf(Number(store.get("guide-rate")) || 1));
  const setRate = () => { audio.playbackRate = rates[ri]; rateBtn.textContent = `${rates[ri]}×`; };
  setRate();
  rateBtn.addEventListener("click", () => { ri = (ri + 1) % rates.length; store.set("guide-rate", String(rates[ri])); setRate(); });

  // 进度条：点击、拖动、键盘
  const seekTo = (clientX) => {
    const r = rail.getBoundingClientRect();
    audio.currentTime = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * total;
    userScrollAt = 0; paint(); scrollToSeg(segs[findSeg(audio.currentTime)], true);
  };
  rail.addEventListener("pointerdown", (e) => {
    rail.setPointerCapture(e.pointerId); seekTo(e.clientX);
    const move = (ev) => seekTo(ev.clientX);
    rail.addEventListener("pointermove", move);
    rail.addEventListener("pointerup", () => rail.removeEventListener("pointermove", move), { once: true });
  });
  rail.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { audio.currentTime = Math.min(total, audio.currentTime + 5); e.preventDefault(); }
    if (e.key === "ArrowLeft") { audio.currentTime = Math.max(0, audio.currentTime - 5); e.preventDefault(); }
    paint();
  });

  // 全局快捷键：空格播放/暂停，J/K 上一句/下一句
  addEventListener("keydown", (e) => {
    if (e.target.closest?.("input, select, textarea, button, [contenteditable], .rail")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === "Space") { e.preventDefault(); toggle(); }
    else if (e.key === "j" || e.key === "J") step(1);
    else if (e.key === "k" || e.key === "K") step(-1);
  });

  // 恢复上次位置：只标旗，不自动播放
  const saved = Number(store.get("guide-pos"));
  if (saved > 1 && saved < total - 1) {
    audio.currentTime = saved;
    flag.classList.add("on"); flag.style.left = `${(saved / total) * 100}%`;
    flag.title = `上次停在 ${fmt(saved)}`;
    const s = segs[findSeg(saved)];
    nowCh.textContent = chTitle(s.ch);
    nowLine.textContent = `上次停在这里：${(s.els[0]?.textContent ?? "").trim()}`;
    timeEl.textContent = `${fmt(saved)} / ${fmt(total)}`;
    fill.style.width = knob.style.left = `${(saved / total) * 100}%`;
  } else {
    timeEl.textContent = `0:00 / ${fmt(total)}`;
  }
  syncBtn();

  // 录屏：进入视口时播放，离开时暂停
  const vio = new IntersectionObserver((entries) => entries.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) { v.preload = "auto"; if (!reduced.matches) v.play().catch(() => {}); }
    else v.pause();
  }), { threshold: 0.4 });
  $$(".capture video").forEach((v) => vio.observe(v));
})();
