param(
 [Parameter(Mandatory=$true)][string]$Workspace,
 [string]$Config,
 [ValidateSet('local','demo','cloud')][string]$Mode='local',
 [ValidateSet('tourist','merchant','government')][string]$Role='tourist',
 [switch]$Weather,
 [switch]$AllowImage
)
$ErrorActionPreference='Stop'
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw '需要安装 Node.js 22 或更新版本。' }
$installArgs=@((Join-Path $PSScriptRoot 'install.mjs'),'--workspace',$Workspace,'--mode',$Mode,'--role',$Role)
if ($Config) { $installArgs+=@('--config',$Config) }
if ($Weather) { $installArgs+='--weather' }
if ($AllowImage) { $installArgs+='--allow-image' }
& node @installArgs
if ($LASTEXITCODE -ne 0) { throw "安装未完成 ($LASTEXITCODE)" }
