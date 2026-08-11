import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeModifiers, rollsForGrade, sumMaterials } from './engineering.js';
import { getBlueprintCost } from './blueprint-costs.js';
import { getBlueprint, getBlueprintGrade, BLUEPRINTS } from './blueprints.js';
import { getExperimentalEffect, EXPERIMENTAL_EFFECTS } from './experimental-effects.js';
import {
    blueprintAvailableFor,
    experimentalAvailableFor,
    isEngineerable,
} from './internal/loadout-engineering.js';
import {
    getBlueprintsForModule,
    getEngineeringGroup,
    getExperimentalsForModule,
} from './engineering-options.js';
import { resolveBlueprintForModule } from './blueprint-journal.js';
import { getPreEngineeredVariants } from './pre-engineered.js';
import fixture from '../../../fixtures/ships/engineering.jsonc' with { type: 'json' };
import optionsFixture from '../../../fixtures/ships/engineering-options.jsonc' with { type: 'json' };
import corvetteJournal from '../../../fixtures/ships/journal-federation-corvette.jsonc' with { type: 'json' };
import caspianJournal from '../../../fixtures/ships/journal-caspian-explorer.jsonc' with { type: 'json' };
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import { baseStats } from './internal/module-stat-labels.js';
import { combinedRateOfFire } from './weapons.js';

const near = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps;
const modFor = (mods: { Label: string; Value?: number }[], label: string) =>
    mods.find((m) => m.Label === label)?.Value;

test('the catalogues hold the expected counts', () => {
    assert.equal(Object.keys(BLUEPRINTS).length, fixture.blueprintCount);
    assert.equal(Object.keys(EXPERIMENTAL_EFFECTS).length, fixture.experimentalCount);
});

test('blueprint-only modifications never resolve as experimental effects', () => {
    for (const [effectId, classification] of Object.entries(
        fixture.blueprintOnlyModifications.excludedExperimentalIds,
    )) {
        assert.equal(getExperimentalEffect(effectId), null, `${effectId} became an effect`);
        for (const [blueprintId, expectedName] of Object.entries(classification.blueprints)) {
            assert.equal(getBlueprint(blueprintId)?.name, expectedName, blueprintId);
        }
    }
});

test('the gate accepts every recipe the menu offers, for every module', () => {
    // The contract: "what can this module take?" and "may I put this on it?" read the
    // same catalogue, so no module can be offered a recipe that `applyBlueprint` refuses.
    for (const module of ALL_MODULES) {
        for (const fdname of getBlueprintsForModule(module.symbol)) {
            assert.ok(
                blueprintAvailableFor(module.symbol, fdname),
                `${module.symbol} is offered ${fdname} but the gate refuses it`,
            );
        }
        for (const effect of getExperimentalsForModule(module.symbol)) {
            assert.ok(
                experimentalAvailableFor(module.symbol, effect),
                `${module.symbol} is offered ${effect} but the gate refuses it`,
            );
        }
    }
});

test('every recipe in the catalogues reaches a module', () => {
    // Sweep every recipe id against every module through the compatibility gate. The
    // fixture pins both empty residues so a stranded id fails explicitly.
    const reach = fixture.reachability;
    const strandedBlueprints = Object.keys(BLUEPRINTS).filter(
        (id) => !ALL_MODULES.some((module) => blueprintAvailableFor(module.symbol, id)),
    );
    const strandedExperimentals = Object.keys(EXPERIMENTAL_EFFECTS).filter(
        (id) => !ALL_MODULES.some((module) => experimentalAvailableFor(module.symbol, id)),
    );
    assert.deepEqual(strandedBlueprints, reach.unreachableBlueprints);
    assert.deepEqual(strandedExperimentals, reach.unreachableExperimentals);

    // And each id that was rescued is rescued on the modules it belongs to, not everywhere:
    // reaching *something* satisfies the sweep above, so the count and a module that must
    // still refuse are what catch a menu row that widened into a neighbouring family. All
    // six are blueprints; an experimental has no route to a module but its group's menu.
    for (const row of reach.reachable) {
        assert.ok(blueprintAvailableFor(row.accepts, row.id), `${row.accepts}: ${row.id}`);
        assert.ok(!blueprintAvailableFor(row.refuses, row.id), `${row.refuses}: ${row.id}`);
        assert.equal(
            ALL_MODULES.filter((module) => blueprintAvailableFor(module.symbol, row.id)).length,
            row.modules,
            row.id,
        );
    }
});

test('a build that spells a modification generically is still engineered', () => {
    // The menu lists the family-specific id; an EDSY-authored build carries the generic
    // one. They are the same recipe, so both are accepted.
    assert.deepEqual(getBlueprintsForModule('Int_LifeSupport_Size4_Class2'), [
        'LifeSupport_LightWeight',
        'LifeSupport_Reinforced',
        'LifeSupport_Shielded',
    ]);
    for (const generic of ['Misc_LightWeight', 'Misc_Reinforced', 'Misc_Shielded']) {
        assert.ok(
            blueprintAvailableFor('Int_LifeSupport_Size4_Class2', generic),
            `life support must accept ${generic}`,
        );
    }
    assert.ok(blueprintAvailableFor('Int_Repairer_Size3_Class5', 'Misc_Shielded'));
    assert.ok(
        blueprintAvailableFor('Int_DroneControl_Collection_Size3_Class3', 'Misc_LightWeight'),
    );

    // The alias runs one way only. `Misc_ChaffCapacity` and `Misc_HeatSinkCapacity` share
    // a signature — both "Ammo capacity" over the same labels — but neither is a family
    // spelling of the other, and their rolls differ.
    assert.ok(!blueprintAvailableFor('Hpt_HeatSinkLauncher_Turret_Tiny', 'Misc_ChaffCapacity'));
    assert.ok(!blueprintAvailableFor('Hpt_ChaffLauncher_Tiny', 'Misc_HeatSinkCapacity'));
    // A weapon's Lightweight cuts distributor draw, so the signature keeps it apart.
    assert.ok(!blueprintAvailableFor('Hpt_PulseLaser_Fixed_Small', 'Misc_LightWeight'));
    // And a family-specific id never widens to another family.
    assert.ok(
        !blueprintAvailableFor(
            'Int_DroneControl_Collection_Size3_Class3',
            'LifeSupport_LightWeight',
        ),
    );
});

