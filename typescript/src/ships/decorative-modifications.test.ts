import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    DECORATIVE_MODIFICATIONS,
    getDecorativeModification,
    getDecorativeModificationsForModule,
    isDecorativeModification,
} from './decorative-modifications.js';
import { getBlueprint, BLUEPRINTS } from './blueprints.js';
import {
    ENGINEERING_OPTION_GROUPS,
    getBlueprintsForModule,
    getEngineeringGroup,
} from './engineering-options.js';
import { blueprintAvailableFor } from './loadout-engineering.js';
import { resolveBlueprintForModule } from './blueprint-journal.js';
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import { ShipLoadout } from './ship-loadout.js';
import fixture from '../../../fixtures/ships/engineering.json' with { type: 'json' };

const decorative = fixture.decorativeModifications;
const ids = decorative.ids.map((row) => row.id);

test('the three ids a real journal writes all resolve, and carry the colour they spell', () => {
    // These are ids a commander's own storage carries, so resolving them is the whole
    // job: `getBlueprint` answering `null` for one is correct and is not the same answer
    // as "unknown id", and this catalogue is what separates the two.
    assert.deepEqual(Object.keys(DECORATIVE_MODIFICATIONS), ids);
    for (const row of decorative.ids) {
        assert.equal(getDecorativeModification(row.id)?.name, row.name);
        assert.ok(isDecorativeModification(row.id), `${row.id} must be a decorative id`);
        // A journal spelling is whatever the game felt like; every lookup is
        // case-insensitive and trims, so a raw value goes straight in.
        assert.equal(getDecorativeModification(`  ${row.id.toUpperCase()} `)?.name, row.name);
    }
    assert.equal(getDecorativeModification('FSD_LongRange'), null);
    assert.equal(isDecorativeModification('Weapon_Efficient'), false);
});

test('a decorative modification is a livery, so no recipe and no menu anywhere holds one', () => {
    for (const id of ids) {
        assert.equal(getBlueprint(id), null, `${id} must not be a blueprint`);
        assert.ok(!Object.hasOwn(BLUEPRINTS, id));
        for (const [group, { blueprints }] of Object.entries(ENGINEERING_OPTION_GROUPS)) {
            assert.ok(
                !blueprints.some((b) => b.toLowerCase() === id.toLowerCase()),
                `group ${group} offers ${id}`,
            );
        }
    }
});

test('every module symbol stored is a module the catalogues carry', () => {
    // `modules` is what `getDecorativeModificationsForModule` joins on, so a symbol that
    // matches nothing would make it answer `[]` for a module that does carry the livery —
    // an empty answer being a legitimate one is exactly what hides the typo.
    for (const [id, record] of Object.entries(DECORATIVE_MODIFICATIONS)) {
        assert.ok(record.modules.length > 0, `${id} names no module`);
        for (const symbol of record.modules) {
            assert.ok(getModuleBySymbol(symbol, ALL_MODULES), `${id}: ${symbol} is not a module`);
            assert.ok(
                getDecorativeModificationsForModule(symbol).includes(id),
                `${symbol} does not join back to ${id}`,
            );
        }
    }
});

test('the launcher observed carrying them is engineerable by nothing all the same', () => {
    // EDSY leaves this launcher with Decorative entries and no blueprint, which reads as
    // `noblueprints` precisely because a Decorative entry is not a blueprint: no engineer
    // applies one, so a launcher left with only those entries is offering nothing.
    const symbol = decorative.module;
    assert.ok(getModuleBySymbol(symbol, ALL_MODULES), `${symbol} is not a module`);
    assert.equal(getEngineeringGroup(symbol), null);
    assert.deepEqual(getBlueprintsForModule(symbol), []);
    assert.deepEqual(getDecorativeModificationsForModule(symbol), ids);
    // Case-insensitive, and a module no capture shows carrying one answers empty rather
    // than null — "none seen", not "cannot have one".
    assert.deepEqual(getDecorativeModificationsForModule(` ${symbol.toLowerCase()} `), ids);
    assert.deepEqual(getDecorativeModificationsForModule('Hpt_BeamLaser_Fixed_Small'), []);
});

test('the engineering gate refuses a decorative id, and says what it is', () => {
    const symbol = decorative.module;
    for (const id of ids) {
        // Nothing rewrites the id on the way through: it names no recipe on any menu.
        assert.equal(resolveBlueprintForModule(symbol, id), id);
        assert.ok(!blueprintAvailableFor(symbol, id), `the gate must refuse ${id}`);
    }
    const build = ShipLoadout.empty('Anaconda').setModule(
        'MediumHardpoint1',
        getModuleBySymbol(symbol, ALL_MODULES)!,
    );
    // A TypeError naming the livery, not a RangeError about a grade that never existed:
    // the id is real, and the refusal has to read that way.
    assert.throws(
        () => build.applyBlueprint('MediumHardpoint1', ids[0]!, { grade: 1 }),
        (error: unknown) => {
            assert.ok(error instanceof TypeError);
            assert.match(error.message, /is a decorative modification, not a blueprint/);
            return true;
        },
    );
});

test('the catalogue and its records are frozen', () => {
    assert.equal(Object.isFrozen(DECORATIVE_MODIFICATIONS), true);
    for (const record of Object.values(DECORATIVE_MODIFICATIONS)) {
        assert.equal(Object.isFrozen(record), true);
        assert.equal(Object.isFrozen(record.modules), true);
    }
    assert.throws(
        () => Object.assign(DECORATIVE_MODIFICATIONS, { Decorative_Blue: {} }),
        TypeError,
    );
});
