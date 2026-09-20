import { GameApp } from '@/app';
import { createLogger, setLogLevel } from '@/utils/logger';
import { webglAvailable } from '@/utils/platform';

const log = createLogger('main');

const loading = document.getElementById('boot-loading');
const loadingFill = document.getElementById('boot-loading-fill');
const loadingLabel = document.getElementById('boot-loading-label');

function setProgress(progress: number, label?: string): void {
  if (loadingFill) loadingFill.style.width = `${Math.round(progress * 100)}%`;
  if (loadingLabel && label) loadingLabel.textContent = label;
}

function hideLoading(): void {
  if (!loading) return;
  loading.classList.add('is-hidden');
  window.setTimeout(() => loading.remove(), 600);
}

function showFatal(title: string, message: string, error?: unknown): void {
  log.error(title, error);
  const box = document.createElement('div');
  box.className = 'gf-fatal__box';
  box.style.cssText =
    'max-width:460px;padding:26px 28px;text-align:center;background:rgba(16,20,26,0.9);' +
    'border:1px solid rgba(255,255,255,0.09);border-radius:14px;color:#f3f5f8;' +
    'font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif';
  box.innerHTML = `<h2 style="margin:0 0 10px;font-weight:500">${title}</h2>
    <p style="margin:0;color:#99a2ad;font-size:13px">${message}</p>`;
  if (error) {
    const code = document.createElement('code');
    code.style.cssText =
      'display:block;margin-top:12px;padding:10px;border-radius:8px;background:rgba(255,255,255,0.05);' +
      'color:#d98477;font-size:11px;text-align:left;white-space:pre-wrap';
    code.textContent = error instanceof Error ? error.stack ?? error.message : String(error);
    box.append(code);
  }
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;' +
    'padding:24px;background:rgba(7,9,12,0.95)';
  overlay.append(box);
  loading?.remove();
  document.body.append(overlay);
}

async function main(): Promise<void> {
  setLogLevel(import.meta.env.DEV ? 'debug' : 'warn');

  const canvas = document.getElementById('glue-canvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Canvas element #glue-canvas is missing');

  if (!webglAvailable()) {
    showFatal(
      'WebGL unavailable',
      'Glue Flip needs WebGL to render. Try a recent version of Chrome, Firefox, Safari or Edge with hardware acceleration enabled.',
    );
    return;
  }

  setProgress(0.02, 'Starting');
  const app = await GameApp.boot(canvas, setProgress);
  app.start();

  // Handy handle for debugging from the console without exposing internals
  // through module scope.
  (window as unknown as { glueFlip?: GameApp }).glueFlip = app;

  window.addEventListener('pagehide', () => {
    app.save.persist();
  });

  hideLoading();
  log.info('ready');
}

main().catch((error: unknown) => {
  showFatal(
    'Something went wrong while starting',
    'The game could not initialise. Reloading usually fixes it.',
    error,
  );
});
