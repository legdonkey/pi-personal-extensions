import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

interface Style {
	id: number;
	name: string;
	colors: readonly (readonly [fg: string, bg: string])[];
}

const STYLES: readonly Style[] = [
	{
		id: 1,
		name: "茶墨渐层",
		colors: [
			["#f8fafc", "#2e1a0c"],
			["#f8fafc", "#473123"],
			["#f8fafc", "#624b3b"],
			["#f8fafc", "#7e6555"],
			["#11161a", "#9b8171"],
			["#11161a", "#b99f8d"],
		],
	},
	{
		id: 2,
		name: "冰川蓝阶",
		colors: [
			["#f8fafc", "#002436"],
			["#f8fafc", "#0c3c50"],
			["#f8fafc", "#29566b"],
			["#f8fafc", "#457287"],
			["#11161a", "#618fa5"],
			["#11161a", "#7eacc3"],
		],
	},
	{
		id: 3,
		name: "靛夜层云",
		colors: [
			["#f8fafc", "#161944"],
			["#f8fafc", "#2b3260"],
			["#f8fafc", "#444c7c"],
			["#f8fafc", "#5e679a"],
			["#11161a", "#7984b8"],
			["#11161a", "#96a1d7"],
		],
	},
	{
		id: 4,
		name: "琥珀余温",
		colors: [
			["#f8fafc", "#391300"],
			["#f8fafc", "#542c00"],
			["#f8fafc", "#704600"],
			["#f8fafc", "#8d621b"],
			["#11161a", "#ab7e3c"],
			["#11161a", "#c99b5a"],
		],
	},
	{
		id: 5,
		name: "紫藤暮色",
		colors: [
			["#f8fafc", "#2f0d3c"],
			["#f8fafc", "#482656"],
			["#f8fafc", "#634072"],
			["#f8fafc", "#7f5b8f"],
			["#11161a", "#9c77ad"],
			["#11161a", "#ba94cc"],
		],
	},
	{
		id: 6,
		name: "松林雾径",
		colors: [
			["#f8fafc", "#0c260e"],
			["#f8fafc", "#243e25"],
			["#f8fafc", "#3d583d"],
			["#f8fafc", "#577458"],
			["#11161a", "#739173"],
			["#11161a", "#90ae90"],
		],
	},
	{
		id: 7,
		name: "陶火晚照",
		colors: [
			["#f8fafc", "#430000"],
			["#f8fafc", "#601e0d"],
			["#f8fafc", "#7e3928"],
			["#f8fafc", "#9c5442"],
			["#11161a", "#bb705d"],
			["#11161a", "#db8e7a"],
		],
	},
	{
		id: 8,
		name: "玫瑰尘光",
		colors: [
			["#f8fafc", "#3a0b1a"],
			["#f8fafc", "#562432"],
			["#f8fafc", "#723e4b"],
			["#f8fafc", "#905865"],
			["#11161a", "#ae7481"],
			["#11161a", "#ce919e"],
		],
	},
	{
		id: 9,
		name: "石墨银阶",
		colors: [
			["#f8fafc", "#1f1f1f"],
			["#f8fafc", "#373737"],
			["#f8fafc", "#505050"],
			["#f8fafc", "#6b6b6b"],
			["#11161a", "#878787"],
			["#11161a", "#a4a4a4"],
		],
	},
	{
		id: 10,
		name: "潮汐青绿",
		colors: [
			["#f8fafc", "#002725"],
			["#f8fafc", "#06403d"],
			["#f8fafc", "#275a57"],
			["#f8fafc", "#437672"],
			["#11161a", "#5f928f"],
			["#11161a", "#7cb0ac"],
		],
	},
	{
		id: 11,
		name: "Claude 暖纸",
		colors: [
			["#d97757", "#141413"],
			["#faf9f5", "#30302e"],
			["#faf9f5", "#5e5d59"],
			["#141413", "#87867f"],
			["#141413", "#b0aea5"],
			["#141413", "#d1cfc5"],
		],
	},
];

const SEGMENT_GROUPS = {
	brand: 0,
	provider: 0,
	model: 0,
	thinking: 1,
	tools: 1,
	cwd: 2,
	branch: 3,
	context: 4,
	tokens: 4,
	cost: 4,
	cache: 5,
	time: 5,
	turn: 5,
} as const;

function paletteFor(style: Style) {
	return Object.fromEntries(
		Object.entries(SEGMENT_GROUPS).map(([segment, group]) => {
			const [fg, bg] = style.colors[group];
			return [segment, { fg, bg }];
		}),
	);
}

function findStyle(value: string): Style | undefined {
	const query = value.trim().toLowerCase();
	return STYLES.find(
		(style) => String(style.id) === query || style.name.toLowerCase() === query,
	);
}

const RESET = "\x1b[0m";
const PREVIEW_LABELS = ["M sol", "T high", "D pi", "G main", "C 42%", "K 76%"];

function ansi(hex: string, background = false): string {
	const [red, green, blue] = hex
		.slice(1)
		.match(/.{2}/g)
		?.map((value) => Number.parseInt(value, 16)) ?? [0, 0, 0];
	return `\x1b[${background ? 48 : 38};2;${red};${green};${blue}m`;
}

