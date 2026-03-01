/**
 * Dev server — Bun.serve + WebSocket with hot-reload on .pen changes.
 */

import { watch } from "node:fs";
import { resolve, dirname } from "node:path";
import pc from "picocolors";
import type { DevOptions } from "../types/options.js";
import { capture } from "../capture/index.js";
import { build } from "../build/index.js";
import { writeFile, mkdir, readFile } from "node:fs/promises";

const HMR_SCRIPT = `<script>
(function() {
  const ws = new WebSocket('ws://' + location.host + '/__nib_ws');
  ws.onmessage = function(e) {
    const msg = JSON.parse(e.data);
    if (msg.type === 'reload') location.reload();
  };
  ws.onclose = function() { setTimeout(function() { location.reload(); }, 1000); };
})();
</script>`;

export async function startDevServer(options: DevOptions): Promise<void> {
  const file = resolve(options.file);
  const port = options.port ?? 3142;
  const template = options.template ?? "clean";
  const tmpDir = resolve(dirname(file), ".nib-dev");

  await mkdir(tmpDir, { recursive: true });

  let html = "";
  let building = false;

  async function rebuild() {
    if (building) return;
    building = true;
    try {
      console.log(pc.dim("  Rebuilding..."));
      const doc = await capture({ file });
      const tmpJson = resolve(tmpDir, "design.json");
      await writeFile(tmpJson, JSON.stringify(doc, null, 2));
      await build({ input: tmpJson, output: tmpDir, template });
      const raw = await readFile(resolve(tmpDir, "index.html"), "utf-8");
      // Inject HMR script before </body>
      html = raw.replace("</body>", `${HMR_SCRIPT}\n</body>`);
      console.log(pc.green("  ✓"), pc.dim("Ready"));

      // Notify WebSocket clients
      for (const ws of wsClients) {
        ws.send(JSON.stringify({ type: "reload" }));
      }
    } catch (err) {
      console.error(pc.red("  Build error:"), (err as Error).message);
    } finally {
      building = false;
    }
  }

  // Initial build
  await rebuild();

  const wsClients = new Set<{ send(data: string): void; close(): void }>();

  const server = Bun.serve({
    port,
    fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === "/__nib_ws") {
        const upgraded = server.upgrade(req);
        if (!upgraded) {
          return new Response("WebSocket upgrade failed", { status: 400 });
        }
        return undefined;
      }

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
    websocket: {
      open(ws) {
        wsClients.add(ws as unknown as { send(data: string): void; close(): void });
      },
      close(ws) {
        wsClients.delete(ws as unknown as { send(data: string): void; close(): void });
      },
      message() {},
    },
  });

  console.log(pc.green("  Dev server running at"), pc.cyan(`http://localhost:${port}`));

  // Watch .pen file for changes
  let debounce: ReturnType<typeof setTimeout> | null = null;
  watch(file, () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(rebuild, 300);
  });

  // Open browser if requested
  if (options.open !== false) {
    const { exec } = await import("node:child_process");
    exec(`open http://localhost:${port}`);
  }

  // Keep alive
  await new Promise(() => {});
}
