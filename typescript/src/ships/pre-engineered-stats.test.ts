import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    getPreEngineeredStats,
    getPreEngineeredModifiers,
    getPreEngineeredJournalModifiers,
    identifyPreEngineeredVariant,
    unresolvedModifiers,
} from './pre-engineered-stats.js';
import {
    PRE_ENGINEERED_MODULES,
    getPreEngineeredVariants,
    type PreEngineeredVariant,
} from './pre-engineered.js';
import { getModuleBySymbol, type OutfittingModule } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import { combinedRateOfFire, weaponMetrics } from './weapons.js';
import { fieldForLabel, scaleForLabel } from './internal/module-stat-labels.js';
import fixture from '../../../fixtures/ships/pre-engineered.jsonc' with { type: 'json' };
import slapaconda from '../../../fixtures/ships/journal-anaconda-slapaconda.jsonc' with { type: 'json' };
import corvette from '../../../fixtures/ships/journal-federation-corvette-mixed.jsonc' with { type: 'json' };
import panther from '../../../fixtures/ships/journal-panther-mkii-fat-arse.jsonc' with { type: 'json' };
import spireOps from '../../../fixtures/ships/journal-python-mkii-spire-ops.jsonc' with { type: 'json' };
import krait from '../../../fixtures/ships/journal-krait-phantom.jsonc' with { type: 'json' };
import type { LoadoutEvent, LoadoutModule } from './slef.js';

/** The rounding `computeModifiers` applies, so a pin means the same thing to a port. */
const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

/** The one variant matching every field given — asserted unique so a pin cannot drift. */
function only(match: Partial<PreEngineeredVariant>): PreEngineeredVariant {
    const found = PRE_ENGINEERED_MODULES.filter((v) =>
        Object.entries(match).every(([k, value]) => v[k as keyof PreEngineeredVariant] === value),
    );
    assert.equal(found.length, 1, `expected exactly one variant for ${JSON.stringify(match)}`);
    return found[0]!;
}

const captures: Readonly<Record<string, LoadoutEvent>> = {
    'journal-anaconda-slapaconda.jsonc': slapaconda as LoadoutEvent,
    'journal-federation-corvette-mixed.jsonc': corvette as LoadoutEvent,
    'journal-panther-mkii-fat-arse.jsonc': panther as LoadoutEvent,
    'journal-python-mkii-spire-ops.jsonc': spireOps as LoadoutEvent,
    'journal-krait-phantom.jsonc': krait as LoadoutEvent,
};

const capturedModule = (source: string, slot: string): LoadoutModule => {
    const module = captures[source]?.Modules.find((candidate) => candidate.Slot === slot);
    assert.ok(module, `${source}: no module in ${slot}`);
    return module;
};

test('captured stat signatures identify fixed variants, including an added experimental', () => {
    for (const expected of fixture.identification.matches) {
        const actual = identifyPreEngineeredVariant(capturedModule(expected.source, expected.slot));
        assert.ok(actual, `${expected.source}: ${expected.slot} was not identified`);
        assert.equal(actual.symbol, expected.symbol);
        assert.equal(actual.blueprint, expected.blueprint);
        assert.equal(actual.grade, expected.grade);
        assert.equal(
            actual.experimental,
            'experimental' in expected ? expected.experimental : undefined,
        );
        assert.equal(actual.acquisition, expected.acquisition);
    }
});

test('ordinary and under-specified engineering is not guessed to be pre-engineered', () => {
    for (const expected of fixture.identification.notMatches) {
        assert.equal(
            identifyPreEngineeredVariant(capturedModule(expected.source, expected.slot)),
            null,
            `${expected.source}: ${expected.slot}`,
        );
    }

    const matched = capturedModule('journal-panther-mkii-fat-arse.jsonc', 'FrameShiftDrive');
    const modifiers = matched.Engineering!.Modifiers!;
    assert.equal(
        identifyPreEngineeredVariant({
            ...matched,
            Engineering: { ...matched.Engineering!, Modifiers: modifiers.slice(0, -2) },
        }),
        null,
        'two missing predictions are insufficient evidence',
    );
    assert.equal(
        identifyPreEngineeredVariant({
            ...matched,
            Engineering: {
                ...matched.Engineering!,
                ExperimentalEffect: 'not_a_real_effect',
            },
        }),
        null,
        'an unknown added effect cannot be composed safely',
    );
    assert.equal(identifyPreEngineeredVariant({ Slot: 'x', Item: matched.Item }), null);
    assert.equal(
        identifyPreEngineeredVariant({
            Slot: 'x',
            Item: 'Hpt_ATDumbfireMissile_Fixed_Medium',
            Engineering: {
                BlueprintName: 'Weapon_HighCapacity',
                Level: 5,
                Quality: 1,
                ExperimentalEffect_Localised: 'Corrosive Shell',
            },
        }),
        null,
        'a localized-only experimental is not a complete fixed identity',
    );
    assert.equal(
        identifyPreEngineeredVariant({
            Slot: 'x',
            Item: 'not_a_real_module',
            Engineering: matched.Engineering!,
        }),
        null,
    );
});

