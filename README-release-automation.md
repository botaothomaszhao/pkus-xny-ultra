# 自动打包发布配置与使用说明

## 1. 当前仓库自动发布链路

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

## 2. 前置条件（最重要）

### 2.1 在你的仓库里启用对应文件

1. 确保 `.github/workflows/release.yml` 存在且未被禁用。
2. 确保 `.github/agents/release-publisher.agent.md` 存在（用于 Agent 发布流程）。
3. 在仓库 `Actions` 页面确认 workflow 可见且可手动运行。

### 2.2 配置 MCP（让 Agent 能调用 GitHub Actions）

自动发布 Agent 的使用入口是：**GitHub 仓库网页 → Agent 页面**，直接调用 `release-publisher`。  
该 Agent 触发 Actions 依赖 MCP，因此必须在仓库设置里配置 MCP 与对应 Secret（见第 4 节）。

## 3. 在项目中创建发布专用 Token（Fine-grained PAT）

建议单独创建一个仅用于 Agent 触发发布的 Fine-grained Personal Access Token，不要复用日常开发 Token。

创建步骤（按这个顺序基本不会迷路）：

1. 先点 GitHub 右上角头像 → `Settings`。  
   或直接打开：`https://github.com/settings/tokens?type=beta`
2. 在左侧菜单找到 `Developer settings`（通常在最底部）。
3. 进入 `Personal access tokens` → `Fine-grained tokens`。
4. 点击 `Generate new token`（或 `Generate new token (classic)` 旁边下拉后选 Fine-grained）。
5. `Repository access` 选择 `Only select repositories`，只勾选目标仓库（例如 `botaothomaszhao/pkus-xny-ultra`）。
6. `User permissions` 保持不授予。
7. `Repository permissions` 至少设置：
   - `Actions`：**Read and write**
   - `agent tasks`、`code`、`metadata`、`pull requests`：**Read**
8. 设置有效期后生成 Token，并立即复制保存（页面离开后无法再次查看明文）。

额外建议：

- Token 使用短周期并轮换。
- 只保存在 Agent/MCP 密钥区，不写进仓库文件。
- 一旦泄露，立即 Revoke 并重建。

## 4. 在项目中设置 MCP 与 Secret（仓库网页设置）

进入仓库网页设置路径：`Settings` → `Copilot` → `Coding agent`。

### 4.1 配置 MCP servers（粘贴位置）

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

### 4.2 配置 Secret（把 Token 配到仓库）

在同一页面的 `Secrets` 区域新增：

- Name：`COPILOT_MCP_GITHUB_PERSONAL_ACCESS_TOKEN`
- Value：第 3 节创建的 Fine-grained PAT

保存后重开 Agent 会话，先做一次只读验证（例如列出 workflow），再执行发布。  
说明：MCP 配置 JSON 里不写明文 Token，Token 通过上面的 Secret 注入。

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

## 7. 交接建议

给新维护者至少交接以下内容：

- 本文档链接
- 当前发布命名规范（本仓库约定 `vv.x.x`，不是 `v.x.x`；用于对应 `vv/` 活跃目录并与旧版 `v1/`、`v2/` 习惯区分）
- 哪些脚本通常排除在 Edge 包外（如有团队约定）
- Token 轮换周期与保管方式

做到以上四点，fork 或接手后即可独立完成自动打包发布。
