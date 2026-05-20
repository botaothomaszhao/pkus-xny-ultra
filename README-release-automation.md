# 自动打包发布配置与使用说明

本文面向 fork 或后续接手本仓库的维护者，目标是让你可以稳定使用 Agent 自动触发发布流程。

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

如果你是 fork：

1. 确保 `.github/workflows/release.yml` 存在且未被禁用。
2. 确保 `.github/agents/release-publisher.agent.md` 存在（用于 Agent 发布流程）。
3. 在仓库 `Actions` 页面确认 workflow 可见且可手动运行。

### 2.2 配置 MCP（让 Agent 能调用 GitHub Actions）

本仓库的自动发布 Agent 使用方式是：直接在 **GitHub 仓库网页中的 Agent 页面** 调用 `release-publisher`。  
该页面中的 Agent 仍然依赖 GitHub MCP Server 权限来触发 Actions，因此你需要给它配置可用认证。  
核心检查点只有两个：

1. MCP 已连接到 GitHub（不是只读离线模式）。
2. MCP 认证所用令牌对目标仓库具备 Actions 写权限（至少能触发 workflow）。

如果你本地/团队有统一 MCP 配置模板，直接套用并替换仓库名即可。

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

## 4. 在项目中设置 MCP（仓库网页 Agent 页面）

本项目当前使用的 MCP 配置如下（放在仓库网页 Agent 的 MCP 配置中）：

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

设置步骤：

1. 进入仓库网页的 Agent 页面，打开该仓库的 MCP 配置入口。
2. 添加或替换为上面的 `github-mcp-server` 配置。
3. 在同一 Agent 环境的 Secrets/凭据设置里新增发布 Token（建议命名 `GH_TOKEN`），值为第 3 节创建的 Fine-grained PAT。
4. 保存后重开 Agent 会话，先执行一次只读验证（如列出 workflow），再执行发布。

说明：MCP 配置里不直接写明文 Token，Token 通过 Agent 的 Secrets 注入。

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
