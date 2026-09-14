/* 分享图生成服务。
 * 用 html2canvas 把一个 DOM 节点渲染成图片。为避免修改构建依赖（package.json
 * 在本项目的部分环境下读写不稳定），改用 CDN 动态加载脚本，纯运行时行为，
 * 兼容性好、风险低，只在用户真正点击"保存图片"时才会加载。 */

const HTML2CANVAS_CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';

let loadPromise: Promise<any> | null = null;

function loadHtml2Canvas(): Promise<any> {
  if ((window as any).html2canvas) return Promise.resolve((window as any).html2canvas);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = HTML2CANVAS_CDN;
    script.onload = () => resolve((window as any).html2canvas);
    script.onerror = () => reject(new Error('html2canvas 加载失败，请检查网络后重试'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

/** 把指定 DOM 节点渲染成图片并触发浏览器下载 */
export async function captureAndDownload(el: HTMLElement, filename: string): Promise<void> {
  const html2canvas = await loadHtml2Canvas();
  const canvas = await html2canvas(el, {
    scale: 2, // 提高清晰度，适合分享到社交平台
    useCORS: true,
    backgroundColor: '#fdf9ee',
  });
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
