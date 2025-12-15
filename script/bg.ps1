param(
  [Parameter(Mandatory=$true, Position=0)]
  [ValidateSet('start','stop','status','restart','logs')]
  [string]$Action,

  [Parameter(Position=1)]
  [string]$Name = 'app',

  # For Action=start only
  [string]$Command,
  [string[]]$CommandArgs = @(),

  # For Action=logs
  [int]$Tail = 200,
  [switch]$Follow
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$tmpDir = Join-Path $repoRoot 'tmp\bg'
$pidPath = Join-Path $tmpDir ("$Name.pid")
$metaPath = Join-Path $tmpDir ("$Name.json")
$logPath = Join-Path $tmpDir ("$Name.log")
$errPath = Join-Path $tmpDir ("$Name.err.log")

function Read-Pid {
  if (!(Test-Path -LiteralPath $pidPath)) { return $null }
  try {
    $raw = (Get-Content -LiteralPath $pidPath -Raw).Trim()
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    return [int]$raw
  } catch { return $null }
}

function Write-Meta([int]$procId, [string]$cmd, [string[]]$commandArgs, [string]$startCommand, [string[]]$startArgs) {
  $meta = [ordered]@{
    name = $Name
    pid = $procId
    startedAt = (Get-Date).ToString('o')
    workingDirectory = $repoRoot
    command = $cmd
    args = $commandArgs
    startCommand = $startCommand
    startArgs = $startArgs
    logPath = $logPath
    errPath = $errPath
  }
  ($meta | ConvertTo-Json -Depth 5) | Set-Content -LiteralPath $metaPath -Encoding UTF8
}

function Get-RunningProcess([int]$procId) {
  try {
    return Get-Process -Id $procId -ErrorAction Stop
  } catch {
    return $null
  }
}

function Resolve-StartProcessTarget([string]$cmd, [string[]]$commandArgs) {
  function Quote-Arg([string]$a) {
    if ($null -eq $a) { return '' }
    $needsQuotes = ($a -match '[\s\"]')
    if (-not $needsQuotes) { return $a }
    $escaped = $a.Replace('"', '""')
    return '"' + $escaped + '"'
  }

  $resolvedCmd = $cmd
  try {
    $cmdInfo = Get-Command $cmd -ErrorAction Stop
    if ($cmdInfo.Source) { $resolvedCmd = $cmdInfo.Source }
  } catch { }

  $ext = [IO.Path]::GetExtension($resolvedCmd).ToLowerInvariant()
  switch ($ext) {
    '.ps1' {
      $argLine = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Quote-Arg $resolvedCmd)) + ($commandArgs | ForEach-Object { Quote-Arg $_ })
      return @{
        FilePath = 'powershell.exe'
        ArgumentList = ($argLine -join ' ')
        DisplayCommand = "powershell.exe -File $resolvedCmd"
      }
    }
    '.cmd' { }
    '.bat' { }
    default {
      if ($ext -eq '.cmd' -or $ext -eq '.bat') {
        $argLine = @('/c', (Quote-Arg $resolvedCmd)) + ($commandArgs | ForEach-Object { Quote-Arg $_ })
        return @{
          FilePath = 'cmd.exe'
          ArgumentList = ($argLine -join ' ')
          DisplayCommand = "cmd.exe /c $resolvedCmd"
        }
      }
      return @{
        FilePath = $resolvedCmd
        ArgumentList = (($commandArgs | ForEach-Object { Quote-Arg $_ }) -join ' ')
        DisplayCommand = $resolvedCmd
      }
    }
  }
  # fallthrough for cmd/bat
  $argLine = @('/c', (Quote-Arg $resolvedCmd)) + ($commandArgs | ForEach-Object { Quote-Arg $_ })
  return @{
    FilePath = 'cmd.exe'
    ArgumentList = ($argLine -join ' ')
    DisplayCommand = "cmd.exe /c $resolvedCmd"
  }
}

