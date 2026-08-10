# vinext-starter

一个简洁的全栈项目模板，基于
[vinext](https://github.com/cloudflare/vinext) 运行，并可选配 Cloudflare D1
和 Drizzle 支持。

## 前置要求

- Node.js `>=22.13.0`

## 快速开始

```bash
npm install
npm run dev
npm run build
```

此模板不使用 `wrangler.jsonc`。

## 已包含的项目结构

- 在 `app/` 目录下编辑网站代码
- `.openai/hosting.json` 声明可选的 Sites D1 与 R2 绑定
- `vite.config.ts` 在本地开发时模拟已声明的绑定
- `db/schema.ts` 初始时有意保持为空
- `examples/d1/` 包含一个可选的 D1 示例代码
- `drizzle.config.ts` 在需要时支持本地生成数据库迁移文件

## 工作区身份验证请求头

已登录的访问者会同时收到 `oai-authenticated-user-id` 和
`oai-authenticated-user-email` 两个请求头。私有 Sites 要求每位访问者登录；
公共 Sites 也可能有匿名访问者，此时这两个请求头都不会出现。

同一位用户在同一个 Site 上的用户 ID 是稳定的，而在不同 Sites 之间会不同。
电子邮箱和姓名主要用于展示或联系。

当用户的 SIWC 档案中存在非空的 `name` 声明时，使用 SIWC 身份验证的工作区
站点还可能收到 `oai-authenticated-user-full-name` 请求头。完整姓名的值采用
百分号编码的 UTF-8 格式，并伴随有
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8` 请求头。

请将完整姓名视为可选字段；如果不存在，则使用电子邮箱作为后备值：

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## 可选：由 Dispatch 托管的 ChatGPT 登录

当网站需要可选或必需的 ChatGPT 登录时，可从 `app/chatgpt-auth.ts` 导入可直接使用的辅助函数：

- 使用 `getChatGPTUser()` 创建可选登录状态的界面。
- 对于需要将匿名访问者引导至“使用 ChatGPT 登录”的服务端渲染页面，使用
  `requireChatGPTUser(returnTo)`。
- 对浏览器链接或操作，使用 `chatGPTSignInPath(returnTo)` 和
  `chatGPTSignOutPath(returnTo)`。
- 请传入同源的相对 `returnTo` 路径，作为登录或退出后的跳转目标；辅助函数会进行验证并安全编码。
- 受保护页面依赖每次请求的身份请求头，因此请使用
  `export const dynamic = "force-dynamic"` 标记这些页面。

Dispatch 负责处理 `/signin-with-chatgpt`、`/signout-with-chatgpt`、`/callback`、
OAuth Cookie 及身份请求头注入。请不要为这些保留路径自行实现应用路由。
未导入并调用这些辅助函数的路由仍可兼容匿名访问。

SIWC 只负责建立身份，不能证明用户属于某个工作区。如需对整个工作区进行访问限制，
请使用 Sites 托管平台的访问策略控制，或在服务端明确实施成员资格或允许名单检查。

将 SIWC 用于账户页面、用户专属仪表板、已保存记录，以及与当前 ChatGPT 用户绑定的写入操作；
公开内容应保持支持匿名访问。

## 常用命令

- `npm run dev`：启动本地开发服务器
- `npm run build`：验证 vinext 的构建输出
- `npm test`：构建模板并验证其渲染的加载骨架
- `npm run db:generate`：在修改数据库结构后生成 Drizzle 迁移文件

## 了解更多

- [vinext 文档](https://github.com/cloudflare/vinext)
- [Drizzle D1 指南](https://orm.drizzle.team/docs/get-started/d1-new)
