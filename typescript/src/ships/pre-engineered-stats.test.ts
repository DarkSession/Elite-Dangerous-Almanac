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
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import fixture from '../../../fixtures/ships/pre-engineered.json' with { type: 'json' };

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

    const fitted = getPreEngineeredStats(variant)!;
    assert.equal(fitted.optMass, engineered.optMass);
    assert.equal(fitted.mass, engineered.mass);
    assert.equal(fitted.integrity, engineered.integrity);
    assert.deepEqual(unresolvedModifiers(variant), unresolved);
});

test('a pre-engineered weapon resolves the stats the catalogue does carry', () => {
    const { symbol, blueprint, grade, base, engineered, unresolved } =
        fixture.resolved.guardianShardMediumG1;
    const variant = only({ symbol, blueprint, grade });
    const stock = getModuleBySymbol(symbol, ALL_MODULES)!;
    assert.equal(stock.mass, base.mass);
    assert.equal(stock.powerDraw, base.powerDraw);

    const fitted = getPreEngineeredStats(variant)!;
    assert.equal(fitted.mass, engineered.mass);
    assert.equal(fitted.powerDraw, engineered.powerDraw);
    // The catalogue carries no weapon stats, so the damage-side modifiers are reported
    // as unresolved rather than silently dropped.
    assert.deepEqual(unresolvedModifiers(variant), unresolved);
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

test('a reward variant changes a carried stat unless it only touches weapon stats', () => {
    // Most reward variants move mass, integrity or power draw. Five do not: every
    // modifier they carry targets a weapon or scanner stat the module catalogues hold no
    // base value for, so resolving them is necessarily a no-op. Pinned so that the
    // no-ops stay a known, listed set rather than silent breakage.
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
    assert.notDeepEqual(unresolvedModifiers(first!), unresolvedModifiers(second!));
});
