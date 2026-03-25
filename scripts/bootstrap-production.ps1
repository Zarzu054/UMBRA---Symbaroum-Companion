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

  Import-DotEnv ".env"
  Invoke-Step 'docker compose -f docker-compose.umbra.dev.yml up -d postgres'

  if (-not (Test-Path "packages/shared/node_modules")) {
    Invoke-Step 'npm.cmd install --prefix packages/shared'
  }

  if (-not (Test-Path "apps/api/node_modules")) {
    Invoke-Step 'npm.cmd install --prefix apps/api'
  }

  if (-not (Test-Path "apps/web/node_modules")) {
    Invoke-Step 'npm.cmd install --prefix apps/web'
  }

  Invoke-Step 'npm.cmd run prisma:generate --prefix apps/api'
  Invoke-Step 'npm.cmd run prisma:migrate:deploy --prefix apps/api'
  Invoke-Step 'npm.cmd run prisma:seed --prefix apps/api'

  Invoke-Step 'npm.cmd run build --prefix packages/shared'
  Invoke-Step 'npm.cmd run build --prefix apps/web'
}
finally {
  Pop-Location
}
