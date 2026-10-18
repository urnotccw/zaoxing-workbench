# 造形 · 角色设计工作台

从一个有设计依据的角色，扩展为同画风、不同身份的一组角色。

- GitHub Pages 工作台：https://urnotccw.github.io/zaoxing-workbench/
- 项目分析 PDF：https://urnotccw.github.io/zaoxing-workbench/project-analysis.pdf
- 备用工作台：https://zaoxing-workbench.urnotccw1.chatgpt.site
- 本机原版：`local/`，Windows 安装 Python 3 后运行启动脚本。

## 项目特色

1. 记录资料出处、视觉特征和原创建议，用户决定最终采用的设计。
2. 参考图库与任务选图分开，按画风、角色、构图、姿态和材质控制取用。
3. 从满意成图建立系列画风基准，扩展造型不同的角色，先试选定成员再继续剩余。
4. 保存角色、版本、提示词、参考关系和任务进度，支持返修与续做。

## 在线版

前端沿用原工作台交互，静态工作台与 PDF 通过 GitHub Pages 发布；AI 后端使用 Vinext + Cloudflare Workers、D1 任务记录和 R2 图片存储，通过 Sites 发布。GitHub Pages 页面直接调用受口令保护的后端，不跳转、不在前端保存模型密钥。

项目内容保存在用户当前浏览器、当前网站中，请主动导出备份。GitHub Pages、备用站与本机版的项目不自动同步，可通过导出和导入迁移。

### GitHub Pages 发布

在仓库 Settings → Pages 中选择 **Deploy from a branch**，分支 **main**，目录 **/docs**，保存后 GitHub 自动发布。`docs/` 是可独立托管的完整工作台和 PDF。更新前端后运行 `node scripts/build-pages.mjs` 并提交 `docs/`。AI 后端变更需要另行发布到 Sites。

公开网页与 PDF 无需口令；AI 功能需要作者单独提供的访问口令，有效期 24 小时。当前全站每日限 40 次图片提交与 200 次分析调用。请求失败或状态不确定时，不自动重复付费提交。

服务端环境变量：`DEEPSEEK_API_KEY`、`ARK_API_KEY`、`ACCESS_PASSWORD`、`SESSION_SECRET`；可选模型配置 `DEEPSEEK_MODEL`、`SEEDREAM_MODEL`。只能通过托管后台配置，不能填入公开代码、项目文件或 GitHub 仓库。

AI 能力与模型账户权限有关；检索无结果、模型不支持图片或生成失败时会显示真实错误，不以演示数据替代。人工仍需检查设计依据、画风、结构与采用结果。

## 本地开发

```sh
npm run install:ci
npm run db:generate
npm run dev
npm run build
```

数据库迁移在 `drizzle/`；首次本地预览需应用本地 D1 迁移。运行环境和部署步骤见 Sites 标准流程。本仓库不包含 API 密钥、用户项目存档或本机生成结果。