test('the gate accepts what the menu omits only by a pinned alias or a non-final sale', () => {
    // Three things beyond the menu may explain an acceptance, and nothing else may: the
    // generic spelling of a recipe the menu lists under a family's name, the journal
    // colliding journal spelling of an offered blueprint, and a recipe the module
    // is sold already carrying and is not final. Anything else means the gate has quietly widened.
    const pinned = new Set(
        Object.entries(optionsFixture.corpus.blueprintAliases).flatMap(([generic, specific]) =>
            specific.map((id) => `${generic.toLowerCase()}|${id.toLowerCase()}`),
        ),
    );
    for (const [fdname, journalName] of Object.entries(fixture.journalNames.map)) {
        pinned.add(`${journalName.toLowerCase()}|${fdname.toLowerCase()}`);
    }
    const seen = new Set<string>();
    for (const module of ALL_MODULES) {
        const offered = getBlueprintsForModule(module.symbol);
        if (offered.length === 0) continue;
        const sold = new Set(
            getPreEngineeredVariants(module.symbol)
                .filter((variant) => !variant.engineeringLocked)
                .map((variant) => variant.blueprint.toLowerCase()),
        );
        for (const fdname of Object.keys(BLUEPRINTS)) {
            if (offered.includes(fdname)) continue;
            if (!blueprintAvailableFor(module.symbol, fdname)) continue;
            if (sold.has(fdname.toLowerCase())) continue;
            const matched = offered.filter((id) =>
                pinned.has(`${fdname.toLowerCase()}|${id.toLowerCase()}`),
            );
            assert.equal(
                matched.length,
                1,
                `${module.symbol} accepts "${fdname}", which neither a pinned alias nor a non-final pre-engineered sale explains`,
            );
            seen.add(`${fdname.toLowerCase()}|${matched[0]!.toLowerCase()}`);
        }
    }
    // ...and every alias the fixture pins is one the gate actually honours.
    assert.deepEqual([...seen].sort(), [...pinned].sort());
});

test('one journal id rolls the recipe the fitted module actually takes', () => {
    // Long Range and Wide Angle exist on the sensor suite and on the utility scanners, the
    // game writes the same `BlueprintName` for both, and the two roll different stats in
    // opposite directions. Reading the id alone would charge a wake scanner mass where the
    // game charges power draw — so the module resolves it, and the fixture pins both sides.
    const collision = fixture.scannerIdCollision;
    for (const expected of collision.cases) {
        const module = getModuleBySymbol(expected.symbol, ALL_MODULES)!;
        const base = baseStats(module);
        for (const [label, value] of Object.entries(expected.base)) {
            assert.equal(base[label], value, `${expected.symbol}: ${label}`);
        }
        const resolved = resolveBlueprintForModule(expected.symbol, expected.blueprint);
        assert.equal(resolved, expected.resolved, `${expected.symbol}: ${expected.blueprint}`);
        assert.ok(
            blueprintAvailableFor(expected.symbol, expected.blueprint),
            `${expected.symbol} must accept ${expected.blueprint}`,
        );
        assert.deepEqual(
            computeModifiers(
                base,
                getBlueprintGrade(resolved, collision.grade)!,
                collision.quality,
            ),
            expected.modifiers,
            `${expected.symbol}: ${expected.blueprint}`,
        );
    }
    // The same id on the two families is not the same set of stats — which is the whole
    // reason the resolution has to exist. Read from the library, not from the fixture rows
    // above, so this fails on a regression rather than on a fixture edit.
    const legsFor = (symbol: string, id: string) =>
        getBlueprintGrade(resolveBlueprintForModule(symbol, id), collision.grade)!
            .features.map((feature) => feature.label)
            .sort();
    assert.notDeepEqual(
        legsFor('Int_Sensors_Size4_Class5', 'Sensor_LongRange'),
        legsFor('Hpt_CloudScanner_Size0_Class5', 'Sensor_LongRange'),
    );
    assert.notDeepEqual(
        legsFor('Int_Sensors_Size4_Class5', 'Sensor_WideAngle'),
        legsFor('Hpt_CloudScanner_Size0_Class5', 'Sensor_WideAngle'),
    );
    // Resolution runs into a menu, never out of one: a sensor suite is not thereby offered
    // the scanner's spelling.
    for (const row of collision.refused) {
        assert.ok(
            !blueprintAvailableFor(row.symbol, row.blueprint),
            `${row.symbol} must refuse ${row.blueprint}`,
        );
    }
});

