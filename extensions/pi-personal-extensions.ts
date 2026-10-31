import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  getAgentDir,
  getSettingsListTheme,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Container, SettingsList, Text } from "@earendil-works/pi-tui";
import autoSessionName from "./auto-session-name.ts";
import clickablePaths from "./clickable-paths.ts";
import statusline from "./statusline.ts";
import sessionTitle from "./session-title.ts";
import userMessageBorder from "./user-message-border.ts";
import inlineEffort from "./inline-effort.ts";

const features = [
  {
    id: "session-title",
    label: "右下角会话标题",
    description: "在输入框下方右对齐显示会话名，保留原有状态栏",
    register: sessionTitle,
  },
  {
    id: "auto-session-name",
    label: "自动会话命名",
    description: "独立模型后台命名，保护手动标题；/personal → 自动会话命名 → 选择命名模型",
    register: autoSessionName,
  },
  {
    id: "statusline",
    label: "状态栏：额度、会话 ID 与配色",
    description: "显示服务商剩余额度及会话 ID，预览或应用 11 套配色；配色需要另外启用 pi-statusline",
    register: statusline,
  },
  {
    id: "clickable-paths",
    label: "文件路径可点击",
    description: "通过 /personal → 文件路径可点击 设置开关、打开方式和裸路径识别",
    register: clickablePaths,
  },
  {
    id: "user-message-border",
    label: "用户消息橙色线框",
    description: "只增加边框，不修改底色和文字",
    register: userMessageBorder,
  },
  {
    id: "inline-effort",
    label: "原位思考强度（Jev / d1-ultra）",
    description: "通过 /personal → 原位思考强度（Jev / d1-ultra） → 选择分类模型（Jev / d1-ultra） 配置分类器，原位调整强度并保留缓存",
    register: inlineEffort,
  },
] as const;

type FeatureId = (typeof features)[number]["id"];
type FeatureSettings = Record<FeatureId, boolean>;
type Command = Parameters<ExtensionAPI["registerCommand"]>[1];

// 菜单只描述入口，设置和校验继续交给各功能已有的命令处理器。
const actions: Partial<Record<FeatureId, { label: string; command: string; args: string }[]>> = {
  "auto-session-name": [
    { label: "查看状态", command: "auto-name", args: "status" },
    { label: "选择命名模型", command: "auto-name", args: "model" },
    { label: "选择命名思考强度", command: "auto-name", args: "thinking" },
    { label: "预览建议标题", command: "auto-name", args: "preview" },
    { label: "暂停当前会话命名", command: "auto-name", args: "off" },
    { label: "恢复当前会话命名", command: "auto-name", args: "on" },
  ],
  "inline-effort": [
    { label: "查看分类模型与状态", command: "effort", args: "status" },
    { label: "选择分类模型（Jev / d1-ultra）", command: "effort", args: "model" },
    { label: "测试分类模型可用性", command: "effort", args: "test" },
  ],
  "clickable-paths": [
    { label: "查看路径链接设置", command: "clickable-paths", args: "" },
    { label: "开启路径链接", command: "clickable-paths", args: "on" },
    { label: "暂停路径链接", command: "clickable-paths", args: "off" },
    ...["vscode", "vscode-insiders", "cursor", "windsurf", "file"].map((editor) => ({
      label: `打开方式：${editor}`, command: "clickable-paths", args: `editor ${editor}`,
    })),
    { label: "识别裸路径", command: "clickable-paths", args: "bare on" },
    { label: "不识别裸路径", command: "clickable-paths", args: "bare off" },
  ],
  "statusline": [
    { label: "选择 pi-statusline 自定义配色", command: "statusline-style", args: "" },
  ],
};

function readSettings(path: string): FeatureSettings {
  const settings = Object.fromEntries(
    features.map(({ id }) => [id, true]),
  ) as FeatureSettings;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return settings;
    throw new Error(`无法读取功能配置：${path}`, { cause: error });
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`功能配置必须是 JSON 对象：${path}`);
  }
  const values = raw as Record<string, unknown>;
  for (const id of [
    ...features.map(({ id }) => id),
    "substatusline", "statusline-style-picker", "jev-inline-effort",
  ]) {
    if (!Object.hasOwn(raw, id)) continue;
    if (typeof values[id] !== "boolean")
      throw new Error(`功能配置 ${id} 必须为 true 或 false：${path}`);
  }
  for (const { id } of features) {
    const value = values[id];
    if (typeof value === "boolean") settings[id] = value;
  }
  // 缺失的旧开关按原默认值开启；仅两个旧开关都关闭时关闭合并功能。
  if (!Object.hasOwn(values, "statusline"))
    settings.statusline = values.substatusline !== false || values["statusline-style-picker"] !== false;
  if (!Object.hasOwn(values, "inline-effort") && typeof values["jev-inline-effort"] === "boolean")
    settings["inline-effort"] = values["jev-inline-effort"];
  return settings;
}

