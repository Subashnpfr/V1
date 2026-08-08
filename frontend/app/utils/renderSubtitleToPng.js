import { toPng } from 'html-to-image';

export async function renderNodeToPngDataUrl(node, width, height) {
  if (typeof window !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {}
  }
  const dataUrl = await toPng(node, {
    width,
    height,
    pixelRatio: 1,
    cacheBust: false,
    skipFonts: true,
    backgroundColor: 'transparent',
    style: {
      margin: '0',
      transform: 'none',
      visibility: 'visible',
      opacity: '1'
    }
  });
  return dataUrl;
}
