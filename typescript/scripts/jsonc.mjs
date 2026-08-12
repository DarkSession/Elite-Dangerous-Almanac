/**
 * JSONC support for the shared `data/` and `fixtures/` files.
 *
 * Both carry their prose as a comment header rather than as a payload key — a
 * catalogue's attribution, a fixture's provenance — so the words sit where a
 * reader meets the data and never reach a consumer's bundle. That makes them
 * JSONC, which neither `JSON.parse` nor esbuild's `json` loader accepts, so the
 * test runner and the build strip comments through this module first.
 *
 * Consumed by:
 * - `scripts/register-jsonc.mjs` — synchronous Node module hook, used by `npm test`.
 * - `tsup.config.ts` — esbuild `onLoad` plugin, used by `npm run build`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Replaces `//` line comments and block comments with whitespace, leaving
 * valid JSON.
 *
 * Comments are blanked rather than deleted, and newlines inside block comments
 * are kept, so byte offsets and line numbers are unchanged — a `JSON.parse`
 * error still points at the right place in the original file.
 *
 * Handles comments only. Trailing commas — the other JSONC extension — are left
 * alone so they still fail loudly instead of being silently accepted in files
 * that other language implementations have to parse too.
 *
 * @param {string} source Raw JSONC text.
 * @returns {string} The same text with every comment blanked out.
 */
export function stripJsonComments(source) {
    let out = '';
    let i = 0;
    const n = source.length;

    while (i < n) {
        const ch = source[i];

        // Copy strings verbatim — a "//" inside one is data, not a comment.
        if (ch === '"') {
            let j = i + 1;
            while (j < n) {
                if (source[j] === '\\') {
                    j += 2;
                    continue;
                }
                if (source[j] === '"') {
                    j += 1;
                    break;
                }
                j += 1;
            }
            out += source.slice(i, j);
            i = j;
            continue;
        }

        if (ch === '/' && source[i + 1] === '/') {
            let j = i;
            while (j < n && source[j] !== '\n') j += 1;
            out += ' '.repeat(j - i);
            i = j;
            continue;
        }

        if (ch === '/' && source[i + 1] === '*') {
            const end = source.indexOf('*/', i + 2);
            const j = end === -1 ? n : end + 2;
            for (let k = i; k < j; k += 1) out += source[k] === '\n' ? '\n' : ' ';
            i = j;
            continue;
        }

        out += ch;
        i += 1;
    }

    return out;
}

/**
 * Synchronous module-customization `load` hook that serves `.jsonc` files as
 * JSON modules.
 *
 * Registered through `module.registerHooks` (not `module.register`) to share
 * tsx's in-thread hook chain — see
 * `scripts/register-jsonc.mjs` for why that matters. Being synchronous, it reads
 * the file with `readFileSync`.
 *
 * @type {import('node:module').LoadHookSync}
 */
export function load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.jsonc')) {
        const source = readFileSync(fileURLToPath(url), 'utf8');
        return { format: 'json', source: stripJsonComments(source), shortCircuit: true };
    }
    return nextLoad(url, context);
}
