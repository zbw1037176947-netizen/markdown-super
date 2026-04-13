/**
 * Mermaid 图表渲染器
 * 延迟加载 mermaid 库（~2MB），仅在检测到 mermaid 代码块时才加载
 */

// 缓存 Promise 而非 module，避免并发调用时重复 import + initialize
let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
let mermaidId = 0;

function ensureMermaid(): Promise<typeof import("mermaid").default> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid")
      .then((m) => {
        m.default.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "strict",
          fontFamily: "inherit",
        });
        return m.default;
      })
      .catch((err) => {
        // 失败时重置，下次可以重试
        mermaidPromise = null;
        throw err;
      });
  }
  return mermaidPromise;
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
      // 继承原 <pre> 的 data-line 属性
      const dataLine = block.getAttribute("data-line");
      if (dataLine) wrapper.setAttribute("data-line", dataLine);
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
