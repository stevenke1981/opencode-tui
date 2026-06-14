import { readFile, writeFile } from "node:fs/promises"
import { applyEdits, modify, parse } from "jsonc-parser"

const [file, spec] = process.argv.slice(2)
if (!file || !spec) throw new Error("Usage: node remove-plugin.mjs <config-file> <plugin-spec>")

let text
try {
  text = await readFile(file, "utf8")
} catch (error) {
  if (error && error.code === "ENOENT") process.exit(0)
  throw error
}

const config = parse(text)
const plugins = Array.isArray(config?.plugin) ? config.plugin : []
const next = plugins.filter((entry) => {
  if (entry === spec) return false
  return !(Array.isArray(entry) && entry[0] === spec)
})

if (next.length === plugins.length) process.exit(0)
const edits = modify(text, ["plugin"], next, {
  formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" },
})
await writeFile(file, applyEdits(text, edits), "utf8")
