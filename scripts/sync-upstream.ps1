# sync-upstream.ps1
# 单向拉取上游 addyosmani/agent-skills，把 skills/ 与 references/ 重放到仓库根目录。
# 铁律：本脚本只更新「上游层」（根级 skills/ + references/），永不写入 overrides/。
# 用法：.\scripts\sync-upstream.ps1

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$UPSTREAM_REPO = 'https://github.com/addyosmani/agent-skills.git'
$UPSTREAM_BRANCH = 'main'
$REMOTE_NAME = 'upstream'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$OverridesDir = Join-Path $RepoRoot 'overrides'

Write-Host "==> mont-forge sync-upstream =="

# 1. 确保 upstream remote 存在
$existing = git -C $RepoRoot remote get-url $REMOTE_NAME 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[1/3] 添加 upstream remote: $UPSTREAM_REPO"
    git -C $RepoRoot remote add $REMOTE_NAME $UPSTREAM_REPO
    if ($LASTEXITCODE -ne 0) { throw "添加 upstream remote 失败" }
} else {
    Write-Host "[1/3] upstream remote 已存在: $existing"
}

# 2. 拉取上游
Write-Host "[2/3] 拉取 $REMOTE_NAME/$UPSTREAM_BRANCH ..."
git -C $RepoRoot fetch --depth 1 $REMOTE_NAME $UPSTREAM_BRANCH
if ($LASTEXITCODE -ne 0) { throw "fetch 上游失败" }

# 3. 从上游分支检出 skills/ 与 references/ 到根目录（覆盖上游层）
Write-Host "[3/3] 重放 skills/ 与 references/ 到仓库根目录 ..."
git -C $RepoRoot checkout "$REMOTE_NAME/$UPSTREAM_BRANCH" -- skills references
if ($LASTEXITCODE -ne 0) { throw "checkout 上游 skills/references 失败" }

# 4. 提示 overrides 是否需处理（初期为空）
$overrideSkills = Get-ChildItem (Join-Path $OverridesDir 'skills') -Directory -ErrorAction SilentlyContinue
$patches = Get-ChildItem (Join-Path $OverridesDir 'patches') -Filter *.patch -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "完成。上游 skills/ + references/ 已更新到根目录。"
Write-Host "overrides/skills 覆盖项: $($overrideSkills.Count) 个"
Write-Host "overrides/patches 补丁:  $($patches.Count) 个"
if ($overrideSkills.Count -gt 0 -or $patches.Count -gt 0) {
    Write-Host "--> 检测到本地优化，请运行 .\scripts\build-dist.ps1 合并到最终 dist。" -ForegroundColor Yellow
} else {
    Write-Host "--> 当前为纯镜像（无 overrides），无需额外合并。"
}
