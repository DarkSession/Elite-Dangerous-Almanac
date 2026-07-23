/**
 * Registers the `.jsonc` load hook from `./jsonc.mjs`.
 *
 * Used by `npm test` as `node --import tsx --import ./scripts/register-jsonc.mjs`.
 * The order matters: Node runs `load` hooks in reverse registration order, so
 * this must be registered *after* tsx for it to get first refusal on `.jsonc`
 * URLs. Registered before tsx, tsx's esbuild hook claims them first and fails
 * with "Do not know how to load path".
 */

import { register } from 'node:module';

register('./jsonc.mjs', import.meta.url);
