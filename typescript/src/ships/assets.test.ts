import assert from 'node:assert/strict';
import { open, readdir } from 'node:fs/promises';
import { test } from 'node:test';

import { SHIPS } from './ships.js';

const SHIP_ASSETS_DIR = new URL('../../../assets/ships/', import.meta.url);

test('ship illustrations follow the catalogue symbols one for one', async () => {
    const entries = await readdir(SHIP_ASSETS_DIR, { withFileTypes: true });
    const assetSymbols = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    const catalogueSymbols = SHIPS.map((ship) => ship.symbol).sort();

    assert.deepEqual(assetSymbols, catalogueSymbols);

    for (const symbol of catalogueSymbols) {
        const shipDirectory = new URL(`${symbol}/`, SHIP_ASSETS_DIR);
        assert.deepEqual(await readdir(shipDirectory), ['illustration.svg'], symbol);

        const illustration = await open(new URL('illustration.svg', shipDirectory));
        try {
            const { size } = await illustration.stat();
            assert.ok(size > 0, `${symbol} has an empty illustration`);

            const prefix = Buffer.alloc(Math.min(size, 256));
            await illustration.read(prefix, 0, prefix.length, 0);
            assert.match(
                prefix.toString(),
                /<svg[^>]+viewBox="0 0 1200 800"/,
                `${symbol} has an unexpected SVG canvas`,
            );

            const suffix = Buffer.alloc(Math.min(size, 256));
            await illustration.read(suffix, 0, suffix.length, size - suffix.length);
            assert.match(suffix.toString(), /<\/svg>\s*$/, `${symbol} has an incomplete SVG`);
        } finally {
            await illustration.close();
        }
    }
});
