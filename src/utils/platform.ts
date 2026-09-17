/** Device / environment detection helpers. */

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function isTouchDevice(): boolean {
  if (!isBrowser()) return false;
  return (
    'ontouchstart' in window ||
    (navigator.maxTouchPoints ?? 0) > 0 ||
    window.matchMedia?.('(pointer: coarse)').matches === true
  );
}

export function isMobileUA(): boolean {
  if (!isBrowser()) return false;
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
}

export function isSmallScreen(): boolean {
  if (!isBrowser()) return false;
  return Math.min(window.innerWidth, window.innerHeight) < 560;
}

export function isPortrait(): boolean {
  if (!isBrowser()) return true;
  return window.innerHeight >= window.innerWidth;
}

export function prefersReducedMotion(): boolean {
  if (!isBrowser()) return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function supportsVibration(): boolean {
  return isBrowser() && typeof navigator.vibrate === 'function';
}

export function vibrate(pattern: number | number[]): void {
  if (!supportsVibration()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw when called without a user gesture */
  }
}

export function webglAvailable(): boolean {
  if (!isBrowser()) return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

/** iOS Safari needs a user gesture before the AudioContext can start. */
export function needsAudioGesture(): boolean {
  return isBrowser() && /iP(hone|ad|od)|Safari/.test(navigator.userAgent);
}
