/**
 * Internal catalogue adapters used by the loadout facade and its immutable views.
 *
 * @internal
 */

import { BLUEPRINTS, getBlueprint } from '../blueprints.js';
import {
    getBlueprintsForModule,
    getEngineeringGroup,
    getExperimentalsForModule,
} from '../engineering-options.js';
import { resolveBlueprintForModule } from '../blueprint-journal.js';
import { EXPERIMENTAL_EFFECTS } from '../experimental-effects.js';
import { getPreEngineeredVariants } from '../pre-engineered.js';
import { baseStats, fieldForLabel } from './module-stat-labels.js';
import type { OutfittingModule } from '../modules.js';
import type { EngineeringModifier } from '../slef.js';
import type { AvailableBlueprint } from '../ship-loadout.js';
import { builtInModuleBySymbol } from './module-symbol-index.js';
import { FITTED_ITEM } from './loadout-state.js';
import { normalizeKey } from '../../internal/registry-index.js';
import type { BlueprintGrade, ExperimentalEffect } from '../engineering.js';
import { preciseModifierValue } from './engineering-precision.js';

/** Engineering groups whose non-menu recipes identify final bought articles. */
const GUARDIAN_WEAPON_GROUPS: ReadonlySet<string> = new Set([
    'guardianGauss',
    'guardianPlasma',
    'guardianShard',
]);

/**
 * Modifier labels a recipe changes that **cannot be answered** for a module — the ones
 * that make {@link ShipLoadout.applyBlueprint} refuse the recipe rather than store it
 * half-applied.
 *
 * A label with no base value is not automatically missing. A recipe leg on a stat the
 * module does not have is inert: Long Range scales the shot speed of a projectile weapon
 * and leaves a beam laser alone. A label is missing only when the catalogue models no
 * field for it, so there is nowhere to store the result.
 *
 * @internal
 */
export function missingBaseLabels(
    stats: OutfittingModule,
    base: Readonly<Record<string, number>>,
    features: readonly { readonly label: string; readonly method?: string }[],
    experimental?: readonly { readonly label: string; readonly method?: string }[],
): string[] {
    const contributions = [...features, ...(experimental ?? [])];
    return [
        ...new Set(
            contributions
                .map((contribution) => contribution.label)
                .filter((label) => {
                    if (base[label] !== undefined) return false;
                    return fieldForLabel(label, stats) === null;
                }),
        ),
    ];
}

/**
 * What a blueprint id modifies, without the magnitudes: its display name, and the
 * `label`/`method` pairs each grade carries.
 *
 * Two ids with the same signature are the same modification written twice, which is how
 * the generic spelling is recognised as the family-specific one — see
 * {@link blueprintAvailableFor}. Deliberately blind to the min/max values, because the one
 * published divergence between such a pair is a magnitude: `LifeSupport_Shielded` G5 draws
 * +112% power where `Misc_Shielded` draws +100%. Comparing what a grade *touches* pairs
 * them; comparing what it rolls would not.
 *
 * @internal
 */
function recipeSignature(fdname: string): string | null {
    const blueprint = getBlueprint(fdname);
    if (!blueprint) return null;
    const grades = Object.entries(blueprint.grades)
        .map(
            ([grade, { features }]) =>
                `${grade}:${features
                    .map((feature) => `${feature.label}/${feature.method ?? ''}`)
                    .sort()
                    .join(',')}`,
        )
        .sort()
        .join(';');
    return `${blueprint.name.toLowerCase()}|${grades}`;
}

/** Frontier's family-agnostic spelling of a modification, e.g. `Misc_LightWeight`. */
const isGenericSpelling = (fdname: string): boolean => fdname.toLowerCase().startsWith('misc_');

/**
 * Whether a module is sold carrying this recipe in a form that can still be engineered.
 *
 * Most Operations keys belong to modules bought already engineered — the Mercenary shop's
 * rail gun, the community-goal and tech-broker rewards — so no engineering menu lists one
 * and the menu check alone would refuse every caller. (The four a menu *does* list are
 * recipes a player applies from grade 1, and reach the caller by the menu instead; see
 * `engineering-options`.) The pre-engineered catalogue names
 * which module each arrives on, which is the same question answered by purchase instead of
 * by a menu, and it is narrower than a family: `RailGun_LongShot` resolves on the
 * rail gun that ships with it and nowhere else.
 *
 * This route covers the **climb**, not the purchase. A Mercenary module arrives at grade 1
 * and its recipe publishes grades 2–5 — the grades an engineer can still add — so folding
 * one is how a caller takes a bought module further. It cannot reproduce the grade the
 * module was sold at: all 22 Mercenary rows are grade 1, none of those recipes defines a
 * grade 1, and `getBlueprintGrade` refuses that call before this check is reached. Nothing
 * here recreates a reward variant either; `pre-engineered-stats` resolves those from their
 * own `modifiers`. Final pre-engineered Guardian weapons are deliberately excluded: their
 * stock module offers Anti-Guardian Zone Resistance, but the bought article accepts no
 * further engineering at all.
 *
 * @internal
 */
