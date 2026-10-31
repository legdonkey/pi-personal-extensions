// 组装讲解页：拼接 src/ 里的章节片段，按 .seg 合成朗读音频，注入时间轴，输出 index.html。
// 用法：node docs/extensions-guide/build.mjs [指南目录] [--no-tts]
//   指南目录：含 src/（章节片段与 _hero.html）和 media/ 的目录，默认是本脚本所在目录。
//   外壳、样式、播放器脚本始终取本目录 src/ 下的共享文件。
//   --no-tts  不调用 TTS，用估算时长生成页面（只用于排版预览）。
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const SHARED = join(HERE, "src");
const ROOT = resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) ?? HERE);
const SRC = join(ROOT, "src");
const CACHE = join(HERE, ".cache"); // 各指南共用语音缓存
const TTS = "/Users/yangguandao/Projects/legdonkey-plugins/plugins/bailian-tts/skills/bailian-tts/scripts/run.py";
const VOICE = "wenhuaizhi_v3.1";
const INSTRUCT = "稳重成熟的女声，语速适中，像技术分享的讲解，吐字清晰";
const GAP = 0.32; // 段间停顿（秒）
const CH_GAP = 0.9; // 章间停顿（秒）
const noTts = process.argv.includes("--no-tts");

const decode = (s) => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const strip = (s) => decode(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const fail = (m) => { console.error(`构建失败：${m}`); process.exit(1); };

// ---------- 读取章节 ----------
const files = readdirSync(SRC).filter((f) => /^\d\d-.+\.html$/.test(f)).sort();
if (!files.length) fail("src/ 里没有章节片段");
const chapters = files.map((f) => {
  const html = readFileSync(join(SRC, f), "utf8");
  const m = html.match(/<section[^>]*\bid="ch-([\w-]+)"[^>]*>/);
  if (!m) fail(`${f} 缺少 <section id="ch-…">`);
  const slug = m[1];
  if (!m[0].includes(`data-chapter="${slug}"`)) fail(`${f} 的 data-chapter 与 id 不一致`);
  const h2 = html.match(/(<h2[^>]*>)([\s\S]*?)(<\/h2>)/);
  if (!h2) fail(`${f} 缺少 h2`);
  // 每章开头先朗读章节标题（seg 编号 00），作者不必再写过渡句
  const titled = html.replace(h2[0], `${h2[1]}<span class="seg" data-seg="${slug}-00">${h2[2]}</span>${h2[3]}`);
  return { file: f, slug, title: strip(h2[2]), html: titled };
});

// ---------- 抽取朗读段并校验 ----------
const segs = [];
const seen = new Set();
for (const c of chapters) {
  for (const m of c.html.matchAll(/<span class="seg"([^>]*)>([\s\S]*?)<\/span>/g)) {
    const attrs = m[1];
    const id = attrs.match(/data-seg="([^"]+)"/)?.[1];
    if (!id) fail(`${c.file} 有缺少 data-seg 的 .seg`);
    if (m[2].includes("<span")) fail(`${id} 内部不能嵌套 <span>`);
    if (!id.startsWith(`${c.slug}-`)) fail(`${id} 不以章节前缀 ${c.slug}- 开头`);
    if (seen.has(id)) fail(`data-seg 重复：${id}`);
    seen.add(id);
    const say = attrs.match(/data-say="([^"]*)"/)?.[1];
    const text = say ? decode(say).trim() : strip(m[2]);
    if (!text) fail(`${id} 朗读文本为空`);
    segs.push({ id, ch: c.slug, text });
  }
  for (const m of c.html.matchAll(/data-cue="([^"]+)"/g)) {
    if (!m[1].startsWith(`${c.slug}-`) || !seen.has(m[1]))
      fail(`${c.file} 的 data-cue="${m[1]}" 没有指向本章已出现的 seg`);
  }
  for (const m of c.html.matchAll(/data-capture="([\w-]+)"/g)) {
    for (const ext of ["mp4", "png"])
      if (!existsSync(join(ROOT, "media", `${m[1]}.${ext}`))) {
        const msg = `${c.file} 引用的录屏 media/${m[1]}.${ext} 不存在`;
        if (noTts || process.argv.includes("--allow-missing-media")) console.warn(`警告：${msg}`); else fail(msg);
      }
  }
  for (const m of c.html.matchAll(/\bid="([^"]+)"/g)) {
    if (seen.has(`#${m[1]}`)) fail(`HTML id 重复：${m[1]}`);
    seen.add(`#${m[1]}`);
  }
}
if (!segs.length) fail("没有任何 .seg");

// ---------- 合成音频 ----------
const hash = (s) => createHash("sha1").update(`${VOICE}|${INSTRUCT}|${s}`).digest("hex").slice(0, 16);
const probe = async (p) => Number((await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p])).stdout.trim());

