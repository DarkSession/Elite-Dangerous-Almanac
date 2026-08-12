/**
 * Internal adapters that read a fitted build into the inputs the data-free build
 * calculations (`./power`, `./shields`, `./armour`, `./weapons`) take.
 *
 * Everything here resolves a module's **effective** stat: the journal modifier the
 * build carries for it when engineering has moved it, and the catalogue's base value
 * otherwise.
 *
 * @internal
 */

import { getLoadoutModifier, type LoadoutModule } from '../slef.js';
import {
    capabilityValueForLabel,
    damageTypeForLabel,
    fieldForLabel,
    labelsForField,
    scaleForLabel,
} from './module-stat-labels.js';
import type { DamageDistribution, OutfittingModule } from '../modules.js';
import { getBulkheadsForShip } from '../modules.js';
import { getExperimentalEffect } from '../experimental-effects.js';
import { CORE_MODULES } from '../modules-core.js';
import { getShipBySymbol } from '../ships.js';
import type { PowerConsumer } from '../power.js';
import type { ShieldBoosterParams, ShieldGeneratorParams, ShieldInput } from '../shields.js';
import type {
    ArmourInput,
    BulkheadParams,
    HullReinforcementParams,
    ModuleReinforcementParams,
} from '../armour.js';
import type { DamageResistanceParams } from '../resistances.js';
import { combinedRateOfFire, type WeaponStats } from '../weapons.js';
import { scaleDamageComponents } from './damage-components.js';
import { isNonOutfittingSlot } from './loadout-state.js';
import { parseSlotName } from '../slots.js';

/**
 * Symbol prefixes that identify a module group, lower-cased.
 *
 * @remarks
 * Classifying by symbol is the weaker way to do this, and `powerPlant` is the one entry
 * that does not need it in the ordinary case: a power plant's record names the mount it fills, so
 * {@link powerAvailable} reads {@link OutfittingModule.slot} and falls back to this
 * whenever no mount is named — an `Item` absent from the catalogue, or a record a caller
 * assembled without a `slot`.
 *
 * The other five have nothing better to read. A shield generator, shield booster or
 * reinforcement package fits any mount of its kind that is large enough, so it fills no
 * *one* mount and carries no `slot`; the group it belongs to is not a fact this record
 * shape holds. Match on the prefix here and the record wherever the record can answer.
 *
 * @internal
 */
const PREFIX = {
    powerPlant: ['int_powerplant', 'int_guardianpowerplant'],
    shieldGenerator: ['int_shieldgenerator'],
    shieldBooster: ['hpt_shieldbooster'],
    shieldReinforcement: ['int_guardianshieldreinforcement'],
    hullReinforcement: [
        'int_hullreinforcement',
        'int_guardianhullreinforcement',
        'int_metaalloyhullreinforcement',
    ],
    moduleReinforcement: ['int_modulereinforcement', 'int_guardianmodulereinforcement'],
} as const;

const startsWithAny = (symbol: string, prefixes: readonly string[]): boolean =>
    prefixes.some((prefix) => symbol.toLowerCase().startsWith(prefix));

/** Whether a fitted module is switched on (the journal's `On`, defaulting to `true`). */
function isEnabled(module: LoadoutModule): boolean {
    return module.On !== false;
}

/** The outfitting-panel priority group (1–5) of a fitted module. */
function priorityOf(module: LoadoutModule): number {
    // The journal's Priority is zero-based; the panel numbers the groups from 1.
    return (module.Priority ?? 0) + 1;
}

/**
 * A fitted module's effective value for one catalogue field: the build's own journal
 * modifier when it carries one, else the catalogue's base value, else `undefined`.
 *
 * Journal modifiers come back in the journal's units — a resistance as `40`, not
 * `0.4` — so each is scaled into the catalogue's before it is returned.
 */
function effectiveStat(
    module: LoadoutModule,
    field: keyof OutfittingModule,
    stats: OutfittingModule | null,
): number | undefined {
    const stated = statedModifier(module, field);
    if (stated !== undefined) return stated;
    const base = stats?.[field];
    return typeof base === 'number' ? base : undefined;
}

