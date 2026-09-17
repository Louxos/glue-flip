import { describe, expect, it } from 'vitest';

/**
 * Module smoke test.
 *
 * Imports every module of the application (except the DOM entry points, which
 * need a real document and canvas) and checks that it evaluates cleanly. This
 * catches the class of bug a type-check cannot see: a bad import specifier, a
 * circular import that resolves to `undefined`, or side-effect code that throws
 * at load time.
 */

const modules = import.meta.glob('../src/**/*.ts');

/** `main.ts` runs the boot sequence at module scope and needs a real document. */
const DOM_ENTRY_POINTS = ['../src/main.ts'];

describe('module graph', () => {
  const entries = Object.entries(modules).filter(
    ([path]) => !DOM_ENTRY_POINTS.includes(path),
  );

  it('discovers the source tree', () => {
    // Guard against the glob silently matching nothing.
    expect(entries.length).toBeGreaterThan(50);
  });

  it.each(entries)('%s evaluates without throwing', async (path, load) => {
    const mod = await load();
    expect(mod).toBeDefined();
  });
});