test('a Mercenary-only blueprint identifies the bought article at every reachable grade', () => {
    const expected = fixture.identification.mercenary;
    const variant = only({
        symbol: expected.symbol,
        blueprint: expected.blueprint,
        acquisition: 'mercenary',
    });
    assert.equal(variant.grade, expected.purchaseGrade);
    assert.equal(variant.mercCoinCost, expected.mercCoinCost);

    for (let grade = expected.purchaseGrade; grade <= expected.upgradedGrade; grade++) {
        assert.equal(
            identifyPreEngineeredVariant({
                Slot: 'MediumHardpoint1',
                Item: expected.symbol,
                Engineering: {
                    BlueprintName: expected.blueprint,
                    Level: grade,
                    Quality: 1,
                },
            }),
            variant,
            `grade ${grade}`,
        );
    }
});

test('every Mercenary catalogue row identifies without a published modifier block', () => {
    for (const variant of PRE_ENGINEERED_MODULES.filter(
        (candidate) => candidate.acquisition === 'mercenary',
    )) {
        assert.equal(
            identifyPreEngineeredVariant({
                Slot: 'Slot',
                Item: variant.symbol,
                Engineering: {
                    BlueprintName: variant.blueprint,
                    Level: variant.grade,
                    Quality: 1,
                },
            }),
            variant,
            `${variant.symbol}: ${variant.blueprint}`,
        );
    }
});

test('Mercenary identification still requires a valid exclusive blueprint and grade', () => {
    const expected = fixture.identification.mercenary;
    for (const Engineering of [
        { BlueprintName: 'Weapon_HighCapacity', Level: expected.purchaseGrade, Quality: 1 },
        { BlueprintName: expected.blueprint, Level: 0, Quality: 1 },
        { BlueprintName: expected.blueprint, Level: 6, Quality: 1 },
        { BlueprintName: expected.blueprint, Level: 1.5, Quality: 1 },
    ]) {
        assert.equal(
            identifyPreEngineeredVariant({
                Slot: 'MediumHardpoint1',
                Item: expected.symbol,
                Engineering,
            }),
            null,
        );
    }
});

test('resolved fallback stats include a baked experimental effect omitted by the capture', () => {
    const expected = fixture.identification.omittedBakedExperimental;
    const captured = capturedModule(expected.source, expected.slot);
    const module: LoadoutModule = {
        ...captured,
        Engineering: {
            ...captured.Engineering!,
            Modifiers: [
                ...captured.Engineering!.Modifiers!.filter(
                    (modifier) => modifier.Label !== expected.omitted,
                ),
                expected.reportedInstead,
            ],
        },
    };
    const variant = identifyPreEngineeredVariant(module);
    assert.ok(variant);
    assert.equal(variant.experimental, 'special_feedback_cascade_cooled');
    assert.equal(getPreEngineeredStats(variant)?.thermalLoad, expected.expectedThermalLoad);
});

test('a pre-engineered drive resolves to its known in-game stats', () => {
    const { symbol, blueprint, base, engineered, unresolved } = fixture.resolved.fsdV1Size5;
    const variant = only({ symbol, blueprint });
    const stock = getModuleBySymbol(symbol, ALL_MODULES)!;
    assert.equal(stock.optMass, base.optMass);
    assert.equal(stock.mass, base.mass);
    assert.equal(stock.integrity, base.integrity);
    assert.equal(stock.fsdHeatRate, base.fsdHeatRate);

    const fitted = getPreEngineeredStats(variant)!;
    assert.equal(fitted.optMass, engineered.optMass);
    assert.equal(fitted.mass, engineered.mass);
    assert.equal(fitted.integrity, engineered.integrity);
    assert.equal(fitted.fsdHeatRate, engineered.fsdHeatRate);
    assert.deepEqual(unresolvedModifiers(variant), unresolved);
});

