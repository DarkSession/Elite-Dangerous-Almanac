/**
 * Guards the shared `data/i18n/*.jsonc` files themselves: portable strict JSON,
 * provenance in the comment header, schema coverage, and valid name-key references.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import blueprintNamesData from '../../../data/i18n/blueprint-names.jsonc' with { type: 'json' };
import effectNamesData from '../../../data/i18n/experimental-effect-names.jsonc' with { type: 'json' };
import moduleNamesData from '../../../data/i18n/module-names.jsonc' with { type: 'json' };
import blueprintsData from '../../../data/ships/blueprints.jsonc' with { type: 'json' };
import effectsData from '../../../data/ships/experimental-effects.jsonc' with { type: 'json' };
import coreModulesData from '../../../data/ships/modules-core.jsonc' with { type: 'json' };
import hardpointModulesData from '../../../data/ships/modules-hardpoint.jsonc' with { type: 'json' };
import internalModulesData from '../../../data/ships/modules-internal.jsonc' with { type: 'json' };
import utilityModulesData from '../../../data/ships/modules-utility.jsonc' with { type: 'json' };
import { registerCatalogueDataTests } from '../internal/catalogue-data-tests.js';
import type { LocalizedNameCatalogue, LocalizedNameMap } from './internal/localized-name.js';

const DEFINITION_BY_FILE: Readonly<Record<string, string>> = {
    'blueprint-names.jsonc': 'localizedNameMap',
    'experimental-effect-names.jsonc': 'localizedNameMap',
    'module-names.jsonc': 'localizedNameCatalogue',
};

registerCatalogueDataTests({
    domain: 'i18n',
    definitions: DEFINITION_BY_FILE,
});

test('every deduplicated module identifier resolves to one used name record', () => {
    const catalogue = moduleNamesData as LocalizedNameCatalogue;
    const usedKeys = new Set(Object.values(catalogue.nameKeys));
    assert.deepEqual([...usedKeys].sort(), Object.keys(catalogue.names).sort());
});

interface NamedSymbol {
    readonly symbol: string;
    readonly name: string;
}

interface NamedValue {
    readonly name: string;
}

function assertEnglishNames(
    catalogue: LocalizedNameCatalogue,
    expected: Readonly<Record<string, string>>,
): void {
    assert.deepEqual(Object.keys(catalogue.nameKeys).sort(), Object.keys(expected).sort());
    for (const [identifier, name] of Object.entries(expected)) {
        const key = catalogue.nameKeys[identifier];
        assert.ok(key, `${identifier} has no localized-name key`);
        assert.equal(catalogue.names[key]?.en, name, identifier);
    }
}

function assertDirectEnglishNames(
    catalogue: LocalizedNameMap,
    expected: Readonly<Record<string, string>>,
): void {
    assert.deepEqual(Object.keys(catalogue).sort(), Object.keys(expected).sort());
    for (const [identifier, name] of Object.entries(expected)) {
        assert.equal(catalogue[identifier]?.en, name, identifier);
    }
}

test('English names and identifiers stay aligned with every owning ships catalogue', () => {
    const modules = [
        ...(coreModulesData as readonly NamedSymbol[]),
        ...(internalModulesData as readonly NamedSymbol[]),
        ...(hardpointModulesData as readonly NamedSymbol[]),
        ...(utilityModulesData as readonly NamedSymbol[]),
    ];
    const blueprints = blueprintsData as Readonly<Record<string, NamedValue>>;
    const effects = effectsData as Readonly<Record<string, NamedValue>>;

    assertEnglishNames(
        moduleNamesData as LocalizedNameCatalogue,
        Object.fromEntries(modules.map(({ symbol, name }) => [symbol, name])),
    );
    assertDirectEnglishNames(
        blueprintNamesData as LocalizedNameMap,
        Object.fromEntries(Object.entries(blueprints).map(([key, value]) => [key, value.name])),
    );
    assertDirectEnglishNames(
        effectNamesData as LocalizedNameMap,
        Object.fromEntries(Object.entries(effects).map(([key, value]) => [key, value.name])),
    );
});
