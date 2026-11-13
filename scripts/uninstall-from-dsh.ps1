# uninstall-mont-forge.ps1
# 从 DSH 原生技能目录卸载 mont-forge 部署的 25 个技能。
# 只删除本脚本部署过的技能（依据 .mont-forge-deployed.json 清单），不动其它技能。
# 用法：.\uninstall-mont-forge.ps1 [-DryRun]

param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { "F:\DSHDesktop\dsh-home" }
$skillsDir = Join-Path $dshHome "skills"
$manifestPath = Join-Path $skillsDir ".mont-forge-deployed.json"

if (-not (Test-Path $manifestPath)) {
    Write-Host "未找到部署清单: $manifestPath"
    Write-Host "没有可卸载的 mont-forge 技能。"
    exit 0
}

$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$skills = @($manifest.skills)

Write-Host "==> mont-forge 卸载"
Write-Host "部署来源: $($manifest.source)"
Write-Host "部署时间: $($manifest.deployedAt)"
Write-Host "待卸载:   $($skills.Count) 个技能"
Write-Host ""

$removed = 0
$missing = 0
foreach ($name in $skills) {
    $dir = Join-Path $skillsDir $name
    if (Test-Path $dir) {
        if ($DryRun) {
            Write-Host "  [DryRun] 将删除 $name"
        } else {
            Remove-Item -Recurse -Force $dir
            Write-Host "  已删除 $name"
        }
        $removed++
    } else {
        Write-Host "  跳过 $name（不存在）"
        $missing++
    }
}

if (-not $DryRun) {
    Remove-Item $manifestPath -Force
    Write-Host ""
    Write-Host "完成：删除 $removed 个，跳过 $missing 个。部署清单已移除。"
    Write-Host "DSH 会热加载技能目录，无需重启即可看到变化。"
} else {
    Write-Host ""
    Write-Host "[DryRun] 未实际删除。去掉 -DryRun 执行真实卸载。"
}