function swatches(style: Style): string {
	return style.colors
		.map(([, background]) => `${ansi(background)}●${RESET}`)
		.join("");
}

function previewLines(style: Style, width: number): string[] {
	const ranges =
		width >= 68
			? [[0, 6]]
			: [
					[0, 3],
					[3, 6],
				];
	return ranges.map(([start, end]) => {
		let line = "";
		for (let index = start; index < end; index++) {
			const [foreground, background] = style.colors[index];
			line += `${ansi(foreground)}${ansi(background, true)} ${PREVIEW_LABELS[index]} ${RESET}`;
			if (index < end - 1) {
				const nextBackground = style.colors[index + 1][1];
				line += `${ansi(background)}${ansi(nextBackground, true)}${RESET}`;
			}
		}
		return line;
	});
}

async function applyStyle(style: Style) {
	const agentDir = process.env.PI_AGENT_DIR || join(homedir(), ".pi", "agent");
	const path = join(agentDir, "pi-statusline.json");
	let current: Record<string, unknown> = {};
	try {
		current = JSON.parse(await readFile(path, "utf8"));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}

	const next = {
		...current,
		palettePreset: "custom",
		palette: paletteFor(style),
		density: "compact",
		separator: "round",
	};
	const temporaryPath = `${path}.tmp`;
	await mkdir(dirname(path), { recursive: true });
	await writeFile(temporaryPath, `${JSON.stringify(next, null, "\t")}\n`, {
		mode: 0o600,
	});
	await rename(temporaryPath, path);
}

export default function statuslineStylePicker(pi: ExtensionAPI) {
	pi.registerCommand("statusline-style", {
		description: "预览并应用保存的 pi-statusline 风格",
		getArgumentCompletions(prefix) {
			const query = prefix.trim().toLowerCase();
			return STYLES.filter(
				(style) =>
					String(style.id).startsWith(query) ||
					style.name.toLowerCase().includes(query),
			).map((style) => ({
				value: String(style.id),
				label: `${style.id}. ${style.name}`,
			}));
		},
		async handler(args, ctx) {
			let style = args.trim() ? findStyle(args) : undefined;
			if (!args.trim()) {
				if (ctx.mode !== "tui") {
					ctx.ui.notify("请在 pi 终端交互模式中预览状态栏风格", "warning");
					return;
				}
				const { Key, matchesKey, truncateToWidth } = await import(
					"@earendil-works/pi-tui"
				);
				const selected = await ctx.ui.custom<number | null>(
					(tui, theme, _keybindings, done) => {
						let index = 0;
						return {
							render(width: number) {
								const lines = [
									theme.fg("accent", "选择状态栏风格（上下键实时预览）"),
									"",
								];
								for (let item = 0; item < STYLES.length; item++) {
									const marker = item === index ? theme.fg("accent", ">") : " ";
									const name = `${String(STYLES[item].id).padStart(2, "0")}  ${STYLES[item].name}`;
									lines.push(
										`${marker} ${item === index ? theme.bold(name) : name}  ${swatches(STYLES[item])}`,
									);
								}
								lines.push("", theme.fg("muted", `预览 · ${STYLES[index].name}`));
								lines.push(...previewLines(STYLES[index], width));
								lines.push("", theme.fg("dim", "↑↓ 选择 · Enter 应用 · Esc 取消"));
								return lines.map((line) => truncateToWidth(line, width));
							},
							invalidate() {},
							handleInput(data: string) {
								if (matchesKey(data, Key.up))
									index = (index - 1 + STYLES.length) % STYLES.length;
								else if (matchesKey(data, Key.down))
									index = (index + 1) % STYLES.length;
								else if (matchesKey(data, Key.enter)) return done(index);
								else if (matchesKey(data, Key.escape)) return done(null);
								tui.requestRender();
							},
						};
					},
				);
				if (selected === null || selected === undefined) return;
				style = STYLES[selected];
			}

			if (!style) {
				ctx.ui.notify(`未知风格：${args.trim()}`, "error");
				return;
			}

			try {
				await applyStyle(style);
				ctx.ui.notify(`已应用：${style.name}`, "info");
				await ctx.reload();
			} catch (error) {
				ctx.ui.notify(
					`应用失败：${error instanceof Error ? error.message : String(error)}`,
					"error",
				);
			}
		},
	});
}

if (process.argv.includes("--check")) {
	if (STYLES.length !== 11 || new Set(STYLES.map(({ id }) => id)).size !== 11)
		throw new Error("风格列表无效");
	if (STYLES.some(({ colors }) => colors.length !== 6))
		throw new Error("每套风格必须有六组颜色");
	if (Object.keys(paletteFor(STYLES[0])).length !== 13)
		throw new Error("状态栏字段映射不完整");
	if (
		previewLines(STYLES[0], 80).length !== 1 ||
		previewLines(STYLES[0], 40).length !== 2
	)
		throw new Error("预览布局无效");
	console.log("statusline-style-picker：11 套风格及预览检查通过");
}
