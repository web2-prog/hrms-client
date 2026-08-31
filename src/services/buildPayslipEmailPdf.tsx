import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { SalarySlipPreview } from '../components/SalarySlipPreview';
import { buildSalarySlipPdfPayload } from './salarySlipPdf';
import { getSalaryPdfFilename, type SalarySlipFormData } from './salarySlipDefaults';

function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll('img'));
  if (!images.length) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          // complete can be true for broken SVGs (naturalWidth === 0) — still wait for a real paint.
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          // Safety: don't block email forever if logo never paints.
          window.setTimeout(done, 8000);
        })
    )
  );
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/**
 * Build the same PDF as View / Download PDF from a payslip form.
 * Renders an off-screen SalarySlipPreview so Send mail matches the UI design.
 */
export async function buildPayslipPdfBase64FromForm(form: SalarySlipFormData): Promise<{
  base64: string;
  filename: string;
}> {
  const host = document.createElement('div');
  host.setAttribute('data-payslip-capture', '1');
  host.style.cssText =
    'position:fixed;left:-12000px;top:0;width:794px;background:#ffffff;z-index:-1;pointer-events:none;';
  document.body.appendChild(host);

  let root: Root | null = null;
  try {
    root = createRoot(host);
    root.render(createElement(SalarySlipPreview, { form }));
    await nextFrame();
    const el = host.querySelector('.payslip') as HTMLElement | null;
    if (!el) throw new Error('Could not render salary slip for email PDF');
    await waitForImages(el);
    await nextFrame();
    const { base64 } = await buildSalarySlipPdfPayload(el);
    return { base64, filename: getSalaryPdfFilename(form) };
  } finally {
    try {
      root?.unmount();
    } catch {
      /* ignore */
    }
    host.remove();
  }
}
