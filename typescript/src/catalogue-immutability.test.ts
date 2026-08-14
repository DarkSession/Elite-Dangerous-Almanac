import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CODEX_REGIONS } from './astro/codex-region.js';
import { GALAXY_ORIGIN } from './astro/galaxy-grid.js';
import { HAND_AUTHORED_REGIONS } from './astro/hand-authored-regions.js';
import { getHandAuthoredRegionOrigin } from './astro/naming-region-origins.js';
import { ALL_NEBULAE } from './astro/nebulae-all.js';
import { PLANETARY_NEBULAE } from './astro/nebulae-planetary.js';
import { PROCGEN_NEBULAE } from './astro/nebulae-procgen.js';
import { REAL_NEBULAE } from './astro/nebulae-real.js';
import { PERMIT_LOCKED_REGIONS } from './astro/permit-locked-regions.js';
import { PERMIT_LOCKED_SYSTEMS } from './astro/permit-locked-systems.js';
import { ALL_MATERIALS } from './materials/materials-all.js';
import { RAW_MATERIALS } from './materials/materials-raw.js';
import { MANUFACTURED_MATERIALS } from './materials/materials-manufactured.js';
import { ENCODED_MATERIALS } from './materials/materials-encoded.js';
import { ALL_MICRO_RESOURCES } from './materials/micro-resources-all.js';
import { COMPONENT_MICRO_RESOURCES } from './materials/micro-resources-component.js';
import { CONSUMABLE_MICRO_RESOURCES } from './materials/micro-resources-consumable.js';
import { DATA_MICRO_RESOURCES } from './materials/micro-resources-data.js';
import { ITEM_MICRO_RESOURCES } from './materials/micro-resources-item.js';
import { SUITS } from './equipment/suits.js';
import { PERSONAL_WEAPONS } from './equipment/weapons.js';
import { PERSONAL_UPGRADE_COSTS } from './equipment/upgrade-costs.js';
import { PERSONAL_MODIFICATIONS } from './equipment/modifications.js';
import { PERSONAL_MODIFICATION_COSTS } from './equipment/modification-costs.js';
import { ALL_MODULES } from './ships/modules-all.js';
import { CORE_MODULES } from './ships/modules-core.js';
import { INTERNAL_MODULES } from './ships/modules-internal.js';
import { HARDPOINT_MODULES } from './ships/modules-hardpoint.js';
import { UTILITY_MODULES } from './ships/modules-utility.js';
import { SHIPS } from './ships/ships.js';
import { SHIP_GUNSIGHTS } from './ships/gunsights.js';
import { DEFAULT_LOADOUTS } from './ships/default-loadouts.js';
import { BLUEPRINT_COSTS } from './ships/blueprint-costs.js';
import { BLUEPRINTS } from './ships/blueprints.js';
import { DECORATIVE_MODIFICATIONS } from './ships/decorative-modifications.js';
import { ENGINEERING_OPTION_GROUPS } from './ships/engineering-options.js';
import { EXPERIMENTAL_EFFECT_COSTS } from './ships/experimental-effect-costs.js';
import { EXPERIMENTAL_EFFECTS } from './ships/experimental-effects.js';
import { PRE_ENGINEERED_MODULES } from './ships/pre-engineered.js';
import { SLOT_RESTRICTION_LABELS } from './ships/slots.js';
import { ALL_COMMODITIES } from './commodities/commodities-all.js';
import { COMMODITIES } from './commodities/commodities-standard.js';
import { RARE_COMMODITIES } from './commodities/commodities-rare.js';

function assertDeeplyFrozen(value: unknown, path: string, seen = new Set<object>()): void {
    if (typeof value !== 'object' || value === null || seen.has(value)) return;

    seen.add(value);
    assert.equal(Object.isFrozen(value), true, `${path} is not frozen`);
    for (const [key, child] of Object.entries(value)) {
        assertDeeplyFrozen(child, `${path}.${key}`, seen);
    }
}

