import assert from 'node:assert/strict';
import { test } from 'node:test';

import fixture from '../../../fixtures/i18n/names.jsonc' with { type: 'json' };
import { getBlueprintName } from './blueprints.js';
import { getExperimentalEffectName } from './experimental-effects.js';
import { getExperimentalEffectDescription } from './experimental-effect-descriptions.js';
import { getEngineeringGroupName } from './engineering-groups.js';
import { getOutfittingFamilyName } from './module-families.js';
import { getMaterialName } from './materials.js';
import { getMicroResourceName } from './micro-resources.js';
import { getModuleName } from './modules.js';
import { getShipManufacturer, getShipName } from './ships.js';

type LookupKind =
    | 'module'
    | 'blueprint'
    | 'experimentalEffect'
    | 'material'
    | 'microResource'
    | 'ship'
    | 'shipManufacturer'
    | 'engineeringGroup'
    | 'outfittingFamily'
    | 'experimentalEffectDescription';
type NameLookup = (identifier: string, locale: string) => string | null;

const LOOKUP_BY_KIND: Readonly<Record<LookupKind, NameLookup>> = {
    module: getModuleName,
    blueprint: getBlueprintName,
    experimentalEffect: getExperimentalEffectName,
    material: getMaterialName,
    microResource: getMicroResourceName,
    ship: getShipName,
    shipManufacturer: getShipManufacturer,
    engineeringGroup: getEngineeringGroupName,
    outfittingFamily: getOutfittingFamilyName,
    experimentalEffectDescription: getExperimentalEffectDescription,
};

for (const lookup of fixture.lookups) {
    test(`${lookup.kind} ${lookup.identifier} in ${lookup.locale}`, () => {
        assert.equal(
            LOOKUP_BY_KIND[lookup.kind as LookupKind](lookup.identifier, lookup.locale),
            lookup.expected,
        );
    });
}

test('English regional tags return the owning catalogues canonical names', () => {
    assert.equal(getModuleName(' int_hyperdrive_size6_class5 ', 'en_GB'), 'Frame Shift Drive');
    assert.equal(getBlueprintName(' fsd_longrange ', 'en-AU'), 'Increased range');
    assert.equal(getExperimentalEffectName(' SPECIAL_FSD_HEAVY ', 'en'), 'Mass Manager');
    assert.equal(getMaterialName(' tellurium ', 'en-CA'), 'Tellurium');
    assert.equal(getMicroResourceName(' GRAPHENE ', 'en-US'), 'Graphene');
});

test('a regional or script tag resolves to its stored language', () => {
    // Every stored locale is a bare language tag, so the subtag is dropped, not matched.
    assert.equal(getModuleName('Int_Hyperdrive_Size6_Class5', 'de_AT'), 'Frameshiftantrieb');
    assert.equal(getBlueprintName('FSD_LongRange', 'fr-CA'), 'Portée FSD améliorée');
    assert.equal(getMaterialName('Mercury', 'es-419'), 'Mercurio');
});

test('a language the catalogues no longer carry is a miss', () => {
    // Italian, Hungarian, Georgian and Simplified Chinese are published by the sources
    // and deliberately not stored.
    for (const locale of ['it', 'hu', 'ka', 'zh', 'zh-CN', 'zh-Hans']) {
        assert.equal(getModuleName('Int_Hyperdrive_Size6_Class5', locale), null, locale);
    }
});

test('unknown and empty locales are sparse misses', () => {
    assert.equal(getModuleName('Int_Hyperdrive_Size6_Class5', ''), null);
    assert.equal(getModuleName('Int_Hyperdrive_Size6_Class5', '  klingon-KL  '), null);
    assert.equal(getModuleName('Int_Hyperdrive_Size6_Class5', 'toString'), null);
});

test('nullish identifiers are misses, while present non-strings are rejected', () => {
    assert.equal(getBlueprintName(null as never, 'en'), null);
    assert.equal(getModuleName(undefined as never, 'de'), null);
    assert.equal(getMicroResourceName(undefined as never, 'fr'), null);
    assert.throws(
        () => getBlueprintName(42 as never, 'en'),
        /getBlueprintName: fdname must be a string/,
    );
});

test('a locale must be a string', () => {
    assert.throws(
        () => getExperimentalEffectName('special_fsd_heavy', null as never),
        /getExperimentalEffectName: locale must be a string/,
    );
});
