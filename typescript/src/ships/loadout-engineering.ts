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
    resolveBlueprintForModule,
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
 * Whether a module is *sold* carrying this recipe, rather than offered it at an engineer.
 *
 * The `recipe_*` keys belong to modules bought already engineered — the Mercenary shop's
 * rail gun, the community-goal and tech-broker rewards — so no engineering menu lists one
 * and the menu check alone would refuse every caller. The pre-engineered catalogue names
 * which module each arrives on, which is the same question answered by purchase instead of
 * by a menu, and it is narrower than a family: `recipe_railgun_longshot` resolves on the
 * rail gun that ships with it and nowhere else.
 *
 * What it buys is the **climb**, not the purchase. A Mercenary module arrives at grade 1
 * and its recipe publishes grades 2–5 — the grades an engineer can still add — so folding
 * one is how a caller takes a bought module further. It cannot reproduce the grade the
 * module was sold at: all 21 Mercenary rows are grade 1, none of those recipes defines a
 * grade 1, and `getBlueprintGrade` refuses that call before this check is reached. Nothing
 * here recreates a reward variant either; `pre-engineered-stats` resolves those from their
 * own `modifiers`.
 *
 * @internal
 */
function isSoldWithBlueprint(item: string, wanted: string): boolean {
    return getPreEngineeredVariants(item).some(
        (variant) => variant.blueprint.toLowerCase() === wanted,
    );
}

/**
 * Whether a module's engineering menu offers a blueprint — the check
 * {@link ShipLoadout.applyBlueprint} makes before it computes anything.
 *
 * The menu is `engineering-options`, so this answers exactly what the game offers on that
 * module, with three accommodations, applied in the order they are described here.
 *
 * The first is the module's own alias map, and it comes first because it is the one case
 * where the id names a *different* recipe rather than the same one twice: the game writes
 * `Sensor_LongRange` on a utility scanner as well as on a sensor suite, and the two roll
 * different stats. {@link resolveBlueprintForModule} turns it into the menu's
 * `Scanner_LongRange` — narrowly, per group, from pinned data, because nothing in the two
 * recipes' shape says they belong together. Every id it does not recognise passes straight
 * through, so the two checks below see what the caller wrote.
 *
 * The second is {@link isSoldWithBlueprint}: a module with no menu, or a menu that omits the
 * recipe, still accepts one it is sold already carrying. It is asked about the id as written
 * *and* about the resolved one, so resolution cannot **hide** a sale recorded under the
 * other spelling. That is deliberately the widening direction, not a symmetry: if a variant
 * in an aliased group were ever recorded under an alias *key*, the gate would accept it here
 * while `applyBlueprint` folded the resolved recipe. Nothing is recorded that way today —
 * the only pre-engineered variants in an aliased group are the two Kill Warrant Scanners'
 * `Sensor_FastScan`, which has no alias and which the menu offers anyway — so the question
 * does not arise; it is written down because no test can catch it if it ever does.
 *
 * The third is the generic spelling. Where a modification applies to several module families
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
 * launcher, whose roll is a smaller one. An id **no menu anywhere lists**
 * substitutes too, which is Anti-Guardian Zone Resistance: the game writes
 * `recipe_guardianweapon_sturdy` on a weapon and `recipe_guardianmodule_sturdy` on a
 * module, and every group lists the module id.
 *
 * Everything else is excluded by the signature, by being a menu id in its own right, or by
 * not being sold on that module. `Weapon_LightWeight` fails the signature — a weapon's Lightweight cuts distributor draw,
 * which the generic one does not touch — and `Armour_Explosive`, which rolls exactly like
 * `ShieldBooster_Explosive`, is listed by the armour menus, so it never stands in for one.
 *
 * @internal
 */
export function blueprintAvailableFor(item: string, fdname: string): boolean {
    const offered = getBlueprintsForModule(item);
    const asWritten = fdname.trim().toLowerCase();
    const resolved = resolveBlueprintForModule(item, fdname).trim();
    const wanted = resolved.toLowerCase();
    if (offered.some((id) => id.toLowerCase() === wanted)) return true;
    // Both spellings, so resolving cannot hide a sale recorded under the other one.
    if (isSoldWithBlueprint(item, wanted) || isSoldWithBlueprint(item, asWritten)) return true;
    const ambiguous = isGenericSpelling(wanted) || !MENU_IDS.has(wanted);
    if (!ambiguous) return false;
    const signature = recipeSignature(resolved);
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
 * No aliasing and no pre-engineered leg here: effect ids are unique per effect, the menu
 * already narrows a group's list to the individual module (a small Multi-cannon is one
 * effect short of a medium one), and every experimental a pre-engineered variant arrives
 * with is one its module's menu lists anyway — `pre-engineered.test.ts` asserts that, so
 * the day it stops being true a test says so rather than this quietly covering for it.
 *
 * @internal
 */
export function experimentalAvailableFor(item: string, fdname: string): boolean {
    const wanted = fdname.trim().toLowerCase();
    return getExperimentalsForModule(item).some((id) => id.toLowerCase() === wanted);
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
