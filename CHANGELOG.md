# Changelog

## [0.1.3] - 2026-04-13

### Fixed

- **位置同步重写** — 改为视口对视口对称映射（编辑器视口顶部行 ↔ 预览视口顶部），双向稳定
- **Edit in Source 不再关闭预览** — 用 `preview: false` 避免 webview tab 被挤掉
- **首次打开预览自动定位** — 修复 `requestScrollAfterRender` 静默失效问题
- **GFM Alert 插件不再破坏 inline 渲染** — 不再劫持全局 inline renderer
- **Mermaid 初始化并发竞态** — Promise 缓存替代 module 缓存
- **搜索 surroundContents 崩溃** — try-catch + fallback
- **image-zoom 监听器泄漏** — 具名 Esc 监听器 + closing 状态机
- **滚动同步跨文档窜扰** — setTimeout 回调校验 activeEditor

### Changed

- **光标体验** — 移除块级手型光标，保留 hover 背景反馈，恢复正常 text 光标
- **Outline 代码块解析** — 支持 ~~~、排除 front matter 和缩进代码块
- **图片路径解析** — 缓存 base + data-resolved 标记避免重复处理
- **消息类型安全** — webview ↔ extension 通信加入结构验证
- **去掉失效的"点击预览跳转编辑器"功能** — 不再产生视觉干扰

### Added

- **PlantUML 配置化服务器** — `markdownSuper.plantuml.server`，支持自建服务器保护隐私
- **PlantUML 官方 deflate 编码** — 支持大型图表，替代 hex 编码

## [0.1.2] - 2026-04-13

### Added

- **7 套预设主题** — GitHub / Notion / Medium / Vue / Purple Night / Minimalist / Chinese Doc / Auto，标题栏按钮循环切换
- **视觉增强** — macOS 风格代码块头部、链接下划线动画、外部链接图标、图片 hover 放大、装饰性分割线、自定义 checkbox、阅读进度条
- **原地预览模式** — 新设置 `previewMode: "inplace"`，预览在当前 tab 原地打开，快捷键 toggle 关闭
- **预览 → 编辑器跳转** — 右键 "Edit in Source" 自动跳回编辑器对应位置
- **打开预览自动定位** — 按快捷键打开预览时自动滚到编辑器光标所在位置

### Fixed

- **粗体/斜体渲染失效** — gfm-alert 插件不再全局劫持 inline renderer
- **锚点链接跳转错误** — slugify 使用 GitHub 风格，避免点号等标点符号导致不匹配
- **图表区域位置同步丢失** — Mermaid/PlantUML/Markmap 渲染后保留 data-line 属性
- **Toggle 误关闭** — 预览不可见时按快捷键应该 reveal 而非关闭
- **浅色模式行内代码颜色不清** — 使用玫红色文字 + 浅灰背景

## [0.1.0] - 2026-04-10

### Added

- **Live Preview** — split-view with real-time rendering (50ms debounce)
- **Scroll Sync** — bidirectional sync between editor and preview (binary search + interpolation)
- **Independent Theme** — preview theme toggle (Auto / Light reading mode)
- **Code Block Enhancements** — language label, copy button, optional line numbers
- **KaTeX** — inline `$...$` and block `$$...$$` math rendering
- **Mermaid** — flowcharts, sequence diagrams, gantt charts (lazy loaded)
- **PlantUML** — UML diagram rendering
- **Markmap** — interactive mindmap from markdown headings
- **Image Paste** — Ctrl+V paste clipboard images, auto-save to `./assets/`
- **Image Drag & Drop** — drag image files into editor
- **Image Zoom** — click to view full-screen, Esc to close
- **GFM Alerts** — NOTE, TIP, IMPORTANT, WARNING, CAUTION blocks
- **Front Matter** — YAML header rendered as info card
- **Floating TOC** — outline panel in preview, auto-highlights on scroll
- **Explorer Outline** — heading tree in VS Code sidebar
- **Word Count** — status bar with word count and reading time
- **Emoji** — `:smile:` shortcode rendering
- **Anchor Links** — `#heading` links work in preview
- **Quick Formatting** — Ctrl+B/I/K shortcuts for bold, italic, links
- **Preview Search** — Ctrl+F search within preview panel
- **Footnotes** — `[^1]` with auto-numbering
- **Task Lists** — `- [x]` checkbox rendering
