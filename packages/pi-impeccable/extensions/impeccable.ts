import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  changePin, commands, hookText, readPins, resultText, runEngine, sessionKey, skillDir,
} from "../lib/runtime.ts";

const descriptions: Record<string, string> = {
  craft: "新设计任务的兼容入口", init: "采集产品背景，写入 PRODUCT.md",
  document: "从代码记录 DESIGN.md", extract: "提取复用组件与设计令牌",
  shape: "规划 UX/UI", critique: "评审体验与视觉层级", audit: "检查无障碍、响应式与性能",
  polish: "发布前精修", bolder: "增强视觉表达", quieter: "收敛过强表达",
  distill: "精简界面", harden: "补齐错误、国际化与边界状态", onboard: "设计引导与空状态",
  animate: "添加有目的的动效", colorize: "改善配色", typeset: "改善字体与排版",
  layout: "调整布局与间距", delight: "添加体验细节", overdrive: "实现高表现力效果",
  clarify: "改善界面文案", adapt: "适配设备", optimize: "优化性能",
  live: "在浏览器中迭代视觉变体", generate: "生成指定元素的视觉变体",
};

export default function impeccable(pi: ExtensionAPI) {
  let lifetime = new AbortController();
  let hookQueue: Promise<unknown> = Promise.resolve();
  let touched = false;
  let continued = false;
  let failed = false;
  const registeredPins = new Set<string>();

  const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
  const report = (error: unknown, ctx: ExtensionContext) => {
    if (failed || lifetime.signal.aborted || ctx.signal?.aborted) return;
    failed = true;
    pi.sendMessage({
      customType: "impeccable-hook", display: true,
      content: `Impeccable 检查未完成：${errorText(error)}。不能据此判定界面合格。完成编辑后执行一次 impeccable detect --json <修改目标>。`,
    }, { triggerTurn: false, deliverAs: "nextTurn" });
  };
  const scan = (event: Record<string, unknown>, ctx: ExtensionContext): Promise<string> => {
    const signal = ctx.signal ? AbortSignal.any([ctx.signal, lifetime.signal]) : lifetime.signal;
    const run = hookQueue.catch(() => {}).then(async () => {
      if (signal.aborted) return "";
      try {
        const result = await runEngine(["hook"], {
          cwd: ctx.cwd, input: JSON.stringify(event), signal, timeoutMs: 30_000,
          sessionId: ctx.sessionManager.getSessionId(),
        });
        if (signal.aborted) return "";
        if (result.code !== 0 || result.killed) throw new Error(resultText(result));
        return hookText(result.stdout);
      } catch (error) {
        if (signal.aborted) return "";
        throw error;
      }
    });
    hookQueue = run;
    return run;
  };

  const request = (args: string, ctx: ExtensionContext) => {
    const text = readFileSync(join(skillDir, "SKILL.md"), "utf8");
    pi.sendUserMessage(
      `技能目录：${skillDir}\n先读取 ${join(skillDir, "reference/pi.md")}。以下为本包的 Impeccable 技能。\n\n${text}\n\n用户请求：/impeccable ${args}`,
      ctx.isIdle() ? undefined : { deliverAs: "followUp" },
    );
  };
  const loadPins = (ctx: ExtensionContext) => {
    try {
      for (const command of readPins(ctx.cwd)) {
        if (registeredPins.has(command)) continue;
        if (pi.getCommands().some((item) => item.name === command)) {
          ctx.ui.notify(`/${command} 已被其他资源占用，Impeccable 不覆盖它。`, "warning");
          continue;
        }
        registeredPins.add(command);
        pi.registerCommand(command, {
          description: `Impeccable：${descriptions[command]}`,
          async handler(args, current) {
            if (!readPins(current.cwd).includes(command)) {
              current.ui.notify(`/${command} 未在当前项目启用。执行 /reload 更新列表。`, "warning");
              return;
            }
            request(`${command} ${args}`, current);
          },
        });
      }
    } catch (error) {
      ctx.ui.notify(errorText(error), "error");
    }
  };
  const reset = (ctx: ExtensionContext) => {
    lifetime.abort();
    lifetime = new AbortController();
    hookQueue = Promise.resolve();
    touched = continued = failed = false;
    loadPins(ctx);
  };
  pi.on("session_start", (_event, ctx) => reset(ctx));
  pi.on("session_tree", (_event, ctx) => reset(ctx));
  pi.on("session_shutdown", async () => {
    lifetime.abort();
    await hookQueue.catch(() => {});
  });
  pi.on("before_agent_start", () => {
    touched = continued = failed = false;
  });

  pi.registerCommand("impeccable", {
    description: "Impeccable 设计工具：24 个命令、检测与 Live 迭代",
    getArgumentCompletions(prefix) {
      if (/^(pin|unpin)\s/.test(prefix)) {
        const action = prefix.split(/\s/)[0];
        return Object.keys(commands).filter((name) => `${action} ${name}`.startsWith(prefix))
          .map((name) => ({ value: `${action} ${name}`, label: name, description: descriptions[name] }));
      }
      return [...Object.keys(commands), "teach", "hooks", "doctor", "pin", "unpin", "help"]
        .filter((name) => name.startsWith(prefix))
        .map((name) => ({ value: name, label: name, description: descriptions[name] }));
    },
    async handler(args, ctx) {
      const tokens = args.trim().split(/\s+/);
      if (["pin", "unpin"].includes(tokens[0])) {
        try {
          if (tokens.length !== 2) throw new Error("用法：/impeccable <pin|unpin> <设计命令>");
          if (tokens[0] === "pin" && !registeredPins.has(tokens[1]) && pi.getCommands().some((item) => item.name === tokens[1])) {
            throw new Error(`/${tokens[1]} 已被占用，无法创建快捷命令。`);
          }
          const text = changePin(ctx.cwd, tokens[0], tokens[1]);
          ctx.ui.notify(text, "info");
          await ctx.reload();
          return;
        } catch (error) {
          ctx.ui.notify(errorText(error), "error");
          return;
        }
      }
      if (tokens[0] === "help") {
        pi.sendMessage({ customType: "impeccable-help", display: true, content:
          "## Impeccable\n\n" + Object.keys(commands).map((name) => `- \`/impeccable ${name}\`：${descriptions[name]}`).join("\n")
          + "\n\n管理：`hooks`、`doctor`、`pin <命令>`、`unpin <命令>`。也可以直接描述设计任务。",
        }, { triggerTurn: false });
        return;
      }
      request(args, ctx);
    },
  });

  pi.registerTool({
    name: "impeccable", label: "Impeccable",
    description: "运行固定版本的完整 Impeccable 引擎。argv 为参数数组，不经 shell。支持 context、detect、hooks、doctor、palette、字体、comp、决策页面和全部 live-* 等上游命令。设计动作（polish 等）应按技能执行，不能当作 CLI 动词。live-poll 使用 10 分钟长轮询；处理事件后立即重新轮询。默认 cwd 为项目目录，可使用 Live 返回的 projectRoot。检测退出码 2 表示发现问题，1 表示操作失败。图像生成需要用户明确请求，并遵循宿主授权规则。",
    parameters: Type.Object({
      argv: Type.Array(Type.String(), { description: '如 ["detect", "--json", "src"]' }),
      cwd: Type.Optional(Type.String({ description: "相对或绝对工作目录" })),
      stdin: Type.Optional(Type.String()),
      timeoutMs: Type.Optional(Type.Integer({ minimum: 1, maximum: 3_600_000 })),
    }),
    async execute(_id, params, signal, _update, ctx) {
      const result = await runEngine(params.argv, {
        cwd: params.cwd ? resolve(ctx.cwd, params.cwd) : ctx.cwd,
        input: params.stdin, signal: signal ? AbortSignal.any([signal, lifetime.signal]) : lifetime.signal,
        timeoutMs: params.timeoutMs, sessionId: ctx.sessionManager.getSessionId(), automatic: true,
      });
      if (params.argv[0] === "build-phase") touched = true;
      return {
        content: [{ type: "text", text: resultText(result) }], details: result,
        isError: result.code !== 0 && !(params.argv[0] === "detect" && result.code === 2),
      };
    },
  });

  pi.on("tool_result", async (event, ctx) => {
    const name = event.toolName.split(".").at(-1);
    if (event.isError || !["edit", "write", "apply_patch"].includes(name ?? "")) return;
    const path = event.input.path ?? event.input.file_path;
    if (name !== "apply_patch" && typeof path !== "string") return;
    touched = true;
    try {
      const text = await scan({
        hook_event_name: "PostToolUse", cwd: ctx.cwd,
        session_id: sessionKey(ctx.sessionManager.getSessionId()),
        tool_name: name === "apply_patch" ? "apply_patch" : name === "edit" ? "Edit" : "Write",
        tool_input: name === "apply_patch" ? event.input : { file_path: path },
      }, ctx);
      if (text && !ctx.signal?.aborted && !lifetime.signal.aborted) {
        pi.sendMessage({ customType: "impeccable-hook", content: text, display: true },
          { triggerTurn: false, deliverAs: "nextTurn" });
      }
    } catch (error) { report(error, ctx); }
  });
  pi.on("agent_before_settle", async (event, ctx) => {
    if (event.outcome !== "completed" || (!touched && !failed) || continued) return;
    try {
      const text = await scan({
        hook_event_name: "Stop", cwd: ctx.cwd,
        session_id: sessionKey(ctx.sessionManager.getSessionId()), stop_hook_active: false,
      }, ctx);
      if (!text || ctx.signal?.aborted || lifetime.signal.aborted) return;
      continued = true;
      return {
        entries: [...event.entries, { type: "custom_message", customType: "impeccable-hook", content: text, display: true }],
        continue: event.continue || event.context.canContinue,
      };
    } catch (error) { report(error, ctx); }
  });
}