test('one journal id rolls a clip penalty on a multi-cannon and none on the other weapons', () => {
    // The same mechanism as the scanner ids above, on the family that actually meets it.
    // Pinned as whole modifier blocks rather than as availability, because the defect this
    // guards against is the leg going quietly missing again: dropping `AmmoClipSize` from
    // `MC_Overcharged` would leave every menu, count and reachability assertion passing.
    const collision = fixture.overchargedIdCollision;
    for (const expected of collision.cases) {
        const module = getModuleBySymbol(expected.symbol, ALL_MODULES)!;
        const base = baseStats(module);
        for (const [label, value] of Object.entries(expected.base)) {
            assert.equal(base[label], value, `${expected.symbol}: ${label}`);
        }
        const resolved = resolveBlueprintForModule(expected.symbol, expected.blueprint);
        assert.equal(resolved, expected.resolved, `${expected.symbol}: ${expected.blueprint}`);
        assert.ok(
            blueprintAvailableFor(expected.symbol, expected.blueprint),
            `${expected.symbol} must accept ${expected.blueprint}`,
        );
        assert.deepEqual(
            computeModifiers(
                base,
                getBlueprintGrade(resolved, collision.grade)!,
                collision.quality,
            ),
            expected.modifiers,
            `${expected.symbol}: ${expected.blueprint}`,
        );
    }
    // Every one of these weapons carries a clip, so the difference is the recipe and not
    // the module — which is the whole reason the two blueprint records exist. Read from the
    // library, so this fails on a regression rather than on a fixture edit.
    const legs = (symbol: string) =>
        getBlueprintGrade(resolveBlueprintForModule(symbol, 'Weapon_Overcharged'), 5)!
            .features.map((feature) => feature.label)
            .sort();
    for (const symbol of [
        'Hpt_Cannon_Fixed_Medium',
        'Hpt_Slugshot_Fixed_Medium',
        'Hpt_PlasmaAccelerator_Fixed_Medium',
    ]) {
        assert.ok(baseStats(getModuleBySymbol(symbol, ALL_MODULES)!)['AmmoClipSize'], symbol);
        assert.notDeepEqual(legs('Hpt_MultiCannon_Fixed_Medium'), legs(symbol), symbol);
    }
    // An anti-xeno multi-cannon rolls the same recipe as an ordinary one. coriolis-data
    // carries no blueprint list for an anti-xeno group, so this row is EDSY's alone — its
    // single Overcharged carries the clip leg wherever it is offered.
    assert.deepEqual(legs('Hpt_ATMultiCannon_Gimbal_Medium'), legs('Hpt_MultiCannon_Fixed_Medium'));
    // Resolution runs into a menu, never out of one: no other weapon is thereby offered the
    // multi-cannon's spelling.
    for (const row of collision.refused) {
        assert.ok(
            !blueprintAvailableFor(row.symbol, row.blueprint),
            `${row.symbol} must refuse ${row.blueprint}`,
        );
    }
});

test('the spellings a real journal writes all resolve to a recipe', () => {
    // Read off a `StoredModules` capture rather than off a registry, so it catches an id
    // the registries spell differently from the game. `GuardianModule_Sturdy` was one:
    // every menu listed an Inara `recipe_`-prefixed key for it, so a genuine journal id resolved to
    // nothing and `applyBlueprint` refused it on the module the capture shows carrying it.
    assert.ok(fixture.journalSpellings.cases.length, 'no spellings pinned');
    for (const row of fixture.journalSpellings.cases) {
        assert.equal(
            resolveBlueprintForModule(row.symbol, row.blueprint),
            row.resolved,
            `${row.symbol}: ${row.blueprint}`,
        );
        assert.ok(getBlueprint(row.resolved), `${row.resolved} is not a blueprint`);
        const final = getPreEngineeredVariants(row.symbol).some(
            (variant) =>
                variant.engineeringLocked &&
                variant.blueprint.toLowerCase() === row.blueprint.toLowerCase(),
        );
        assert.equal(
            blueprintAvailableFor(row.symbol, row.blueprint),
            !final,
            `${row.symbol}: ${row.blueprint}`,
        );
    }
    // The two registry spellings resolve as explicit aliases.
    const guardian = 'Hpt_Guardian_GaussCannon_Fixed_Medium';
    assert.ok(fixture.journalSpellings.alsoResolve.length, 'no aliases pinned');
    for (const id of fixture.journalSpellings.alsoResolve) {
        assert.ok(getBlueprint(id), `${id} must still look up`);
        assert.ok(blueprintAvailableFor(guardian, id), `${guardian} must accept ${id}`);
    }
    // ...but the menu answers with the id the game writes, not with a registry spelling.
    assert.ok(getBlueprintsForModule(guardian).includes('GuardianModule_Sturdy'));
    for (const id of fixture.journalSpellings.alsoResolve) {
        assert.ok(!getBlueprintsForModule(guardian).includes(id), `menu should not list ${id}`);
    }
});

test('only the two declared aliases carry the registry prefix no game data uses', () => {
    // Inara publishes the Operations recipes prefixed (`recipe_fuelscoop_efficiency`);
    // coriolis and EDSY use no such prefix, and neither does any observed build — a real
    // SLEF export writes the Mercenary reinforcement as `modulereinforcement_heavyduty`
    // (Inara lower-cases everything; the raw journal supplies the casing used here).
    // So the keys here are the registry id minus the prefix, and the only two that keep it
    // are declared aliases for a recipe whose real name is a key in its own right.
    const ops = fixture.journalSpellings.operationsKeys;
    assert.deepEqual(
        Object.keys(BLUEPRINTS).filter((k) => k.toLowerCase().startsWith('recipe_')),
        ops.prefixed,
    );
    for (const id of ops.prefixed) {
        assert.ok(getBlueprint(id), `${id} must still resolve`);
    }
    // The observed spelling resolves, is offered by no menu, and reaches its module by the
    // sale — the route a bought-engineered recipe is supposed to take.
    assert.ok(ops.observed.length, 'no observed Operations spelling pinned');
    for (const row of ops.observed) {
        assert.ok(getBlueprint(row.blueprint), `${row.blueprint} does not resolve`);
        assert.ok(
            getBlueprintGrade(row.blueprint, row.grade),
            `${row.blueprint} has no grade ${row.grade}`,
        );
        assert.ok(
            blueprintAvailableFor(row.symbol, row.blueprint),
            `${row.symbol} must accept ${row.blueprint}`,
        );
        assert.ok(!getBlueprintsForModule(row.symbol).includes(row.blueprint));
        assert.ok(
            getPreEngineeredVariants(row.symbol).some(
                (v) => v.blueprint.toLowerCase() === row.blueprint.toLowerCase(),
            ),
            `${row.symbol} is not sold carrying ${row.blueprint}`,
        );
        // Sold at grade 1, so the recipe recreates only what comes after the purchase.
        assert.equal(getBlueprintGrade(row.blueprint, row.soldAtGrade), null);
    }
});