function isSoldWithBlueprint(item: string, wanted: string): boolean {
    return getPreEngineeredVariants(item).some(
        (variant) => !variant.engineeringLocked && variant.blueprint.toLowerCase() === wanted,
    );
}

/**
 * Whether a module's engineering menu offers a blueprint — the check
 * {@link ShipLoadout.applyBlueprint} makes before it computes anything.
 *
 * The menu is `engineering-options`, so this answers exactly what the game offers on that
 * module, with three accommodations, applied in the order they are described here.
 *
 * The first is the journal spelling, and it comes first because it is the one case where
 * the id names a *different* recipe rather than the same one twice: the game writes
 * `Sensor_LongRange` on a utility scanner as well as on a sensor suite, and the two roll
 * different stats. {@link resolveBlueprintForModule} turns it into the menu's
 * `Scanner_LongRange`, by asking which blueprint *this module is offered* declares that
 * journal name. It reads stored facts rather than inferring, because nothing in the two
 * recipes' shape says they belong together. Every id it does not recognise passes straight
 * through, so the two checks below see what the caller wrote.
 *
 * The second is {@link isSoldWithBlueprint}: a non-final module with no menu, or a menu
 * that omits the recipe, still accepts one it is sold already carrying. It is asked about
 * the id as written
 * *and* about the resolved one, so resolution cannot **hide** a sale recorded under the
 * other spelling. That is deliberately the widening direction, not a symmetry: if a variant
 * on a menu carrying one of the three colliding ids were recorded under the journal
 * spelling, the gate would accept it here while `applyBlueprint` folded the resolved
 * recipe. Three of the five such menus have variants: the Kill Warrant Scanners'
 * `Sensor_FastScan` (its own journal id, and offered anyway), the anti-xeno multi-cannons'
 * Enhanced AX Multi-Cannon, and the ordinary multi-cannons' two rows, `Weapon_RapidFire`
 * and the Merc-Coin `MultiCannon_Rapid` — the last menu being where the hazard would most
 * likely arrive, since `Weapon_Overcharged` on a multi-cannon is the collision consumers
 * actually meet. None is recorded that way:
 * `pre-engineered.jsonc` names the recipe the module rolls, never a spelling that would
 * resolve to a different one, and `pre-engineered.test.ts` asserts exactly that over the
 * whole catalogue — each row's `blueprint`, resolved on its own module, comes back
 * unchanged. That is a narrower claim than menu membership, which 29 rows do not have and
 * are not meant to: this leg exists for them. So the question does not arise; it is
 * written down because the gate itself cannot catch it if it ever does.
 *
 * The third is the generic spelling. Where a modification applies to several module families
 * Frontier writes a family-specific `BlueprintName` and the menu lists that one, but a
 * build authored elsewhere carries the generic spelling instead — a life support's
 * Lightweight is `LifeSupport_LightWeight` in the menu and `Misc_LightWeight` in an
 * EDSY-authored build. So a generic id is accepted when the menu offers a *family-specific*
 * id of the same {@link recipeSignature}.
 *
 * That the alias must run *from* the generic spelling *to* the menu's is what keeps it
 * honest: a `Misc_*` id substitutes only for a menu id that is not itself generic.
 * `Misc_ChaffCapacity` and `Misc_HeatSinkCapacity` share a signature — both are "Ammo
 * capacity" over the same three labels — but neither is a family spelling of the other, so
 * a chaff launcher's ammo recipe stays off a heat sink launcher, whose roll is a smaller
 * one. Anti-Guardian Zone Resistance needs no leg of its own: `GuardianModule_Sturdy` is
 * the id the game writes on Guardian weapons as well as modules, the nine groups offering
 * the recipe list it, and `BLUEPRINTS` keys it under nothing else.
 *
 * Everything else is excluded by not being a generic spelling, by the signature, or by
 * not being sold on that module. `Armour_Explosive` shares `ShieldBooster_Explosive`'s
 * signature and still never stands in for it, because it is a family's own id rather than
 * a generic one. `Misc_LightWeight` is generic, so the signature is what stops it: a
 * weapon's Lightweight is `Weapon_LightWeight`, which cuts distributor draw where the
 * generic recipe touches only integrity and mass.
 *
 * @internal
 */