test('grade-5 festive variants resolve and identify through the fixed-article path', () => {
    const expected = fixture.festive;
    for (const blueprint of expected.blueprints) {
        const variant = only({ symbol: expected.symbol, blueprint });
        const fitted = getPreEngineeredStats(variant)!;
        assert.equal(variant.grade, expected.grade);
        assert.equal(fitted.damage, expected.resolved.damage);
        const modifiers = getPreEngineeredJournalModifiers(variant);
        assert.deepEqual(modifiers, [
            {
                Label: 'DamagePerSecond',
                Value: expected.resolved.damagePerSecond,
                OriginalValue: expected.resolved.baseDamage * 0.5,
            },
            {
                Label: 'Damage',
                Value: expected.resolved.damage,
                OriginalValue: expected.resolved.baseDamage,
            },
        ]);
        assert.equal(
            identifyPreEngineeredVariant({
                Slot: 'MediumHardpoint1',
                Item: variant.symbol,
                Engineering: {
                    BlueprintName: variant.blueprint,
                    Level: expected.grade,
                    Quality: 1,
                    Modifiers: modifiers,
                },
            }),
            variant,
        );
    }
});

test('festive identification rejects a mismatched grade or experimental effect', () => {
    const expected = fixture.festive;
    const variant = only({ symbol: expected.symbol, blueprint: expected.blueprints[1]! });
    const modifiers = getPreEngineeredJournalModifiers(variant);
    for (const Engineering of [
        {
            BlueprintName: variant.blueprint,
            Level: 4,
            Quality: 1,
            Modifiers: modifiers,
        },
        {
            BlueprintName: variant.blueprint,
            Level: expected.grade,
            Quality: 1,
            ExperimentalEffect: 'special_auto_loader',
            Modifiers: modifiers,
        },
        {
            BlueprintName: variant.blueprint,
            Level: expected.grade,
            Quality: 1,
            ExperimentalEffect_Localised: 'Auto Loader',
            Modifiers: modifiers,
        },
    ]) {
        assert.equal(
            identifyPreEngineeredVariant({
                Slot: 'MediumHardpoint1',
                Item: variant.symbol,
                Engineering,
            } as LoadoutModule),
            null,
        );
    }
});

test('setter-shaped fragment-cannon modifiers identify their fixed variants', () => {
    for (const symbol of ['Hpt_Slugshot_Gimbal_Small', 'Hpt_Slugshot_Gimbal_Large']) {
        const variant = only({
            symbol,
            blueprint: 'Weapon_DoubleShot',
            acquisition: 'communityGoal',
        });
        const grade = variant.grade;
        assert.equal(
            identifyPreEngineeredVariant({
                Slot: 'Hardpoint',
                Item: symbol,
                Engineering: {
                    BlueprintName: variant.blueprint,
                    Level: grade,
                    Quality: 1,
                    ...(variant.experimental === undefined
                        ? {}
                        : { ExperimentalEffect: variant.experimental }),
                    Modifiers: getPreEngineeredJournalModifiers(variant),
                },
            }),
            variant,
            symbol,
        );
    }
});

test('a string-valued capability resolves to the boolean module field', () => {
    // A caller may use the resolver with a variant outside the bundled sale catalogue.
    // Keep capability handling consistent with a rolled blueprint without claiming this
    // particular article is sold pre-engineered in game.
    const variant: PreEngineeredVariant = {
        symbol: 'Int_GuardianPowerplant_Size7',
        name: 'Guardian Hybrid Power Plant',
        blueprint: 'GuardianModule_Sturdy',
        grade: 1,
        acquisition: 'communityGoal',
        modifiers: [{ label: 'GuardianModuleResistance', method: 'additive', value: 1 }],
    };
    assert.deepEqual(getPreEngineeredModifiers(variant), [
        { Label: 'GuardianModuleResistance', ValueStr: 'Active' },
    ]);
    assert.deepEqual(unresolvedModifiers(variant), []);
    assert.equal(getPreEngineeredStats(variant)?.guardianZoneResistance, true);
});