test('a shared journal id costs the same whichever of its two recipes is priced', () => {
    // Why `getBlueprintCost` takes an id and no module: pricing the wrong one of a
    // collided pair still bills correctly. If upstream ever splits the recipes' costs,
    // this fails and the cost API needs the module too. Driven off the fixture's whole
    // `journalNames` map rather than a hand-listed pair or two, so a fourth collision is
    // covered the day it is recorded — the multi-cannon pair went uncovered for exactly
    // that reason.
    //
    // Each mapped journal id is a record in its own right and the pair defines the same
    // grades. Both are properties of these collisions; a future spelling that names no
    // twin belongs outside this loop rather than weakening the assertions.
    for (const [fdname, journalName] of Object.entries(fixture.journalNames.map)) {
        const shared = BLUEPRINTS[journalName];
        assert.ok(shared, `${fdname}: ${journalName} is not a blueprint`);
        const grades = Object.keys(BLUEPRINTS[fdname]!.grades);
        assert.deepEqual(grades, Object.keys(shared.grades), `${fdname} vs ${journalName}`);
        for (const grade of grades) {
            assert.deepEqual(
                getBlueprintCost(fdname, Number(grade)),
                getBlueprintCost(journalName, Number(grade)),
                `${fdname} vs ${journalName} G${grade}`,
            );
        }
    }
});

test('a recipe sold on one module is not thereby available on its neighbours', () => {
    // The pre-engineered route is per module, not per family: the Mercenary rail gun's
    // recipe resolves on the rail gun that ships with it and on nothing else.
    assert.ok(blueprintAvailableFor('Hpt_Railgun_Fixed_Medium', 'RailGun_LongShot'));
    assert.ok(!blueprintAvailableFor('Hpt_Railgun_Fixed_Small', 'RailGun_LongShot'));
    assert.ok(!blueprintAvailableFor('Hpt_MultiCannon_Fixed_Medium', 'RailGun_LongShot'));
    // A module with no engineering menu at all can still be sold carrying a recipe, and
    // the menu check must not refuse it first: the Mercenary Module Reinforcement Package
    // is the one such case, and reproducing its numbers is the whole point of this leg.
    assert.equal(getEngineeringGroup('Int_ModuleReinforcement_Size5_Class2'), null);
    assert.ok(
        blueprintAvailableFor(
            'Int_ModuleReinforcement_Size5_Class2',
            'ModuleReinforcement_HeavyDuty',
        ),
    );
    assert.ok(
        !blueprintAvailableFor(
            'Int_ModuleReinforcement_Size3_Class2',
            'ModuleReinforcement_HeavyDuty',
        ),
    );
});

test('a final Guardian sale does not widen the stock module menu', () => {
    const guardian = 'Hpt_Guardian_ShardCannon_Fixed_Medium';
    assert.deepEqual(getBlueprintsForModule(guardian), ['GuardianModule_Sturdy']);
    assert.ok(
        getPreEngineeredVariants(guardian).some(
            (variant) => variant.blueprint === 'Weapon_LongRange' && variant.engineeringLocked,
        ),
    );
    assert.ok(!blueprintAvailableFor(guardian, 'Weapon_LongRange'));
    assert.ok(blueprintAvailableFor(guardian, 'GuardianModule_Sturdy'));
});

test('the gate matches an id the way every other lookup does', () => {
    // `getBlueprint` has already accepted the id by the time the gate sees it, so the two
    // must agree on casing and whitespace — including down the alias path, which resolves
    // the id a second time.
    for (const id of [
        'Misc_LightWeight',
        'misc_lightweight',
        'MISC_LIGHTWEIGHT',
        ' Misc_LightWeight ',
    ]) {
        assert.ok(blueprintAvailableFor('Int_LifeSupport_Size4_Class2', id), JSON.stringify(id));
    }
    assert.ok(blueprintAvailableFor('Int_LifeSupport_Size4_Class2', 'lifesupport_lightweight'));
    // An Operations key too, whose casing this catalogue infers rather than observes — so
    // a caller carrying any casing of it must still be understood.
    assert.ok(blueprintAvailableFor('Hpt_Railgun_Fixed_Medium', 'RAILGUN_LONGSHOT'));
    // An id that is only a property of `Object.prototype` is not a blueprint.
    assert.ok(!blueprintAvailableFor('Int_LifeSupport_Size4_Class2', 'toString'));
});

test('a module no registry gives a menu takes no engineering', () => {
    assert.ok(!isEngineerable('Int_FuelTank_Size5_Class3'));
    assert.ok(!blueprintAvailableFor('Int_FuelTank_Size5_Class3', 'Misc_LightWeight'));
    assert.ok(!isEngineerable('Hpt_MRAScanner_Size0_Class1'));
    assert.ok(isEngineerable('Int_LifeSupport_Size4_Class2'));
});

test('computeModifiers reproduces the FSD Long Range G5 + Mass Manager anchor', () => {
    const a = fixture.anchor;
    const mods = computeModifiers(
        a.base,
        getBlueprintGrade(a.blueprint, a.grade)!,
        a.quality,
        getExperimentalEffect(a.experimental)!,
    );
    assert.ok(near(modFor(mods, 'FSDOptimalMass')!, a.expected.FSDOptimalMass), 'optmass');
    assert.ok(near(modFor(mods, 'Mass')!, a.expected.Mass), 'mass');
    assert.ok(near(modFor(mods, 'Integrity')!, a.expected.Integrity), 'integrity');
    assert.ok(near(modFor(mods, 'PowerDraw')!, a.expected.PowerDraw), 'power');
});

test('every modifier carries its original base value', () => {
    const a = fixture.anchor;
    const mods = computeModifiers(a.base, getBlueprintGrade(a.blueprint, a.grade)!, 1);
    assert.equal(mods.find((m) => m.Label === 'FSDOptimalMass')?.OriginalValue, 4670);
});

