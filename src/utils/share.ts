import { toPng } from 'html-to-image';

export async function captureElement(element: HTMLElement): Promise<Blob | null> {
  try {
    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: '#030712', // gray-950
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
