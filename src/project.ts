import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { GitProgress, ProjectProgress, StatusFooterOptions, TodoSummary } from "./types.js"

const execFileAsync = promisify(execFile)

const EMPTY_GIT: GitProgress = {
  available: false,
  branch: "",
  commits: 0,
  ahead: 0,
  behind: 0,
  changedFiles: 0,
  conflictedFiles: 0,
  totalFiles: 0,
  completedFiles: 0,
}

async function git(directory: string, args: string[], allowNoMatch = false): Promise<string | undefined> {
  try {
    const result = await execFileAsync("git", args, {
      cwd: directory,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    })
    return result.stdout.trim()
  } catch (error) {
    if (allowNoMatch && error && typeof error === "object" && "code" in error && error.code === 1) {
      return "stdout" in error && typeof error.stdout === "string" ? error.stdout.trim() : ""
    }
    return undefined
  }
}

function countLines(value: string | undefined): number {
  if (!value) return 0
  return value.split(/\r?\n/).filter(Boolean).length
}

function number(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function parseAheadBehind(value: string | undefined): { behind: number; ahead: number } {
  if (!value) return { behind: 0, ahead: 0 }
  const [behind, ahead] = value.split(/\s+/).map((item) => Number.parseInt(item, 10) || 0)
  return { behind: behind ?? 0, ahead: ahead ?? 0 }
}

function markerExpression(patterns: string[]): string {
  return patterns.map((pattern) => pattern.replace(/[\\.^$|?*+()[\]{}]/g, "\\$&")).join("|")
}

export async function scanProject(
  directory: string,
  todos: TodoSummary,
  options: StatusFooterOptions,
): Promise<ProjectProgress> {
  const inside = await git(directory, ["rev-parse", "--is-inside-work-tree"])
  if (inside !== "true") {
    const totalTasks = todos.total
    const score = totalTasks > 0 ? todos.completed / totalTasks : 0
    return {
      percent: Math.round(clamp(score) * 100),
      completedTasks: todos.completed,
      totalTasks,
      openMarkers: 0,
      git: { ...EMPTY_GIT },
    }
  }

  const [branch, commitsRaw, filesRaw, statusRaw, aheadBehindRaw, markerRaw] = await Promise.all([
    git(directory, ["branch", "--show-current"]),
    git(directory, ["rev-list", "--count", "HEAD"]),
    git(directory, ["ls-files", "-co", "--exclude-standard", "--", ".", ":(exclude).opencode/status-footer/**"]),
    git(directory, [
      "status",
      "--porcelain=v1",
      "--untracked-files=normal",
      "--",
      ".",
      ":(exclude).opencode/status-footer/**",
    ]),
    git(directory, ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"]),
    git(directory, ["grep", "-n", "-I", "-E", markerExpression(options.todoPatterns), "--", "."], true),
  ])

  const allFiles = (filesRaw ?? "").split(/\r?\n/).filter(Boolean).slice(0, options.maxScanFiles)
  const statusLines = (statusRaw ?? "").split(/\r?\n/).filter(Boolean)
  const changedFiles = statusLines.length
  const conflictedFiles = statusLines.filter((line) => /^(DD|AU|UD|UA|DU|AA|UU)/.test(line)).length
  const totalFiles = allFiles.length
  const completedFiles = Math.max(0, totalFiles - changedFiles)
  const commits = number(commitsRaw)
  const { ahead, behind } = parseAheadBehind(aheadBehindRaw)
  const openMarkers = Math.min(countLines(markerRaw), options.markerBudget * 10)

  const gitProgress: GitProgress = {
    available: true,
    branch: branch || "detached",
    commits,
    ahead,
    behind,
    changedFiles,
    conflictedFiles,
    totalFiles,
    completedFiles,
  }

  const completedTasks = todos.completed
  const totalTasks = todos.total + openMarkers
  const taskScore = totalTasks > 0 ? completedTasks / totalTasks : 1
  const markerScore = 1 - clamp(openMarkers / options.markerBudget)
  const commitScore = clamp(commits / options.targetCommitCount)
  const cleanlinessScore = changedFiles === 0 ? 1 : 1 / (1 + changedFiles)
  const conflictScore = conflictedFiles === 0 ? 1 : 0
  const syncScore = behind === 0 ? 1 : 1 / (1 + behind)
  // Git is a supporting signal: history, cleanliness, conflicts, and upstream sync.
  const gitScore = commitScore * 0.45 + cleanlinessScore * 0.25 + conflictScore * 0.2 + syncScore * 0.1
  const fileScore = totalFiles > 0 ? completedFiles / totalFiles : 1
  const weights = options.progressWeights
  const score =
    taskScore * weights.tasks + markerScore * weights.markers + gitScore * weights.git + fileScore * weights.files

  return {
    percent: Math.round(clamp(score) * 100),
    completedTasks,
    totalTasks,
    openMarkers,
    git: gitProgress,
  }
}

export function emptyProgress(): ProjectProgress {
  return {
    percent: 0,
    completedTasks: 0,
    totalTasks: 0,
    openMarkers: 0,
    git: { ...EMPTY_GIT },
  }
}
