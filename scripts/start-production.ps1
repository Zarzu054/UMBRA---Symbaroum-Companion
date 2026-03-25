$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$PSNativeCommandUseErrorActionPreference = $true

$repoRoot = Split-Path -Parent $PSScriptRoot

function Import-DotEnv([string]$path) {
  Get-Content $path | ForEach-Object {
    if (-not $_ -or $_.Trim().StartsWith("#")) {
      return
    }

    $parts = $_.Split("=", 2)
    if ($parts.Length -eq 2) {
      [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1])
    }
  }
}

function Invoke-Step([string]$command) {
  Invoke-Expression $command
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo el comando: $command"
  }
}

Push-Location $repoRoot
try {
  if (-not (Test-Path ".env")) {
    throw "Falta el archivo .env en la raiz del proyecto."
  }

  if (-not (Test-Path "apps/web/dist/index.html")) {
    throw "Falta el build web de produccion. Ejecuta scripts/bootstrap-production.ps1 primero."
  }

  Import-DotEnv ".env"
  Invoke-Step 'docker compose -f docker-compose.umbra.dev.yml up -d postgres'
  Invoke-Step 'npm.cmd run start:prod --prefix apps/api'
}
finally {
  Pop-Location
}
