import { fork } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir, getPackageDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const workerUrl = new URL("./understand-video-worker.mjs", import.meta.url);
const TIMEOUT_MS = 120_000;
const MAX_RESULT_BYTES = 40 * 1024;
export const VIDEO_BOUNDARY = "提供方 antigravity；模型 gemini-4-argon；输入模式：原始 video/mp4（工具内部调用，不是主会话视频附件）。音轨未可靠验证；长视频、快速转场不保证完整覆盖。视频会外发并消耗模型额度。";

type VideoReply = { ok: boolean; text: string; bytes?: number; provider?: string; model?: string; inputMode?: string };

export async function runVideoWorker(request: Record<string, unknown>, signal?: AbortSignal, timeout = TIMEOUT_MS): Promise<VideoReply> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = fork(fileURLToPath(workerUrl), ["--understand-video-worker"], {
      cwd: request.cwd as string,
      execArgv: [],
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      env: { ...process.env, PI_CODING_AGENT_DIR: request.agentDir as string },
    });
    let reply: VideoReply | undefined;
    let failure: Error | undefined;
    const stop = (message: string) => {
      failure ??= new Error(message);
      child.kill("SIGKILL");
    };
    const abort = () => stop("视频分析已取消，隔离进程已终止。");
    const timer = setTimeout(() => stop("视频分析超过 120 秒，隔离进程已终止。"), timeout);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.on("message", (value: unknown) => {
      if (reply || !value || typeof value !== "object" || Buffer.byteLength(JSON.stringify(value)) > MAX_RESULT_BYTES) return stop("视频进程返回无效结果。");
      const result = value as VideoReply;
      if (typeof result.ok !== "boolean" || typeof result.text !== "string" || !result.text.trim()) return stop("视频进程返回空结果。");
      reply = result;
    });
    child.on("error", () => stop("无法启动视频隔离进程。"));
    child.on("close", () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (failure) reject(failure);
      else if (!reply) reject(new Error("视频隔离进程未返回结果。"));
      else resolve(reply);
    });
    child.send(request, (error) => { if (error) stop("无法发送视频分析任务。"); });
  });
}

export default function understandVideo(pi: ExtensionAPI) {
  pi.registerCommand("understand-video-status", {
    description: "查看原视频审查的通路和限制",
    async handler(_args, ctx) {
      ctx.ui.notify(`${VIDEO_BOUNDARY} 仅允许当前工作目录内非隐藏、无符号链接或硬链接的 MP4，最大 20 MiB，问题最多 8000 字符。通过 /personal → 原视频审查 启停；需要 Pi 1.5.0 与 pi-antigravity 0.11.x。`, "info");
    },
  });
  pi.registerTool({
    name: "understand_video",
    label: "原视频审查",
    executionMode: "sequential",
    description: `${VIDEO_BOUNDARY} 仅在用户明确授权上传该文件后调用。只读当前工作目录内非隐藏路径的 MP4（无符号/硬链接），24 bytes–20 MiB；120 秒超时，输出最多约 32 KiB。失败不回退其他模型。`,
    promptSnippet: "通过现有 Antigravity OAuth 将获授权的本地 MP4 原视频交给 Argon 审查",
    promptGuidelines: ["调用 understand_video 前必须确认用户授权将该视频外发。understand_video 仅返回模型分析，不代表主会话已直接看到视频；音轨无法确认时标为未审查。"],
    parameters: Type.Object({ path: Type.String({ minLength: 1, maxLength: 4096, description: "用户授权的工作目录内 MP4 路径" }), question: Type.String({ minLength: 1, maxLength: 8000, description: "要审查的问题" }) }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      try {
        signal?.throwIfAborted();
        if (!params.question.trim() || params.question.length > 8000) throw new Error("审查问题不能为空且最多 8000 字符。");
        const { readAuthorizedVideo } = await import(workerUrl.href);
        const video = await readAuthorizedVideo(ctx.cwd, params.path);
        const result = await runVideoWorker({ cwd: ctx.cwd, path: video.path, digest: video.digest, question: params.question, sdkDir: getPackageDir(), agentDir: getAgentDir(), providerPath: join(getAgentDir(), "npm/node_modules/pi-antigravity/src/index.ts") }, signal);
        return { content: [{ type: "text" as const, text: `${VIDEO_BOUNDARY}\n\n${result.text}` }], details: { ok: result.ok, inputMode: "native-video/mp4" }, isError: !result.ok };
      } catch {
        // 不转发路径、SDK 或 provider 原始异常，避免把账号/鉴权信息带入会话。
        return { content: [{ type: "text" as const, text: "原视频审查失败或已取消：仅支持工作目录内非隐藏、无链接的 MP4（24 bytes–20 MiB）；请检查授权、登录、额度及兼容版本。超时为 120 秒，未切换模型。通过 /personal → 原视频审查 → 查看通路与限制 了解边界。" }], details: { ok: false, inputMode: "native-video/mp4" }, isError: true };
      }
    },
  });
}
