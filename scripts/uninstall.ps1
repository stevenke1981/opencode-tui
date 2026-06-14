[CmdletBinding()]
param(
    [switch]$Global,
    [string]$ProjectPath = (Get-Location).Path,
    [switch]$RemoveState
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$spec = 'file:' + ($source -replace '\\', '/')
$configRoot = if ($Global) {
    Join-Path $HOME '.config\opencode'
} else {
    Join-Path (Resolve-Path $ProjectPath).Path '.opencode'
}

$configs = @(
    (Join-Path $configRoot 'opencode.json'),
    (Join-Path $configRoot 'opencode.jsonc'),
    (Join-Path $configRoot 'tui.json'),
    (Join-Path $configRoot 'tui.jsonc')
)

foreach ($config in $configs) {
    node (Join-Path $PSScriptRoot 'remove-plugin.mjs') $config $spec
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to update $config"
    }
}

if ($RemoveState -and -not $Global) {
    $statePath = Join-Path (Resolve-Path $ProjectPath).Path '.opencode\status-footer'
    if (Test-Path -LiteralPath $statePath) {
        Remove-Item -LiteralPath $statePath -Recurse -Force
    }
}

Write-Host "Removed $spec from OpenCode configuration."
