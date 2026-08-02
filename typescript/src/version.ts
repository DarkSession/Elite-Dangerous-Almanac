/**
 * The published version of this package.
 *
 * Kept as a constant rather than read from `package.json` so the manifest is never
 * inlined into a consumer's bundle. `src/version.test.ts` asserts the two agree, so a
 * release that bumps one without the other fails the suite.
 *
 * @internal
 */
export const LIBRARY_VERSION = '0.0.1';

/**
 * The name this package publishes under — the `appName` a SLEF export made by this
 * library identifies itself with.
 *
 * @internal
 */
export const LIBRARY_NAME = '@elite-dangerous-almanac/core';
