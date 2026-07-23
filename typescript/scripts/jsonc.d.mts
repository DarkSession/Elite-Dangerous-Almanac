/** Types for `./jsonc.mjs`, which is plain JS so the Node hook can load it directly. */

/** See `jsonc.mjs` — blanks `//` and block comments, leaving valid JSON. */
export declare function stripJsonComments(source: string): string;

/** Node module-customization `load` hook serving `.jsonc` files as JSON modules. */
export declare const load: import('node:module').LoadHook;
