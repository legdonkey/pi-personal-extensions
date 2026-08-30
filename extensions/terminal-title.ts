import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const PI_TITLE = "π";

export default function terminalTitle(pi: ExtensionAPI) {
	let pendingUpdate: ReturnType<typeof setTimeout> | undefined;

	const updateTitle = (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui") return;

		if (pendingUpdate) clearTimeout(pendingUpdate);
		pendingUpdate = setTimeout(() => {
			pendingUpdate = undefined;
			const sessionName = ctx.sessionManager.getSessionName();
			ctx.ui.setTitle(sessionName ? `${PI_TITLE} · ${sessionName}` : PI_TITLE);
		}, 0);
		pendingUpdate.unref?.();
	};

	pi.on("session_start", (_event, ctx) => {
		updateTitle(ctx);
	});

	pi.on("session_info_changed", (_event, ctx) => {
		updateTitle(ctx);
	});

	pi.on("session_shutdown", () => {
		if (!pendingUpdate) return;
		clearTimeout(pendingUpdate);
		pendingUpdate = undefined;
	});
}
