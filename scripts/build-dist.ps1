# build-dist.ps1
# 合并「上游层」（根级 skills/ + references/，已由 sync-upstream 重放）
# 与「优化层」（overrides/skills/ 覆盖 + overrides/patches/ 补丁），
# 产出最终 dist。初期 overrides 为空，本脚本等价于纯镜像直通。
# 优先级：overrides/skills > overrides/patches > upstream
# 用法：.\scripts\build-dist.ps1

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RepoRoot = Split-Path -Parent $PSScriptRoot
$SkillsDir = Join-Path $RepoRoot 'skills'
$RefsDir = Join-Path $RepoRoot 'references'
$OverrideSkills = Join-Path $RepoRoot 'overrides\skills'
$PatchesDir = Join-Path $RepoRoot 'overrides\patches'

Write-Host "==> mont-forge build-dist =="

# 1. overrides/skills 覆盖：同名技能目录整体替换上游版本
$overrideDirs = Get-ChildItem $OverrideSkills -Directory -ErrorAction SilentlyContinue
foreach ($od in $overrideDirs) {
    $target = Join-Path $SkillsDir $od.Name
    Write-Host "[覆盖] overrides/skills/$($od.Name) -> skills/$($od.Name)"
    if (Test-Path $target) { Remove-Item -Recurse -Force $target }
    Copy-Item -Recurse -Force $od.FullName $target
}

# 2. overrides/patches 补丁：逐条 apply（git apply 到仓库根）
$patches = Get-ChildItem $PatchesDir -Filter *.patch -ErrorAction SilentlyContinue | Sort-Object Name
foreach ($p in $patches) {
    Write-Host "[补丁] 应用 $($p.Name)"
    git -C $RepoRoot apply --whitespace=nowarn $p.FullName
    if ($LASTEXITCODE -ne 0) { Write-Warning "补丁 $($p.Name) 应用失败，请人工检查" }
}

# 3. 统计
$skillCount = (Get-ChildItem $SkillsDir -Directory).Count
$refCount = (Get-ChildItem $RefsDir -File).Count
Write-Host ""
Write-Host "dist 就绪：skills=$skillCount 个技能，references=$refCount 个清单。"
Write-Host "根级 skills/ + references/ 即为 DSH 订阅后实际加载的内容。"