test('quality interpolates a feature between its min and max', () => {
    // FSD_LongRange G5 optmass spans [0.45, 0.55]; base 1000 -> 1450 / 1500 / 1550.
    const base = { FSDOptimalMass: 1000 };
    const g5 = getBlueprintGrade('FSD_LongRange', 5)!;
    assert.ok(near(modFor(computeModifiers(base, g5, 0), 'FSDOptimalMass')!, 1450));
    assert.ok(near(modFor(computeModifiers(base, g5, 0.5), 'FSDOptimalMass')!, 1500));
    assert.ok(near(modFor(computeModifiers(base, g5, 1), 'FSDOptimalMass')!, 1550));
});

test('a contribution to a stat not present in the base is skipped', () => {
    const mods = computeModifiers({ Mass: 100 }, [
        { label: 'Integrity', method: 'multiplicative', min: 0.5, max: 0.5 },
    ]);
    assert.equal(mods.length, 0);
});

test('additive and multiplicative methods differ', () => {
    const mult = computeModifiers({ X: 100 }, [
        { label: 'X', method: 'multiplicative', min: 0.1, max: 0.1 },
    ]);
    const add = computeModifiers({ X: 100 }, [
        { label: 'X', method: 'additive', min: 0.1, max: 0.1 },
    ]);
    assert.equal(modFor(mult, 'X'), 110);
    assert.equal(modFor(add, 'X'), 100.1);
});

test('each contribution keeps its own method on a label collision', () => {
    // A multiplicative blueprint feature and an additive experimental on one label:
    // multiply first (100 * 1.2 = 120), then add (120 + 5 = 125) — not 100*1.2*1.05.
    const mods = computeModifiers(
        { X: 100 },
        [{ label: 'X', method: 'multiplicative', min: 0.2, max: 0.2 }],
        1,
        [{ label: 'X', method: 'additive', value: 5 }],
    );
    assert.equal(modFor(mods, 'X'), 125);
});

test('quality outside [0, 1] is rejected', () => {
    const g5 = getBlueprintGrade('FSD_LongRange', 5)!;
    const base = { FSDOptimalMass: 1000 };
    assert.throws(() => computeModifiers(base, g5, 5), RangeError);
    assert.throws(() => computeModifiers(base, g5, -5), RangeError);
    assert.throws(() => computeModifiers(base, g5, Number.NaN), RangeError);
});

test('rollsForGrade returns grades 1–5 and rejects values outside that range', () => {
    assert.equal(rollsForGrade(1), 1);
    assert.equal(rollsForGrade(5), 5);
    assert.throws(() => rollsForGrade(0), RangeError);
    assert.throws(() => rollsForGrade(6), RangeError);
    assert.throws(() => rollsForGrade(-1), RangeError);
    assert.throws(() => rollsForGrade(2.5), RangeError);
});

test('sumMaterials folds lists together, combining by symbol case-insensitively', () => {
    const a = [
        { symbol: 'Iron', name: 'Iron', count: 2 },
        { symbol: 'Carbon', name: 'Carbon', count: 1 },
    ];
    const b = [{ symbol: 'iron', name: 'Iron', count: 3 }];
    assert.deepEqual(sumMaterials(a, b), [
        { symbol: 'Iron', name: 'Iron', count: 5 },
        { symbol: 'Carbon', name: 'Carbon', count: 1 },
    ]);
    assert.deepEqual(sumMaterials(), []);
    assert.deepEqual(sumMaterials([], a), a);
});

test('lookups are case-insensitive and miss cleanly', () => {
    assert.ok(getBlueprint('fsd_longrange'));
    assert.equal(getBlueprint('nope'), null);
    assert.equal(getBlueprintGrade('FSD_LongRange', 9), null);
    assert.ok(getExperimentalEffect('SPECIAL_FSD_HEAVY'));
    assert.equal(getExperimentalEffect('nope'), null);
});

test('Rapid Fire shortens the fire interval, and the rate of fire follows', () => {
    // Frontier's recipe modifies the *interval* — -44% of the wait between shots —
    // so that is the label it carries. The rate of fire is derived from it.
    const multiCannon = getModuleBySymbol('Hpt_MultiCannon_Fixed_Small', ALL_MODULES)!;
    const rapid = computeModifiers(
        baseStats(multiCannon),
        getBlueprintGrade('Weapon_RapidFire', 5)!,
        1,
    );
    assert.equal(
        rapid.find((m) => m.Label === 'RateOfFire'),
        undefined,
        'the recipe names the interval, not the rate',
    );
    const interval = rapid.find((m) => m.Label === 'BurstInterval')!;
    assert.equal(interval.OriginalValue, multiCannon.burstInterval);
    assert.ok(Math.abs(interval.Value! - multiCannon.burstInterval! * 0.56) < 1e-9);

    // A single-shot weapon's rate is the interval's reciprocal...
    assert.ok(
        Math.abs(
            combinedRateOfFire({ ...multiCannon, burstInterval: interval.Value! })! -
                multiCannon.rateOfFire! / 0.56,
        ) < 1e-5,
    );
    // ...while a burst weapon keeps the (3 - 1) / 15 s its own burst takes.
    const burstLaser = getModuleBySymbol('Hpt_PulseLaserBurst_Fixed_Small', ALL_MODULES)!;
    const burstInterval = computeModifiers(
        baseStats(burstLaser),
        getBlueprintGrade('Weapon_RapidFire', 5)!,
        1,
    ).find((m) => m.Label === 'BurstInterval')!;
    assert.ok(
        Math.abs(
            combinedRateOfFire({ ...burstLaser, burstInterval: burstInterval.Value! })! -
                3 / (2 / 15 + 0.5 * 0.56),
        ) < 1e-9,
    );
});

test('a tech-broker recipe raises the rate of fire directly, as its registry publishes it', () => {
    // The Inara-sourced Operations totals are the displayed stat change, so a
    // rate-of-fire total is exactly that, including on a charged weapon.
    const railgun = getModuleBySymbol('Hpt_Railgun_Fixed_Medium', ALL_MODULES)!;
    const rate = computeModifiers(
        baseStats(railgun),
        getBlueprintGrade('RailGun_LongShot', 5)!,
        1,
    ).find((m) => m.Label === 'RateOfFire')!;
    assert.ok(Math.abs(rate.Value! - railgun.rateOfFire! * 1.667) < 1e-5, `${rate.Value}`);
});

