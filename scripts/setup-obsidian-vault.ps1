#Requires -Version 5.1
<#
.SYNOPSIS
  Configura o Obsidian para usar o harness Viva Saúde (pasta contexto/).

.EXAMPLE
  .\scripts\setup-obsidian-vault.ps1
  Abre ou instrui a abrir o vault = pasta contexto do repo.

.EXAMPLE
  .\scripts\setup-obsidian-vault.ps1 -Mode symlink -VaultPath "$env:USERPROFILE\Documents\Obsidian\Viva-Saude"
  Cria junction AppVS-contexto -> repo\contexto dentro do vault existente.

.EXAMPLE
  .\scripts\setup-obsidian-vault.ps1 -Open
  Tenta abrir o Obsidian no vault configurado.
#>
param(
    [ValidateSet('repo-vault', 'symlink')]
    [string]$Mode = 'repo-vault',

    [string]$VaultPath = '',

    [switch]$Open,

    [switch]$SaveConfig
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$ContextoPath = Join-Path $RepoRoot 'contexto'
$ConfigPath = Join-Path $RepoRoot '.obsidian-vault.json'
$LinkName = 'AppVS-contexto'

function Write-Info($msg) { Write-Host "[obsidian] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[obsidian] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[obsidian] $msg" -ForegroundColor Yellow }

if (-not (Test-Path $ContextoPath)) {
    throw "Pasta contexto nao encontrada: $ContextoPath"
}

# Carregar config local se existir
if (-not $VaultPath -and (Test-Path $ConfigPath)) {
    try {
        $cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
        if ($cfg.vaultPath) { $VaultPath = $cfg.vaultPath }
        if ($cfg.mode) { $Mode = $cfg.mode }
    } catch {
        Write-Warn "Nao foi possivel ler $ConfigPath — ignorando."
    }
}

if ($Mode -eq 'symlink') {
    if (-not $VaultPath) {
        $VaultPath = Read-Host "Caminho do vault Obsidian existente (ex: $env:USERPROFILE\Documents\Obsidian\Viva-Saude)"
    }
    if (-not (Test-Path $VaultPath)) {
        New-Item -ItemType Directory -Path $VaultPath -Force | Out-Null
        Write-Info "Vault criado: $VaultPath"
    }
    $LinkPath = Join-Path $VaultPath $LinkName

    if (Test-Path $LinkPath) {
        $item = Get-Item $LinkPath -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            Write-Warn "Junction ja existe: $LinkPath"
        } else {
            throw "Ja existe pasta/arquivo em $LinkPath (nao e junction). Remova manualmente."
        }
    } else {
        cmd /c "mklink /J `"$LinkPath`" `"$ContextoPath`"" | Out-Null
        Write-Ok "Junction criada: $LinkPath -> $ContextoPath"
    }

    Write-Ok "No Obsidian, abra o vault: $VaultPath"
    Write-Ok "Edite as notas em: $LinkName\"
    $OpenPath = $VaultPath
} else {
    Write-Ok "Modo recomendado: vault = pasta contexto do repositorio"
    Write-Ok "Caminho: $ContextoPath"
    Write-Info "Obsidian -> Open folder as vault -> selecione a pasta acima"
    $OpenPath = $ContextoPath
}

if ($SaveConfig -or $VaultPath) {
    $out = @{
        mode      = $Mode
        vaultPath = if ($Mode -eq 'symlink') { $VaultPath } else { $ContextoPath }
        contexto  = $ContextoPath
        updatedAt = (Get-Date).ToString('o')
    }
    $out | ConvertTo-Json | Set-Content -Path $ConfigPath -Encoding UTF8
    Write-Ok "Config salva em $ConfigPath (local, nao vai pro Git)"
}

if ($Open) {
    $obsidianExe = @(
        "${env:LocalAppData}\Programs\Obsidian\Obsidian.exe",
        "${env:ProgramFiles}\Obsidian\Obsidian.exe",
        "$env:LOCALAPPDATA\obsidian\Obsidian.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    $uri = 'obsidian://open?path=' + [uri]::EscapeDataString($OpenPath)

    if ($obsidianExe) {
        Write-Info "Abrindo Obsidian: $OpenPath"
        Start-Process -FilePath $obsidianExe -ArgumentList $uri
    } else {
        Write-Warn "Obsidian.exe nao encontrado. Abra manualmente e selecione:"
        Write-Host "  $OpenPath"
        Write-Info "Ou cole no navegador: $uri"
    }
}

Write-Host ""
Write-Host "Documentacao: contexto\SETUP-OBSIDIAN.md" -ForegroundColor DarkGray
