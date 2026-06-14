[CmdletBinding()]
param(
    [switch]$Global,
    [string]$ProjectPath = (Get-Location).Path,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$target = if ($Global) { $source } else { (Resolve-Path $ProjectPath).Path }
$spec = 'file:' + ($source -replace '\\', '/')

Push-Location $source
try {
    npm install
    npm run validate
}
finally {
    Pop-Location
}

$arguments = @('plugin', $spec)
if ($Global) { $arguments += '--global' }
if ($Force) { $arguments += '--force' }

Push-Location $target
try {
    & opencode @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "opencode plugin failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

Write-Host "Installed $spec"
$scopeLabel = if ($Global) { 'Scope: global' } else { "Scope: project ($target)" }
Write-Host $scopeLabel