test('every published catalogue and all of its nested records are frozen', () => {
    // Keep every public catalogue here, including split catalogues and keyed records.
    // These module singletons are shared by every consumer. Mutating a record would
    // affect later callers and could leave a lookup's prebuilt key index inconsistent.
    const catalogues: readonly (readonly [name: string, value: object])[] = [
        ['CODEX_REGIONS', CODEX_REGIONS],
        ['GALAXY_ORIGIN', GALAXY_ORIGIN],
        ['HAND_AUTHORED_REGIONS', HAND_AUTHORED_REGIONS],
        ['ALL_NEBULAE', ALL_NEBULAE],
        ['PLANETARY_NEBULAE', PLANETARY_NEBULAE],
        ['PROCGEN_NEBULAE', PROCGEN_NEBULAE],
        ['REAL_NEBULAE', REAL_NEBULAE],
        ['PERMIT_LOCKED_REGIONS', PERMIT_LOCKED_REGIONS],
        ['PERMIT_LOCKED_SYSTEMS', PERMIT_LOCKED_SYSTEMS],
        ['ALL_MATERIALS', ALL_MATERIALS],
        ['RAW_MATERIALS', RAW_MATERIALS],
        ['MANUFACTURED_MATERIALS', MANUFACTURED_MATERIALS],
        ['ENCODED_MATERIALS', ENCODED_MATERIALS],
        ['ALL_MICRO_RESOURCES', ALL_MICRO_RESOURCES],
        ['COMPONENT_MICRO_RESOURCES', COMPONENT_MICRO_RESOURCES],
        ['CONSUMABLE_MICRO_RESOURCES', CONSUMABLE_MICRO_RESOURCES],
        ['DATA_MICRO_RESOURCES', DATA_MICRO_RESOURCES],
        ['ITEM_MICRO_RESOURCES', ITEM_MICRO_RESOURCES],
        ['SUITS', SUITS],
        ['PERSONAL_WEAPONS', PERSONAL_WEAPONS],
        ['PERSONAL_UPGRADE_COSTS', PERSONAL_UPGRADE_COSTS],
        ['PERSONAL_MODIFICATIONS', PERSONAL_MODIFICATIONS],
        ['PERSONAL_MODIFICATION_COSTS', PERSONAL_MODIFICATION_COSTS],
        ['ALL_MODULES', ALL_MODULES],
        ['CORE_MODULES', CORE_MODULES],
        ['INTERNAL_MODULES', INTERNAL_MODULES],
        ['HARDPOINT_MODULES', HARDPOINT_MODULES],
        ['UTILITY_MODULES', UTILITY_MODULES],
        ['SHIPS', SHIPS],
        ['SHIP_GUNSIGHTS', SHIP_GUNSIGHTS],
        ['DEFAULT_LOADOUTS', DEFAULT_LOADOUTS],
        ['BLUEPRINT_COSTS', BLUEPRINT_COSTS],
        ['BLUEPRINTS', BLUEPRINTS],
        ['DECORATIVE_MODIFICATIONS', DECORATIVE_MODIFICATIONS],
        ['ENGINEERING_OPTION_GROUPS', ENGINEERING_OPTION_GROUPS],
        ['EXPERIMENTAL_EFFECT_COSTS', EXPERIMENTAL_EFFECT_COSTS],
        ['EXPERIMENTAL_EFFECTS', EXPERIMENTAL_EFFECTS],
        ['PRE_ENGINEERED_MODULES', PRE_ENGINEERED_MODULES],
        ['SLOT_RESTRICTION_LABELS', SLOT_RESTRICTION_LABELS],
        ['ALL_COMMODITIES', ALL_COMMODITIES],
        ['COMMODITIES', COMMODITIES],
        ['RARE_COMMODITIES', RARE_COMMODITIES],
    ];

    for (const [name, catalogue] of catalogues) assertDeeplyFrozen(catalogue, name);
});

test('exported lookup records are frozen too, not only the array catalogues', () => {
    // `setModule` builds its refusal message from this table, so a consumer able to
    // mutate it could silently rewrite the library's own error text.
    assert.equal(Object.isFrozen(SLOT_RESTRICTION_LABELS), true);
    assert.throws(
        () => Object.assign(SLOT_RESTRICTION_LABELS, { mining: 'anything at all' }),
        TypeError,
    );
    assert.equal(SLOT_RESTRICTION_LABELS.mining, 'mining tools');
});

test('computed named origins are frozen', () => {
    const origin = getHandAuthoredRegionOrigin('Pleiades Sector');
    assert.ok(origin);
    assert.equal(Object.isFrozen(origin), true);
});

test('consumer mutation attempts fail instead of changing later lookups', () => {
    const ship = SHIPS[0]!;
    const originalName = ship.name;

    assert.throws(() => Object.assign(ship, { name: 'Changed' }), TypeError);
    assert.throws(() => Array.prototype.push.call(SHIPS, ship), TypeError);
    assert.equal(SHIPS[0]!.name, originalName);
});