/**
 * The build's own journal modifier for one catalogue field, in the catalogue's units, or
 * `undefined` when it carries none.
 *
 * Capability labels share the modifier collection but never represent numbers, even when
 * an importer serializes the UI's displayed +100% as `Value: 1`, so they are skipped —
 * for {@link relatedStat}'s fields as much as for {@link effectiveStat}'s. A capability
 * is not a magnitude whichever stat asks, so there is nothing for either to read; today
 * the only capability label maps to `guardianZoneResistance`, which is a related stat of
 * nothing, so the skip decides no current call either way.
 */
function statedModifier(module: LoadoutModule, field: keyof OutfittingModule): number | undefined {
    for (const label of labelsForField(field)) {
        if (capabilityValueForLabel(label) !== null) continue;
        const modified = getLoadoutModifier(module, label);
        if (modified !== null) return modified / scaleForLabel(label);
    }
    return undefined;
}

/** A fitted module's effective boolean capability, when `field` is capability-backed. */
function effectiveCapability(
    module: LoadoutModule,
    field: keyof OutfittingModule,
    stats: OutfittingModule,
): boolean | undefined {
    for (const label of labelsForField(field)) {
        if (capabilityValueForLabel(label) === null) continue;
        if (
            module.Engineering?.Modifiers?.some(
                (modifier) => modifier.Label.toLowerCase() === label.toLowerCase(),
            )
        ) {
            return true;
        }
    }
    const base = stats[field];
    return typeof base === 'boolean' ? base : undefined;
}

/** A fitted weapon's damage split after an effect or journal modifiers convert it. */
function effectiveDamageDistribution(
    module: LoadoutModule,
    stats: OutfittingModule,
): DamageDistribution | undefined {
    const fromEffect = module.Engineering?.ExperimentalEffect
        ? getExperimentalEffect(module.Engineering.ExperimentalEffect)?.damageDistribution
        : undefined;
    const distribution: Record<string, number> = {
        ...(fromEffect ?? stats.damageDistribution),
    };
    let resolved = fromEffect !== undefined || stats.damageDistribution !== undefined;
    for (const modifier of module.Engineering?.Modifiers ?? []) {
        if (modifier.Value === undefined) continue;
        const type = damageTypeForLabel(modifier.Label);
        if (type === null) continue;
        distribution[type] = modifier.Value / scaleForLabel(modifier.Label);
        resolved = true;
    }
    return resolved ? (distribution as DamageDistribution) : undefined;
}

/** Whether engineering replaces exact base damage components with a converted split. */
function convertsDamage(module: LoadoutModule): boolean {
    if (
        module.Engineering?.ExperimentalEffect &&
        getExperimentalEffect(module.Engineering.ExperimentalEffect)?.damageDistribution
    ) {
        return true;
    }
    return (module.Engineering?.Modifiers ?? []).some(
        (modifier) => damageTypeForLabel(modifier.Label) !== null,
    );
}

/**
 * How far engineering has moved one stat, as a ratio of its base value — `1` when the
 * build carries no modifier for it, or when the catalogue has no base to compare with.
 */
function modifierRatio(
    module: LoadoutModule,
    stats: OutfittingModule | null,
    field: keyof OutfittingModule,
): number {
    const base = stats?.[field];
    if (typeof base !== 'number' || base === 0) return 1;
    const effective = effectiveStat(module, field, stats);
    return effective === undefined ? 1 : effective / base;
}

/**
 * A stat that the game moves in step with another: thruster and shield-generator minimum
 * and maximum mass follow optimal mass, and a generator's minimum and maximum strength
 * follow optimal strength. An explicit modifier for the stat itself still wins.
 *
 * @remarks
 * Reference: EDSY's `getRelatedAttrModifier` (`engminmass`, `engmaxmass`, `genminmass`,
 * `genmaxmass`, `genminmul`, and `genmaxmul` return the relevant optimal stat's
 * modifier). Blueprint recipes only name the optimal figure, so without this an
 * engineered performance curve would be built from a moved optimum and stock endpoints.
 */