if (!noTts) {
  mkdirSync(CACHE, { recursive: true });
  const todo = segs.filter((s) => !existsSync(join(CACHE, `${hash(s.text)}.wav`)));
  console.log(`朗读段 ${segs.length} 个，需合成 ${todo.length} 个`);
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const s = todo[next++];
      const out = join(CACHE, `${hash(s.text)}.wav`);
      for (let attempt = 1; ; attempt++) {
        try {
          await run("python3", [TTS, "gen", "-v", VOICE, "--instruct", INSTRUCT, "--text", s.text, "--out", out], { maxBuffer: 1 << 24 });
          break;
        } catch (e) {
          if (attempt >= 2) fail(`合成 ${s.id} 失败：${e.stderr || e.message}`);
        }
      }
      process.stdout.write(".");
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  if (todo.length) console.log("");
}

let t = 0;
const list = [];
const silence = (sec) => {
  const p = join(CACHE, `silence-${sec}.wav`);
  list.push(p);
  return p;
};
const silences = new Set();
for (let i = 0; i < segs.length; i++) {
  const s = segs[i];
  if (i > 0) {
    const g = s.ch !== segs[i - 1].ch ? CH_GAP : GAP;
    silences.add(g); silence(g); t += g;
  }
  const wav = join(CACHE, `${hash(s.text)}.wav`);
  const d = noTts ? Math.max(1.2, [...s.text].length * 0.2) : await probe(wav);
  s.start = Number(t.toFixed(3));
  t += d;
  s.end = Number(t.toFixed(3));
  list.push(wav);
}
const duration = Number(t.toFixed(3));

let src = "audio/narration.mp3";
if (!noTts) {
  for (const g of silences) {
    const p = join(CACHE, `silence-${g}.wav`);
    if (!existsSync(p)) await run("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", String(g), "-c:a", "pcm_s16le", p]);
  }
  const listFile = join(CACHE, "concat.txt");
  writeFileSync(listFile, list.map((p) => `file '${p}'`).join("\n"));
  mkdirSync(join(ROOT, "audio"), { recursive: true });
  const mp3 = join(ROOT, "audio", "narration.mp3");
  await run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "64k", mp3]);
  const real = await probe(mp3);
  if (Math.abs(real - duration) > 0.6) fail(`音频时长 ${real}s 与时间轴 ${duration}s 偏差过大`);
  src += `?v=${createHash("sha1").update(readFileSync(mp3)).digest("hex").slice(0, 8)}`;
}

// ---------- 输出页面 ----------
const fmt = (x) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, "0")}`;
const mtoc = chapters.map((c) => `    <li><a href="#ch-${c.slug}">${c.title}</a></li>`).join("\n");
// 表格包一层横向滚动容器，避免窄屏撑宽页面
for (const c of chapters) c.html = c.html.replace(/<table([\s>])/g, '<div class="table-scroll"><table$1').replace(/<\/table>/g, "</table></div>");
// 目录用短标签：章节标题冒号前的部分
const short = (t) => t.split("：")[0];
const toc = chapters.map((c) => `      <li><a href="#ch-${c.slug}" title="${c.title}"><span>${short(c.title)}</span><span class="dur"></span><span class="bar"><i></i></span></a></li>`).join("\n");
const narration = { src, duration, segs: segs.map(({ id, ch, start, end }) => ({ id, ch, start, end })) };
const hero = readFileSync(join(existsSync(join(SRC, "_hero.html")) ? SRC : SHARED, "_hero.html"), "utf8");
const attr = (name) => hero.match(new RegExp(`data-${name}="([^"]*)"`))?.[1] ?? fail(`_hero.html 缺少 data-${name}`);
const page = readFileSync(join(SHARED, "_shell.html"), "utf8")
  .replace("{{TITLE}}", () => attr("title"))
  .replace("{{BRAND}}", () => attr("brand"))
  .replace("{{DESCRIPTION}}", () => attr("description"))
  .replace("<!--HERO-->", () => hero.trimEnd())
  .replace("/*CSS*/", () => readFileSync(join(SHARED, "guide.css"), "utf8"))
  .replace("/*JS*/", () => readFileSync(join(SHARED, "guide.js"), "utf8"))
  .replace("/*NARRATION*/", () => JSON.stringify(narration))
  .replace("<!--TOC-->", () => toc)
  .replace("<!--MTOC-->", () => mtoc)
  .replace("<!--CHAPTERS-->", () => chapters.map((c) => c.html.trim()).join("\n\n"));
writeFileSync(join(ROOT, "index.html"), page);
console.log(`已生成 index.html：${chapters.length} 章，${segs.length} 段，朗读 ${fmt(duration)}${noTts ? "（估算，未合成音频）" : ""}`);
