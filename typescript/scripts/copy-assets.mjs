#!/usr/bin/env node

/**
 * Copy the repository's canonical ship assets into the npm package directory.
 *
 * Shared assets stay at the repository root so future language implementations use
 * the same files. npm can only pack files inside `typescript/`, so the build creates
 * a git-ignored, byte-identical package copy. Edit `assets/`, never the generated copy.
 */

import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = new URL('../../assets/ships/', import.meta.url);
const packageAssets = new URL('../assets/', import.meta.url);
const target = new URL('ships/', packageAssets);

await rm(packageAssets, { recursive: true, force: true });
await mkdir(packageAssets, { recursive: true });
await cp(source, target, { recursive: true });

console.log(`copied ${fileURLToPath(source)} -> ${fileURLToPath(target)}`);
