/**
 * Types the shared `data/**\/*.jsonc` imports.
 *
 * The data files are JSONC (attribution lives in a comment header, out of the
 * parsed payload and therefore out of consumers' bundles), so TypeScript cannot
 * infer their shape the way `resolveJsonModule` does for `.json`. The default
 * export is `unknown`, which forces each consuming module to state the shape it
 * expects with an explicit cast next to its own interfaces — the same casts the
 * astro modules already carried when these were `.json`.
 *
 * Comment stripping happens at load time: `scripts/jsonc.mjs`, wired into the
 * test runner via `scripts/register-jsonc.mjs` and into the build via an esbuild
 * plugin in `tsup.config.ts`.
 */
declare module '*.jsonc' {
    const value: unknown;
    export default value;
}
