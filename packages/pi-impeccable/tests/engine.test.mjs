import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { hookText, runEngine, runnerPath, writeObject } from '../lib/runtime.ts';

const fixtureCss = '.headline { font-family: Inter; background: linear-gradient(90deg,red,blue); -webkit-background-clip: text; color: transparent; }\n';
function project(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'pi-impeccable-engine-'));
  writeFileSync(join(cwd, 'package.json'), '{}');
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}

test('真实引擎：检测、失败退出码、配置忽略与启动器', async (t) => {
  const cwd = project(t);
  writeFileSync(join(cwd, 'page.css'), fixtureCss);
  let result = await runEngine(['detect', '--json', 'page.css'], {cwd});
  assert.equal(result.code, 2);
  assert.deepEqual(JSON.parse(result.stdout).map((finding) => finding.antipattern), ['overused-font', 'gradient-text']);
  result = await runEngine(['detect', '--json', 'page.css', 'missing.css'], {cwd});
  assert.equal(result.code, 1, '部分目标失败优先于发现问题');
  assert.match(result.stderr, /missing/);
  result = await runEngine(['hooks', 'ignore-value', 'overused-font', 'Inter', '--reason', '测试字体例外'], {cwd});
  assert.equal(result.code, 0, result.stderr);
  result = await runEngine(['detect', '--json', 'page.css'], {cwd});
  assert.deepEqual(JSON.parse(result.stdout).map((finding) => finding.antipattern), ['gradient-text']);
  const raw = spawnSync(process.execPath, [runnerPath, 'detect', '--no-config', '--json', 'page.css'], {cwd, input: '', encoding: 'utf8'});
  assert.equal(raw.status, 2);
  assert.equal(JSON.parse(raw.stdout).length, 2);
  const noInjection = await runEngine(['detect', '--json', 'bad.css; touch injected'], {cwd});
  assert.equal(noInjection.code, 1);
  assert.throws(() => readFileSync(join(cwd, 'injected')));
});

test('真实引擎：即时检查、结束前完整检查、去重、禁用与原生平台', async (t) => {
  const cwd = project(t);
  const path = join(cwd, 'page.css');
  writeFileSync(path, fixtureCss);
  const post = {hook_event_name: 'PostToolUse', cwd, session_id: 'test-hooks', tool_name: 'Write', tool_input: {file_path: path}};
  let result = await runEngine(['hook'], {cwd, input: JSON.stringify(post)});
  assert.equal(result.code, 0);
  assert.match(hookText(result.stdout), /gradient-text/);
  assert.doesNotMatch(hookText(result.stdout), /\[overused-font\]/);
  const stop = {hook_event_name: 'Stop', cwd, session_id: 'test-hooks'};
  result = await runEngine(['hook'], {cwd, input: JSON.stringify(stop)});
  assert.match(hookText(result.stdout), /overused-font/);
  assert.doesNotMatch(hookText(result.stdout), /\[gradient-text\]/);
  result = await runEngine(['hook'], {cwd, input: JSON.stringify(stop)});
  assert.equal(result.stdout, '');
  await runEngine(['hooks', 'off'], {cwd});
  post.session_id = 'disabled';
  assert.equal((await runEngine(['hook'], {cwd, input: JSON.stringify(post)})).stdout, '');
  assert.match((await runEngine(['context'], {cwd, automatic: true})).stdout, /MANUAL_DETECTOR_REQUIRED/);
  await runEngine(['hooks', 'on'], {cwd});
  assert.match((await runEngine(['context'], {cwd, automatic: true})).stdout, /PI_AUTOMATIC_DETECTOR/);
  writeFileSync(join(cwd, 'PRODUCT.md'), '# Product\n\n## Platform\n\nios\n');
  post.session_id = 'native';
  assert.equal((await runEngine(['hook'], {cwd, input: JSON.stringify(post)})).stdout, '');
  const context = await runEngine(['context'], {cwd, automatic: true});
  assert.match(context.stdout, /NATIVE PLATFORM REFERENCE: IOS/);
  assert.doesNotMatch(context.stdout, /PI_AUTOMATIC_DETECTOR/);
});

test('真实 Live 服务：启动、认证、长轮询事件、回复、恢复状态与清理', async (t) => {
  const cwd = project(t);
  const html = '<!doctype html><html><head><title>测试页面</title></head><body><h1>测试页面</h1></body></html>\n';
  writeFileSync(join(cwd, 'index.html'), html);
  writeFileSync(join(cwd, 'PRODUCT.md'), '# Product\n\n## Platform\n\nweb\n');
  writeFileSync(join(cwd, 'DESIGN.md'), '# Design\n\n## Colors\n\n深色文字与浅色背景。\n');
  writeObject(join(cwd, '.impeccable/live/config.json'), {files:['index.html'],insertBefore:'</body>',commentSyntax:'html',cspChecked:true});
  const generateHelp = await runEngine(['live-generate', '--help'], {cwd});
  assert.equal(generateHelp.code, 0, generateHelp.stderr);
  assert.match(generateHelp.stdout, /--selector/);
  const boot = await runEngine(['live'], {cwd});
  assert.equal(boot.code, 0, boot.stderr + boot.stdout);
  const state = JSON.parse(boot.stdout);
  assert.equal(state.ok, true);
  assert.ok(state.serverToken);
  try {
    const url = `http://127.0.0.1:${state.serverPort}`;
    assert.equal((await (await fetch(url + '/health')).json()).status, 'ok');
    assert.match(readFileSync(join(cwd, 'index.html'), 'utf8'), /live\.js/);
    const denied = await fetch(url + '/events', {method:'POST',body:JSON.stringify({token:'wrong',type:'steer',id:'12345678',message:'测试'})});
    assert.equal(denied.status, 401);
    const accepted = await fetch(url + '/events', {method:'POST',body:JSON.stringify({token:state.serverToken,type:'steer',id:'12345678',message:'测试指令',pageUrl:'http://localhost:3000/'})});
    assert.equal(accepted.status, 200, await accepted.text());
    const poll = await runEngine(['live-poll', '--timeout=3000'], {cwd, timeoutMs:5000});
    assert.equal(poll.code, 0, poll.stderr);
    const event = JSON.parse(poll.stdout);
    assert.equal(event.type, 'steer'); assert.equal(event.message, '测试指令');
    assert.ok(event._instructions);
    const reply = await runEngine(['live-poll','--reply','12345678','steer_done','测试：只检查事件收发，无需修改源文件'], {cwd});
    assert.equal(reply.code, 0, reply.stderr);
    const recovery = await runEngine(['live-status'], {cwd});
    assert.equal(recovery.code, 0, recovery.stderr);
    assert.doesNotThrow(() => JSON.parse(recovery.stdout));
    const controller = new AbortController();
    const active = runEngine(['live-poll'], {cwd, signal:controller.signal});
    setTimeout(() => controller.abort(), 200);
    const cancelled = await active;
    assert.equal(cancelled.killed, true);
    assert.equal(cancelled.code, 1);
  } finally {
    const stop = await runEngine(['live-server','stop'], {cwd});
    assert.equal(stop.code, 0, stop.stderr);
    const remove = await runEngine(['live-inject','--remove'], {cwd});
    assert.equal(remove.code, 0, remove.stderr);
    assert.equal(readFileSync(join(cwd,'index.html'),'utf8'), html);
  }
});