switch ($Action) {
  'start' {
    if ([string]::IsNullOrWhiteSpace($Command)) {
      throw "Action=start requires -Command. Example: .\\script\\bg.ps1 start dev -Command npm -CommandArgs run,dev"
    }

    # Allow comma-delimited args (common in docs/examples): -CommandArgs run,start
    if ($CommandArgs -and $CommandArgs.Length -eq 1 -and $CommandArgs[0] -match ',') {
      $CommandArgs = @($CommandArgs[0].Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
    }

    $existingPid = Read-Pid
    if ($existingPid) {
      $existing = Get-RunningProcess $existingPid
      if ($existing) {
        Write-Host "[$Name] already running (PID $existingPid)." -ForegroundColor Yellow
        exit 0
      }
      Remove-Item -LiteralPath $pidPath -ErrorAction SilentlyContinue
    }

    if (!(Test-Path -LiteralPath $tmpDir)) {
      New-Item -ItemType Directory -Path $tmpDir | Out-Null
    }

    # Ensure log exists
    if (!(Test-Path -LiteralPath $logPath)) {
      New-Item -ItemType File -Path $logPath | Out-Null
    }

    if (!(Test-Path -LiteralPath $errPath)) {
      New-Item -ItemType File -Path $errPath | Out-Null
    }

    $argString = if ($CommandArgs -and $CommandArgs.Length -gt 0) { $CommandArgs -join ' ' } else { '' }

    $target = Resolve-StartProcessTarget -cmd $Command -commandArgs $CommandArgs

    # Start-Process with redirection creates a detached process and returns immediately.
    $p = Start-Process -FilePath $target.FilePath -ArgumentList $target.ArgumentList -WorkingDirectory $repoRoot -NoNewWindow -PassThru -RedirectStandardOutput $logPath -RedirectStandardError $errPath

    $p.Id | Set-Content -LiteralPath $pidPath -Encoding ASCII
    Write-Meta -procId $p.Id -cmd ([string]$target.DisplayCommand) -commandArgs $CommandArgs -startCommand $Command -startArgs $CommandArgs

    Write-Host "[$Name] started (PID $($p.Id))." -ForegroundColor Green
    Write-Host "  Log: $logPath"
    Write-Host "  Err: $errPath"
    Write-Host "  Stop: .\\script\\bg.ps1 stop $Name"
    exit 0
  }

  'stop' {
    $procId = Read-Pid
    if (-not $procId) {
      Write-Host "[$Name] not running (no PID file)." -ForegroundColor Yellow
      exit 0
    }

    $p = Get-RunningProcess $procId
    if (-not $p) {
      Write-Host "[$Name] not running (stale PID $procId). Cleaning up." -ForegroundColor Yellow
      Remove-Item -LiteralPath $pidPath -ErrorAction SilentlyContinue
      exit 0
    }

    Stop-Process -Id $procId -Force
    Write-Host "[$Name] stopped (PID $procId)." -ForegroundColor Green
    Remove-Item -LiteralPath $pidPath -ErrorAction SilentlyContinue
    exit 0
  }

  'status' {
    $procId = Read-Pid
    if (-not $procId) {
      Write-Host "[$Name] stopped" -ForegroundColor Yellow
      exit 0
    }

    $p = Get-RunningProcess $procId
    if ($p) {
      Write-Host "[$Name] running (PID $procId)" -ForegroundColor Green
      if (Test-Path -LiteralPath $metaPath) {
        try {
          $meta = Get-Content -LiteralPath $metaPath -Raw | ConvertFrom-Json
          Write-Host "  Cmd: $($meta.command) $($meta.args -join ' ')"
          Write-Host "  Log: $($meta.logPath)"
        } catch { }
      }
      exit 0
    }

    Write-Host "[$Name] stopped (stale PID $procId)" -ForegroundColor Yellow
    exit 0
  }

  'restart' {
    & $PSCommandPath stop $Name
    if ([string]::IsNullOrWhiteSpace($Command)) {
      # Restart using meta if possible
      if (Test-Path -LiteralPath $metaPath) {
        $meta = Get-Content -LiteralPath $metaPath -Raw | ConvertFrom-Json
        $cmd = if ($meta.startCommand) { [string]$meta.startCommand } else { [string]$meta.command }
        $args = @()
        if ($meta.startArgs) { $args = @($meta.startArgs) } elseif ($meta.args) { $args = @($meta.args) }
        & $PSCommandPath start $Name -Command $cmd -CommandArgs $args
        exit 0
      }
      throw "Action=restart requires -Command (or existing $metaPath)."
    }
    & $PSCommandPath start $Name -Command $Command -CommandArgs $CommandArgs
    exit 0
  }

  'logs' {
    if (!(Test-Path -LiteralPath $logPath)) {
      Write-Host "[$Name] no log file at $logPath" -ForegroundColor Yellow
      exit 0
    }

    if ($Follow) {
      Get-Content -LiteralPath $logPath -Tail $Tail -Wait
    } else {
      Get-Content -LiteralPath $logPath -Tail $Tail
    }
    exit 0
  }
}
