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

import { getLoadoutModifier, type LoadoutModule } from './slef.js';
import { fieldForLabel, labelsForField, scaleForLabel } from './module-stat-labels.js';
import type { OutfittingModule } from './modules.js';
import { getModulesForShip } from './modules.js';
import { CORE_MODULES } from './modules-core.js';
import { getShipBySymbol } from './ships.js';
import { statFor } from './loadout-engineering.js';
import type { PowerConsumer } from './power.js';
import type { ShieldBoosterParams, ShieldGeneratorParams, ShieldInput } from './shields.js';
import type {
    ArmourInput,
    BulkheadParams,
    HullReinforcementParams,
    ModuleReinforcementParams,
} from './armour.js';
import { combinedRateOfFire, type WeaponStats } from './weapons.js';
import { isStatUnknown } from './unknown-stats.js';

/**
 * Symbol prefixes that identify a module group, lower-cased.
 *
 * @remarks
 * Classifying by symbol is the weaker way to do this, and `powerPlant` is the one entry
 * that no longer needs it: a power plant's record names the mount it fills, so
 * {@link powerAvailable} reads {@link OutfittingModule.slot} and falls back to this only
 * for an `Item` no catalogue knows — a build may name a module newer than this snapshot.
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
export function isEnabled(module: LoadoutModule): boolean {
    return module.On !== false;
}

/** The outfitting-panel priority group (1–5) of a fitted module. */
export function priorityOf(module: LoadoutModule): number {
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
export function effectiveStat(
    module: LoadoutModule,
    field: keyof OutfittingModule,
    stats: OutfittingModule | null = statFor(module.Item),
): number | undefined {
    for (const label of labelsForField(field)) {
        const modified = getLoadoutModifier(module, label);
        if (modified !== null) return modified / scaleForLabel(label);
    }
    const base = stats?.[field];
    return typeof base === 'number' ? base : undefined;
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
 * A stat that the game moves in step with another: a shield generator's minimum and
 * maximum mass follow its optimal mass, and its minimum and maximum strength follow its
 * optimal strength. An explicit modifier for the stat itself still wins.
 *
 * @remarks
 * Reference: EDSY's `getRelatedAttrModifier` (`genminmass`, `genmaxmass`, `genminmul`,
 * `genmaxmul` all return the optimal stat's modifier). Blueprint recipes only name the
 * optimal figure, so without this an engineered generator's curve would be built from a
 * moved optimum and stock endpoints.
 */
function relatedStat(
    module: LoadoutModule,
    stats: OutfittingModule | null,
    field: keyof OutfittingModule,
    ratio: number,
): number | undefined {
    for (const label of labelsForField(field)) {
        const modified = getLoadoutModifier(module, label);
        if (modified !== null) return modified / scaleForLabel(label);
    }
    const base = stats?.[field];
    return typeof base === 'number' ? base * ratio : undefined;
}

/**
 * A fitted module's catalogue record with every engineered stat folded in — the
 * module as it actually performs on this build.
 */
export function effectiveModule(
    module: LoadoutModule,
    stats: OutfittingModule | null = statFor(module.Item),
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
        const value = effectiveStat(module, key, stats);
        if (value !== undefined) merged[key] = value;
    }
    // The rate of fire is derived from the firing cycle, so an engineered burst pattern
    // moves it even when nothing names it — same rule the weapon metrics use.
    const rate = burstAdjustedRateOfFire(module, merged);
    if (rate !== undefined) merged.rateOfFire = rate;
    // A build that carries a modifier for a stat the catalogue calls unknown has just
    // supplied it, so the record must stop saying it is missing — `unknownStats` names
    // only fields that are absent.
    if (stats.unknownStats) {
        const stillUnknown = stats.unknownStats.filter((field) => merged[field] === undefined);
        if (stillUnknown.length === 0) delete merged.unknownStats;
        else if (stillUnknown.length !== stats.unknownStats.length) {
            merged.unknownStats = stillUnknown;
        }
    }
    return merged as unknown as OutfittingModule;
}

/**
 * One fitted module's claim on the power plant, or `null` when it makes none.
 *
 * A module whose draw the catalogue knows it cannot supply (`./unknown-stats` — the
 * withdrawn Discovery Scanners) is **not** `null`: it comes back flagged
 * `drawUnknown`, so the budget reports it as unknown rather than as zero.
 */
export function powerConsumerFor(
    module: LoadoutModule,
    stats: OutfittingModule | null = statFor(module.Item),
): PowerConsumer | null {
    const draw = effectiveStat(module, 'powerDraw', stats);
    // Weapons and most utility fittings only draw while the hardpoints are out; the
    // ones flagged `alwaysPowered` (shield boosters, chaff, heat sinks, …) always draw.
    const mounted = stats?.category === 'hardpoint' || stats?.category === 'utility';
    const common = {
        priority: priorityOf(module),
        enabled: isEnabled(module),
        deployedOnly: mounted && stats?.alwaysPowered !== true,
        label: module.Slot,
    };
    if (draw === undefined) {
        // The record the module was fitted as has the last word, so a build that
        // supplied its own stats is classified by the article it actually carries.
        return isStatUnknown(stats, 'powerDraw') ? { draw: 0, drawUnknown: true, ...common } : null;
    }
    if (draw === 0) return null;
    return { draw, ...common };
}

/** The build's power-plant capacity, post-engineering, or `0` when none is fitted. */
export function powerAvailable(
    modules: readonly LoadoutModule[],
    statsFor: (module: LoadoutModule) => OutfittingModule | null = (module) => statFor(module.Item),
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

/** The four resistances a defensive module can carry, as the calculations name them. */
interface ModuleResistances {
    readonly kineticResistance: number;
    readonly thermalResistance: number;
    readonly explosiveResistance: number;
    readonly causticResistance: number;
}

/**
 * Read the four resistances off a fitted module, post-engineering. A resistance the
 * module does not carry reads as `0` — no resistance and no weakness.
 */
function resistancesOf(module: LoadoutModule, stats: OutfittingModule | null): ModuleResistances {
    return {
        kineticResistance: effectiveStat(module, 'kineticResistance', stats) ?? 0,
        thermalResistance: effectiveStat(module, 'thermalResistance', stats) ?? 0,
        explosiveResistance: effectiveStat(module, 'explosiveResistance', stats) ?? 0,
        causticResistance: effectiveStat(module, 'causticResistance', stats) ?? 0,
    };
}

/** Gather a build's shield generator, boosters and Guardian reinforcement. */
export function shieldInputFor(
    shipSymbol: string,
    modules: readonly LoadoutModule[],
    systemsPips: number,
    statsFor: (module: LoadoutModule) => OutfittingModule | null = (module) => statFor(module.Item),
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
    const variants = getModulesForShip(hull.name, CORE_MODULES);
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
    statsFor: (module: LoadoutModule) => OutfittingModule | null = (module) => statFor(module.Item),
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
                  kineticResistance: stock.kineticResistance ?? 0,
                  thermalResistance: stock.thermalResistance ?? 0,
                  explosiveResistance: stock.explosiveResistance ?? 0,
                  causticResistance: stock.causticResistance ?? 0,
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
 * Two figures need more than a per-field read. The **rate of fire** is derived from the
 * firing cycle, so a recipe that changes the burst pattern (Double Shot gives a weapon a
 * two-round burst) moves it even when the build carries no `RateOfFire` modifier — it is
 * rebuilt from the parts whenever one of them has been engineered. And the **falloff
 * range** is held to the weapon's maximum range, as Coriolis's `getFalloff` does.
 */
export function weaponStatsFor(
    module: LoadoutModule,
    stats: OutfittingModule | null = statFor(module.Item),
): WeaponStats | null {
    if (!stats || stats.category !== 'hardpoint') return null;
    const weapon: Record<string, unknown> = {};
    for (const field of WEAPON_FIELDS) {
        const value = effectiveStat(module, field, stats);
        if (value !== undefined) weapon[field] = value;
    }

    const rate = burstAdjustedRateOfFire(module, weapon);
    if (rate !== undefined) weapon.rateOfFire = rate;

    const { maximumRange, falloffRange } = weapon as WeaponStats;
    if (maximumRange !== undefined && falloffRange !== undefined && falloffRange > maximumRange) {
        weapon.falloffRange = maximumRange;
    }

    // Engineering never redistributes damage across types, so the split is the
    // catalogue's own.
    if (stats.damageDistribution) weapon.damageDistribution = stats.damageDistribution;
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
