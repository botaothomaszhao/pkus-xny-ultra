# 自动打包发布配置与使用说明

## 1. 自动发布链路

仓库内已有两个关键部分：

- Workflow：`.github/workflows/release.yml`
  - 触发方式：`workflow_dispatch`（手动触发）
  - 关键输入：
    - `version`：tag（本仓库约定为 `vv.x.x`，例如 `vv.2.5`）
    - `release_title`：发布标题
    - `release_notes`：Release 正文（Markdown）
    - `via_exclude`：Via 包排除文件（逗号分隔）
    - `edge_exclude`：Edge 包排除文件（逗号分隔）
  - 行为：
    - 从 `vv/*.user.js` 打包两个 zip（Via / Edge）
    - 用 `gh release create` 创建 Release 并上传两个 zip
- Agent：`.github/agents/release-publisher.agent.md`
  - 职责：整理变更说明，确认发布参数后触发 `release.yml`
  - 触发方式：通过 GitHub MCP Actions 接口调用 `run_workflow`

## 2. 前置条件

1. 确保 `.github/workflows/release.yml` 存在且未被禁用。
2. 确保 `.github/agents/release-publisher.agent.md` 存在（用于 Agent 发布流程）。
3. 在仓库 `Actions` 页面确认 workflow 可见且可手动运行。

## 3. 在项目中创建发布专用 Token（Fine-grained PAT）

建议单独创建一个仅用于 Agent 触发发布的 Fine-grained Personal Access Token，不要复用日常开发 Token。

创建步骤：

1. 打开 GitHub：`Settings` → `Developer settings` → `Personal access tokens` → `Fine-grained tokens`。
2. 点击 `Generate new token`（或 `Generate new token (classic)` 旁边下拉后选 Fine-grained）。
3. `Repository access` 选择 `Only select repositories`，只勾选目标仓库（例如 `xxx/pkus-xny-ultra`）。
4. `User permissions` 保持不授予。
5. `Repository permissions` 至少设置：
   - `Actions`：**Read and write**
   - `agent tasks`、`code`、`metadata`、`pull requests`：**Read**
6. 设置有效期后生成 Token，并立即复制保存（页面离开后无法再次查看明文）。

额外建议：

- Token 使用短周期并轮换。
- 只保存在 Agent 密钥区，不写进仓库文件。
- 一旦泄露，立即 Revoke 并重建。

生成 Token 后，立即在仓库网页配置 Secret：

1. 进入仓库 `Settings` → `Secrets and variables` → `Agent`。
2. 新增 Secret：
   - Name：`COPILOT_MCP_GITHUB_PERSONAL_ACCESS_TOKEN`
   - Value：第 3 节创建的 Fine-grained PAT
3. 保存后再继续 MCP 配置。

## 4. 在项目中设置 MCP 与 Secret（仓库网页设置）

进入仓库网页设置路径：`Settings` → `Copilot` → `Cloud agent`。

在 `MCP servers` 配置区域添加或替换为以下 JSON：

```json
{
  "mcpServers": {
    "github-mcp-server": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp",
      "tools": ["*"],
      "headers": {
        "X-MCP-Toolsets": "repos,issues,users,pull_requests,code_security,secret_protection,actions,web_search"
      }
    }
  }
}
```

保存后重开 Agent 会话，先做一次只读验证（例如列出 workflow），再执行发布。  
说明：MCP 配置 JSON 里不写明文 Token，Token 通过仓库 `Settings` → `Secrets and variables` → `Agent` 中的 `COPILOT_MCP_GITHUB_PERSONAL_ACCESS_TOKEN` 注入。

## 5. 实际发布操作（给维护者）

建议流程：

1. 确认工作区代码已准备完成（`vv/` 脚本与 README 已更新）。
2. 打开该仓库网页的 Agent 页面，选择 `release-publisher` agent，让它生成发布信息并展示待确认参数。
3. 重点核对：
   - `version` 未与已有 tag 冲突
   - `release_title` 可读
   - `release_notes` 完整
   - `via_exclude` / `edge_exclude` 是否符合本次发包需求
4. 确认后由 Agent 触发 `release.yml`。
5. 到 Actions 页面检查 run 成功，再到 Releases 页面核对附件是否齐全（Via/Edge 两个 zip）。

## 6. 常见失败点排查

1. 无法触发 workflow：
   - 先看 Token 是否过期/被撤销；
   - 再看是否真的是 Fine-grained 且绑定了正确仓库；
   - 再看 `Actions` 是否为 Read and write。
2. workflow 触发了但 Release 创建失败：
   - 多数是 `version` tag 已存在；
   - 或输入内容格式有问题（尤其 `release_notes`）。
3. 打包后缺脚本：
   - 检查 `via_exclude` / `edge_exclude` 是否误排除；
   - 检查 `vv/` 下脚本命名是否正确且为 `*.user.js`。
