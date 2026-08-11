import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripJsonComments } from '../../scripts/jsonc.mjs';

const SCRIPT = fileURLToPath(
    new URL('../../../scripts/data/ships/merge-normalized-catalogues.mjs', import.meta.url),
);

test('the final catalogue join projects engineering groups into module kinds', () => {
    const directory = mkdtempSync(join(tmpdir(), 'eda-catalogue-'));
    const input = (name: string, value: unknown): string => {
        const path = join(directory, name);
        writeFileSync(path, JSON.stringify(value));
        return path;
    };
    try {
        const out = join(directory, 'out');
        // The derivation preserves existing attribution headers, so seed its five outputs.
        mkdirSync(out);
        for (const name of [
            'ships.jsonc',
            'modules-core.jsonc',
            'modules-internal.jsonc',
            'modules-hardpoint.jsonc',
            'modules-utility.jsonc',
        ]) {
            writeFileSync(join(out, name), '/* fixture attribution */\n[]\n');
        }

        const empty = input('empty.json', []);
        const command = [
            SCRIPT,
            '--ship-identities',
            input('ships.json', [{ symbol: 'TestShip', name: 'Test ship' }]),
            '--ship-stats',
            empty,
            '--ship-slots',
            empty,
            '--core-identities',
            input('core.json', [
                {
                    symbol: 'Int_Grouped',
                    kind: 'staleKind',
                    name: 'Grouped',
                    class: 1,
                    rating: 'A',
                },
                {
                    symbol: 'Int_Ungrouped',
                    kind: 'staleKind',
                    name: 'Ungrouped',
                    class: 1,
                    rating: 'E',
                },
            ]),
            '--core-stats',
            empty,
            '--internal-identities',
            empty,
            '--internal-stats',
            empty,
            '--hardpoint-identities',
            empty,
            '--hardpoint-stats',
            empty,
            '--utility-identities',
            empty,
            '--utility-stats',
            empty,
            '--engineering-options',
            input('engineering.jsonc', {
                groups: { testKind: { name: 'Test', blueprints: [], experimentals: [] } },
                modules: { Int_Grouped: 'testKind' },
            }),
            '--out',
            out,
        ];
        execFileSync(process.execPath, command);

        const modules = JSON.parse(
            stripJsonComments(readFileSync(join(out, 'modules-core.jsonc'), 'utf8')),
        ) as readonly Record<string, unknown>[];
        assert.equal(modules[0]?.kind, 'testKind');
        assert.equal(Object.hasOwn(modules[1]!, 'kind'), false);

        const inheritedGroup = input('inherited-group.json', {
            groups: {},
            modules: { Int_Grouped: 'toString' },
        });
        const inheritedCommand = [...command];
        inheritedCommand[inheritedCommand.indexOf('--engineering-options') + 1] = inheritedGroup;
        assert.throws(
            () => execFileSync(process.execPath, inheritedCommand, { stdio: 'pipe' }),
            /names unknown group toString/,
        );
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
