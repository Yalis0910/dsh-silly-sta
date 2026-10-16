# dsh-silly-sta

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![dsh](https://img.shields.io/badge/dsh-0.2.0--rc.2+-orange.svg)](https://www.npmjs.com/package/@deepseek-ai/dsh)
[![node](https://img.shields.io/badge/node->=22.19.0-green.svg)](https://nodejs.org/)
[![github](https://img.shields.io/badge/GitHub-Yalis0910%2Fdsh--silly--sta-181717?logo=github)](https://github.com/Yalis0910/dsh-silly-sta)

[English](README-EN.md) | 简体中文

DeepSeek Harness (DSH) 沉浸式酒馆角色扮演与角色卡创作插件。为 DSH 带来与 SillyTavern 兼容的角色卡生态、灵感创作工坊、本地相册管理以及 Yohaku 风格的现代极简交互体验。

---

## 界面预览

| 角色选择网格 | 沉浸式对话与开场白切换 | 临时指令抽屉 |
| :---: | :---: | :---: |
| ![角色选择](images/1.png) | ![对话界面](images/2.png) | ![临时指令](images/3.png) |

---

## ✨ 核心特性

### 🎭 沉浸式角色扮演 (Role-play)
- **酒馆标准兼容**：无缝支持 SillyTavern / Tavern 规范角色卡（V2/V3 规范、PNG 头像内嵌元数据、JSON 格式导入导出）。
- **Yohaku 美学与原生文本流**：参考 Yohaku 极简留白设计哲学，去除厚重气泡框，采用通透的原生流式排版，深度兼容 PC 端与移动端触控交互。
- **高阶文本着色**：智能识别台词、旁白、心理描写与动作，支持执行角色卡自带的自定义正则高亮规则（Regex Scripts），呈现淡雅的情绪视觉层次。
- **多开场白实时切换**：支持拥有多个备选开场白（Alternate Greetings）的角色卡，直接在对话顶部/底部进行翻页预览与一键生效。
- **临时指令 (OOC Tray)**：内联呼出临时引导面板，指令将随下一轮对话作为系统级提示注入并自动销毁，无需污染主对话流。
- **场景设定 (Author's Note)**：支持全局/临时注入场景基调与深度提示词，控制情节走向。
- **分支选项模式 (Choice Mode)**：在关键情节处由 AI 提议多种下一步行动策略，玩家可一键点击决策。

### 🛠️ 角色卡创作工坊 (Character Forge)
- **灵感一键成卡**：只需一句灵感描述，大模型即可交互式推演并生成完备角色卡（名字、人格、场景、世界书、开场白与头像）。
- **全功能内置编辑器**：支持在线编辑角色基础资料、标签、高级提示词、示例对话、备选开场白、世界书条目（Lorebook）增删改查及正则脚本。
- **便携打包导出**：一键将卡片导出为标准的 PNG 图片卡（内嵌角色元数据）或标准 JSON 文件，随处分享。

### 🖼️ 本地相册与插画展示 (Gallery & Illustration View)
- **相册画廊管理**：内置本地相册系统（设置 → 角色扮演 → 图库），集中管理已保存的插画与头像，支持磁盘占用统计、星标收藏、批量迁移与删除。
- **全屏灯箱查看 (Lightbox)**：支持对话内插画与头像全屏点击放大查看与快捷保存。
- **生图结果渲染插槽**：内置 `tool.call.toolview` 适配层，可优雅呈现生图工具的输出结果卡片，并支持一键将图片设为当前角色卡头像。

### 🗄️ 双层存储域与上下文智能维护
- **作用域隔离**：支持「全局存储（Global）」与「工作区存储（Workspace）」两级分类，卡片与插画可跨空间迁移。
- **长文本上下文压缩**：无缝接入 DSH 0.2.x 体系，支持自动 Compaction 机制，超长对话剧本永不超出模型上下文。

---

## 📦 环境要求

- **[dsh](https://www.npmjs.com/package/@deepseek-ai/dsh)**: **`0.2.0-rc.2+`**
- **Node.js**: **`>=22.19.0`**
- **pnpm**: **`>=9.0.0`**

---

## 🚀 安装

### 方式一：从 GitHub 安装（推荐）

通过 DSH 插件管理器直接安装当前仓库：

```bash
dsh plugin --profile web add -w github:Yalis0910/dsh-silly-sta
```

如需指定特定分支或标签：

```bash
dsh plugin --profile web add -w github:Yalis0910/dsh-silly-sta#main
```

> **注意**：从 GitHub 安装会自动触发 `prepare` 脚本构建前端与后端 bundle。若 pnpm 提示忽略了构建脚本，可在 `~/.dsh/profiles/web/pnpm-workspace.yaml` 中添加白名单：
> ```yaml
> allowBuilds:
>   silly-sta: true
> ```

---

### 方式二：本地克隆与开发 (Local Development)

克隆仓库并安装依赖：

```bash
git clone https://github.com/Yalis0910/dsh-silly-sta.git
cd dsh-silly-sta
pnpm install
```

执行完整校验构建：

```bash
npm run check
```

将本地开发目录软链挂载到 DSH Web Profile 中：

```bash
dsh plugin --profile web add -w .
```

启动 DSH Web 进行实时开发与测试：

```bash
dsh web
```

---

## 🔄 更新与卸载

### 更新插件

从 GitHub 安装的用户直接重新执行安装命令拉取最新提交：

```bash
dsh plugin --profile web add -w github:Yalis0910/dsh-silly-sta
```

本地开发用户在源码目录下 `git pull` 后执行 `npm run check`，然后重启 `dsh web` 即可。

### 卸载插件

```bash
dsh plugin --profile web remove silly-sta
```

> **说明**：已保存的角色卡与相册文件仍安全保留在 `$DSH_HOME/roleplay/` 中；如需彻底清除，可手动删除该目录。

---

## 💻 本地构建命令说明

项目采用 TypeScript + esbuild 构建。Windows PowerShell 环境下若遇到脚本执行策略限制，可直接运行 Node 原生指令：

```powershell
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p tsconfig.client.json --noEmit
node scripts/build.mjs
node scripts/verify-dsh-imports.mjs
```

---

## 📖 使用指南

1. **启用角色扮演预设**：
   - 启动 `dsh web`，在顶部预设下拉菜单中选择 **「角色扮演 · Role-play」** 预设（或在创建新会话时选择）。
2. **选择或导入角色卡**：
   - 输入框上方会自动弹出角色卡选择 Dock，点击任意卡片即可直接绑定并开始对话。
   - 可以在左侧侧边栏 **「设置 → 角色扮演」** 中点击导入酒馆 PNG 角色卡或 JSON 文件。
3. **临时指示与开场白定制**：
   - 点击 Dock 上的 **「临时指令」** 展开输入抽屉（如剧情跳跃、旁白要求等）。
   - 点击 **「‹ / ›」** 即可实时预览并切换备选开场白。

---

## 🤝 致谢与参考

- 感谢 [SillyTavern](https://github.com/SillyTavern/SillyTavern) 社区制定的角色卡与世界书开放生态规范。
- 感谢 [RP-Hub](https://github.com/STA1N156/RP-Hub) 项目在角色卡设计与提示词方案上的启发。
- UI/UX 视觉灵感借鉴自 [Yohaku (余白)](https://yohaku.innei.dev/) 极简设计规范。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。
