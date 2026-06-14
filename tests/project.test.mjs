import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { promisify } from "node:util"
import { parseOptions } from "../dist/options.js"
import { scanProject } from "../dist/project.js"

const exec = promisify(execFile)

test("scanProject combines TODO markers, git history, and file completion", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "status-footer-git-"))
  try {
    await exec("git", ["init", "-b", "main"], { cwd: directory })
    await exec("git", ["config", "user.email", "status-footer@example.invalid"], { cwd: directory })
    await exec("git", ["config", "user.name", "Status Footer Test"], { cwd: directory })
    await writeFile(path.join(directory, "app.ts"), "// TODO: finish integration\nexport const ready = false\n", "utf8")
    await writeFile(path.join(directory, "README.md"), "# fixture\n", "utf8")
    await exec("git", ["add", "."], { cwd: directory })
    await exec("git", ["commit", "-m", "chore: fixture"], { cwd: directory })
    await writeFile(path.join(directory, "README.md"), "# fixture\nchanged\n", "utf8")

    const progress = await scanProject(
      directory,
      { completed: 1, total: 2 },
      parseOptions({ targetCommitCount: 1, markerBudget: 10 }),
    )

    assert.equal(progress.git.available, true)
    assert.equal(progress.git.branch, "main")
    assert.equal(progress.git.commits, 1)
    assert.equal(progress.git.changedFiles, 1)
    assert.equal(progress.openMarkers, 1)
    assert.equal(progress.completedTasks, 1)
    assert.equal(progress.totalTasks, 3)
    assert.ok(progress.percent >= 0 && progress.percent <= 100)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
