import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    getPreEngineeredStats,
    getPreEngineeredModifiers,
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
import { fieldForLabel, scaleForLabel } from './module-stat-labels.js';
import fixture from '../../../fixtures/ships/pre-engineered.json' with { type: 'json' };

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
    const { symbol, blueprint, grade, base, engineered, unresolved } =
        fixture.resolved.guardianShardMediumG1;
    const variant = only({ symbol, blueprint, grade });
    const stock = getModuleBySymbol(symbol, ALL_MODULES)!;
    assert.equal(stock.mass, base.mass);
    assert.equal(stock.powerDraw, base.powerDraw);
    assert.equal(stock.maximumRange, base.maximumRange);
    assert.equal(stock.thermalLoad, base.thermalLoad);
    assert.equal(stock.armourPiercing, base.armourPiercing);

    const fitted = getPreEngineeredStats(variant)!;
    assert.equal(fitted.mass, engineered.mass);
    assert.equal(fitted.powerDraw, engineered.powerDraw);
    // Whole metres, not 2999.99: see the authored-stat note below.
    assert.equal(fitted.maximumRange, engineered.maximumRange);
    assert.equal(fitted.falloffRange, engineered.falloffRange);
    assert.equal(fitted.thermalLoad, engineered.thermalLoad);
    assert.equal(fitted.armourPiercing, engineered.armourPiercing);
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
    const fitted = getPreEngineeredStats(only({ symbol, blueprint: 'MC_Overcharged', grade: 5 }))!;
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
        const computed = getPreEngineeredModifiers(variant).map((modifier) => modifier.Label);
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