export default function personalExtensions(pi: ExtensionAPI) {
  const configPath = join(getAgentDir(), "personal-extensions.json");
  const enabled = readSettings(configPath);
  const commands = new Map<string, Command>();
  const featureApi: ExtensionAPI = Object.assign(Object.create(pi), {
    registerCommand(name: string, command: Command) {
      commands.set(name, command);
    },
  });
  for (const feature of features) {
    if (enabled[feature.id]) feature.register(featureApi);
  }

  pi.registerCommand("personal", {
    description: "个人扩展统一管理：启停、功能设置；switches 批量开关",
    async handler(args, ctx) {
      if (!ctx.hasUI) {
        ctx.ui.notify("当前模式没有交互界面，请在支持 UI 的客户端中使用 /personal。", "warning");
        return;
      }
      if (args.trim() && args.trim() !== "switches") {
        ctx.ui.notify("用法：/personal 或 /personal switches", "warning");
        return;
      }
      while (true) {
        let selected: FeatureSettings | undefined;
        let batch = args.trim() === "switches";
        while (!batch && !selected) {
          const labels = features.map((feature) => `${feature.label} · ${enabled[feature.id] ? "已加载" : "未加载"}`);
          const batchLabel = "批量功能开关";
          const choice = await ctx.ui.select("个人扩展 · 统一管理（Esc 退出）", [...labels, batchLabel]);
          if (choice === undefined) return;
          batch = choice === batchLabel;
          if (batch) break;
          const feature = features[labels.indexOf(choice)];
          if (!feature) return;
          const loaded = enabled[feature.id];
          const entries = loaded ? actions[feature.id] ?? [] : [];
          const toggle = loaded ? "禁用此功能并重载" : "启用此功能并重载";
          while (!selected) {
            const action = await ctx.ui.select(
              `${feature.label} · ${feature.description}${loaded ? "" : "；启用后可管理设置"}（Esc 返回上一级）`,
              [...entries.map(({ label }) => label), toggle],
            );
            if (action === undefined) break;
            if (action === toggle) {
              selected = { ...enabled, [feature.id]: !loaded };
              break;
            }
            const entry = entries.find(({ label }) => label === action);
            const command = entry && commands.get(entry.command);
            if (!entry || !command) return;
            let reloaded = false;
            await command.handler(entry.args, Object.assign(Object.create(ctx), {
              reload: async () => {
                reloaded = true;
                await ctx.reload();
              },
            }));
            // 重载后旧菜单及其功能实例已失效，不能继续使用。
            if (reloaded) return;
          }
        }
        // RPC 的 custom 直接返回 undefined，批量界面仅在 TUI 中提供。
        if (batch && ctx.mode !== "tui") {
          ctx.ui.notify("当前模式不支持批量功能开关，请在 /personal 中选择功能，再选择「启用此功能并重载」或「禁用此功能并重载」。", "warning");
          return;
        }
        if (batch) selected = await ctx.ui.custom<FeatureSettings | undefined>(
          (tui, theme, keybindings, done) => {
            const draft = { ...enabled };
            const container = new Container();
            container.addChild(new Text(theme.bold("个人扩展 · 功能开关"), 1, 1));
            const list = new SettingsList(
              features.map(({ id, label, description }) => ({
                id,
                label,
                description,
                currentValue: draft[id] ? "开启" : "关闭",
                values: ["开启", "关闭"],
              })),
              features.length,
              getSettingsListTheme(),
              (id, value) => {
                draft[id as FeatureId] = value === "开启";
              },
              () => done(undefined),
            );
            container.addChild(list);
            container.addChild(
              new Text(
                theme.fg(
                  "dim",
                  "上下选择 · 空格切换 · 确认键保存并重载 · 取消键放弃",
                ),
                1,
                1,
              ),
            );
            return {
              render: (width) => container.render(width),
              invalidate: () => container.invalidate(),
              handleInput(data) {
                if (keybindings.matches(data, "tui.select.confirm"))
                  return done(draft);
                list.handleInput(data);
                tui.requestRender();
              },
            };
          },
        );
        if (!selected || features.every(({ id }) => selected[id] === enabled[id])) {
          if (args.trim() === "switches") return;
          continue;
        }
        try {
          mkdirSync(dirname(configPath), { recursive: true });
          const temporaryPath = `${configPath}.${randomUUID()}.tmp`;
          writeFileSync(temporaryPath, `${JSON.stringify(selected, null, 2)}\n`, {
            flag: "wx",
            mode: 0o600,
          });
          renameSync(temporaryPath, configPath);
        } catch (error) {
          ctx.ui.notify(
            `保存失败，当前功能保持不变：${error instanceof Error ? error.message : String(error)}`,
            "error",
          );
          return;
        }
        await ctx.reload();
        return;
      }
    },
  });
}
