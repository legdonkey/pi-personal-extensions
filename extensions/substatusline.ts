import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "usage";
const SESSION_STATUS_KEY = "session-id";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const SETTLED_REFRESH_COOLDOWN_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = 15 * 1000;
const CODEX_PROVIDER = "openai-codex";
const ZAI_PROVIDER = "zai-coding-cn";
const SUPPORTED_PROVIDERS = new Set([CODEX_PROVIDER, ZAI_PROVIDER]);

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

const showSessionId = (ctx: ExtensionContext) => {
	ctx.ui.setStatus(
		SESSION_STATUS_KEY,
		ctx.sessionManager.getSessionId().slice(0, 7),
	);
};

export default function subStatusline(pi: ExtensionAPI) {
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
					: await fetchZaiUsage(pi, controller.signal);

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