function relatedStat(
    module: LoadoutModule,
    stats: OutfittingModule | null,
    field: keyof OutfittingModule,
    ratio: number,
): number | undefined {
    const stated = statedModifier(module, field);
    if (stated !== undefined) return stated;
    const base = stats?.[field];
    return typeof base === 'number' ? base * ratio : undefined;
}

/**
 * A fitted module's catalogue record with every engineered stat folded in — the
 * module as it actually performs on this build.
 */
export function effectiveModule(
    module: LoadoutModule,
    stats: OutfittingModule | null,
): OutfittingModule | null {
    if (!stats || !module.Engineering) return stats;
    const merged: Record<string, unknown> = { ...stats };
    // Every stat the record carries, plus any the engineering *introduces* — Double
    // Shot gives a burst size to a weapon whose catalogue record has none.
    const fields = new Set<keyof OutfittingModule>(
        Object.keys(stats) as (keyof OutfittingModule)[],
    );
    // A SLEF export may name a blueprint without stating its modifiers; then there is
    // nothing to fold in beyond the fields the catalogue record already carries.
    for (const modifier of module.Engineering.Modifiers ?? []) {
        const field = fieldForLabel(modifier.Label, stats);
        if (field) fields.add(field);
    }
    for (const key of fields) {
        const capability = effectiveCapability(module, key, stats);
        if (capability !== undefined) {
            merged[key] = capability;
            continue;
        }
        const value = effectiveStat(module, key, stats);
        if (value !== undefined) merged[key] = value;
    }
    if (stats.engineeringGroup === 'thrusters') {
        const massRatio = modifierRatio(module, stats, 'optMass');
        const minMass = relatedStat(module, stats, 'minMass', massRatio);
        const maxMass = relatedStat(module, stats, 'maxMass', massRatio);
        if (minMass !== undefined) merged.minMass = minMass;
        if (maxMass !== undefined) merged.maxMass = maxMass;
    }
    const damageDistribution = effectiveDamageDistribution(module, stats);
    if (damageDistribution) merged.damageDistribution = damageDistribution;
    if (stats.category === 'hardpoint') normalizeEffectiveWeapon(module, merged);
    // Exact components follow the effective total damage. Once engineering converts
    // them, the resulting fractional split is authoritative instead.
    if (convertsDamage(module)) {
        delete merged.damageComponents;
    } else if (stats.damageComponents) {
        merged.damageComponents = scaleDamageComponents(
            stats.damageComponents,
            stats.damage,
            typeof merged.damage === 'number' ? merged.damage : undefined,
        );
    }
    return merged as unknown as OutfittingModule;
}

/** One fitted module's claim on the power plant, or `null` when it legitimately makes none. */
export function powerConsumerFor(
    module: LoadoutModule,
    stats: OutfittingModule | null,
): PowerConsumer | null {
    const draw = effectiveStat(module, 'powerDraw', stats);
    const parsedSlot = parseSlotName(module.Slot);
    // Weapons and most utility fittings only draw while the hardpoints are out; the
    // ones flagged `alwaysPowered` (shield boosters, chaff, heat sinks, …) always draw.
    const mounted = stats?.category === 'hardpoint' || stats?.category === 'utility';
    const deployedOnly =
        stats !== null
            ? mounted && stats.alwaysPowered !== true
            : parsedSlot?.kind === 'hardpoint'
              ? true
              : parsedSlot?.kind === 'utility'
                ? undefined
                : false;
    const common = {
        priority: priorityOf(module),
        enabled: isEnabled(module),
        ...(deployedOnly === undefined ? {} : { deployedOnly }),
        label: module.Slot,
    };
    if (draw === undefined) {
        // A known record without a draw is a passive fitting (bulkheads, cargo racks,
        // cabins, reinforcement packages, …). Unknown modules in recognised powered
        // mounts are different: omitting them would make the budget quietly optimistic.
        const inherentlyPassiveSlot =
            parsedSlot?.kind === 'armour' ||
            (parsedSlot?.kind === 'core' &&
                (parsedSlot.core === 'powerPlant' || parsedSlot.core === 'fuelTank'));
        if (stats !== null || inherentlyPassiveSlot || isNonOutfittingSlot(module.Slot))
            return null;
        return { drawUnknown: true, ...common };
    }
    if (draw === 0) return null;
    return { draw, ...common };
}

