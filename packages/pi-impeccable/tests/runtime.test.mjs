import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adaptContext, changePin, commands, hookEnabled, hookText, readPins, resultText, runEngine, skillDir, writeObject } from '../lib/runtime.ts';
import { engineManifest, verifyEngine } from '../lib/engine.ts';

function project(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'pi-impeccable-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}

test('固定上游快照覆盖全部命令、引用与运行资源', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const upstream = JSON.parse(readFileSync(new URL('../upstream.json', import.meta.url), 'utf8'));
  assert.equal(engineManifest.version, upstream.engineVersion);
  assert.deepEqual(manifest.pi.extensions, ['./extensions/impeccable.ts']);
  assert.equal(Object.keys(engineManifest.sha256).length, 5);
  assert.throws(() => verifyEngine(Buffer.from('bad engine'), engineManifest.sha256['darwin-arm64']), /校验失败/);
  assert.equal(readFileSync(join(skillDir, 'scripts/VERSION'), 'utf8').trim(), upstream.engineVersion);
  assert.equal(Object.keys(commands).length, 24);
  assert.equal(Object.keys(upstream.files).length, 57);
  const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  assert.match(skill, /^---\nname: impeccable\ndescription:/);
  assert.match(skill, /reference\/pi\.md/);
  assert.doesNotMatch(skill, /no Node or other runtime is required/);
  for (const name of Object.keys(commands)) assert.ok(existsSync(join(skillDir, `reference/${name}.md`)), name);
  for (const [path, digest] of Object.entries(upstream.files)) {
    const content = readFileSync(join(skillDir, path));
    if (!path.endsWith('.md') && !['scripts/impeccable', 'scripts/impeccable.cmd'].includes(path)) {
      assert.equal(createHash('sha256').update(content).digest('hex'), digest, path);
    }
    if (path.endsWith('.md')) {
      const text = content.toString();
      assert.doesNotMatch(text, /\{\{(?:scripts_path|command_prefix)\}\}/, path);
      assert.doesNotMatch(text, /\.pi\/skills\/impeccable\/scripts/, path);
      for (const match of text.matchAll(/\]\(([^)\s]+\.md)(?:#[^)]+)?\)/g)) {
        if (/^(https?:|#)/.test(match[1])) continue;
        const target = new URL(match[1], new URL('../skills/impeccable/' + path, import.meta.url));
        assert.ok(existsSync(target), `${path} → ${match[1]}`);
      }
    }
  }
  assert.match(readFileSync(new URL('../LICENSE', import.meta.url), 'utf8'), /Copyright 2025 Paul Bakaus/);
});

test('项目快捷命令校验、去重和损坏配置保护', (t) => {
  const cwd = project(t);
  assert.deepEqual(readPins(cwd), []);
  changePin(cwd, 'pin', 'audit'); changePin(cwd, 'pin', 'audit');
  assert.deepEqual(readPins(cwd), ['audit']);
  assert.throws(() => changePin(cwd, 'pin', '../bad'), /用法/);
  changePin(cwd, 'unpin', 'audit');
  assert.deepEqual(readPins(cwd), []);
  const path = join(cwd, '.pi/impeccable-pins.json');
  for (const invalid of ['{', 'null', '[]', '{"commands":["unknown"]}']) {
    writeFileSync(path, invalid);
    assert.throws(() => changePin(cwd, 'pin', 'audit'));
    assert.equal(readFileSync(path, 'utf8'), invalid);
  }
});

test('上下文区分自动和手动检查，保留子代理授权边界', (t) => {
  const cwd = project(t);
  const stdout = `RESOLVED_CONTEXT:\n${JSON.stringify({projectRoot: cwd})}\n\n---\n\nMANUAL_DETECTOR_REQUIRED: scan\n\n---\n\nSUBAGENT_AUTHORIZATION: spawn`;
  assert.match(adaptContext(stdout, true), /PI_AUTOMATIC_DETECTOR/);
  assert.match(adaptContext(stdout, false), /MANUAL_DETECTOR_REQUIRED/);
  assert.doesNotMatch(adaptContext(stdout, true), /SUBAGENT_AUTHORIZATION:/);
  writeObject(join(cwd, '.impeccable/config.json'), { hook: { enabled: false } });
  assert.equal(hookEnabled(cwd), false);
  assert.match(adaptContext(stdout, true), /MANUAL_DETECTOR_REQUIRED/);
  writeObject(join(cwd, '.impeccable/config.local.json'), { hook: { enabled: true } });
  assert.equal(hookEnabled(cwd), true);
  assert.equal(hookText('{"hookSpecificOutput":{"additionalContext":"fix"}}'), 'fix');
  assert.throws(() => hookText('{"bad":true}'), /无法识别/);
});

test('引擎参数不经过 shell；取消、超时与长输出可恢复', async (t) => {
  const cwd = project(t);
  await assert.rejects(runEngine(['bad\0arg'], {cwd}), /空字符/);
  await assert.rejects(runEngine(['detect'], {cwd, timeoutMs: 0}), /timeoutMs/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(runEngine(['detect'], {cwd, signal: controller.signal}), /取消/);
  const result = { code: 0, stdout: '字'.repeat(50_000), stderr: '', killed: false };
  assert.match(resultText(result), /完整输出/);
  assert.equal(readFileSync(result.outputPath, 'utf8'), result.stdout);
  rmSync(new URL('.', `file://${result.outputPath}`), { recursive: true, force: true });
});
