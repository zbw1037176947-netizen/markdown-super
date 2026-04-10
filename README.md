# Markdown Super

**All-in-one Markdown preview & editing experience for VS Code.**

One extension to replace them all — no more juggling 3-4 Markdown plugins.

![Preview](https://img.shields.io/badge/Preview-Live%20Sync-blue)
![Theme](https://img.shields.io/badge/Theme-Light%20%2F%20Auto-green)
![Diagrams](https://img.shields.io/badge/Diagrams-Mermaid%20%7C%20PlantUML%20%7C%20Markmap-orange)

## Features

### Live Preview with Scroll Sync

Split-view preview that stays in sync with your editor. Scroll the editor — preview follows instantly. Click in the preview — editor jumps to the line.

### Independent Theme System

Switch the preview between two modes with one click:
- **Auto** — follows your VS Code theme (dark/light)
- **Light** — clean white background for reading, independent of VS Code theme

### Rich Diagram Support

| Diagram | Syntax | Rendering |
|---------|--------|-----------|
| **Mermaid** | ` ```mermaid ` | Flowcharts, sequence, gantt, etc. |
| **PlantUML** | ` ```plantuml ` | UML diagrams |
| **Markmap** | ` ```markmap ` | Interactive mindmaps |

### Math Formulas (KaTeX)

Inline math with `$E=mc^2$` and block math with `$$...$$`. Fast KaTeX rendering.

### GFM Alerts

GitHub-style admonition blocks with color-coded cards:

```markdown
> [!NOTE]
> Useful information

> [!WARNING]
> Critical content
```

Supports NOTE, TIP, IMPORTANT, WARNING, and CAUTION.

### Code Block Enhancements

- Syntax highlighting (180+ languages)
- Language label in the header
- One-click **Copy** button
- Optional line numbers

### Image Support

- Paste images from clipboard (auto-save to `./assets/`)
- Drag & drop image files
- Click to zoom (lightbox)
- Local and remote images

### Floating TOC Navigation

A floating outline panel in the preview — fades in on hover, auto-highlights the current section as you scroll.

### More Features

- **Front Matter** — YAML header rendered as an info card
- **Word Count** — status bar shows word count & reading time
- **Emoji** — `:smile:` → 😄
- **Anchor Links** — `[jump](#heading)` works in preview
- **Footnotes** — `[^1]` with auto-numbering
- **Task Lists** — `- [x]` checkboxes
- **Quick Formatting** — Ctrl+B bold, Ctrl+I italic, Ctrl+K link
- **Preview Search** — Ctrl+F search within preview

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+V` | Open preview to the side |
| `Ctrl+B` | Toggle bold |
| `Ctrl+I` | Toggle italic |
| `Ctrl+K` | Insert link |
| `Ctrl+Shift+K` | Insert image |
| `Ctrl+Shift+C` | Toggle inline code |
| `Ctrl+F` (in preview) | Search in preview |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `markdownSuper.mermaid.enabled` | `true` | Enable Mermaid rendering |
| `markdownSuper.katex.enabled` | `true` | Enable KaTeX rendering |
| `markdownSuper.fontSize` | `16` | Preview font size |
| `markdownSuper.codeBlock.lineNumbers` | `false` | Show line numbers |
| `markdownSuper.image.saveDir` | `./assets` | Image save directory |

## Requirements

- VS Code 1.90.0 or later
- Works with Remote SSH, WSL, and Codespaces

## License

MIT