/** The build's power-plant capacity, post-engineering, or `0` when none is fitted. */
export function powerAvailable(
    modules: readonly LoadoutModule[],
    statsFor: (module: LoadoutModule) => OutfittingModule | null,
): number {
    for (const module of modules) {
        const stats = statsFor(module);
        // A record that names its mount is believed; the prefix answers when none does
        // — an `Item` this snapshot's catalogue has no record for, or a record a caller
        // assembled without a `slot`. Falling back on the *absent field* rather than on
        // the absent record is what keeps a hand-built record reading as it always has.
        const isPlant = stats?.slot
            ? stats.slot === 'powerPlant'
            : startsWithAny(module.Item, PREFIX.powerPlant);
        if (!isPlant) continue;
        if (!isEnabled(module)) return 0; // a switched-off plant powers nothing
        return effectiveStat(module, 'powerCapacity', stats) ?? 0;
    }
    return 0;
}

/** The four resistances a defensive module can carry, every one of them answered. */
type ModuleResistances = Required<DamageResistanceParams>;

/**
 * Build the four resistance fields by calling `read` once per field — the same fan-out
 * `mapDamageTypes` does, over the `<type>Resistance` names a module record carries rather
 * than the bare types. A field the source does not carry reads as `0` — no resistance and
 * no weakness.
 */
function mapResistanceFields(
    read: (field: keyof ModuleResistances) => number | undefined,
): ModuleResistances {
    return {
        kineticResistance: read('kineticResistance') ?? 0,
        thermalResistance: read('thermalResistance') ?? 0,
        explosiveResistance: read('explosiveResistance') ?? 0,
        causticResistance: read('causticResistance') ?? 0,
    };
}

/**
 * Read the four resistances off a fitted module, post-engineering. A resistance the
 * module does not carry reads as `0` — no resistance and no weakness.
 */
function resistancesOf(module: LoadoutModule, stats: OutfittingModule | null): ModuleResistances {
    return mapResistanceFields((field) => effectiveStat(module, field, stats));
}

/** Gather a build's shield generator, boosters and Guardian reinforcement. */
export function shieldInputFor(
    shipSymbol: string,
    modules: readonly LoadoutModule[],
    systemsPips: number,
    statsFor: (module: LoadoutModule) => OutfittingModule | null,
): ShieldInput {
    const hull = getShipBySymbol(shipSymbol);
    let generator: ShieldGeneratorParams | null = null;
    const boosters: ShieldBoosterParams[] = [];
    let reinforcement = 0;

    for (const module of modules) {
        if (!isEnabled(module)) continue;
        const stats = statsFor(module);
        if (!generator && startsWithAny(module.Item, PREFIX.shieldGenerator)) {
            const massRatio = modifierRatio(module, stats, 'optMass');
            const strengthRatio = modifierRatio(module, stats, 'optMultiplier');
            const optMass = effectiveStat(module, 'optMass', stats);
            const minMass = relatedStat(module, stats, 'minMass', massRatio);
            // Lightening a generator never lowers the hull mass it can still cover.
            const maxMass = relatedStat(module, stats, 'maxMass', Math.max(1, massRatio));
            const optMultiplier = effectiveStat(module, 'optMultiplier', stats);
            const minMultiplier = relatedStat(module, stats, 'minMultiplier', strengthRatio);
            const maxMultiplier = relatedStat(module, stats, 'maxMultiplier', strengthRatio);
            // A generator whose record is missing part of its curve still counts as
            // fitted; the curve then resolves to 0 rather than the build reading as
            // having no shield generator at all.
            generator = {
                ...(optMass === undefined ? {} : { optMass }),
                ...(minMass === undefined ? {} : { minMass }),
                ...(maxMass === undefined ? {} : { maxMass }),
                ...(optMultiplier === undefined ? {} : { optMultiplier }),
                ...(minMultiplier === undefined ? {} : { minMultiplier }),
                ...(maxMultiplier === undefined ? {} : { maxMultiplier }),
                ...resistancesOf(module, stats),
            };
        } else if (startsWithAny(module.Item, PREFIX.shieldBooster)) {
            boosters.push({
                shieldBoost: effectiveStat(module, 'shieldBoost', stats) ?? 0,
                ...resistancesOf(module, stats),
            });
        } else if (startsWithAny(module.Item, PREFIX.shieldReinforcement)) {
            reinforcement += effectiveStat(module, 'shieldAddition', stats) ?? 0;
        }
    }

    return {
        hullMass: hull?.hullMass ?? 0,
        baseShieldStrength: hull?.baseShieldStrength ?? 0,
        generator,
        boosters,
        reinforcement,
        systemsPips,
    };
}

