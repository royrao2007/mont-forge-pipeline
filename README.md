# mont-forge-pipeline

把 mont-forge 的 44 个工程技能编排成覆盖开发全流程的可调用工具。

## 工具

- `forge_spec` `forge_plan` `forge_build` `forge_verify` `forge_review` `forge_ship`
- `forge_assess` `forge_catalog` `forge_skill`

## 安装

```powershell
dsh plugin --profile desktop add "F:\deepseek harness\moren\mont-forge-pipeline"
```

或在 DSH「插件 → 添加插件」选择该目录。

## 依赖

技能正文由 mont-forge 插件提供；本插件只提供流程编排。