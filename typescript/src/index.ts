/**
 * Elite Dangerous Almanac — ready-to-go static data and calculations for
 * community apps and researchers.
 *
 * The root entry point re-exports each feature area's general API. Large data-backed
 * modules stay on explicit subpaths, and all symbols are available from their individual
 * modules. Prefer a subpath import (e.g. `@elite-dangerous-almanac/core/astro`) so
 * consumers only bundle the slice they use.
 *
 * @packageDocumentation
 */

export * from './astro/index.js';
export * from './ships/index.js';
export * from './materials/index.js';
export * from './commodities/index.js';