test('a pre-engineered weapon resolves its damage-side stats too', () => {
    const { symbol, blueprint, grade, base, engineered, displayed, displayedChanges, unresolved } =
        fixture.resolved.guardianShardMediumG1;
    const variant = only({ symbol, blueprint, grade });
    const stock = getModuleBySymbol(symbol, ALL_MODULES)!;
    assert.equal(stock.mass, base.mass);
    assert.equal(stock.powerDraw, base.powerDraw);
    assert.equal(stock.damage, base.damage);
    assert.equal(stock.distributorDraw, base.distributorDraw);
    assert.equal(stock.maximumRange, base.maximumRange);
    assert.equal(stock.falloffRange, base.falloffRange);
    assert.equal(stock.shotSpeed, base.shotSpeed);
    assert.equal(stock.jitter, base.jitter);
    assert.equal(stock.thermalLoad, base.thermalLoad);
    assert.equal(stock.armourPiercing, base.armourPiercing);
    assert.equal(stock.rateOfFire, base.rateOfFire);
    assert.equal(stock.roundsPerShot, base.roundsPerShot);
    assert.equal(stock.clipSize, base.clipSize);
    assert.equal(stock.ammoMaximum, base.ammoMaximum);

    const fitted = getPreEngineeredStats(variant)!;
    assert.equal(fitted.mass, engineered.mass);
    assert.equal(fitted.powerDraw, engineered.powerDraw);
    assert.equal(fitted.damage, engineered.damage);
    assert.equal(fitted.distributorDraw, engineered.distributorDraw);
    // Whole metres, not 2999.99: see the authored-stat note below.
    assert.equal(fitted.maximumRange, engineered.maximumRange);
    assert.equal(fitted.falloffRange, engineered.falloffRange);
    assert.equal(fitted.shotSpeed, engineered.shotSpeed);
    assert.equal(fitted.jitter, engineered.jitter);
    assert.equal(fitted.thermalLoad, engineered.thermalLoad);
    assert.equal(fitted.armourPiercing, engineered.armourPiercing);
    assert.equal(fitted.rateOfFire, engineered.rateOfFire);
    assert.equal(fitted.roundsPerShot, engineered.roundsPerShot);
    assert.equal(fitted.clipSize, engineered.clipSize);
    assert.equal(fitted.ammoMaximum, engineered.ammoMaximum);
    const metrics = weaponMetrics(fitted);
    assert.equal(Math.round(metrics.damagePerSecond * 10) / 10, displayed.damagePerSecond);
    assert.equal(Math.round(fitted.damage! * 10) / 10, displayed.damage);
    assert.equal(Math.round(fitted.powerDraw! * 100) / 100, displayed.powerDraw);
    assert.equal(fitted.distributorDraw, displayed.distributorDraw);
    assert.equal(Math.round(fitted.thermalLoad! * 10) / 10, displayed.thermalLoad);
    assert.equal(Math.round(fitted.armourPiercing!), displayed.armourPiercing);
    assert.equal(fitted.maximumRange, displayed.maximumRange);
    assert.equal(Math.round(fitted.shotSpeed!), displayed.shotSpeed);
    assert.equal(fitted.jitter, displayed.jitter);
    assert.equal(fitted.falloffRange, displayed.falloffRange);
    assert.equal(Math.round(fitted.rateOfFire! * 10) / 10, displayed.rateOfFire);
    assert.equal(fitted.clipSize, displayed.clipSize);
    assert.equal(fitted.ammoMaximum, displayed.ammoMaximum);
    assert.ok(metrics.damageByType.thermal > 0);
    assert.equal(displayed.damageType, 'Thermal');

    const percent = (value: number, original: number): number =>
        Math.round((value / original - 1) * 1000) / 10;
    assert.equal(percent(fitted.mass!, stock.mass!), displayedChanges.massPercent);
    assert.equal(percent(fitted.powerDraw!, stock.powerDraw!), displayedChanges.powerDrawPercent);
    assert.equal(
        percent(fitted.distributorDraw!, stock.distributorDraw!),
        displayedChanges.distributorDrawPercent,
    );
    assert.equal(
        percent(fitted.thermalLoad!, stock.thermalLoad!),
        displayedChanges.thermalLoadPercent,
    );
    assert.equal(
        percent(fitted.armourPiercing!, stock.armourPiercing!),
        displayedChanges.armourPiercingPercent,
    );
    assert.equal(
        percent(fitted.maximumRange!, stock.maximumRange!),
        displayedChanges.maximumRangePercent,
    );
    assert.equal(percent(fitted.shotSpeed!, stock.shotSpeed!), displayedChanges.shotSpeedPercent);
    assert.equal(fitted.jitter! - stock.jitter!, displayedChanges.jitterDegrees);
    assert.equal(
        percent(fitted.falloffRange!, stock.falloffRange!),
        displayedChanges.falloffRangePercent,
    );
    // Every modifier this variant carries has a base stat to apply to.
    assert.deepEqual(unresolvedModifiers(variant), unresolved);
});

