/**
 * clickable-paths —— 把 pi 输出里的本地文件路径变成可点击链接。
 *
 * 原理：pi 的内置 markdown 渲染器对 link token 会输出 OSC 8 终端超链接
 * （见 pi-tui/dist/components/markdown.js 的 case "link"），且对 URL 协议
 * 没有任何白名单限制。所以只要在渲染前把路径改写成 markdown 链接语法，
 * 剩下的事 pi 自己就做了。
 *
 * 这里用 pi.registerMarkdownTransformer 在渲染前做这个改写。
 * 改写只影响显示，会话记录和发给模型的内容都不变。
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI, MarkdownTransformContext } from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------- 配置

type EditorScheme = "vscode" | "vscode-insiders" | "cursor" | "windsurf" | "file";

interface Config {
  /** 总开关 */
  enabled: boolean;
  /** 点击后用什么打开 */
  editor: EditorScheme;
  /** 是否处理不带反引号的裸路径 */
  bareText: boolean;
  /** 是否处理用户自己输入的消息 */
  userMessages: boolean;
}

const DEFAULTS: Config = {
  enabled: true,
  editor: "vscode",
  bareText: true,
  userMessages: true,
};

const CONFIG_PATH = path.join(os.homedir(), ".pi", "agent", "clickable-paths.json");

function loadConfig(): Config {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveConfig(config: Config): void {
  try {
    fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  } catch {
    // 存不下就算了，本次会话内的改动依然生效
  }
}

// ---------------------------------------------------------------- 路径 -> URL

/**
 * 把绝对路径拼成编辑器能识别的 URL。
 * VS Code 系列认 `vscode://file/<绝对路径>:<行>:<列>`，
 * file:// 则交给系统默认程序打开（不支持定位到行）。
 */
function buildUrl(config: Config, absPath: string, line?: string, column?: string): string {
  // 路径逐段编码，保留斜杠；空格之类的字符必须转义，否则 markdown 链接会断开
  const encoded = absPath.split("/").map(encodeURIComponent).join("/");

  if (config.editor === "file") {
    return `file://${encoded}`;
  }

  let url = `${config.editor}://file${encoded}`;
  if (line) {
    url += `:${line}`;
    if (column) url += `:${column}`;
  }
  return url;
}

// ---------------------------------------------------------------- 路径识别

/** 当前工作目录，session_start 时更新，用来解析相对路径 */
let workingDir = process.cwd();

/** fs.existsSync 的短期缓存：渲染会因终端宽度变化等原因重复触发，别每次都打盘 */
const existsCache = new Map<string, { ok: boolean; at: number }>();
const CACHE_TTL_MS = 5000;
const CACHE_MAX = 4000;

function isExistingFile(absPath: string): boolean {
  const now = Date.now();
  const hit = existsCache.get(absPath);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.ok;

  let ok = false;
  try {
    ok = fs.statSync(absPath).isFile();
  } catch {
    ok = false;
  }

  if (existsCache.size >= CACHE_MAX) existsCache.clear();
  existsCache.set(absPath, { ok, at: now });
  return ok;
}

/**
 * 把候选文本解析成绝对路径。
 * 只认真实存在的文件——这是最有效的误判过滤器，
 * 避免把 "node.js"、"a/b" 这种普通文字变成链接。
 */
function resolveFile(candidate: string): string | null {
  if (!candidate || candidate.includes("://")) return null;

  let raw = candidate;
  if (raw.startsWith("~/")) {
    raw = path.join(os.homedir(), raw.slice(2));
  }

  const abs = path.isAbsolute(raw) ? raw : path.resolve(workingDir, raw);
  return isExistingFile(abs) ? abs : null;
}

/** 从 `src/foo.ts:12:5` 里拆出路径、行号、列号 */
const LOCATION_RE = /^(.*?)(?::(\d+))?(?::(\d+))?$/;

function splitLocation(text: string): { file: string; line?: string; column?: string } {
  const m = LOCATION_RE.exec(text);
  if (!m) return { file: text };
  return { file: m[1], line: m[2], column: m[3] };
}

/**
 * 尝试把一段文本转成链接。转不了就返回 null。
 * 会先试带行号的解析，失败再试把整串当路径（应付文件名里带冒号的情况）。
 */
function linkify(config: Config, text: string, display: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const { file, line, column } = splitLocation(trimmed);
  let abs = resolveFile(file);
  if (abs) return `[${display}](${buildUrl(config, abs, line, column)})`;

  if (line) {
    abs = resolveFile(trimmed);
    if (abs) return `[${display}](${buildUrl(config, abs)})`;
  }

  return null;
}

// ---------------------------------------------------------------- 文本改写

/**
 * 一次扫描两种东西：
 *   组 1 —— 已经是 markdown 链接/图片的整段，原样跳过，否则会套娃；
 *   组 2/3 —— 行内代码的反引号和内容（`foo` 或 ``foo``）。
 */
const SEGMENT_RE = /(!?\[[^\]]*\]\([^)]*\))|(`+)([^`]+?)\2/g;