/**
 * The armour a hull flies with when no bulkhead has been fitted explicitly — the stock
 * lightweight alloy every hull leaves the shipyard with.
 */
function stockBulkhead(shipSymbol: string): OutfittingModule | null {
    const hull = getShipBySymbol(shipSymbol);
    if (!hull) return null;
    const variants = getBulkheadsForShip(hull.name, CORE_MODULES);
    // The Caspian Explorer's stock alloy is spelled `..._Grade1_Default`; every other
    // hull's is the zero-mass first entry.
    return (
        variants.find((v) => v.symbol.toLowerCase().endsWith('_default')) ??
        variants.find((v) => v.mass === 0) ??
        variants[0] ??
        null
    );
}

/** Gather a build's bulkhead and reinforcement packages. */
export function armourInputFor(
    shipSymbol: string,
    modules: readonly LoadoutModule[],
    statsFor: (module: LoadoutModule) => OutfittingModule | null,
): ArmourInput {
    const hull = getShipBySymbol(shipSymbol);
    const reinforcements: HullReinforcementParams[] = [];
    const moduleReinforcements: ModuleReinforcementParams[] = [];
    let bulkhead: BulkheadParams | null = null;

    for (const module of modules) {
        if (!isEnabled(module)) continue;
        const stats = statsFor(module);
        // Lower-cased: a producer may write the slot key either way, and a bulkhead
        // missed here would silently be reported as the hull's stock alloy.
        if (module.Slot.toLowerCase() === 'armour') {
            bulkhead = {
                hullBoost: effectiveStat(module, 'hullBoost', stats) ?? 0,
                ...resistancesOf(module, stats),
            };
        } else if (startsWithAny(module.Item, PREFIX.hullReinforcement)) {
            // A stock package has no hull boost; only an engineered one does, and then
            // the journal modifier is the whole bonus — reported, like every other
            // percentage stat, as a percentage rather than a fraction.
            const boost = getLoadoutModifier(module, 'DefenceModifierHealthMultiplier');
            reinforcements.push({
                hullReinforcement: effectiveStat(module, 'hullReinforcement', stats) ?? 0,
                hullBoost:
                    boost === null ? 0 : boost / scaleForLabel('DefenceModifierHealthMultiplier'),
                ...resistancesOf(module, stats),
            });
        } else if (startsWithAny(module.Item, PREFIX.moduleReinforcement)) {
            moduleReinforcements.push({
                moduleProtection: effectiveStat(module, 'moduleProtection', stats) ?? 0,
                integrity: effectiveStat(module, 'integrity', stats) ?? 0,
            });
        }
    }

    if (!bulkhead) {
        const stock = stockBulkhead(shipSymbol);
        bulkhead = stock
            ? {
                  hullBoost: stock.hullBoost ?? 0,
                  ...mapResistanceFields((field) => stock[field]),
              }
            : null;
    }

    return {
        baseArmour: hull?.baseArmour ?? 0,
        bulkhead,
        reinforcements,
        moduleReinforcements,
    };
}

/** The weapon fields read straight off the fitted module, post-engineering. */
const WEAPON_FIELDS = [
    'damage',
    'roundsPerShot',
    'rateOfFire',
    'burstInterval',
    'burstRounds',
    'burstRateOfFire',
    'chargeTime',
    'clipSize',
    'ammoMaximum',
    'reloadTime',
    'distributorDraw',
    'thermalLoad',
    'powerDraw',
    'maximumRange',
    'falloffRange',
    'armourPiercing',
] as const;

