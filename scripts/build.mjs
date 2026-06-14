import { rm } from "node:fs/promises"
import solidPlugin from "@opentui/solid/bun-plugin"

await rm(new URL("../dist", import.meta.url), { recursive: true, force: true })

async function build(entrypoint) {
  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir: "./dist",
    target: "bun",
    format: "esm",
    packages: "external",
    sourcemap: "external",
    plugins: [solidPlugin],
  })
  if (result.success) return
  for (const log of result.logs) console.error(log)
  throw new Error(`Bun build failed for ${entrypoint}`)
}

for (const entrypoint of [
  "./src/server.ts",
  "./src/tui.tsx",
  "./src/format.ts",
  "./src/options.ts",
  "./src/project.ts",
  "./src/state.ts",
  "./src/types.ts",
  "./src/usage.ts",
]) {
  await build(entrypoint)
}