/**
 * 裸路径（不带反引号）。要求必须带扩展名，且不能紧跟在字母、斜杠、协议符号后面，
 * 剩下的靠 resolveFile 的存在性检查兜底。
 */
const BARE_PATH_RE =
  /(?<![\w`/:.-])((?:~\/|\.{1,2}\/|\/)?(?:[\w.@-]+\/)*[\w.@-]+\.[A-Za-z][\w]{0,9})((?::\d+){0,2})(?![\w/])/g;

function transformBare(config: Config, text: string): string {
  return text.replace(BARE_PATH_RE, (whole, filePart: string, locPart: string) => {
    return linkify(config, filePart + locPart, whole) ?? whole;
  });
}

/** 处理一段不在围栏代码块里的文本 */
function transformSegment(config: Config, text: string): string {
  let result = "";
  let last = 0;

  SEGMENT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SEGMENT_RE.exec(text)) !== null) {
    const plain = text.slice(last, m.index);
    result += config.bareText ? transformBare(config, plain) : plain;
    last = m.index + m[0].length;

    if (m[1] !== undefined) {
      // 已有的 markdown 链接 / 图片，原样保留
      result += m[0];
      continue;
    }

    // 行内代码：链接文本保留反引号，这样代码样式和可点击性都在
    const fence = m[2];
    const inner = m[3];
    result += linkify(config, inner, `${fence}${inner}${fence}`) ?? m[0];
  }

  const tail = text.slice(last);
  result += config.bareText ? transformBare(config, tail) : tail;
  return result;
}

/** 围栏代码块（``` 或 ~~~）里的内容原样保留 */
const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;

function transform(config: Config, markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let fence: string | null = null;

  for (const line of lines) {
    const m = FENCE_RE.exec(line);
    if (fence) {
      out.push(line);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
      continue;
    }
    if (m) {
      fence = m[1];
      out.push(line);
      continue;
    }
    out.push(transformSegment(config, line));
  }

  return out.join("\n");
}

// ---------------------------------------------------------------- 扩展入口

const EDITORS: EditorScheme[] = ["vscode", "vscode-insiders", "cursor", "windsurf", "file"];

export default function (pi: ExtensionAPI) {
  const config = loadConfig();

  pi.on("session_start", async (_event, ctx) => {
    workingDir = ctx.cwd ?? process.cwd();
  });

  pi.registerMarkdownTransformer((markdown: string, context: MarkdownTransformContext) => {
    if (!config.enabled) return markdown;
    // 流式输出时路径可能只写了一半，等最终渲染再处理；思考块一般是折叠的，跳过
    if (context.isStreaming) return markdown;
    if (context.messageType === "assistant-thinking") return markdown;
    if (context.messageType === "user" && !config.userMessages) return markdown;

    return transform(config, markdown);
  });

  pi.registerCommand("clickable-paths", {
    description: "开关文件路径可点击，或切换用哪个编辑器打开",
    handler: async (args: string, ctx) => {
      const [action, value] = args.trim().split(/\s+/);

      switch (action) {
        case "on":
        case "off": {
          config.enabled = action === "on";
          saveConfig(config);
          ctx.ui.notify(`路径链接已${config.enabled ? "开启" : "关闭"}（下一条消息生效）`, "info");
          return;
        }

        case "editor": {
          if (!EDITORS.includes(value as EditorScheme)) {
            ctx.ui.notify(`可选：${EDITORS.join(" / ")}`, "warning");
            return;
          }
          config.editor = value as EditorScheme;
          saveConfig(config);
          ctx.ui.notify(`点击后用 ${config.editor} 打开`, "info");
          return;
        }

        case "bare": {
          config.bareText = value !== "off";
          saveConfig(config);
          ctx.ui.notify(`裸路径（不带反引号）识别已${config.bareText ? "开启" : "关闭"}`, "info");
          return;
        }

        default: {
          ctx.ui.notify(
            [
              `状态：${config.enabled ? "开启" : "关闭"}`,
              `编辑器：${config.editor}`,
              `裸路径：${config.bareText ? "识别" : "不识别"}`,
              `工作目录：${workingDir}`,
              "",
              "用法：/clickable-paths [on|off]",
              "      /clickable-paths editor <vscode|vscode-insiders|cursor|windsurf|file>",
              "      /clickable-paths bare <on|off>",
            ].join("\n"),
            "info",
          );
        }
      }
    },
  });
}
