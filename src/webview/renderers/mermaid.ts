/**
 * Mermaid 图表渲染器
 * 延迟加载 mermaid 库（~2MB），仅在检测到 mermaid 代码块时才加载
 */

let mermaidModule: typeof import("mermaid") | null = null;
let mermaidId = 0;

async function ensureMermaid() {
  if (!mermaidModule) {
    mermaidModule = await import("mermaid");
    mermaidModule.default.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "strict",
      fontFamily: "inherit",
    });
  }
  return mermaidModule.default;
}

export async function renderMermaidBlocks(container: HTMLElement) {
  const blocks = container.querySelectorAll("pre.mermaid-block");
  if (blocks.length === 0) return;

  const mermaid = await ensureMermaid();

  for (const block of blocks) {
    const code = block.textContent?.trim();
    if (!code) continue;

    try {
      const id = `mermaid-${mermaidId++}`;
      const { svg } = await mermaid.render(id, code);
      const wrapper = document.createElement("div");
      wrapper.className = "mermaid-rendered";
      wrapper.innerHTML = svg;
      block.replaceWith(wrapper);
    } catch (err) {
      // 渲染失败时显示错误提示，保留原始代码
      const errorEl = document.createElement("div");
      errorEl.className = "mermaid-error";
      errorEl.textContent = `Mermaid error: ${err instanceof Error ? err.message : String(err)}`;
      block.parentElement?.insertBefore(errorEl, block.nextSibling);
    }
  }
}
