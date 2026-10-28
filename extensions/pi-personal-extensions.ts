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
import statuslineStylePicker from "./statusline-style-picker.ts";
import sessionTitle from "./session-title.ts";
import subStatusline from "./substatusline.ts";
import userMessageBorder from "./user-message-border.ts";
import jevInlineEffort from "./jev-inline-effort.ts";

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
    description: "独立模型后台命名；/auto-name model 选择模型，保护手动标题",
    register: autoSessionName,
  },
  {
    id: "substatusline",
    label: "额度与会话 ID",
    description: "在状态栏显示服务商剩余额度及会话 ID",
    register: subStatusline,
  },
  {
    id: "clickable-paths",
    label: "文件路径可点击",
    description: "保留 /clickable-paths 命令及原有配置",
    register: clickablePaths,
  },
  {
    id: "user-message-border",
    label: "用户消息橙色线框",
    description: "只增加边框，不修改底色和文字",
    register: userMessageBorder,
  },
  {
    id: "statusline-style-picker",
    label: "状态栏风格选择",
    description: "提供 /statusline-style；需要另外启用 pi-statusline",
    register: statuslineStylePicker,
  },
  {
    id: "jev-inline-effort",
    label: "原位思考强度（Jev / d1-ultra）",
    description: "/effort 选择分类模型；物理 GPT-6 Codex 用 configuration_update 调整强度并保留缓存",
    register: jevInlineEffort,
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
  "jev-inline-effort": [
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
  "statusline-style-picker": [
    { label: "预览并选择配色", command: "statusline-style", args: "" },
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
  for (const { id } of features) {
    if (!Object.hasOwn(raw, id)) continue;
    const value = (raw as Record<string, unknown>)[id];
    if (typeof value !== "boolean")
      throw new Error(`功能配置 ${id} 必须为 true 或 false：${path}`);
    settings[id] = value;
  }
  return settings;
}

export default function personalExtensions(pi: ExtensionAPI) {
  const configPath = join(getAgentDir(), "personal-extensions.json");
  const enabled = readSettings(configPath);
  const commands = new Map<string, Command>();
  const featureApi: ExtensionAPI = Object.assign(Object.create(pi), {
    registerCommand(name: string, command: Command) {
      commands.set(name, command);
      pi.registerCommand(name, command);
    },
  });
  for (const feature of features) {
    if (enabled[feature.id]) feature.register(featureApi);
  }

  pi.registerCommand("personal", {
    description: "个人扩展统一管理：启停、功能设置；switches 批量开关",
    async handler(args, ctx) {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("请在 pi 终端交互模式中使用 /personal", "warning");
        return;
      }
      if (args.trim() && args.trim() !== "switches") {
        ctx.ui.notify("用法：/personal 或 /personal switches", "warning");
        return;
      }
      let selected: FeatureSettings | undefined;
      let batch = args.trim() === "switches";
      if (!batch) {
        const labels = features.map((feature) => `${feature.label} · ${enabled[feature.id] ? "已加载" : "未加载"}`);
        const batchLabel = "批量功能开关";
        const choice = await ctx.ui.select("个人扩展 · 统一管理", [...labels, batchLabel]);
        if (choice === undefined) return;
        batch = choice === batchLabel;
        if (!batch) {
          const feature = features[labels.indexOf(choice)];
          if (!feature) return;
          const loaded = enabled[feature.id];
          const entries = loaded ? actions[feature.id] ?? [] : [];
          const toggle = loaded ? "禁用此功能并重载" : "启用此功能并重载";
          const action = await ctx.ui.select(
            `${feature.label} · ${feature.description}${loaded ? "" : "；启用后可管理设置"}`,
            [...entries.map(({ label }) => label), toggle],
          );
          if (action === undefined) return;
          if (action !== toggle) {
            const entry = entries.find(({ label }) => label === action);
            const command = entry && commands.get(entry.command);
            if (entry && command) await command.handler(entry.args, ctx);
            return;
          }
          selected = { ...enabled, [feature.id]: !loaded };
        }
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
      if (!selected || features.every(({ id }) => selected[id] === enabled[id]))
        return;
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
    },
  });
}
