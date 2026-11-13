# push-via-api.ps1 — 通过 GitHub Git Data API 推送全部文件（api.github.com 可达时的兜底）
# 关键：tree 字段是 JSON 数组，必须用 --input 传完整 JSON（且文件无 BOM）。
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = "F:\deepseek harness\moren\mont-forge"
$owner = "royrao2007"
$repo = "mont-forge"
$branch = "main"

function ApiJsonBody($method, $endpoint, $obj) {
    $tmp = [System.IO.Path]::GetTempFileName()
    $json = $obj | ConvertTo-Json -Depth 20 -Compress
    # 无 BOM 写 UTF-8
    [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))
    $out = & gh api --method $method "repos/$owner/$repo/$endpoint" --input $tmp 2>&1
    Remove-Item $tmp -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -ne 0) { throw "API $method $endpoint 失败: $out" }
    return ($out | ConvertFrom-Json)
}

# 0. 父提交
$parentSha = (& gh api "repos/$owner/$repo/git/refs/heads/$branch" --jq '.object.sha' 2>&1).Trim()
$baseTreeSha = (& gh api "repos/$owner/$repo/git/commits/$parentSha" --jq '.tree.sha' 2>&1).Trim()
Write-Host "父提交: $parentSha / base_tree: $baseTreeSha"

# 1. 创建 blob
$files = git -C $root ls-files
$treeItems = @()
foreach ($f in $files) {
    $bytes = [System.IO.File]::ReadAllBytes((Join-Path $root $f))
    $b64 = [Convert]::ToBase64String($bytes)
    $blob = ApiJsonBody "POST" "git/blobs" @{ content = $b64; encoding = "base64" }
    $treeItems += @{ path = $f; mode = "100644"; type = "blob"; sha = $blob.sha }
}
Write-Host "共 $($treeItems.Count) 个 blob 已创建。"

# 2. 创建 tree（base_tree + tree 数组）
$tree = ApiJsonBody "POST" "git/trees" @{ base_tree = $baseTreeSha; tree = $treeItems }
Write-Host "新 tree sha: $($tree.sha)"

# 3. 创建 commit
$commit = ApiJsonBody "POST" "git/commits" @{
    message = "chore: mont-forge 0.0.10 — mirror addyosmani/agent-skills skills (MIT)"
    tree = $tree.sha
    parents = @($parentSha)
}
Write-Host "commit sha: $($commit.sha)"

# 4. 更新 main ref
ApiJsonBody "PATCH" "git/refs/heads/$branch" @{ sha = $commit.sha; force = $false } | Out-Null
Write-Host ""
Write-Host "推送完成！https://github.com/$owner/$repo  (commit: $($commit.sha))"
