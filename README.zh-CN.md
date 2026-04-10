# Markdown Super

**VS Code 上的一站式 Markdown 预览与编辑体验。**

一个插件替代所有——不再需要同时安装 3-4 个 Markdown 插件。

![Preview](https://img.shields.io/badge/预览-实时同步-blue)
![Theme](https://img.shields.io/badge/主题-浅色%20%2F%20跟随-green)
![Diagrams](https://img.shields.io/badge/图表-Mermaid%20%7C%20PlantUML%20%7C%20Markmap-orange)

[English](./README.md) | 中文

## 功能特性

### 实时预览 + 滚动同步

分屏预览与编辑器实时同步。滚动编辑器——预览跟着动；点击预览——编辑器跳转到对应行。

### 独立主题系统

一键切换预览主题：
- **跟随模式** — 跟随 VS Code 当前主题（暗色/亮色）
- **阅读模式** — 白底黑字，独立于 VS Code 主题，适合专注阅读

### 丰富的图表支持

| 图表类型 | 语法 | 说明 |
|----------|------|------|
| **Mermaid** | ` ```mermaid ` | 流程图、时序图、甘特图等 |
| **PlantUML** | ` ```plantuml ` | UML 图表 |
| **Markmap** | ` ```markmap ` | 交互式思维导图 |

### 数学公式（KaTeX）

行内公式 `$E=mc^2$`，块级公式 `$$...$$`，快速 KaTeX 渲染。

### GFM 提示块

GitHub 风格的彩色提示卡片：

```markdown
> [!NOTE]
> 补充说明信息

> [!WARNING]
> 警告提醒
```

支持 NOTE、TIP、IMPORTANT、WARNING、CAUTION 五种类型。

### 代码块增强

- 语法高亮（180+ 语言）
- 语言标签显示
- 一键 **复制** 按钮
- 可选行号显示

### 图片支持

- 粘贴剪贴板图片（自动保存到 `./assets/`）
- 拖拽图片文件到编辑器
- 点击放大查看（Lightbox）
- 本地图片和网络图片

### 浮动目录导航

预览面板内的浮动大纲——平时半透明不干扰阅读，鼠标移入时显现，滚动时自动高亮当前章节。

### 更多功能

- **Front Matter** — YAML 头部渲染为信息卡片
- **字数统计** — 状态栏显示字数和预估阅读时长
- **Emoji** — `:smile:` → 😄
- **锚点链接** — `[跳转](#标题)` 在预览内跳转
- **脚注** — `[^1]` 自动编号
- **任务列表** — `- [x]` 复选框
- **快捷格式化** — Ctrl+B 加粗、Ctrl+I 斜体、Ctrl+K 链接
- **预览内搜索** — Ctrl+F 搜索并高亮

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+V` | 打开侧边预览 |
| `Ctrl+B` | 加粗 |
| `Ctrl+I` | 斜体 |
| `Ctrl+K` | 插入链接 |
| `Ctrl+Shift+K` | 插入图片 |
| `Ctrl+Shift+C` | 行内代码 |
| `Ctrl+F`（预览面板内） | 预览内搜索 |

## 配置项

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `markdownSuper.mermaid.enabled` | `true` | 启用 Mermaid 渲染 |
| `markdownSuper.katex.enabled` | `true` | 启用 KaTeX 渲染 |
| `markdownSuper.fontSize` | `16` | 预览字体大小 |
| `markdownSuper.codeBlock.lineNumbers` | `false` | 显示代码行号 |
| `markdownSuper.image.saveDir` | `./assets` | 图片保存目录 |

## 环境要求

- VS Code 1.90.0 或更高版本
- 支持 Remote SSH、WSL、Codespaces

## 许可证

MIT
