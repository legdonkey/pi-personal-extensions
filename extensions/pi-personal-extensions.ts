import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  getAgentDir,
  getSettingsListTheme,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Container, SettingsList, Text } from "@earendil-works/pi-tui";
import clickablePaths from "./clickable-paths.ts";
import statuslineStylePicker from "./statusline-style-picker.ts";
import subStatusline from "./substatusline.ts";
import terminalTitle from "./terminal-title.ts";
import userMessageBorder from "./user-message-border.ts";

const features = [
  {
    id: "terminal-title",
    label: "终端标题",
    description: "用会话名设置终端标题",
    register: terminalTitle,
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
] as const;

type FeatureId = (typeof features)[number]["id"];
type FeatureSettings = Record<FeatureId, boolean>;

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
  for (const feature of features) {
    if (enabled[feature.id]) feature.register(pi);
  }

  pi.registerCommand("personal", {
    description: "选择个人扩展功能，保存后自动重载",
    async handler(_args, ctx) {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("请在 pi 终端交互模式中使用 /personal", "warning");
        return;
      }
      const selected = await ctx.ui.custom<FeatureSettings | undefined>(
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
