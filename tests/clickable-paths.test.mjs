import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import clickablePaths from "../extensions/clickable-paths.ts";

test("路径链接配置读写 PI_CODING_AGENT_DIR 下的 clickable-paths.json", async () => {
  const previous = process.env.PI_CODING_AGENT_DIR;
  const dir = mkdtempSync(join(tmpdir(), "pi-clickable-test-"));
  process.env.PI_CODING_AGENT_DIR = dir;
  try {
    const configPath = join(dir, "clickable-paths.json");
    writeFileSync(configPath, JSON.stringify({ editor: "cursor" }));
    let command;
    clickablePaths({
      on() {},
      registerMarkdownTransformer() {},
      registerCommand(name, value) {
        if (name === "clickable-paths") command = value;
      },
    });
    const notices = [];
    const ctx = { ui: { notify: (message) => notices.push(message) } };

    await command.handler("", ctx);
    assert.match(notices.at(-1), /编辑器：cursor/);

    await command.handler("off", ctx);
    assert.deepEqual(JSON.parse(readFileSync(configPath, "utf8")), {
      enabled: false, editor: "cursor", bareText: true, userMessages: true,
    });
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
