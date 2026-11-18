export function isStaleContextError(error: unknown): boolean {
  // shortcut: Pi 1.5.2 没有公开的失效类型；提供后改用该类型。
  return error instanceof Error &&
    error.message.startsWith("This extension ctx is stale after session replacement or reload.");
}
