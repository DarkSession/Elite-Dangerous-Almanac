/**
 * Guards the shared `data/i18n/*.jsonc` files themselves: portable strict JSON,
 * provenance in the comment header, schema coverage, and valid name-key references.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import blueprintNamesData from '../../../data/i18n/blueprint-names.jsonc' with { type: 'json' };
import effectNamesData from '../../../data/i18n/experimental-effect-names.jsonc' with { type: 'json' };
import effectDescriptionsData from '../../../data/i18n/experimental-effect-descriptions.jsonc' with { type: 'json' };
import engineeringGroupNamesData from '../../../data/i18n/engineering-group-names.jsonc' with { type: 'json' };
import moduleFamilyNamesData from '../../../data/i18n/module-family-names.jsonc' with { type: 'json' };
import materialNamesData from '../../../data/i18n/material-names.jsonc' with { type: 'json' };
import microResourceNamesData from '../../../data/i18n/micro-resource-names.jsonc' with { type: 'json' };
import moduleNamesData from '../../../data/i18n/module-names.jsonc' with { type: 'json' };
import preEngineeredNamesData from '../../../data/i18n/pre-engineered-variant-names.jsonc' with { type: 'json' };
import shipManufacturerNamesData from '../../../data/i18n/ship-manufacturer-names.jsonc' with { type: 'json' };
import shipNamesData from '../../../data/i18n/ship-names.jsonc' with { type: 'json' };
import materialsEncodedData from '../../../data/materials/materials-encoded.jsonc' with { type: 'json' };
import materialsManufacturedData from '../../../data/materials/materials-manufactured.jsonc' with { type: 'json' };
import materialsRawData from '../../../data/materials/materials-raw.jsonc' with { type: 'json' };
import microResourcesComponentData from '../../../data/materials/micro-resources-component.jsonc' with { type: 'json' };
import microResourcesConsumableData from '../../../data/materials/micro-resources-consumable.jsonc' with { type: 'json' };
import microResourcesDataData from '../../../data/materials/micro-resources-data.jsonc' with { type: 'json' };
import microResourcesItemData from '../../../data/materials/micro-resources-item.jsonc' with { type: 'json' };
import blueprintsData from '../../../data/ships/blueprints.jsonc' with { type: 'json' };
import effectsData from '../../../data/ships/experimental-effects.jsonc' with { type: 'json' };
import engineeringOptionsData from '../../../data/ships/engineering-options.jsonc' with { type: 'json' };
import moduleFamiliesData from '../../../data/ships/module-families.jsonc' with { type: 'json' };
import coreModulesData from '../../../data/ships/modules-core.jsonc' with { type: 'json' };
import hardpointModulesData from '../../../data/ships/modules-hardpoint.jsonc' with { type: 'json' };
import internalModulesData from '../../../data/ships/modules-internal.jsonc' with { type: 'json' };
import utilityModulesData from '../../../data/ships/modules-utility.jsonc' with { type: 'json' };
import preEngineeredData from '../../../data/ships/pre-engineered.jsonc' with { type: 'json' };
import shipsData from '../../../data/ships/ships.jsonc' with { type: 'json' };
import { registerCatalogueDataTests } from '../internal/catalogue-data-tests.js';
import type { CatalogueLocale } from './locale.js';
import type { LocalizedNameCatalogue, LocalizedNameMap } from './internal/localized-name.js';

const DEFINITION_BY_FILE: Readonly<Record<string, string>> = {
    'blueprint-names.jsonc': 'localizedNameMap',
    'experimental-effect-names.jsonc': 'localizedNameMap',
    'experimental-effect-descriptions.jsonc': 'localizedNameMap',
    'engineering-group-names.jsonc': 'localizedNameMap',
    'material-names.jsonc': 'localizedNameMap',
    'micro-resource-names.jsonc': 'localizedNameMap',
    'module-family-names.jsonc': 'localizedNameMap',
    'module-names.jsonc': 'localizedNameCatalogue',
    'pre-engineered-variant-names.jsonc': 'localizedNameCatalogue',
    'ship-manufacturer-names.jsonc': 'localizedNameMap',
    'ship-names.jsonc': 'localizedNameMap',
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

test('every deduplicated pre-engineered identity resolves to one used name record', () => {
    const catalogue = preEngineeredNamesData as LocalizedNameCatalogue;
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

interface ShipValue extends NamedSymbol {
    readonly manufacturer: string;
}

interface EngineeringOptionsData {
    readonly groups: Readonly<Record<string, NamedValue>>;
}

interface PreEngineeredValue extends NamedSymbol {
    readonly blueprintSymbol: string;
    readonly experimentalEffectSymbol?: string;
    readonly acquisition: string;
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

test('new display text stays aligned with its owning ships catalogues', () => {
    const ships = shipsData as readonly ShipValue[];
    const groups = (engineeringOptionsData as EngineeringOptionsData).groups;
    const variants = preEngineeredData as readonly PreEngineeredValue[];

    assertDirectEnglishNames(
        shipNamesData as LocalizedNameMap,
        Object.fromEntries(ships.map(({ symbol, name }) => [symbol, name])),
    );
    assertDirectEnglishNames(
        shipManufacturerNamesData as LocalizedNameMap,
        Object.fromEntries(ships.map(({ symbol, manufacturer }) => [symbol, manufacturer])),
    );
    assertDirectEnglishNames(
        engineeringGroupNamesData as LocalizedNameMap,
        Object.fromEntries(Object.entries(groups).map(([groupId, group]) => [groupId, group.name])),
    );
    assertDirectEnglishNames(
        moduleFamilyNamesData as LocalizedNameMap,
        moduleFamiliesData as Readonly<Record<string, string>>,
    );
    assertEnglishNames(
        preEngineeredNamesData as LocalizedNameCatalogue,
        Object.fromEntries(
            variants.map((variant) => [
                [
                    variant.symbol,
                    variant.blueprintSymbol,
                    variant.experimentalEffectSymbol ?? '',
                    variant.acquisition,
                ].join('|'),
                variant.name,
            ]),
        ),
    );
});

const STORED_LOCALES: readonly CatalogueLocale[] = ['en', 'de', 'es', 'fr', 'pt', 'ru'];

test('experimental-effect descriptions cover the effect registry in every locale', () => {
    const effects = effectsData as Readonly<Record<string, NamedValue>>;
    const descriptions = effectDescriptionsData as LocalizedNameMap;

    // The descriptions are the game's own display prose, not a projection of the
    // mechanical `description` the ships catalogue carries, so this asserts the key set
    // and the locale coverage rather than string equality with that field.
    assert.deepEqual(Object.keys(descriptions).sort(), Object.keys(effects).sort());
    for (const [experimentalEffectSymbol, record] of Object.entries(descriptions)) {
        for (const locale of STORED_LOCALES) {
            assert.equal(
                typeof record[locale],
                'string',
                `${experimentalEffectSymbol} has no ${locale} description`,
            );
        }
    }
});

test('English names and symbols stay aligned with every owning materials catalogue', () => {
    const materials = [
        ...(materialsRawData as readonly NamedSymbol[]),
        ...(materialsManufacturedData as readonly NamedSymbol[]),
        ...(materialsEncodedData as readonly NamedSymbol[]),
    ];
    const microResources = [
        ...(microResourcesComponentData as readonly NamedSymbol[]),
        ...(microResourcesConsumableData as readonly NamedSymbol[]),
        ...(microResourcesDataData as readonly NamedSymbol[]),
        ...(microResourcesItemData as readonly NamedSymbol[]),
    ];

    assertDirectEnglishNames(
        materialNamesData as LocalizedNameMap,
        Object.fromEntries(materials.map(({ symbol, name }) => [symbol, name])),
    );
    assertDirectEnglishNames(
        microResourceNamesData as LocalizedNameMap,
        Object.fromEntries(microResources.map(({ symbol, name }) => [symbol, name])),
    );
});
