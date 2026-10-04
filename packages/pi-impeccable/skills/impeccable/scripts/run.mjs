#!/usr/bin/env node
import { runEngine } from '../../../lib/runtime.ts';

try {
  const input = process.stdin.isTTY ? undefined : await new Promise((resolve, reject) => {
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { text += chunk; });
    process.stdin.on('end', () => resolve(text));
    process.stdin.on('error', reject);
  });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  const result = await runEngine(process.argv.slice(2), {
    cwd: process.cwd(), input, signal: controller.signal,
    sessionId: process.env.PI_IMPECCABLE_SESSION_ID,
    automatic: process.env.PI_IMPECCABLE_AUTOMATIC === '1',
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.killed) process.stderr.write('Impeccable 操作超时或已取消。\n');
  process.exitCode = result.code;
} catch (error) {
  process.stderr.write(`Impeccable：${error.message}\n`);
  process.exitCode = 1;
}