test('thermal plasma conversion blueprints publish their damage split at every grade', () => {
    const conversion = fixture.thermalPlasmaConversions;
    for (const [blueprint, symbol] of Object.entries(conversion.blueprints)) {
        const weapon = getModuleBySymbol(symbol, ALL_MODULES)!;
        assert.deepEqual(weapon.damageDistribution, { thermal: 1 }, symbol);
        for (const [grade, expected] of Object.entries(conversion.grades)) {
            assert.deepEqual(
                getBlueprintGrade(blueprint, Number(grade))?.damageDistribution,
                expected,
                `${blueprint} G${grade}`,
            );
        }
    }
});

test('a long-range recipe pushes the damage falloff out to the new maximum range', () => {
    // Upstream encodes "damage falls off from maximum range" as an overwrite in [0, 1]
    // — a flag, not a distance. Read literally it would put the falloff a metre out.
    const multiCannon = getModuleBySymbol('Hpt_MultiCannon_Fixed_Small', ALL_MODULES)!;
    const modifiers = computeModifiers(
        baseStats(multiCannon),
        getBlueprintGrade('Weapon_LongRange', 5)!,
        1,
    );
    const range = modifiers.find((m) => m.Label === 'Range')!;
    const falloff = modifiers.find((m) => m.Label === 'FalloffRange')!;
    assert.equal(range.Value, 8000); // 4000 doubled at a full grade-5 roll
    assert.equal(falloff.Value, range.Value);
});

test('an overwrite recipe applies to a stat the module does not carry', () => {
    // Double Shot gives a two-round burst to a multi-cannon that fires one at a time.
    const multiCannon = getModuleBySymbol('Hpt_MultiCannon_Fixed_Small', ALL_MODULES)!;
    assert.equal(multiCannon.burstRounds, undefined);
    const modifiers = computeModifiers(
        baseStats(multiCannon),
        getBlueprintGrade('Weapon_DoubleShot', 5)!,
        1,
    );
    const size = modifiers.find((m) => m.Label === 'BurstSize')!;
    assert.equal(size.Value, 2);
    assert.equal(size.OriginalValue, 1); // the value the game assumes when absent
    assert.equal(modifiers.find((m) => m.Label === 'BurstRateOfFire')?.Value, 14);
});

test('engineered ammunition is rounded to whole rounds', () => {
    for (const pinned of fixture.clipRounding.cases) {
        const weapon = getModuleBySymbol(pinned.symbol, ALL_MODULES)!;
        assert.equal(weapon.clipSize, pinned.baseAmmoClipSize, pinned.symbol);

        const grade = getBlueprintGrade(pinned.blueprint, pinned.grade)!;
        const modifiers = computeModifiers(baseStats(weapon), grade, pinned.quality);
        const label = `${pinned.symbol} ${pinned.blueprint} g${pinned.grade}`;
        assert.equal(modFor(modifiers, 'AmmoClipSize'), pinned.AmmoClipSize, label);

        // The recipe's own arithmetic, before anything rounds it — the figure the fixture
        // pins as `unroundedAmmoClipSize`, so the rounding is visibly doing work.
        const scale = grade.features.find((feature) => feature.label === 'AmmoClipSize')!;
        const roll = scale.min + (scale.max - scale.min) * pinned.quality;
        assert.ok(near(pinned.baseAmmoClipSize * (1 + roll), pinned.unroundedAmmoClipSize), label);

        if (pinned.AmmoClipSize === pinned.baseAmmoClipSize) {
            // A roll that moves the clip nowhere leaves it exactly where it was, whether or
            // not that is a whole number of bursts.
            assert.equal(pinned.unroundedAmmoClipSize, pinned.baseAmmoClipSize, label);
        } else {
            // What the rule says, stated independently of how it is implemented: a whole
            // number of bursts, no smaller than the roll, and no further from it than the
            // registries' own three-decimal precision can account for.
            const bursts = pinned.AmmoClipSize / pinned.burstSize;
            assert.equal(bursts, Math.round(bursts), `${label}: not a whole number of bursts`);
            // Never below the roll, bar what the multiplier's own third decimal is worth
            // on this weapon's clip — the only fraction a published figure may be out by.
            assert.ok(
                pinned.AmmoClipSize >=
                    pinned.unroundedAmmoClipSize - pinned.baseAmmoClipSize * 5e-4,
                `${label}: rounded below the roll`,
            );
            assert.ok(
                pinned.AmmoClipSize - pinned.unroundedAmmoClipSize < pinned.burstSize,
                `${label}: rounded up by a whole burst or more`,
            );
        }
        // Where the burst comes from: the recipe writes one (Double Shot), the weapon
        // already fires in bursts (a Concord Cannon), or nothing does and the step is inert.
        const fromRecipe = modFor(modifiers, 'BurstSize');
        const fromModule = weapon.burstRounds;
        if (pinned.burstFrom === 'recipe') assert.equal(fromRecipe, pinned.burstSize, label);
        if (pinned.burstFrom === 'module') {
            assert.equal(fromRecipe, undefined, label);
            assert.equal(fromModule, pinned.burstSize, label);
        }
        if (pinned.burstFrom === 'none') {
            assert.equal(fromRecipe, undefined, label);
            assert.equal(fromModule, undefined, label);
            assert.equal(pinned.burstSize, 1, label);
        }
        if ('AmmoMaximum' in pinned) {
            assert.equal(modFor(modifiers, 'AmmoMaximum'), pinned.AmmoMaximum, label);
        }
    }
});