/**
 * A fitted weapon's stats, post-engineering.
 *
 * @remarks
 * Several values need more than a per-field read. The **rate of fire** is derived from
 * the firing cycle, so a recipe that changes the burst pattern (Double Shot gives a
 * weapon a two-round burst) moves it even when the build carries no `RateOfFire`
 * modifier. The **falloff range** is held to the weapon's maximum range. Exact
 * **damage components** scale by the effective/base damage ratio so ordinary engineering
 * keeps their proportions; a damage-converting experimental replaces them with its fixed
 * distribution. A Plasma Conversion blueprint supplies its grade's converted split, and
 * journal damage-type modifiers can override the catalogue result. A journal's derived
 * `DamagePerSecond` modifier is authoritative for the fitted article; it is divided by
 * the effective rounds and firing rate to recover the per-round `damage` consumed by the
 * data-free weapon functions. This matters especially for engineered beam lasers, whose
 * journal block states no separate `Damage` modifier.
 * **Projectile boundary parameters** are copied unchanged because they are not ordinary
 * engineerable range fields.
 */
export function weaponStatsFor(
    module: LoadoutModule,
    stats: OutfittingModule | null,
): WeaponStats | null {
    if (!stats || stats.category !== 'hardpoint') return null;
    const weapon: Record<string, unknown> = {};
    for (const field of WEAPON_FIELDS) {
        const value = effectiveStat(module, field, stats);
        if (value !== undefined) weapon[field] = value;
    }

    normalizeEffectiveWeapon(module, weapon);

    const damageDistribution = effectiveDamageDistribution(module, stats);
    if (damageDistribution) weapon.damageDistribution = damageDistribution;
    if (stats.damageComponents && !convertsDamage(module)) {
        weapon.damageComponents = scaleDamageComponents(
            stats.damageComponents,
            stats.damage,
            typeof weapon.damage === 'number' ? weapon.damage : undefined,
        );
    }
    if (stats.projectileRange) weapon.projectileRange = { ...stats.projectileRange };
    return weapon as WeaponStats;
}

/**
 * The rate of fire once an engineered burst pattern is taken into account, or
 * `undefined` when nothing needs adjusting.
 *
 * An explicit `RateOfFire` modifier is the game's own answer and wins outright. Failing
 * that, if the build has engineered the burst size, the within-burst rate or the
 * interval, the cycle is rebuilt from those parts.
 */
function burstAdjustedRateOfFire(
    module: LoadoutModule,
    weapon: Readonly<Record<string, unknown>>,
): number | undefined {
    if (getLoadoutModifier(module, 'RateOfFire') !== null) return undefined;
    const touched = ['BurstSize', 'BurstRateOfFire', 'BurstInterval'].some(
        (label) => getLoadoutModifier(module, label) !== null,
    );
    if (!touched) return undefined;
    return combinedRateOfFire(weapon as WeaponStats);
}

/**
 * Apply the derived rules shared by every post-engineering view of a fitted weapon.
 *
 * The journal can state damage only as the derived `DamagePerSecond`, burst engineering
 * can change the effective firing cycle without stating a new rate, and short-range
 * engineering can leave the stock falloff beyond the reduced maximum range. Keeping the
 * three corrections together prevents a fitted module snapshot and its metrics from
 * describing different weapons.
 */
function normalizeEffectiveWeapon(module: LoadoutModule, weapon: Record<string, unknown>): void {
    const rate = burstAdjustedRateOfFire(module, weapon);
    if (rate !== undefined) weapon.rateOfFire = rate;

    const statedDamagePerSecond = getLoadoutModifier(module, 'DamagePerSecond');
    const firingFactor = Number(weapon.roundsPerShot ?? 1) * Number(weapon.rateOfFire ?? 1);
    if (statedDamagePerSecond !== null && firingFactor > 0) {
        weapon.damage = statedDamagePerSecond / firingFactor;
    }

    const { maximumRange, falloffRange } = weapon as WeaponStats;
    if (maximumRange !== undefined && falloffRange !== undefined && falloffRange > maximumRange) {
        weapon.falloffRange = maximumRange;
    }
}