test('a final pre-engineered Guardian weapon stays locked when resolved', () => {
    const variant = getPreEngineeredVariants('Hpt_Guardian_GaussCannon_Fixed_Medium')[0]!;
    assert.equal(variant.engineeringLocked, true);
    assert.equal(getPreEngineeredStats(variant)?.engineeringLocked, true);
});

test('a pre-engineered damage modifier scales every exact damage component', () => {
    const symbol = 'Hpt_ATMultiCannon_Gimbal_Medium';
    const stock = getModuleBySymbol(symbol, ALL_MODULES)!;
    const fitted = getPreEngineeredStats(
        only({ symbol, blueprint: 'Weapon_Overcharged', grade: 5 }),
    )!;
    assert.ok(Math.abs(fitted.damage! - stock.damage! * 1.1) < 1e-9);
    assert.ok(
        Math.abs(fitted.damageComponents!.kinetic! - stock.damageComponents!.kinetic! * 1.1) < 1e-9,
    );
    assert.ok(
        Math.abs(fitted.damageComponents!.antiXeno! - stock.damageComponents!.antiXeno! * 1.1) <
            1e-9,
    );
    const metrics = weaponMetrics(fitted);
    assert.ok(Math.abs(metrics.damageByType.antiXeno - 2.19 * 1.1 * metrics.rateOfFire) < 1e-6);
});

test('pre-engineered ammunition is rounded to whole rounds', () => {
    const { symbol, blueprint, grade, base, engineered } =
        fixture.resolved.fragmentCannonDoubleShot;
    const stock = getModuleBySymbol(symbol, ALL_MODULES)!;
    assert.equal(stock.clipSize, base.clipSize);
    assert.equal(stock.ammoMaximum, base.ammoMaximum);
    assert.equal(stock.burstRounds, undefined);

    const fitted = getPreEngineeredStats(only({ symbol, blueprint, grade }))!;
    // 3 × 2.6667 is 8.0001, and the article holds 8 — the stated multiplier's precision is
    // snapped before the round-up, or the noise would buy a whole extra two-round burst.
    assert.equal(fitted.clipSize, engineered.clipSize);
    assert.equal(fitted.burstRounds, engineered.burstRounds);
    assert.equal(fitted.clipSize! % fitted.burstRounds!, 0);
    // The reserve's multiplier gives 301.9968, which is nearest to 302 whole rounds.
    assert.equal(fitted.ammoMaximum, engineered.ammoMaximum);
});

test('a stat the source authored as a value resolves to exactly that value', () => {
    // EDSY encodes a modifier as a multiplier in a 20-bit float, so a stat the game
    // authored as a round number comes back short however the multiplier is recovered —
    // the "Modified Guardian Shard Cannon" reads 2999.99 m rather than 3000 m. Those
    // modifiers are stored as an `overwrite` of the stat itself, which is also the shape
    // a journal reports a pre-engineered module in. An overwrite must land exactly.
    let checked = 0;
    for (const variant of PRE_ENGINEERED_MODULES) {
        const fitted = getPreEngineeredStats(variant)!;
        for (const modifier of variant.modifiers ?? []) {
            if (modifier.method !== 'overwrite') continue;
            const field = fieldForLabel(modifier.label) as keyof OutfittingModule | null;
            if (!field) continue;
            const resolved = (fitted[field] as number) * scaleForLabel(modifier.label);
            assert.equal(resolved, modifier.value, `${variant.symbol} ${modifier.label}`);
            checked++;
        }
    }
    assert.ok(checked >= fixture.authoredStats.count, `only ${checked} overwrites checked`);
});