export function blueprintAvailableFor(item: string, fdname: string): boolean {
    const offered = getBlueprintsForModule(item);
    const asWritten = normalizeKey(fdname, 'ShipLoadout.applyBlueprint: fdname');
    const resolved = resolveBlueprintForModule(item, fdname).trim();
    const wanted = resolved.toLowerCase();
    if (offered.some((id) => id.toLowerCase() === wanted)) return true;
    // Both spellings, so resolving cannot hide a sale recorded under the other one.
    if (isSoldWithBlueprint(item, wanted) || isSoldWithBlueprint(item, asWritten)) return true;
    if (!isGenericSpelling(wanted)) return false;
    const signature = recipeSignature(resolved);
    if (signature === null) return false;
    // A generic spelling stands in for a family's id, never for another generic.
    return offered.some((id) => recipeSignature(id) === signature && !isGenericSpelling(id));
}

/**
 * Whether a module's engineering menu offers an experimental effect.
 *
 * No aliasing and no pre-engineered leg here: effect ids are unique per effect, the menu
 * already narrows a group's list to the individual module (a small Multi-cannon is one
 * effect short of a medium one), and every experimental a pre-engineered variant arrives
 * with is one its module's menu lists anyway — `pre-engineered.test.ts` asserts that, so
 * the day it stops being true a test says so rather than this quietly covering for it.
 *
 * @internal
 */
export function experimentalAvailableFor(item: string, fdname: string): boolean {
    const wanted = normalizeKey(fdname, 'ShipLoadout.applyBlueprint: options.experimental');
    return getExperimentalsForModule(item).some((id) => id.toLowerCase() === wanted);
}

/** Whether any registry lists an engineering menu for this module at all. @internal */
export function isEngineerable(item: string): boolean {
    return getEngineeringGroup(item) !== null;
}

/** The recipe-side spelling for a module-specific journal alias. */
function primitiveLabelFor(stats: OutfittingModule, label: string): string {
    const weapon = stats.damage !== undefined;
    if (weapon && label === 'MaximumRange') return 'Range';
    if (weapon && label === 'DamageFalloffRange') return 'FalloffRange';
    if (!weapon && label === 'Range') return 'ScannerRange';
    if (label === 'DSS_PatchRadius') return 'ProbeRadius';
    if (label === 'FuelScoopRate') return 'RefuelRate';
    if (label === 'EnergyPerRegen' && stats.shieldRegenRate !== undefined) {
        return 'DistributorDraw';
    }
    return label;
}

/**
 * Canonicalize aliases before the one modifier calculation combines their contributions.
 *
 * A blueprint and experimental can name the same stat differently — shield recipes use
 * `DistributorDraw`, while shield experimentals use the journal alias `EnergyPerRegen`.
 * Normalizing their labels first lets {@link computeModifiers} compound them as one stat;
 * {@link journalModifiersFor} translates the single result back afterward.
 *
 * @internal
 */
export function primitiveEngineeringInputsFor(
    stats: OutfittingModule,
    grade: BlueprintGrade,
    experimental?: ExperimentalEffect,
): { grade: BlueprintGrade; experimental?: ExperimentalEffect } {
    const canonicalGrade = {
        ...grade,
        features: grade.features.map((feature) => {
            const label = primitiveLabelFor(stats, feature.label);
            return label === feature.label ? feature : { ...feature, label };
        }),
    };
    if (!experimental) return { grade: canonicalGrade };
    return {
        grade: canonicalGrade,
        experimental: {
            ...experimental,
            modifiers: experimental.modifiers.map((modifier) => {
                const label = primitiveLabelFor(stats, modifier.label);
                return label === modifier.label ? modifier : { ...modifier, label };
            }),
        },
    };
}

/** Round a journal number to Frontier's six serialized decimal places. */
const round6 = (value: number): number => {
    const rounded = Math.round(value * 1e6) / 1e6;
    return Object.is(rounded, -0) ? 0 : rounded;
};

