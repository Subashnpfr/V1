import { toCanvas } from 'html-to-image';

export async function renderNodeToPngDataUrl(node, width, height) {
  if (typeof window !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {}
  }
  const canvas = await toCanvas(node, {
    width,
    height,
    canvasWidth: width,
    canvasHeight: height,
    pixelRatio: 1,
    cacheBust: false,
    skipFonts: true,
    backgroundColor: null,
    style: {
      margin: '0',
      transform: 'none',
      visibility: 'visible',
      opacity: '1',
      background: 'transparent'
    }
  });
  return canvas.toDataURL('image/png');
}
