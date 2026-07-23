import { toPng } from 'html-to-image';

export async function captureElement(element: HTMLElement): Promise<Blob | null> {
  try {
    // 等待所有图片加载完成
    const images = element.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve(); // 即使加载失败也继续
          // 超时保护
          setTimeout(() => resolve(), 5000);
        });
      })
    );

    // 额外等一帧确保渲染
    await new Promise((r) => setTimeout(r, 200));

    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: '#0a0a0f',
      cacheBust: false,
    });

    const res = await fetch(dataUrl);
    return await res.blob();
  } catch (error) {
    console.error('截图失败:', error);
    return null;
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