/** Frontier's firing-cycle duration, with a float stored after every operation. */
function float32FiringCycle(
    interval: number,
    burstRounds: number,
    burstRateOfFire: number,
): number | undefined {
    if (interval <= 0) return undefined;
    const withinBurst =
        burstRounds > 1
            ? Math.fround(Math.fround(burstRounds - 1) / Math.fround(burstRateOfFire))
            : 0;
    const cycle = Math.fround(withinBurst + Math.fround(interval));
    return cycle > 0 ? cycle : undefined;
}

/** Frontier's firing rate derived from one stored firing cycle. */
function float32RateOfFire(
    interval: number,
    burstRounds: number,
    burstRateOfFire: number,
): number | undefined {
    const cycle = float32FiringCycle(interval, burstRounds, burstRateOfFire);
    return cycle === undefined ? undefined : Math.fround(Math.fround(burstRounds) / cycle);
}

/** A discrete weapon's displayed DPS, using a cycle directly when one is available. */
function float32DamagePerSecond(
    damage: number,
    rounds: number,
    rate: number,
    burstRounds: number,
    cycle?: number,
): number {
    if (cycle !== undefined && (rounds !== 1 || burstRounds !== 1)) {
        const damagePerCycle = Math.fround(
            Math.fround(Math.fround(damage) * Math.fround(rounds)) * Math.fround(burstRounds),
        );
        return Math.fround(damagePerCycle / cycle);
    }
    return Math.fround(Math.fround(Math.fround(damage) * Math.fround(rounds)) * Math.fround(rate));
}

const JOURNAL_MODIFIER_ORDER = [
    'CargoCapacity',
    'GuardianModuleResistance',
    'Mass',
    'Integrity',
    'PowerDraw',
    'BootTime',
    'PowerCapacity',
    'HeatEfficiency',
    'FSDOptimalMass',
    'MaxFuelPerJump',
    'FSDHeatRate',
    'EngineOptimalMass',
    'EngineOptPerformance',
    'EngineHeatRate',
    'ShieldGenOptimalMass',
    'ShieldGenStrength',
    'DamagePerSecond',
    'Damage',
    'DistributorDraw',
    'ThermalLoad',
    'ArmourPenetration',
    'MaximumRange',
    'ShotSpeed',
    'RateOfFire',
    'DamageType',
    '$Kinetic;',
    '$Thermal;',
    '$Explosive;',
    '$Absolute;',
    'AmmoClipSize',
    'AmmoMaximum',
    'ReloadTime',
    'Jitter',
    'DamageFalloffRange',
    'DefenceModifierShieldMultiplier',
    'DefenceModifierHealthMultiplier',
    'DefenceModifierHealthAddition',
    'DefenceModifierShieldAddition',
    'RegenRate',
    'BrokenRegenRate',
    'EnergyPerRegen',
    'KineticResistance',
    'ThermicResistance',
    'ExplosiveResistance',
    'CausticResistance',
    'DamageProtection',
    'ModuleDefenceAbsorption',
    'WeaponsCapacity',
    'WeaponsRecharge',
    'EnginesCapacity',
    'EnginesRecharge',
    'SystemsCapacity',
    'SystemsRecharge',
    'ShieldBankSpinUp',
    'ShieldBankDuration',
    'ShieldBankReinforcement',
    'ShieldBankHeat',
    'FSDInterdictorRange',
    'FSDInterdictorFacingLimit',
    'SensorTargetScanAngle',
    'MaxAngle',
    'ScannerTimeToScan',
    'Range',
    'DSS_PatchRadius',
    'FuelScoopRate',
    'FuelCapacity',
] as const;

const JOURNAL_MODIFIER_RANK: ReadonlyMap<string, number> = new Map(
    JOURNAL_MODIFIER_ORDER.map((label, index) => [label, index]),
);

/** Stable ordering used by Frontier's outfitting/journal stat list. */
function sortJournalModifiers(modifiers: EngineeringModifier[]): EngineeringModifier[] {
    return modifiers
        .map((modifier, index) => ({ modifier, index }))
        .sort(
            (a, b) =>
                (JOURNAL_MODIFIER_RANK.get(a.modifier.Label) ?? JOURNAL_MODIFIER_ORDER.length) -
                    (JOURNAL_MODIFIER_RANK.get(b.modifier.Label) ??
                        JOURNAL_MODIFIER_ORDER.length) || a.index - b.index,
        )
        .map(({ modifier }) => modifier);
}