test('a clip a recipe overwrites is published, not computed, and is left alone', () => {
    // The two Guardian Plasma Launchers are the only ammunition overwrites in the
    // catalogues and neither fires in bursts, so nothing in the data reaches this. It is
    // the same exclusion the snap makes: a stated figure is not a product to be corrected.
    const overwrite = [{ label: 'AmmoClipSize', method: 'overwrite', min: 20, max: 20 }] as const;
    assert.equal(
        modFor(computeModifiers({ AmmoClipSize: 12, BurstSize: 3 }, overwrite), 'AmmoClipSize'),
        20,
    );
    // A clip the recipe *computes* on the same weapon still loads whole bursts: 12 × 1.36
    // is 16.32, and three-round bursts make that 18.
    const scaled = [
        { label: 'AmmoClipSize', method: 'multiplicative', min: 0.36, max: 0.36 },
    ] as const;
    assert.equal(
        modFor(computeModifiers({ AmmoClipSize: 12, BurstSize: 3 }, scaled), 'AmmoClipSize'),
        18,
    );
});

test('the base stats a recipe scales come back in the journal spelling for the family', () => {
    // One catalogue field can answer to more than one journal label, and which label a
    // stat arrives under is a fact about the module's family, not about the stat. A
    // shield generator's distributor draw is `EnergyPerRegen`; a cell bank's heat is
    // `ShieldBankHeat` as well as `ThermalLoad`; a utility scanner's range is
    // `ScannerRange` as well as `Range`.
    const generator = baseStats(
        getModuleBySymbol('Int_ShieldGenerator_Size3_Class5', ALL_MODULES)!,
    );
    assert.equal(generator['EnergyPerRegen'], 0.6);
    assert.equal(generator['DistributorDraw'], 0.6);

    const cellBank = baseStats(getModuleBySymbol('Int_ShieldCellBank_Size8_Class5', ALL_MODULES)!);
    assert.equal(cellBank['ShieldBankReinforcement'], 65);
    assert.equal(cellBank['ShieldBankSpinUp'], 5);
    assert.equal(cellBank['ShieldBankDuration'], 17.1);
    assert.equal(cellBank['ShieldBankHeat'], 800);

    // A sensor suite's range is its typical emission range, in metres — the panel shows
    // 5.76 km. A utility scanner's is the scan distance, in the same units.
    assert.equal(
        baseStats(getModuleBySymbol('Int_Sensors_Size8_Class2', ALL_MODULES)!)['ScannerRange'],
        5760,
    );
    const scanner = baseStats(getModuleBySymbol('Hpt_CrimeScanner_Size0_Class5', ALL_MODULES)!);
    assert.equal(scanner['ScannerRange'], 4000);
    assert.equal(scanner['Range'], 4000);
    assert.equal(scanner['SensorTargetScanAngle'], 15);
    assert.equal(scanner['ScannerTimeToScan'], 10);

    // The Detailed Surface Scanner's probe radius is a percentage, and the journal and
    // the recipe spell its label differently. Both have to reach the same base.
    const dss = baseStats(getModuleBySymbol('Int_DetailedSurfaceScanner_Tiny', ALL_MODULES)!);
    assert.equal(dss['ProbeRadius'], 20);
    assert.equal(dss['DSS_PatchRadius'], 20);
});

test('Overcharged leaves a cannon’s clip alone, as a real journal reports', () => {
    // Ground truth, read from the capture rather than quoted from it: the Federation
    // Corvette carries a large gimballed cannon under `Weapon_Overcharged` at grade 5,
    // quality 1, with High Yield Shell. Frontier states no `AmmoClipSize` and leaves the
    // magazine full. So the multi-cannon's clip penalty is the multi-cannon's alone, which
    // is the whole of the registry disagreement the two Overcharged records exist to hold
    // apart.
    const fitted = corvetteJournal.Modules.find(
        (m) =>
            (m as { Engineering?: { BlueprintName: string } }).Engineering?.BlueprintName ===
            'Weapon_Overcharged',
    ) as {
        Item: string;
        AmmoInClip: number;
        Engineering: { Level: number; Quality: number; Modifiers: { Label: string }[] };
    };
    const cannon = getModuleBySymbol(fitted.Item, ALL_MODULES)!;
    assert.equal(cannon.symbol, 'Hpt_Cannon_Gimbal_Large');
    assert.equal(fitted.Engineering.Level, 5);
    assert.equal(fitted.Engineering.Quality, 1);
    assert.ok(!fitted.Engineering.Modifiers.some((m) => m.Label === 'AmmoClipSize'));
    // A full magazine, so the roll did not touch it: 5 × 0.85 would have loaded four.
    assert.equal(cannon.clipSize, 5);
    assert.equal(fitted.AmmoInClip, cannon.clipSize);
    const modifiers = computeModifiers(
        baseStats(cannon),
        getBlueprintGrade('Weapon_Overcharged', 5)!,
        1,
    );
    assert.ok(!modifiers.some((m) => m.Label === 'AmmoClipSize'));
    assert.deepEqual(modifiers.map((m) => m.Label).sort(), [
        'Damage',
        'DistributorDraw',
        'ThermalLoad',
    ]);
    // The base values observed in-game agree with the journal, so both engineered values
    // reproduce the capture directly: ×1.35 distributor draw and ×1.15 thermal load.
    assert.ok(near(modFor(modifiers, 'DistributorDraw')!, 1.539, 1e-9));
    assert.ok(near(modFor(modifiers, 'ThermalLoad')!, 3.3695, 1e-9));

    // The multi-cannon recipe the same journal id resolves to on a multi-cannon does cut
    // the clip, so the absence above is the recipe and not a dropped leg.
    const multi = getModuleBySymbol('Hpt_MultiCannon_Gimbal_Medium', ALL_MODULES)!;
    assert.equal(resolveBlueprintForModule(multi.symbol, 'Weapon_Overcharged'), 'MC_Overcharged');
    assert.equal(
        resolveBlueprintForModule(cannon.symbol, 'Weapon_Overcharged'),
        'Weapon_Overcharged',
    );
    const multiMods = computeModifiers(
        baseStats(multi),
        getBlueprintGrade('MC_Overcharged', 5)!,
        1,
    );
    // 90 × 0.85 is 76.5, and a magazine holds whole rounds — the figure
    // `fixtures/ships/engineering.jsonc` pins for this same module and grade.
    assert.equal(multi.clipSize, 90);
    assert.equal(modFor(multiMods, 'AmmoClipSize'), 77);
});

