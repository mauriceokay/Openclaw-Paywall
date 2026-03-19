$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot ".env"

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
      return
    }

    $idx = $line.IndexOf("=")
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1)
    Set-Item -Path ("Env:" + $key) -Value $value
  }
}

$env:PORT = "8080"
Set-Location (Join-Path $repoRoot "artifacts\\api-server")
& "C:\Program Files\nodejs\npm.cmd" run dev
