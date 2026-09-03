/**
 * Guards the shared `data/i18n/*.jsonc` files themselves: portable strict JSON,
 * provenance in the comment header, schema coverage, and valid name-key references.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import standardCommoditiesData from '../../../data/commodities/commodities.jsonc' with { type: 'json' };
import rareCommoditiesData from '../../../data/commodities/rare-commodities.jsonc' with { type: 'json' };
import modificationsData from '../../../data/equipment/modifications.jsonc' with { type: 'json' };
import suitsData from '../../../data/equipment/suits.jsonc' with { type: 'json' };
import toolsData from '../../../data/equipment/tools.jsonc' with { type: 'json' };
import personalWeaponsData from '../../../data/equipment/weapons.jsonc' with { type: 'json' };
import blueprintNamesData from '../../../data/i18n/blueprint-names.jsonc' with { type: 'json' };
import commodityNamesData from '../../../data/i18n/commodity-names.jsonc' with { type: 'json' };
import effectNamesData from '../../../data/i18n/experimental-effect-names.jsonc' with { type: 'json' };
import effectDescriptionsData from '../../../data/i18n/experimental-effect-descriptions.jsonc' with { type: 'json' };
import moduleFamilyNamesData from '../../../data/i18n/module-family-names.jsonc' with { type: 'json' };
import materialNamesData from '../../../data/i18n/material-names.jsonc' with { type: 'json' };
import microResourceNamesData from '../../../data/i18n/micro-resource-names.jsonc' with { type: 'json' };
import moduleNamesData from '../../../data/i18n/module-names.jsonc' with { type: 'json' };
import personalModificationDescriptionsData from '../../../data/i18n/personal-modification-descriptions.jsonc' with { type: 'json' };
import personalModificationNamesData from '../../../data/i18n/personal-modification-names.jsonc' with { type: 'json' };
import personalToolNamesData from '../../../data/i18n/personal-tool-names.jsonc' with { type: 'json' };
import personalWeaponDescriptionsData from '../../../data/i18n/personal-weapon-descriptions.jsonc' with { type: 'json' };
import preEngineeredNamesData from '../../../data/i18n/pre-engineered-variant-names.jsonc' with { type: 'json' };
import suitDescriptionsData from '../../../data/i18n/suit-descriptions.jsonc' with { type: 'json' };
import suitNamesData from '../../../data/i18n/suit-names.jsonc' with { type: 'json' };
import materialsEncodedData from '../../../data/materials/materials-encoded.jsonc' with { type: 'json' };
import materialsManufacturedData from '../../../data/materials/materials-manufactured.jsonc' with { type: 'json' };
import materialsRawData from '../../../data/materials/materials-raw.jsonc' with { type: 'json' };
import microResourcesComponentData from '../../../data/materials/micro-resources-component.jsonc' with { type: 'json' };
import microResourcesConsumableData from '../../../data/materials/micro-resources-consumable.jsonc' with { type: 'json' };
import microResourcesDataData from '../../../data/materials/micro-resources-data.jsonc' with { type: 'json' };
import microResourcesItemData from '../../../data/materials/micro-resources-item.jsonc' with { type: 'json' };
import blueprintsData from '../../../data/ships/blueprints.jsonc' with { type: 'json' };
import effectsData from '../../../data/ships/experimental-effects.jsonc' with { type: 'json' };
import moduleFamiliesData from '../../../data/ships/module-families.jsonc' with { type: 'json' };
import coreModulesData from '../../../data/ships/modules-core.jsonc' with { type: 'json' };
import hardpointModulesData from '../../../data/ships/modules-hardpoint.jsonc' with { type: 'json' };
import internalModulesData from '../../../data/ships/modules-internal.jsonc' with { type: 'json' };
import utilityModulesData from '../../../data/ships/modules-utility.jsonc' with { type: 'json' };
import preEngineeredData from '../../../data/ships/pre-engineered.jsonc' with { type: 'json' };
import { registerCatalogueDataTests } from '../internal/catalogue-data-tests.js';
import type { CatalogueLocale } from './locale.js';
import type { LocalizedNameCatalogue, LocalizedNameMap } from './internal/localized-name.js';

const DEFINITION_BY_FILE: Readonly<Record<string, string>> = {
    'blueprint-names.jsonc': 'localizedNameMap',
    'commodity-names.jsonc': 'localizedNameMap',
    'experimental-effect-names.jsonc': 'localizedNameMap',
    'experimental-effect-descriptions.jsonc': 'localizedNameMap',
    'material-names.jsonc': 'localizedNameMap',
    'micro-resource-names.jsonc': 'localizedNameMap',
    'module-family-names.jsonc': 'localizedNameMap',
    'module-names.jsonc': 'localizedNameCatalogue',
    'personal-modification-descriptions.jsonc': 'localizedNameCatalogue',
    'personal-modification-names.jsonc': 'localizedNameCatalogue',
    'personal-tool-names.jsonc': 'localizedNameMap',
    'personal-weapon-descriptions.jsonc': 'localizedNameMap',
    'pre-engineered-variant-names.jsonc': 'localizedNameCatalogue',
    'suit-descriptions.jsonc': 'localizedNameCatalogue',
    'suit-names.jsonc': 'localizedNameCatalogue',
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
    const variants = preEngineeredData as readonly PreEngineeredValue[];

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

test('English names and symbols stay aligned with both owning commodity catalogues', () => {
    const commodities = [
        ...(standardCommoditiesData as readonly NamedSymbol[]),
        ...(rareCommoditiesData as readonly NamedSymbol[]),
    ];

    assertDirectEnglishNames(
        commodityNamesData as LocalizedNameMap,
        Object.fromEntries(commodities.map(({ symbol, name }) => [symbol, name])),
    );
    assertCompleteDirectLocales(commodityNamesData as LocalizedNameMap, 'commodity-names.jsonc');
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

interface SuitValue {
    readonly family: string;
    readonly name: string;
    readonly grades: Readonly<Record<string, { readonly symbol: string }>>;
}

/** Every identifier a personal-suit catalogue is keyed by: the family and each grade symbol. */
function suitIdentifiers(suit: SuitValue): readonly string[] {
    const symbols = Object.values(suit.grades).map((grade) => grade.symbol);
    return [suit.family, ...symbols.filter((symbol) => symbol !== suit.family)];
}