test('Overcharged leaves a plasma accelerator’s clip alone, as a real journal reports', () => {
    // The third and last clip-bearing group, read the same way: the Caspian Explorer
    // carries a medium fixed plasma accelerator under `Weapon_Overcharged` at grade 1,
    // quality 1, with no experimental. Frontier states four modifiers — the recipe's
    // three legs and a `DamagePerSecond`, which is the `Damage` leg folded against the
    // weapon's unmodified rate of fire rather than a leg of its own — and none is a clip.
    const fitted = caspianJournal.Modules.find(
        (m) =>
            (m as { Engineering?: { BlueprintName: string } }).Engineering?.BlueprintName ===
            'Weapon_Overcharged',
    ) as {
        Item: string;
        AmmoInClip: number;
        Engineering: {
            Level: number;
            Quality: number;
            Modifiers: { Label: string; Value: number }[];
        };
    };
    const accelerator = getModuleBySymbol(fitted.Item, ALL_MODULES)!;
    assert.equal(accelerator.symbol, 'Hpt_PlasmaAccelerator_Fixed_Medium');
    assert.equal(fitted.Engineering.Level, 1);
    assert.equal(fitted.Engineering.Quality, 1);
    assert.ok(!fitted.Engineering.Modifiers.some((m) => m.Label === 'AmmoClipSize'));
    // The magazine is full, and unlike the cannon's that settles nothing on its own: the
    // grade-1 cut is −3%, and 5 × 0.97 = 4.85 rounds back to 5. What carries this case is
    // the modifier list, so the roll is folded at its own grade and quality and read
    // against every figure Frontier states rather than against the count.
    assert.equal(accelerator.clipSize, 5);
    assert.equal(fitted.AmmoInClip, accelerator.clipSize);
    const modifiers = computeModifiers(
        baseStats(accelerator),
        getBlueprintGrade('Weapon_Overcharged', 1)!,
        1,
    );
    assert.deepEqual(modifiers.map((m) => m.Label).sort(), [
        'Damage',
        'DistributorDraw',
        'ThermalLoad',
    ]);
    for (const stated of fitted.Engineering.Modifiers) {
        if (stated.Label === 'DamagePerSecond') continue;
        assert.ok(
            near(modFor(modifiers, stated.Label)!, stated.Value, 1e-5),
            `${stated.Label}: computed ${String(modFor(modifiers, stated.Label))}, capture ${stated.Value}`,
        );
    }

    // The absence is the recipe and not a dropped leg: the same journal id on a
    // multi-cannon resolves to the record that does cut the clip, at this grade too.
    assert.equal(
        resolveBlueprintForModule(accelerator.symbol, 'Weapon_Overcharged'),
        'Weapon_Overcharged',
    );
    assert.ok(
        getBlueprintGrade('MC_Overcharged', 1)!.features.some(
            (feature) => feature.label === 'AmmoClipSize',
        ),
    );
});

test('a heat-rate recipe reproduces the heat a real journal reports', () => {
    // Ground truth: the Krait Phantom capture in fixtures/ships/journal-krait-phantom.jsonc
    // carries `EngineHeatRate` 1.3 -> 1.95 for grade 4 Dirty Drive Tuning on a 6D thruster.
    const thrusters = getModuleBySymbol('Int_Engine_Size6_Class2', ALL_MODULES)!;
    const heat = computeModifiers(
        baseStats(thrusters),
        getBlueprintGrade('Engine_Dirty', 4)!,
        1,
    ).find((m) => m.Label === 'EngineHeatRate')!;
    assert.equal(heat.OriginalValue, 1.3);
    assert.equal(heat.Value, 1.95);
});

test('long range drops the falloff flag on a weapon with no maximum range', () => {
    // The falloff leg is a flag in [0, 1] that resolves to the weapon's range. A missile
    // rack has no range for it to resolve against — and no damage falloff either — so the
    // leg is dropped rather than shipped as a one-metre falloff. Its `Range` leg is
    // already inert on such a weapon for the same reason.
    const rack = getModuleBySymbol('Hpt_DumbfireMissileRack_Fixed_Small', ALL_MODULES)!;
    assert.equal(rack.maximumRange, undefined);
    assert.equal(rack.falloffRange, undefined);
    const modifiers = computeModifiers(
        baseStats(rack),
        getBlueprintGrade('Weapon_LongRange', 5)!,
        1,
    );
    assert.ok(!modifiers.some((m) => m.Label === 'FalloffRange'));
    assert.ok(!modifiers.some((m) => m.Label === 'Range' || m.Label === 'MaximumRange'));
    // The legs the weapon does have still apply.
    assert.ok(modifiers.some((m) => m.Label === 'Mass'));

    // Only the flag is ever dropped. A rangeless weapon that does carry a real falloff —
    // a flak mortar reaches 100 km — keeps the stock distance rather than losing it.
    const flak = getModuleBySymbol('Hpt_FlakMortar_Fixed_Medium', ALL_MODULES)!;
    assert.equal(flak.maximumRange, undefined);
    assert.equal(flak.falloffRange, 100000);
    const flakMods = computeModifiers(
        baseStats(flak),
        getBlueprintGrade('Weapon_LongRange', 5)!,
        1,
    );
    assert.ok(!flakMods.some((m) => m.Label === 'FalloffRange'));
    assert.equal(effectiveFalloff(flak, flakMods), 100000);
});

/** The falloff a build would read: the modifier if one survives, else the base stat. */
function effectiveFalloff(
    module: { falloffRange?: number },
    modifiers: readonly { Label: string; Value?: number }[],
): number | undefined {
    return modifiers.find((m) => m.Label === 'FalloffRange')?.Value ?? module.falloffRange;
}
