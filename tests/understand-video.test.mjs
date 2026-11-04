import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, linkSync, readFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAuthorizedVideo, injectVideo, MAX_VIDEO_BYTES } from "../extensions/understand-video-worker.mjs";
import understandVideo, { runVideoWorker } from "../extensions/understand-video.ts";

const previous = process.env.PI_CODING_AGENT_DIR;
const root = mkdtempSync(join(tmpdir(), "pi-understand-video-test-"));
process.env.PI_CODING_AGENT_DIR = root;
after(() => {
  if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previous;
  rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const cwd = mkdtempSync(join(root, "case-"));
  const bytes = Buffer.alloc(32);
  bytes.writeUInt32BE(24); bytes.write("ftyp", 4); bytes.write("isom", 8);
  writeFileSync(join(cwd, "video.mp4"), bytes);
  return { cwd, bytes, path: join(cwd, "video.mp4") };
}

// 假 SDK 不加载任何真实账号或 provider，用真实隔离进程验证 IPC、取消与清理。
function fakeSDK(mode = "ok") {
  const sdkDir = mkdtempSync(join(root, "sdk-"));
  mkdirSync(join(sdkDir, "dist"));
  writeFileSync(join(sdkDir, "package.json"), '{"type":"module"}');
  writeFileSync(join(sdkDir, "dist/index.js"), `
    export const SettingsManager = { inMemory: x => x };
    export const SessionManager = { inMemory: () => ({}) };
    export class DefaultResourceLoader {
      constructor(options) { if (!options.noExtensions || options.additionalExtensionPaths.length !== 1 || options.settingsManager.packages.length) throw Error('ambient'); }
      async reload() {} getExtensions() { return { errors: [], extensions: [{}] }; }
    }
    export async function createAgentSession() {
      globalThis.fetch = async (_url, init) => {
        const payload = JSON.parse(init.body);
        if (payload.request.contents[0].parts[0].inlineData.mimeType !== 'video/mp4') throw Error('not video');
        return { status: 200 };
      };
      return { session: { async bindExtensions() {}, dispose() {}, modelRuntime: {
        getModel() { return { api: 'antigravity-api' }; },
        async completeSimple(_model, context, options) {
          if (options.reasoning !== 'medium') throw Error('reasoning');
          if (${JSON.stringify(mode)} === 'hang') await new Promise(() => setInterval(() => {}, 1000));
          if (${JSON.stringify(mode)} === 'error') throw Error('Bearer SECRET account@example.com');
          await fetch('https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent', { body: JSON.stringify({model:'gemini-4-argon-medium',request:{contents:[{role:'user',parts:[{text:context.messages[0].content}]}]}}) });
          return {stopReason:'stop', content:[{type:'text',text:${JSON.stringify(mode === "empty" ? "" : mode === "large" ? "中".repeat(20000) : "0–1 秒红色；1–2 秒蓝色；2–3 秒绿色。音轨未审查。")}}]};
        }
      } } };
    }
  `);
  return sdkDir;
}
async function request(mode = "ok") {
  const f = fixture();
  return { cwd: f.cwd, path: f.path, digest: (await readAuthorizedVideo(f.cwd, f.path)).digest, agentDir: root, sdkDir: fakeSDK(mode), providerPath: join(root, "fake-provider.ts"), question: "颜色顺序？" };
}

test("合法 MP4、相对路径和 @ 前缀；拒绝越界、隐藏、类型和链接", async () => {
  const f = fixture();
  assert.equal((await readAuthorizedVideo(f.cwd, "@video.mp4")).bytes.length, 32);
  const authorized = await readAuthorizedVideo(f.cwd, f.path);
  assert.equal(authorized.digest.length, 64);
  assert.equal((await readAuthorizedVideo(f.cwd, authorized.path)).digest, authorized.digest, "macOS /tmp 与 /private/tmp 别名在父子进程间一致");
  for (const input of ["https://example.com/v.mp4", "../outside.mp4", ".hidden.mp4", "video.txt", "", "bad\0.mp4"]) await assert.rejects(readAuthorizedVideo(f.cwd, input));
  symlinkSync(f.path, join(f.cwd, "link.mp4"));
  await assert.rejects(readAuthorizedVideo(f.cwd, "link.mp4"));
  const outside = fixture();
  symlinkSync(outside.cwd, join(f.cwd, "outside"));
  await assert.rejects(readAuthorizedVideo(f.cwd, "outside/video.mp4"));
  linkSync(f.path, join(f.cwd, "hard.mp4"));
  await assert.rejects(readAuthorizedVideo(f.cwd, "hard.mp4"));
});
test("权限不足不读取文件", async () => {
  if (process.getuid?.() === 0) return;
  const f = fixture(); chmodSync(f.path, 0);
  try { await assert.rejects(readAuthorizedVideo(f.cwd, f.path)); }
  finally { chmodSync(f.path, 0o600); }
});
test("文件类型、空文件、超限和目录均拒绝", async () => {
  const f = fixture();
  for (const bytes of [Buffer.alloc(0), Buffer.from("not a video".repeat(4)), Buffer.alloc(MAX_VIDEO_BYTES + 1)]) {
    writeFileSync(f.path, bytes);
    await assert.rejects(readAuthorizedVideo(f.cwd, f.path));
  }
  mkdirSync(join(f.cwd, "folder.mp4"));
  await assert.rejects(readAuthorizedVideo(f.cwd, "folder.mp4"));
});
test("只注入 Google 原生视频请求，不硬编码 medium 路由，不干预其他请求", () => {
  const f = fixture();
  const init = { body: JSON.stringify({ model: "gemini-4-argon-high", request: { contents: [{ role: "user", parts: [{ text: "test" }] }] } }) };
  assert.equal(injectVideo("https://example.com/v1internal:streamGenerateContent", init, f.bytes), undefined);
  assert.equal(injectVideo("http://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent", init, f.bytes), undefined);
  assert.equal(injectVideo("https://cloudcode-pa.googleapis.com:444/v1internal:streamGenerateContent", init, f.bytes), undefined);
  assert.throws(() => injectVideo("https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent", {body:init.body.replace('gemini-4-argon-high','gemini-4-argon-evil')}, f.bytes));
  const payload = JSON.parse(injectVideo("https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent", init, f.bytes).body);
  assert.equal(payload.model, "gemini-4-argon-high");
  assert.deepEqual(payload.request.contents[0].parts[0], { inlineData: { mimeType: "video/mp4", data: f.bytes.toString("base64") } });
  assert.throws(() => injectVideo("https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent", { body: init.body.replace("gemini-4-argon-high", "other") }, f.bytes));
});
test("真实隔离进程成功返回，宿主 fetch 不变，返回时已确认子进程关闭", async () => {
  const original = globalThis.fetch;
  const result = await runVideoWorker(await request());
  assert.equal(result.ok, true);
  assert.match(result.text, /红色.*蓝色.*绿色/);
  assert.equal(result.inputMode, "native-video/mp4");
  assert.equal(globalThis.fetch, original);
});
test("API 异常、空响应和授权后文件替换安全失败且不泄漏鉴权", async () => {
  for (const mode of ["error", "empty"]) {
    const result = await runVideoWorker(await request(mode));
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /SECRET|Bearer|account@/);
  }
  const req = await request();
  const bytes = readFileSync(req.path); bytes[31] = 1; writeFileSync(req.path, bytes);
  assert.equal((await runVideoWorker(req)).ok, false);
});
test("取消和超时终止隔离进程；预取消不启动", async () => {
  await assert.rejects(runVideoWorker(await request("hang"), undefined, 100), /120 秒/);
  const controller = new AbortController();
  const req = await request("hang");
  const work = runVideoWorker(req, controller.signal);
  const timer = setTimeout(() => controller.abort(), 100);
  await assert.rejects(work, /已取消/); clearTimeout(timer);
  await assert.rejects(runVideoWorker(req, controller.signal));
});
test("输出限制与工具非法参数错误，不向外发送非法文件", async () => {
  const result = await runVideoWorker(await request("large"));
  assert.equal(result.ok, true); assert.match(result.text, /结果已截断/);
  assert.ok(Buffer.byteLength(result.text) <= 32 * 1024);
  assert.doesNotMatch(result.text, /\uFFFD/);
  const tools = []; understandVideo({ registerCommand() {}, registerTool: tool => tools.push(tool) });
  assert.equal(tools[0].name, "understand_video");
  const response = await tools[0].execute("test", {path:"/etc/passwd",question:"审查"}, undefined, undefined, {cwd:root});
  assert.equal(response.isError, true); assert.doesNotMatch(JSON.stringify(response), /\/etc\/passwd/);
});