test('identity fields survive resolution — a variant is the same article', () => {
    for (const variant of PRE_ENGINEERED_MODULES) {
        const stock = getModuleBySymbol(variant.symbol, ALL_MODULES)!;
        const fitted = getPreEngineeredStats(variant)!;
        assert.equal(fitted.symbol, stock.symbol);
        assert.equal(fitted.name, stock.name);
        assert.equal(fitted.class, stock.class);
        assert.equal(fitted.rating, stock.rating);
        assert.equal(fitted.category, stock.category);
        assert.equal(fitted.cost, stock.cost);
    }
});

test('a variant with no stat block resolves to the base record itself', () => {
    // Every Merc row: the pre-engineering it arrives with is not published, so the
    // honest answer is the stock record rather than an invented one.
    for (const variant of PRE_ENGINEERED_MODULES) {
        if (variant.acquisition !== 'mercenary') continue;
        assert.equal(
            getPreEngineeredStats(variant),
            getModuleBySymbol(variant.symbol, ALL_MODULES),
        );
        assert.deepEqual(getPreEngineeredModifiers(variant), []);
        assert.deepEqual(unresolvedModifiers(variant), []);
    }
});

test('a reward variant changes a carried stat unless it only touches uncarried ones', () => {
    // Every reward variant moves a stat the catalogues carry. Pin the empty set so a
    // variant that stops resolving is reported explicitly.
    const noOps: string[] = [];
    for (const variant of PRE_ENGINEERED_MODULES) {
        if (variant.acquisition === 'mercenary') continue;
        const stock = getModuleBySymbol(variant.symbol, ALL_MODULES)!;
        const fitted = getPreEngineeredStats(variant)!;
        const moved = Object.keys(stock).some(
            (field) => fitted[field as keyof typeof fitted] !== stock[field as keyof typeof stock],
        );
        if (moved) continue;
        noOps.push(variant.symbol);
        assert.equal(
            unresolvedModifiers(variant).length,
            variant.modifiers!.length,
            `${variant.symbol} resolved to no change but has a modifier we should have applied`,
        );
    }
    assert.deepEqual(noOps, fixture.fullyUnresolved.symbols);
    assert.equal(noOps.length, fixture.fullyUnresolved.count);
});

test('variants that change a burst pattern move the interval their rate comes from', () => {
    // A journal never reports the burst interval — it reports the resulting RateOfFire —
    // so nothing downstream notices if the modifier behind it goes missing: the weapon
    // simply keeps its stock cadence. Pin the interval and the rate it derives.
    const pinned = fixture.burstIntervalVariants;
    const carriers = PRE_ENGINEERED_MODULES.filter((v) =>
        v.modifiers?.some((m) => m.label === 'BurstInterval'),
    );
    assert.equal(carriers.length, pinned.count);
    // …and the fixture covers every one of them, so dropping a row cannot quietly
    // shrink what this test walks.
    assert.equal(pinned.variants.length, pinned.count);

    for (const expected of pinned.variants) {
        const { symbol, blueprint, grade, experimental } = expected;
        const variant = only(
            experimental === null
                ? { symbol, blueprint, grade }
                : { symbol, blueprint, grade, experimental },
        );
        // `only` cannot match on an absent field, so assert the absence separately —
        // otherwise a null pin would silently mean "any experimental".
        if (experimental === null) assert.equal(variant.experimental, undefined, symbol);
        const stock = getModuleBySymbol(symbol, ALL_MODULES)!;
        assert.equal(stock.burstInterval, expected.stockBurstInterval, symbol);

        const fitted = getPreEngineeredStats(variant)!;
        assert.equal(round6(fitted.burstInterval ?? 0), expected.burstInterval, symbol);
        // The stat a consumer actually reads: the resolver writes `rateOfFire` back
        // because the recipe never names it. Asserting only the recomputation would
        // pass even if the resolver stopped writing the field at all.
        assert.equal(round6(fitted.rateOfFire ?? 0), expected.rateOfFire, symbol);
        assert.equal(round6(combinedRateOfFire(fitted) ?? 0), expected.rateOfFire, symbol);
        // The whole point: the variant does not fire at the stock cadence.
        assert.notEqual(fitted.burstInterval, stock.burstInterval, symbol);
        assert.notEqual(fitted.rateOfFire, stock.rateOfFire, symbol);
    }
});

