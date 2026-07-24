/** Types for `./jsonc.mjs`, which is plain JS so the Node hook can load it directly. */

import type { LoadHookSync } from 'node:module';

/** See `jsonc.mjs` — blanks `//` and block comments, leaving valid JSON. */
export declare function stripJsonComments(source: string): string;

/** Synchronous `load` hook serving `.jsonc` files as JSON modules. */
export declare const load: LoadHookSync;