/**
 * Present computed primitive modifiers the way Frontier writes them to a journal.
 *
 * This does no blueprint arithmetic. It maps the one result of {@link computeModifiers}
 * onto module-specific aliases and derives display stats such as weapon DPS and rate of
 * fire. Keeping this in the loadout adapter prevents a second calculator from becoming
 * another source of truth.
 *
 * Reference: Frontier journal `Loadout` captures, including the 29-engineered-module
 * Federal Corvette reconstruction fixture. Frontier is credited in `ATTRIBUTIONS.md`.
 *
 * @internal
 */
export function journalModifiersFor(
    stats: OutfittingModule,
    modifiers: EngineeringModifier[],
): EngineeringModifier[] {
    const weapon = stats.damage !== undefined;
    const valueFor = (label: string, fallback: number): number => {
        const modifier = modifiers.find((candidate) => candidate.Label === label);
        return (modifier && preciseModifierValue(modifier)) ?? Math.fround(fallback);
    };
    const burstTouched = ['BurstInterval', 'BurstSize', 'BurstRateOfFire'].some((label) =>
        modifiers.some((modifier) => modifier.Label === label),
    );
    const damageTouched = modifiers.some((modifier) => modifier.Label === 'Damage');
    const rateTouched =
        burstTouched || modifiers.some((modifier) => modifier.Label === 'RateOfFire');

    let damagePerSecond: EngineeringModifier | undefined;
    let derivedRate: EngineeringModifier | undefined;
    if (weapon && (damageTouched || rateTouched)) {
        const continuous = stats.burstInterval === undefined && stats.rateOfFire === undefined;
        const baseDamage = Math.fround(stats.damage!);
        const effectiveDamage = valueFor('Damage', stats.damage!);
        if (continuous) {
            damagePerSecond = {
                Label: 'DamagePerSecond',
                Value: round6(effectiveDamage),
                OriginalValue: round6(baseDamage),
            };
        } else {
            const burstRounds = valueFor('BurstSize', stats.burstRounds ?? 1);
            const burstRate = valueFor('BurstRateOfFire', stats.burstRateOfFire ?? 1);
            const baseBurstRounds = Math.fround(stats.burstRounds ?? 1);
            const baseBurstRate = Math.fround(stats.burstRateOfFire ?? 1);
            const baseInterval =
                stats.burstInterval === undefined ? undefined : Math.fround(stats.burstInterval);
            const baseCycle =
                baseInterval === undefined
                    ? undefined
                    : float32FiringCycle(baseInterval, baseBurstRounds, baseBurstRate);
            const baseRate =
                baseInterval !== undefined
                    ? float32RateOfFire(baseInterval, baseBurstRounds, baseBurstRate)
                    : stats.rateOfFire === undefined
                      ? undefined
                      : Math.fround(stats.rateOfFire);
            const rateModifier = modifiers.find((modifier) => modifier.Label === 'RateOfFire');
            const effectiveRate = rateModifier && preciseModifierValue(rateModifier);
            const effectiveInterval = valueFor('BurstInterval', stats.burstInterval ?? 0);
            const effectiveCycle =
                effectiveRate === undefined
                    ? float32FiringCycle(effectiveInterval, burstRounds, burstRate)
                    : undefined;
            const rate =
                effectiveRate ??
                (effectiveCycle === undefined
                    ? undefined
                    : Math.fround(Math.fround(burstRounds) / effectiveCycle));
            if (baseRate !== undefined && rate !== undefined) {
                const stockRounds = Math.fround(stats.roundsPerShot ?? 1);
                const effectiveRounds = Math.fround(
                    modifiers.find(
                        (modifier) =>
                            modifier.Label === 'Rounds' || modifier.Label === 'RoundsPerShot',
                    )?.Value ?? stockRounds,
                );
                damagePerSecond = {
                    Label: 'DamagePerSecond',
                    Value: round6(
                        float32DamagePerSecond(
                            effectiveDamage,
                            effectiveRounds,
                            rate,
                            burstRounds,
                            effectiveCycle,
                        ),
                    ),
                    OriginalValue: round6(
                        float32DamagePerSecond(
                            baseDamage,
                            stockRounds,
                            baseRate,
                            baseBurstRounds,
                            baseCycle,
                        ),
                    ),
                };
                if (burstTouched) {
                    derivedRate = {
                        Label: 'RateOfFire',
                        Value: round6(rate),
                        OriginalValue: round6(baseRate),
                    };
                }
            }
        }
    }

    const result: EngineeringModifier[] = [];
    for (const modifier of modifiers) {
        const label = modifier.Label;
        if (weapon && ['BurstInterval', 'BurstSize', 'BurstRateOfFire'].includes(label)) continue;
        if (weapon && label === 'Damage' && stats.rateOfFire === undefined) continue;
        let journalLabel = label;
        if (weapon && label === 'Range') journalLabel = 'MaximumRange';
        else if (weapon && label === 'FalloffRange') journalLabel = 'DamageFalloffRange';
        else if (!weapon && label === 'ScannerRange') journalLabel = 'Range';
        else if (label === 'ProbeRadius') journalLabel = 'DSS_PatchRadius';
        else if (label === 'RefuelRate') journalLabel = 'FuelScoopRate';
        else if (label === 'DistributorDraw' && stats.shieldRegenRate !== undefined) {
            journalLabel = 'EnergyPerRegen';
        }
        result.push(journalLabel === label ? modifier : { ...modifier, Label: journalLabel });
    }
    if (damagePerSecond) result.push(damagePerSecond);
    if (derivedRate) {
        const direct = result.findIndex((modifier) => modifier.Label === 'RateOfFire');
        if (direct >= 0) result[direct] = derivedRate;
        else result.push(derivedRate);
    }
    return sortJournalModifiers(result);
}