test('resolved stats stay finite and non-negative', () => {
    for (const variant of PRE_ENGINEERED_MODULES) {
        const fitted = getPreEngineeredStats(variant)!;
        for (const [field, value] of Object.entries(fitted)) {
            if (typeof value !== 'number') continue;
            assert.ok(Number.isFinite(value), `${variant.symbol}: ${field} is not finite`);
            assert.ok(value >= 0, `${variant.symbol}: ${field} is negative (${value})`);
        }
    }
});

test('getPreEngineeredModifiers reports journal shape with the original value', () => {
    const { symbol, blueprint } = fixture.resolved.fsdV1Size5;
    const variant = only({ symbol, blueprint });
    const modifiers = getPreEngineeredModifiers(variant);
    assert.ok(modifiers.length > 0);
    const stock = getModuleBySymbol(symbol, ALL_MODULES)!;
    const mass = modifiers.find((m) => m.Label === 'Mass')!;
    assert.equal(mass.OriginalValue, stock.mass);
    assert.equal(mass.Value, fixture.resolved.fsdV1Size5.engineered.mass);
    // Only labels the catalogue holds a base value for are computable.
    assert.ok(modifiers.every((m) => m.OriginalValue !== undefined));
});

test('every authored modifier is either computed or reported unresolved', () => {
    for (const variant of PRE_ENGINEERED_MODULES) {
        const authored = new Set((variant.modifiers ?? []).map((modifier) => modifier.label));
        const computed = getPreEngineeredModifiers(variant)
            .map((modifier) => modifier.Label)
            .filter((label) => authored.has(label));
        const unresolved = unresolvedModifiers(variant);
        assert.deepEqual(
            [...computed, ...unresolved].sort(),
            (variant.modifiers ?? []).map((modifier) => modifier.label).sort(),
            `${variant.symbol} / ${variant.blueprint}`,
        );
    }
});

test('resolving is total across the catalogue and never returns null', () => {
    // Every symbol joins to a module (pinned in pre-engineered.test.ts), so resolution
    // cannot miss — a null here would mean the two catalogues had drifted apart.
    for (const variant of PRE_ENGINEERED_MODULES) {
        assert.notEqual(getPreEngineeredStats(variant), null, variant.symbol);
    }
});

test('two variants of one module resolve differently', () => {
    // The medium Guardian Shard Cannon has a grade-1 and a grade-5 Long Range variant
    // with different hand-set stats; resolving must not collapse them.
    const [first, second] = getPreEngineeredVariants('Hpt_Guardian_ShardCannon_Fixed_Medium');
    const a = getPreEngineeredStats(first!)!;
    const b = getPreEngineeredStats(second!)!;
    assert.equal(a.mass, b.mass); // both carry Mass +50%
    assert.notDeepEqual(a, b);
    // The grade-5 Long Range roll is the one that reaches out to 8.5 km.
    const longRange = fixture.resolved.guardianShardMediumLongRange.engineered;
    assert.equal(a.maximumRange, longRange.maximumRange);
    assert.equal(a.falloffRange, longRange.falloffRange);
    assert.equal(a.shotSpeed, longRange.shotSpeed);
});

test('identification names its own fields, not the catalogue lookup beneath it', () => {
    for (const [module, field] of [
        [
            { Slot: 'a', Item: 42, Engineering: { Modifiers: [{ Label: 'x', Value: 1 }] } },
            'module.Item',
        ],
        [
            {
                Slot: 'a',
                Item: 'Int_Hyperdrive_Size6_Class5',
                Engineering: { Modifiers: [{ Label: 42, Value: 1 }] },
            },
            'module.Engineering.Modifiers[].Label',
        ],
    ] as const) {
        assert.throws(() => identifyPreEngineeredVariant(module as never), {
            name: 'TypeError',
            message: `identifyPreEngineeredVariant: ${field} must be a string, received number 42`,
        });
    }
    assert.throws(
        () =>
            identifyPreEngineeredVariant({
                Slot: 'a',
                Item: 'Hpt_Railgun_Fixed_Medium',
                Engineering: { BlueprintName: 42, Level: 1, Quality: 1 },
            } as never),
        {
            name: 'TypeError',
            message:
                'identifyPreEngineeredVariant: module.Engineering.BlueprintName must be a string, received number 42',
        },
    );
    // An unengineered module answers before any field is read.
    assert.equal(identifyPreEngineeredVariant({ Slot: 'a', Item: 42 } as never), null);
});
