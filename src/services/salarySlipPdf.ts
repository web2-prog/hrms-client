import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export type SalarySlipPdfResult = {
  blob: Blob;
  base64: string;
  dataUrl: string;
};

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 120)}`));
    img.src = src;
  });
}

function isSvgSrc(src: string) {
  return /\.svg(\?|#|$)/i.test(src) || src.startsWith('data:image/svg');
}

/**
 * html2canvas does not reliably paint external SVG <img> tags.
 * Rasterize company logos to PNG data URLs before capture so email/download PDFs show the logo.
 */
async function rasterizeSvgImage(img: HTMLImageElement): Promise<void> {
  const src = img.currentSrc || img.src;
  if (!src || src.startsWith('data:image/png') || src.startsWith('data:image/jpeg')) return;
  if (!isSvgSrc(src)) {
    if (img.complete && img.naturalWidth > 0) return;
    await loadImageElement(src).then((loaded) => {
      if (img.src !== loaded.src) img.src = loaded.src;
    });
    return;
  }

  let objectUrl: string | null = null;
  try {
    const displayW = Math.max(img.clientWidth || 88, 1);
    const displayH = Math.max(img.clientHeight || 88, 1);

    let drawSrc = src;
    if (!src.startsWith('data:')) {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`Logo fetch failed (${res.status})`);
      let svgText = await res.text();
      // Explicit pixel size helps browsers draw SVG onto canvas consistently.
      const w = displayW * 2;
      const h = displayH * 2;
      if (!/\swidth\s*=/.test(svgText) || !/\sheight\s*=/.test(svgText)) {
        svgText = svgText.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
          let next = attrs;
          if (!/\swidth\s*=/.test(next)) next += ` width="${w}"`;
          if (!/\sheight\s*=/.test(next)) next += ` height="${h}"`;
          return `<svg${next}>`;
        });
      }
      const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      objectUrl = URL.createObjectURL(blob);
      drawSrc = objectUrl;
    }

    const loaded = await loadImageElement(drawSrc);
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = displayW * scale;
    canvas.height = displayH * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable for logo rasterization');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(loaded, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL('image/png');

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('PNG logo failed to load'));
      img.src = png;
      if (img.complete && img.naturalWidth > 0) resolve();
    });
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

async function preparePayslipImages(element: HTMLElement) {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      try {
        await rasterizeSvgImage(img);
      } catch (err) {
        console.warn('Payslip logo rasterize failed; PDF may omit logo', err);
      }
    })
  );
}

async function renderPayslipCanvas(element: HTMLElement) {
  await preparePayslipImages(element);
  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    imageTimeout: 15000,
    logging: false,
  });
}

function canvasToPdf(canvas: HTMLCanvasElement) {
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 6;

  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;

  let imgWidth = maxWidth;
  let imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight > maxHeight) {
    imgHeight = maxHeight;
    imgWidth = (canvas.width * imgHeight) / canvas.height;
  }

  const x = (pageWidth - imgWidth) / 2;
  const y = margin;

  pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
  return pdf;
}

/** Render payslip element to PDF with tight top alignment (no vertical centering gap). */
export async function downloadSalarySlipPdf(element: HTMLElement, filename: string) {
  const canvas = await renderPayslipCanvas(element);
  const pdf = canvasToPdf(canvas);
  pdf.save(filename);
}

/** Same visual PDF as Download — returned as Blob + base64 for email send. */
export async function buildSalarySlipPdfPayload(element: HTMLElement): Promise<SalarySlipPdfResult> {
  const canvas = await renderPayslipCanvas(element);
  const pdf = canvasToPdf(canvas);
  const dataUrl = pdf.output('datauristring');
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const blob = pdf.output('blob');
  return { blob, base64, dataUrl };
}
