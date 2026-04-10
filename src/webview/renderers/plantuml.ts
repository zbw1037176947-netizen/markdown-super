/**
 * PlantUML 渲染器
 *
 * 使用 PlantUML 官方服务端编码方案，将代码编码为 URL，通过 <img> 标签渲染 SVG。
 * 这里用的是纯客户端编码（deflate + Base64 变种），无需 WASM。
 * 图片由 PlantUML 在线服务渲染（可配置自建服务器）。
 *
 * 注：后续如果需要完全离线，可替换为 plantuml-wasm。
 */

const PLANTUML_SERVER = "https://www.plantuml.com/plantuml";

export async function renderPlantUmlBlocks(container: HTMLElement) {
  const blocks = container.querySelectorAll("pre.plantuml-block");
  if (blocks.length === 0) return;

  for (const block of blocks) {
    const code = block.textContent?.trim();
    if (!code) continue;

    try {
      const encoded = encodePlantUml(code);
      const url = `${PLANTUML_SERVER}/svg/${encoded}`;

      const wrapper = document.createElement("div");
      wrapper.className = "plantuml-rendered";

      const img = document.createElement("img");
      img.src = url;
      img.alt = "PlantUML diagram";
      img.style.maxWidth = "100%";
      img.onerror = () => {
        wrapper.innerHTML = `<div class="plantuml-error">PlantUML rendering failed. Check your diagram syntax.</div>`;
      };

      wrapper.appendChild(img);
      block.replaceWith(wrapper);
    } catch (err) {
      const errorEl = document.createElement("div");
      errorEl.className = "plantuml-error";
      errorEl.textContent = `PlantUML error: ${err instanceof Error ? err.message : String(err)}`;
      block.parentElement?.insertBefore(errorEl, block.nextSibling);
    }
  }
}

/**
 * PlantUML 文本编码（官方 deflate 编码方案）
 * 参考：https://plantuml.com/text-encoding
 */
function encodePlantUml(text: string): string {
  // 简化方案：使用 hex 编码（兼容性最好）
  const hex = Array.from(new TextEncoder().encode(text))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "~h" + hex;
}
