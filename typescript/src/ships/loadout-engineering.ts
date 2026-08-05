/**
 * Internal catalogue adapters used by the loadout facade and fitted-module handle.
 *
 * @internal
 */

import { BLUEPRINTS, getBlueprint } from './blueprints.js';
import {
    ENGINEERING_OPTION_GROUPS,
    getBlueprintsForModule,
    getEngineeringGroup,
    getExperimentalsForModule,
} from './engineering-options.js';
import { EXPERIMENTAL_EFFECTS } from './experimental-effects.js';
import { getPreEngineeredVariants } from './pre-engineered.js';
import { baseStats, fieldForLabel, isUnknown } from './module-stat-labels.js';
import { ALL_MODULES } from './modules-all.js';
import type { OutfittingModule } from './modules.js';
import type { AvailableBlueprint } from './ship-loadout.js';

export { baseStats };

/** The complete catalogue is already part of the loadout facade; index it once. */
const MODULE_BY_SYMBOL: ReadonlyMap<string, OutfittingModule> = new Map(
    ALL_MODULES.map((module) => [module.symbol.toLowerCase(), module]),
);

/** Resolve a module's complete catalogue record across every category. @internal */
export function statFor(item: string): OutfittingModule | null {
    return MODULE_BY_SYMBOL.get(item.trim().toLowerCase()) ?? null;
}

/**
 * Modifier labels a recipe changes that **cannot be answered** for a module — the ones
 * that make {@link ShipLoadout.applyBlueprint} refuse the recipe rather than store it
 * half-applied.
 *
 * A label with no base value is not automatically one of them. The catalogue's rule is
 * that an absent stat means *the module has no such stat* unless the record names it in
 * {@link OutfittingModule.unknownStats}, and a recipe leg on a stat that is not there is
 * simply inert: Long Range scales the shot speed of a weapon that fires a projectile and
 * leaves a beam laser's alone, exactly as the game does. So a label is missing only when
 *
 * - the catalogue models **no field at all** for it, so there would be nowhere to put
 *   the result — an engineered stat this record shape cannot express; or
 * - the record declares that field **unknown**, so a value exists and nobody publishes
 *   it. Nothing can be scaled from an unknown, and guessing would be worse than
 *   refusing.
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
                    const field = fieldForLabel(label, stats);
                    return field === null || isUnknown(stats, field);
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

/** Every id any group's menu names, so an id no menu offers can be told from one it does. */
const MENU_IDS: ReadonlySet<string> = new Set(
    Object.values(ENGINEERING_OPTION_GROUPS).flatMap((group) =>
        group.blueprints.map((id) => id.toLowerCase()),
    ),
);

/**
 * Whether a module is *sold* carrying this recipe or effect, rather than offered it at an
 * engineer.
 *
 * The `recipe_*` keys belong to modules bought already engineered — the Mercenary shop's
 * rail gun, the community-goal and tech-broker rewards — so no engineering menu lists them
 * and the menu check alone would refuse a caller reproducing one. The pre-engineered
 * catalogue names which module each arrives on, which is the same question answered by
 * purchase instead of by a menu, and it is narrower than a family: `recipe_railgun_longshot`
 * resolves on the rail gun that ships with it and nowhere else. It matters most for the 21
 * Mercenary variants, whose own `modifiers` no registry publishes — folding the recipe is
 * the only way to their numbers.
 *
 * @internal
 */
function isPreEngineeredWith(item: string, wanted: string): boolean {
    return getPreEngineeredVariants(item).some(
        (variant) =>
            variant.blueprint.toLowerCase() === wanted ||
            variant.experimental?.toLowerCase() === wanted,
    );
}

/**
 * Whether a module's engineering menu offers a blueprint — the check
 * {@link ShipLoadout.applyBlueprint} makes before it computes anything.
 *
 * The menu is `engineering-options`, so this answers exactly what the game offers on that
 * module, with one accommodation. Where a modification applies to several module families
 * Frontier writes a family-specific `BlueprintName` and the menu lists that one, but a
 * build authored elsewhere carries the generic spelling instead — a life support's
 * Lightweight is `LifeSupport_LightWeight` in the menu and `Misc_LightWeight` in an
 * EDSY-authored build. So a generic id is accepted when the menu offers a *family-specific*
 * id of the same {@link recipeSignature}.
 *
 * That the alias must run *from* the ambiguous spelling *to* the menu's is what keeps it
 * honest, and there are two ambiguous kinds. A generic `Misc_*` id substitutes only for a
 * menu id that is not itself generic: `Misc_ChaffCapacity` and `Misc_HeatSinkCapacity`
 * share a signature — both are "Ammo capacity" over the same three labels — but neither is
 * a family spelling of the other, so a chaff launcher's ammo recipe stays off a heat sink
 * launcher, whose own roll is a different size. An id **no menu anywhere lists**
 * substitutes too, which is Anti-Guardian Zone Resistance: the game writes
 * `recipe_guardianweapon_sturdy` on a weapon and `recipe_guardianmodule_sturdy` on a
 * module, and every group lists the module id.
 *
 * Everything else is excluded by the signature or by being a menu id in its own right.
 * `Weapon_LightWeight` fails the signature — a weapon's Lightweight cuts distributor draw,
 * which the generic one does not touch — and `Armour_Explosive`, which rolls exactly like
 * `ShieldBooster_Explosive`, is listed by the armour menus, so it never stands in for one.
 *
 * @internal
 */
export function blueprintAvailableFor(item: string, fdname: string): boolean {
    const offered = getBlueprintsForModule(item);
    const wanted = fdname.trim().toLowerCase();
    if (offered.some((id) => id.toLowerCase() === wanted)) return true;
    if (isPreEngineeredWith(item, wanted)) return true;
    const ambiguous = isGenericSpelling(wanted) || !MENU_IDS.has(wanted);
    if (!ambiguous) return false;
    const signature = recipeSignature(fdname.trim());
    if (signature === null) return false;
    return offered.some(
        (id) =>
            recipeSignature(id) === signature &&
            // A generic spelling stands in for a family's id, never for another generic.
            (!isGenericSpelling(wanted) || !isGenericSpelling(id)),
    );
}

/**
 * Whether a module's engineering menu offers an experimental effect.
 *
 * No aliasing here: the effect ids are unique per effect, and the menu already narrows a
 * group's list to the individual module (a small Multi-cannon is one effect short of a
 * medium one).
 *
 * @internal
 */
export function experimentalAvailableFor(item: string, fdname: string): boolean {
    const wanted = fdname.trim().toLowerCase();
    return (
        getExperimentalsForModule(item).some((id) => id.toLowerCase() === wanted) ||
        isPreEngineeredWith(item, wanted)
    );
}

/** Whether any registry lists an engineering menu for this module at all. @internal */
export function isEngineerable(item: string): boolean {
    return getEngineeringGroup(item) !== null;
}

/** Blueprints the module's menu offers whose modifiers can also be computed. @internal */
export function availableBlueprintsFor(item: string): AvailableBlueprint[] {
    const stats = statFor(item);
    if (!stats) return [];
    const base = baseStats(stats);
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

/** Experimental effects the menu offers whose modifiers can also be computed. @internal */
export function availableExperimentalsFor(item: string): string[] {
    const stats = statFor(item);
    if (!stats) return [];
    const base = baseStats(stats);
    return getExperimentalsForModule(item).filter((fdname) => {
        const effect = EXPERIMENTAL_EFFECTS[fdname];
        return (
            effect !== undefined && missingBaseLabels(stats, base, effect.modifiers).length === 0
        );
    });
}