/** Assert that every record of a deduplicated catalogue carries all six stored locales. */
function assertCompleteLocales(catalogue: LocalizedNameCatalogue, file: string): void {
    for (const [key, record] of Object.entries(catalogue.names)) {
        for (const locale of STORED_LOCALES) {
            assert.equal(typeof record[locale], 'string', `${file}: ${key} has no ${locale} value`);
        }
    }
}

/** Assert that every record of a directly keyed catalogue carries all six stored locales. */
function assertCompleteDirectLocales(catalogue: LocalizedNameMap, file: string): void {
    for (const [key, record] of Object.entries(catalogue)) {
        for (const locale of STORED_LOCALES) {
            assert.equal(typeof record[locale], 'string', `${file}: ${key} has no ${locale} value`);
        }
    }
}

interface NamedId {
    readonly id: string;
    readonly name: string;
}

test('English names and identifiers stay aligned with every owning equipment catalogue', () => {
    const suits = suitsData as readonly SuitValue[];
    const modifications = modificationsData as Readonly<Record<string, NamedValue>>;
    const tools = toolsData as readonly NamedId[];

    assertEnglishNames(
        suitNamesData as LocalizedNameCatalogue,
        Object.fromEntries(
            suits.flatMap((suit) =>
                suitIdentifiers(suit).map((identifier) => [identifier, suit.name]),
            ),
        ),
    );
    assertEnglishNames(
        personalModificationNamesData as LocalizedNameCatalogue,
        Object.fromEntries(Object.entries(modifications).map(([key, value]) => [key, value.name])),
    );
    // A tool is keyed by this library's own id: Frontier publishes no item symbol for one.
    assertDirectEnglishNames(
        personalToolNamesData as LocalizedNameMap,
        Object.fromEntries(tools.map(({ id, name }) => [id, name])),
    );
});

test('personal-equipment display text covers its owning catalogues in every locale', () => {
    const suits = suitsData as readonly SuitValue[];
    const weapons = personalWeaponsData as readonly NamedSymbol[];
    const modifications = modificationsData as Readonly<Record<string, NamedValue>>;
    const suitDescriptions = suitDescriptionsData as LocalizedNameCatalogue;

    // The descriptions are the game's own display prose rather than a projection of any
    // field the equipment catalogues carry, so this asserts the key set and the locale
    // coverage rather than string equality with one of them.
    assert.deepEqual(
        Object.keys(suitDescriptions.nameKeys).sort(),
        suits.flatMap(suitIdentifiers).sort(),
    );
    assert.deepEqual(
        Object.keys(personalWeaponDescriptionsData as LocalizedNameMap).sort(),
        weapons.map(({ symbol }) => symbol).sort(),
    );
    assert.deepEqual(
        Object.keys(
            (personalModificationDescriptionsData as LocalizedNameCatalogue).nameKeys,
        ).sort(),
        Object.keys(modifications).sort(),
    );

    assertCompleteLocales(suitNamesData as LocalizedNameCatalogue, 'suit-names.jsonc');
    assertCompleteLocales(suitDescriptions, 'suit-descriptions.jsonc');
    assertCompleteDirectLocales(
        personalWeaponDescriptionsData as LocalizedNameMap,
        'personal-weapon-descriptions.jsonc',
    );
    assertCompleteLocales(
        personalModificationNamesData as LocalizedNameCatalogue,
        'personal-modification-names.jsonc',
    );
    assertCompleteLocales(
        personalModificationDescriptionsData as LocalizedNameCatalogue,
        'personal-modification-descriptions.jsonc',
    );
    assertCompleteDirectLocales(
        personalToolNamesData as LocalizedNameMap,
        'personal-tool-names.jsonc',
    );
});

test('every deduplicated personal-equipment identifier resolves to one used record', () => {
    for (const [file, catalogue] of Object.entries({
        'suit-names.jsonc': suitNamesData as LocalizedNameCatalogue,
        'suit-descriptions.jsonc': suitDescriptionsData as LocalizedNameCatalogue,
        'personal-modification-names.jsonc':
            personalModificationNamesData as LocalizedNameCatalogue,
        'personal-modification-descriptions.jsonc':
            personalModificationDescriptionsData as LocalizedNameCatalogue,
    })) {
        const usedKeys = new Set(Object.values(catalogue.nameKeys));
        assert.deepEqual([...usedKeys].sort(), Object.keys(catalogue.names).sort(), file);
    }
});
