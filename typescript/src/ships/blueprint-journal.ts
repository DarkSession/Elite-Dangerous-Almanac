/**
 * Reading a journal `BlueprintName` against the module it was written for — see
 * {@link resolveBlueprintForModule}.
 *
 * @packageDocumentation
 */

import { getBlueprintsForModule } from './engineering-options.js';
import { BLUEPRINT_JOURNAL_NAMES } from './internal/blueprint-journal-names.js';
import { normalizeKey } from '../internal/registry-index.js';
import { requireString, requireStringIfPresent } from '../internal/argument-guards.js';

/**
 * The blueprint whose numbers a module actually rolls when a journal names `blueprint` on
 * it — the same id back, except where the game spells two different recipes alike.
 *
 * **One `BlueprintName`, two recipes.** Long Range and Wide Angle are offered on the
 * internal sensor suite and on the KWS/manifest/wake scanners under the same id, and the
 * two roll different stats in opposite directions:
 *
 * | On a sensor suite | On a utility scanner |
 * | --- | --- |
 * | Long Range: `Mass` ×1.20, `ScannerRange` +0…15% | Long Range: `PowerDraw` ×1.10, `ScannerRange` +0…24% |
 * | Wide Angle: `PowerDraw` ×1.10, `ScannerRange` −4% | Wide Angle: `Mass` ×1.20, `ScannerTimeToScan` +10% |
 *
 * (Grade 1 shown.) `BLUEPRINTS` keys the scanner side under `Scanner_LongRange` /
 * `Scanner_WideAngle`, the spelling the scanner menus list, so folding the journal id as
 * written would charge the build mass where the game charges power draw.
 *
 * The same holds for `Weapon_Overcharged`, which the game writes for every weapon, though
 * a multi-cannon's also cuts the clip — 3% at grade 1 falling to 15% at grade 5.
 * `BLUEPRINTS` keys that side under `MC_Overcharged`, and this is the common case: 70 of
 * the build corpus's 1902 declared entries go through it, against a single entry for the
 * Long Range collision above.
 * The clip penalty is folded only where a module's menu offers the multi-cannon recipe —
 * anti-xeno multi-cannons have no ordinary menu, and cannons, fragment cannons and plasma
 * accelerators take no clip leg. See
 * [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md)
 * § "Multi-cannon Overcharged" for the captures.
 *
 * Only the module can settle it, which is why this takes one, and it resolves **into** a
 * menu and never out of one: a sensor suite's `Sensor_LongRange` comes back unchanged, as
 * does `Scanner_LongRange` asked of a suite — unchanged is not offered, and
 * `getBlueprintsForModule` still says a suite does not take it. A generic `Misc_*` id is
 * left alone too: that pair is one recipe under two published spellings. Materials are
 * unaffected — both spellings of a pair bill the same at every grade, so
 * `getBlueprintCost` needs no module.
 *
 * @param moduleSymbol - A module symbol, e.g. `"Hpt_CloudScanner_Size0_Class5"`.
 * @param blueprintSymbol - A blueprint catalogue or journal id, matched case-insensitively and
 * trimmed. Colliding journal spellings are resolved against `moduleSymbol`.
 * @returns The id to join to `BLUEPRINTS`, in that catalogue's spelling when a journal
 * name resolved, and otherwise `blueprintSymbol` exactly as it was passed — byte for byte, so a
 * caller who never meets the collision never sees their own spelling rewritten.
 *
 * @throws {TypeError} If `blueprintSymbol` is not a string, including when it is missing — this
 * returns an id rather than reporting whether one is known, so there is no miss for a
 * nullish one to be. A nullish `moduleSymbol` *is* a miss: an unknown module offers no
 * menu, and `blueprintSymbol` comes back unchanged.
 * @example
 * ```ts
 * import { resolveBlueprintForModule } from '@elite-dangerous-almanac/core/ships/blueprint-journal';
 *
 * // A wake scanner's Long Range is the scanner recipe, whichever way the build spells it.
 * resolveBlueprintForModule('Hpt_CloudScanner_Size0_Class5', 'Sensor_LongRange');
 * // -> 'Scanner_LongRange'
 *
 * // The sensor suite keeps its own, and every other module keeps whatever it was given.
 * resolveBlueprintForModule('Int_Sensors_Size4_Class5', 'Sensor_LongRange');
 * // -> 'Sensor_LongRange'
 *
 * // A multi-cannon's Overcharged is the multi-cannon recipe, clip penalty and all.
 * resolveBlueprintForModule('Hpt_MultiCannon_Fixed_Medium', 'Weapon_Overcharged');
 * // -> 'MC_Overcharged'
 * resolveBlueprintForModule('Hpt_BeamLaser_Fixed_Small', 'Weapon_Overcharged');
 * // -> 'Weapon_Overcharged'
 * ```
 */
export function resolveBlueprintForModule(moduleSymbol: string, blueprintSymbol: string): string {
    requireStringIfPresent(moduleSymbol, 'resolveBlueprintForModule: moduleSymbol');
    // Strict, unlike the catalogue lookups: this hands an id back rather than answering
    // whether one is known, so a nullish `blueprintSymbol` would be a `string` return that is not
    // one. `massCodeToSizeClass` is the same shape for the same reason.
    const wanted = normalizeKey(
        requireString(blueprintSymbol, 'resolveBlueprintForModule: blueprintSymbol'),
        'resolveBlueprintForModule: blueprintSymbol',
    );
    const offered = getBlueprintsForModule(moduleSymbol);
    // An id the menu already lists is the recipe it names; hand back what the caller wrote,
    // so a caller who never meets the collision never sees their own spelling rewritten.
    if (offered.some((id) => id.toLowerCase() === wanted)) return blueprintSymbol;
    for (const id of offered) {
        const journalName = BLUEPRINT_JOURNAL_NAMES[id];
        if (journalName !== undefined && journalName.toLowerCase() === wanted) return id;
    }
    return blueprintSymbol;
}
