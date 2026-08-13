import assert from 'node:assert/strict';
import { open, readdir } from 'node:fs/promises';
import { test } from 'node:test';

import { SHIPS } from './ships.js';

const SHIP_ASSETS_DIR = new URL('../../../assets/ships/', import.meta.url);
const SHIP_ASSET_FILENAMES = [
    'illustration.svg',
    'schematic-bottom.svg',
    'schematic-top.svg',
] as const;

test('ship illustrations and schematics follow the catalogue symbols one for one', async () => {
    const entries = await readdir(SHIP_ASSETS_DIR, { withFileTypes: true });
    const assetSymbols = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    const catalogueSymbols = SHIPS.map((ship) => ship.symbol).sort();

    assert.deepEqual(assetSymbols, catalogueSymbols);

    for (const symbol of catalogueSymbols) {
        const shipDirectory = new URL(`${symbol}/`, SHIP_ASSETS_DIR);
        assert.deepEqual((await readdir(shipDirectory)).sort(), SHIP_ASSET_FILENAMES, symbol);

        for (const filename of SHIP_ASSET_FILENAMES) {
            const asset = await open(new URL(filename, shipDirectory));
            try {
                const { size } = await asset.stat();
                assert.ok(size > 0, `${symbol}/${filename} is empty`);

                const prefix = Buffer.alloc(Math.min(size, 256));
                await asset.read(prefix, 0, prefix.length, 0);
                assert.match(
                    prefix.toString(),
                    /<svg[^>]+viewBox="0 0 1200 800"/,
                    `${symbol}/${filename} has an unexpected SVG canvas`,
                );

                const suffix = Buffer.alloc(Math.min(size, 256));
                await asset.read(suffix, 0, suffix.length, size - suffix.length);
                assert.match(
                    suffix.toString(),
                    /<\/svg>\s*$/,
                    `${symbol}/${filename} is incomplete`,
                );
            } finally {
                await asset.close();
            }
        }
    }
});