/**
 * Whether captured engineering identifies a final pre-engineered Guardian weapon.
 *
 * Guardian weapon stock modules offer only Anti-Guardian Zone Resistance. A journal or
 * build that instead names a real ordinary weapon recipe is describing the bought or
 * awarded article carrying that recipe, including articles not present in the narrower
 * pre-engineered catalogue. Those articles accept no further engineering.
 *
 * @internal
 */
export function isFinalGuardianWeaponEngineering(item: string, blueprint: string): boolean {
    const group = getEngineeringGroup(item);
    if (group === null || !GUARDIAN_WEAPON_GROUPS.has(group)) return false;
    const resolved = resolveBlueprintForModule(item, blueprint);
    return getBlueprint(resolved) !== null && !blueprintAvailableFor(item, blueprint);
}

/**
 * The record a menu check reads, with its journal-label base values — or `null` when
 * there is nothing to offer: an unresolvable symbol, or an article sold in a final state
 * that accepts no further engineering.
 */
function engineerableBase(
    item: string,
    statsOverride?: OutfittingModule | null,
): { stats: OutfittingModule; base: Readonly<Record<string, number>> } | null {
    const stats = statsOverride ?? builtInModuleBySymbol(item, FITTED_ITEM);
    if (!stats || stats.engineeringLocked) return null;
    return { stats, base: baseStats(stats) };
}

/** Blueprints the fitted article's menu offers whose modifiers can also be computed. @internal */
export function availableBlueprintsFor(
    item: string,
    statsOverride?: OutfittingModule | null,
): AvailableBlueprint[] {
    const engineerable = engineerableBase(item, statsOverride);
    if (!engineerable) return [];
    const { stats, base } = engineerable;
    const available: AvailableBlueprint[] = [];
    for (const fdname of getBlueprintsForModule(item)) {
        const blueprint = BLUEPRINTS[fdname];
        if (!blueprint) continue;
        const grades = Object.entries(blueprint.grades)
            .filter(([, grade]) => missingBaseLabels(stats, base, grade.features).length === 0)
            .map(([grade]) => Number(grade))
            .filter(Number.isFinite)
            .sort((a, b) => a - b);
        if (grades.length > 0) available.push({ fdname, grades });
    }
    return available;
}

/** Experimental effects the fitted article offers whose modifiers can also be computed. @internal */
export function availableExperimentalsFor(
    item: string,
    statsOverride?: OutfittingModule | null,
): string[] {
    const engineerable = engineerableBase(item, statsOverride);
    if (!engineerable) return [];
    const { stats, base } = engineerable;
    return getExperimentalsForModule(item).filter((fdname) => {
        const effect = EXPERIMENTAL_EFFECTS[fdname];
        return (
            effect !== undefined && missingBaseLabels(stats, base, effect.modifiers).length === 0
        );
    });
}
