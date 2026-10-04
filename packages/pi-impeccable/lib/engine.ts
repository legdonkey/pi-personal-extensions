import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const engineManifest: { version: string; baseUrl: string; sha256: Record<string, string> } = JSON.parse(
  readFileSync(new URL("../engine.json", import.meta.url), "utf8"),
);

export function verifyEngine(bytes: Uint8Array, expected: string): void {
  if (createHash("sha256").update(bytes).digest("hex") !== expected) {
    throw new Error("Impeccable 引擎 SHA-256 校验失败，拒绝执行。");
  }
}

export async function locateEngine(signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new Error("Impeccable 操作已取消");
  if (process.env.IMPECCABLE_BIN) {
    const path = resolve(process.env.IMPECCABLE_BIN);
    if (!statSync(path).isFile()) throw new Error(`IMPECCABLE_BIN 必须指向可执行文件：${path}`);
    return path;
  }
  const os = process.platform === "win32" ? "windows" : process.platform;
  const target = `${os}-${process.arch}`;
  const expected = engineManifest.sha256[target];
  if (!expected) throw new Error(`没有适用于 ${target} 的 Impeccable 引擎。可以配置 IMPECCABLE_BIN。`);
  const filename = `impeccable-${target}${os === "windows" ? ".exe" : ""}`;
  const path = join(process.env.IMPECCABLE_HOME || join(homedir(), ".impeccable"), "pi", engineManifest.version, filename);
  try {
    const bytes = readFileSync(path);
    verifyEngine(bytes, expected);
    return path;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  const response = await fetch(`${engineManifest.baseUrl}/${filename}`, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`下载 Impeccable 引擎失败：HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  verifyEngine(bytes, expected);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, bytes, { mode: 0o755, flag: "wx" });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
  return path;
}
