import {
	getAgentDir,
	type ExtensionAPI,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const STATUS_KEY = "usage";
const SESSION_STATUS_KEY = "session-id";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const SETTLED_REFRESH_COOLDOWN_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = 15 * 1000;
const CODEX_PROVIDER = "openai-codex";
const ZAI_PROVIDER = "zai-coding-cn";
const KIMI_PROVIDER = "kimi-coding";
const SUPPORTED_PROVIDERS = new Set([CODEX_PROVIDER, ZAI_PROVIDER, KIMI_PROVIDER]);

interface CodexWindow {
	used_percent?: unknown;
	limit_window_seconds?: unknown;
}

interface ZaiLimit {
	type?: unknown;
	unit?: unknown;
	number?: unknown;
	percentage?: unknown;
}

// UUIDv7 的开头是时间戳，相近时间新建的会话前缀相同；末尾是随机位，取末 8 位才能区分。
export const shortSessionId = (id: string) => id.slice(-8);

const showSessionId = (ctx: ExtensionContext) => {
	ctx.ui.setStatus(
		SESSION_STATUS_KEY,
		shortSessionId(ctx.sessionManager.getSessionId()),
	);
};

export default function statusline(pi: ExtensionAPI) {
	let activeSessionManager: ExtensionContext["sessionManager"] | undefined;
	let activeProvider: string | undefined;
	let refreshGeneration = 0;
	let refreshTimer: ReturnType<typeof setInterval> | undefined;
	let requestController: AbortController | undefined;
	let lastRefreshStartedAt = 0;
	const cache = new Map<string, string>();

	const ownsSession = (ctx: ExtensionContext) =>
		ctx.sessionManager === activeSessionManager;

	const clearTimer = () => {
		if (!refreshTimer) return;
		clearInterval(refreshTimer);
		refreshTimer = undefined;
	};

	const cancelRequest = (reason: string) => {
		requestController?.abort(new DOMException(reason, "AbortError"));
		requestController = undefined;
	};

	const showProvider = (provider: string | undefined, ctx: ExtensionContext) => {
		activeProvider = provider;
		if (!provider || !SUPPORTED_PROVIDERS.has(provider)) {
			ctx.ui.setStatus(STATUS_KEY, undefined);
			return;
		}

		ctx.ui.setStatus(STATUS_KEY, cache.get(provider));
	};

	const refresh = async (
		provider: string | undefined,
		ctx: ExtensionContext,
		options: { force?: boolean } = {},
	) => {
		if (!ownsSession(ctx) || !provider || !SUPPORTED_PROVIDERS.has(provider))
			return;
		if (
			!options.force &&
			Date.now() - lastRefreshStartedAt < SETTLED_REFRESH_COOLDOWN_MS
		)
			return;

		lastRefreshStartedAt = Date.now();
		const generation = ++refreshGeneration;
		cancelRequest("Provider usage refresh replaced");
		const controller = new AbortController();
		requestController = controller;

		try {
			const text =
				provider === CODEX_PROVIDER
					? await fetchCodexUsage(pi, controller.signal)
					: provider === ZAI_PROVIDER
						? await fetchZaiUsage(pi, controller.signal)
						: await fetchKimiUsage(pi, controller.signal);

			if (
				controller.signal.aborted ||
				generation !== refreshGeneration ||
				!ownsSession(ctx) ||
				activeProvider !== provider
			) {
				return;
			}

			cache.set(provider, text);
			ctx.ui.setStatus(STATUS_KEY, text);
		} catch {
			if (controller.signal.aborted) return;
			// 查询失败时保留同一 Provider 的上次成功结果，避免短暂网络故障造成状态闪烁。
			if (activeProvider === provider) {
				ctx.ui.setStatus(STATUS_KEY, cache.get(provider));
			}
		} finally {
			if (requestController === controller) requestController = undefined;
		}
	};

	const startTimer = (ctx: ExtensionContext) => {
		clearTimer();
		refreshTimer = setInterval(() => {
			void refresh(activeProvider, ctx, { force: true });
		}, REFRESH_INTERVAL_MS);
		refreshTimer.unref?.();
	};

	pi.on("session_start", (_event, ctx) => {
		activeSessionManager = ctx.sessionManager;
		showProvider(ctx.model?.provider, ctx);
		showSessionId(ctx);
		startTimer(ctx);
		void refresh(ctx.model?.provider, ctx, { force: true });
	});

	pi.on("session_tree", (_event, ctx) => {
		activeSessionManager = ctx.sessionManager;
		showProvider(ctx.model?.provider, ctx);
		showSessionId(ctx);
		startTimer(ctx);
		void refresh(ctx.model?.provider, ctx, { force: true });
	});

	pi.on("model_select", (event, ctx) => {
		if (!ownsSession(ctx)) return;
		refreshGeneration += 1;
		cancelRequest("Provider changed");
		showProvider(event.model.provider, ctx);
		void refresh(event.model.provider, ctx, { force: true });
	});

	pi.on("agent_settled", (_event, ctx) => {
		if (!ownsSession(ctx)) return;
		void refresh(activeProvider, ctx);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		if (!ownsSession(ctx)) return;
		refreshGeneration += 1;
		clearTimer();
		cancelRequest("Provider usage session shut down");
		ctx.ui.setStatus(STATUS_KEY, undefined);
		ctx.ui.setStatus(SESSION_STATUS_KEY, undefined);
		activeSessionManager = undefined;
		activeProvider = undefined;
	});

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
				const title = "选择 pi-statusline 自定义配色";
				const notes = [
					"需安装并启用 pi-statusline；不改变 Pi 主题。",
					"应用后覆盖其自定义配色，并设为紧凑布局、圆角分隔符。",
				];
				if (ctx.mode !== "tui") {
					if (!ctx.hasUI) {
						ctx.ui.notify("请在支持 UI 的客户端中打开 /personal → 状态栏：额度、会话 ID 与配色 → 选择 pi-statusline 自定义配色。", "warning");
						return;
					}
					const choices = STYLES.map(({ id, name }) => `${id}. ${name}`);
					const choice = await ctx.ui.select([title, ...notes].join("\n"), choices);
					if (choice === undefined) return;
					style = STYLES[choices.indexOf(choice)];
				} else {
					const { Key, matchesKey, truncateToWidth, wrapTextWithAnsi } = await import(
						"@earendil-works/pi-tui"
					);
					const selected = await ctx.ui.custom<number | null>(
						(tui, theme, _keybindings, done) => {
							let index = 0;
							return {
								render(width: number) {
									const lines = [
										theme.fg("accent", title),
										...notes.flatMap((note) => wrapTextWithAnsi(theme.fg("dim", note), width)),
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
			}

			if (!style) {
				ctx.ui.notify(`未知风格：${args.trim()}`, "error");
				return;
			}

			try {
				await applyStyle(style);
				ctx.ui.notify(`已应用 pi-statusline 自定义配色：${style.name}（紧凑布局、圆角分隔符）`, "info");
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

async function fetchCodexUsage(
	pi: ExtensionAPI,
	signal: AbortSignal,
): Promise<string> {
	const token = await readCredential(pi, [
		"auth",
		"print-bearer-token",
		"--provider",
		CODEX_PROVIDER,
		"--min-expiry",
		"5m",
	]);
	const accountId = readChatGptAccountId(token);
	const headers: Record<string, string> = {
		Accept: "application/json",
		Authorization: `Bearer ${token}`,
		"User-Agent": "pi-provider-usage/1.0",
	};
	if (accountId) headers["ChatGPT-Account-ID"] = accountId;

	const body = await fetchJson(
		"https://chatgpt.com/backend-api/wham/usage",
		headers,
		signal,
	);
	const weekly = findCodexWeeklyWindow(body);
	if (!weekly) throw new Error("Codex weekly usage is unavailable");

	return `weekly ${formatRemaining(weekly.used_percent)}`;
}

async function fetchZaiUsage(
	pi: ExtensionAPI,
	signal: AbortSignal,
): Promise<string> {
	const apiKey = await readCredential(pi, [
		"auth",
		"print-api-key",
		"--provider",
		ZAI_PROVIDER,
	]);
	const body = await fetchJson(
		"https://open.bigmodel.cn/api/monitor/usage/quota/limit",
		{
			Accept: "application/json",
			// 中国区 monitor 接口要求原始 API Key，不能添加 Bearer 前缀。
			Authorization: apiKey,
			"User-Agent": "pi-provider-usage/1.0",
		},
		signal,
	);
	const limits = readZaiLimits(body);
	const fiveHour = limits.find((item) => item.unit === 3 && item.number === 5);
	const weekly = limits.find((item) => item.unit === 6 && item.number === 1);
	if (!fiveHour || !weekly) throw new Error("ZAI quota windows are unavailable");

	return `5h ${formatRemaining(fiveHour.percentage)} · weekly ${formatRemaining(weekly.percentage)}`;
}

async function fetchKimiUsage(
	pi: ExtensionAPI,
	signal: AbortSignal,
): Promise<string> {
	const token = await readCredential(pi, [
		"auth",
		"print-bearer-token",
		"--provider",
		KIMI_PROVIDER,
		"--min-expiry",
		"5m",
	]);
	const body = await fetchJson(
		"https://api.kimi.com/coding/v1/usages",
		{
			Accept: "application/json",
			Authorization: `Bearer ${token}`,
			"User-Agent": "pi-provider-usage/1.0",
		},
		signal,
	);
	if (!isRecord(body) || !isRecord(body.usages))
		throw new Error("Kimi usage is unavailable");
	const fiveHour = readKimiUsedPercent(body.usages.limit_5h);
	if (fiveHour === undefined) throw new Error("Kimi 5-hour usage is unavailable");
	// 新套餐没有周窗口，改显示月度额度；老套餐仍显示周额度。
	const weekly = readKimiUsedPercent(body.usages.limit_7d);
	const monthly =
		readKimiUsedPercent(body.usages.limit_month_code) ??
		readKimiUsedPercent(body.usages.limit_month_total);
	const parts = [`5h ${formatRemaining(fiveHour)}`];
	if (weekly !== undefined) parts.push(`weekly ${formatRemaining(weekly)}`);
	else if (monthly !== undefined) parts.push(`monthly ${formatRemaining(monthly)}`);
	return parts.join(" · ");
}

function readKimiUsedPercent(value: unknown): number | undefined {
	if (!isRecord(value)) return undefined;
	const ratio = asFiniteNumber(value.used_ratio);
	return ratio === undefined ? undefined : ratio * 100;
}

async function readCredential(
	pi: ExtensionAPI,
	args: string[],
): Promise<string> {
	const result = await pi.exec("pi", args, { timeout: REQUEST_TIMEOUT_MS });
	const credential = result.stdout.trim();
	if (result.code !== 0 || !credential)
		throw new Error("Provider credential is unavailable");
	return credential;
}

async function fetchJson(
	url: string,
	headers: Record<string, string>,
	signal: AbortSignal,
): Promise<unknown> {
	const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
	const response = await fetch(url, {
		headers,
		signal: AbortSignal.any([signal, timeoutSignal]),
	});
	if (!response.ok)
		throw new Error(`Usage endpoint returned HTTP ${response.status}`);
	return response.json();
}

function readChatGptAccountId(token: string): string | undefined {
	try {
		const payload = token.split(".")[1];
		if (!payload) return undefined;
		const claims = JSON.parse(
			Buffer.from(payload, "base64url").toString("utf8"),
		) as {
			"https://api.openai.com/auth"?: { chatgpt_account_id?: unknown };
		};
		const value = claims["https://api.openai.com/auth"]?.chatgpt_account_id;
		return typeof value === "string" && value.length > 0 ? value : undefined;
	} catch {
		return undefined;
	}
}

function findCodexWeeklyWindow(body: unknown): CodexWindow | undefined {
	if (!isRecord(body)) return undefined;
	const candidates: CodexWindow[] = [];
	collectCodexWindows(body.rate_limit, candidates);
	if (Array.isArray(body.additional_rate_limits)) {
		for (const item of body.additional_rate_limits) {
			if (isRecord(item)) collectCodexWindows(item.rate_limit, candidates);
		}
	}
	return candidates.find((window) => {
		const seconds = asFiniteNumber(window.limit_window_seconds);
		return (
			seconds !== undefined && seconds >= 6 * 86_400 && seconds <= 8 * 86_400
		);
	});
}

function collectCodexWindows(value: unknown, target: CodexWindow[]) {
	if (!isRecord(value)) return;
	for (const key of ["primary_window", "secondary_window"]) {
		const window = value[key];
		if (isRecord(window)) target.push(window as CodexWindow);
	}
}

function readZaiLimits(body: unknown): Array<{
	unit: number;
	number: number;
	percentage: number;
}> {
	if (
		!isRecord(body) ||
		!isRecord(body.data) ||
		!Array.isArray(body.data.limits)
	)
		return [];
	const result: Array<{ unit: number; number: number; percentage: number }> = [];
	for (const raw of body.data.limits) {
		if (!isRecord(raw)) continue;
		const item = raw as ZaiLimit;
		if (item.type !== "TOKENS_LIMIT" && item.type !== "CREDIT_LIMIT") continue;
		const unit = asFiniteNumber(item.unit);
		const number = asFiniteNumber(item.number);
		const percentage = asFiniteNumber(item.percentage);
		if (unit === undefined || number === undefined || percentage === undefined)
			continue;
		result.push({ unit, number, percentage });
	}
	return result;
}

function formatRemaining(usedPercent: unknown): string {
	const used = asFiniteNumber(usedPercent);
	if (used === undefined) throw new Error("Usage percentage is unavailable");
	const remaining = Math.max(0, Math.min(100, 100 - used));
	return `${Math.round(remaining)}% left`;
}

function asFiniteNumber(value: unknown): number | undefined {
	const number = typeof value === "number" ? value : Number(value);
	return Number.isFinite(number) ? number : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface Style {
	id: number;
	name: string;
	colors: readonly (readonly [fg: string, bg: string])[];
}

export const STYLES: readonly Style[] = [
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
	// 与 pi-statusline 一致：它只读 getAgentDir()/pi-statusline.json
	const path = join(getAgentDir(), "pi-statusline.json");
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
	console.log("statusline：11 套风格及预览检查通过");
}
