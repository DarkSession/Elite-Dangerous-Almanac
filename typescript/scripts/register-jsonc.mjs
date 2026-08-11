/**
 * Registers the synchronous `.jsonc` load hook from `./jsonc.mjs`, which serves
 * both the shared `data/` catalogues and the shared `fixtures/`.
 *
 * Used by `npm test` as `node --import tsx --import ./scripts/register-jsonc.mjs`.
 *
 * Registered through `module.registerHooks` (synchronous, in-thread), *not*
 * `module.register`. tsx installs its own load hook synchronously via
 * `module.registerHooks` on Node >= 22.22.3 (and the equivalent 24/25 lines).
 * Synchronous hooks run ahead of anything registered with the asynchronous
 * `module.register`, so an async hook here would let tsx's esbuild loader claim
 * `.jsonc` URLs first and fail with "Do not know how to load path". Staying in
 * the same synchronous chain — and, because hooks run in reverse registration
 * order, imported *after* tsx — gives this hook first refusal on `.jsonc`.
 */

import { registerHooks } from 'node:module';

import { load } from './jsonc.mjs';

registerHooks({ load });
