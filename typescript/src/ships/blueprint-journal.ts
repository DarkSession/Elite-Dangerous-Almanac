/**
 * **Reading a journal `BlueprintName` against the module it was written for** — the one
 * question that needs the journal-collision catalogue and the engineering menus at the
 * same time.
 *
 * Almost every blueprint id means one recipe wherever it appears, and for those
 * `getBlueprint(id)` is the answer. Three ids are not like that, and this is where that is
 * dealt with. One of the three is `Weapon_Overcharged` on a multi-cannon, so any consumer
 * reading journals from combat ships meets this — it is not the corner case the two scanner
 * ids alone would make it.
 *
 * It lives in its own module because the join depends on both menus and the three
 * colliding journal spellings. Keeping those spellings in a tiny purpose-specific
 * catalogue means this resolver does not load every blueprint grade, modifier and
 * material. `package.test.mjs` guards that package boundary.
 *
 * @packageDocumentation
 */

import { getBlueprintsForModule } from './engineering-options.js';
import { BLUEPRINT_JOURNAL_NAMES } from './internal/blueprint-journal-names.js';

/**
 * The blueprint whose numbers a module actually rolls when a journal names `blueprint` on
 * it — the same id back, except where the game spells two different recipes alike.
 *
 * **One `BlueprintName`, two recipes.** Long Range and Wide Angle are offered on the
 * internal sensor suite and on the KWS/manifest/wake scanners, and the game writes the
 * same id for both families. The two roll different stats, in opposite directions:
 *
 * | On a sensor suite | On a utility scanner |
 * | --- | --- |
 * | Long Range: `Mass` ×1.20, `ScannerRange` +0…15% | Long Range: `PowerDraw` ×1.10, `ScannerRange` +0…24% |
 * | Wide Angle: `PowerDraw` ×1.10, `ScannerRange` −4% | Wide Angle: `Mass` ×1.20, `ScannerTimeToScan` +10% |
 *
 * (Grade 1 shown; both pairs share their `SensorTargetScanAngle` leg.) `BLUEPRINTS` keys
 * the scanner side under `Scanner_LongRange` / `Scanner_WideAngle`, which is the spelling
 * the scanner menus list — so on a scanner this resolves `Sensor_LongRange` to
 * `Scanner_LongRange`, and folding the id as written would charge the build mass where the
 * game charges power draw.
 *
 * **One `BlueprintName`, two recipes — again, on the multi-cannons.** The game writes
 * `Weapon_Overcharged` for every weapon's Overcharged, but a multi-cannon's also cuts the
 * clip — 3% at grade 1 falling to 15% at grade 5 — which the recipe the other weapons take
 * does not. `BLUEPRINTS` keys the multi-cannon side under `MC_Overcharged`, the spelling
 * the multi-cannon menus list, so on a multi-cannon this resolves `Weapon_Overcharged` to
 * `MC_Overcharged` and folding the id as written would report a clip the build does not
 * have. This is the common case of the three: 70 of the build corpus's 1902 declared
 * entries go through it, against one for the scanners.
 *
 * The clip penalty is folded on a multi-cannon — anti-xeno ones included — and on nothing
 * else. The cannons, fragment cannons and plasma accelerators take no clip leg, which is
 * the game's own answer on all three groups: journal captures of a large gimballed cannon
 * at grade 5, of a medium fragment cannon at grade 4 and of a medium plasma accelerator at
 * grade 1, each rolled under this id, report no `AmmoClipSize` modifier. See
 * [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md)
 * § "Multi-cannon Overcharged" for the captures.
 *
 * **The pairing is global, not repeated per menu.** A purpose-specific catalogue maps
 * each of the three recipe ids to the colliding id the journal writes. This function
 * supplies the half only a menu knows, by asking which mapped recipe *this module is
 * offered*. Keeping one global map avoids repeating aliases on every scanner or
 * multi-cannon group and silently forgetting the next one.
 *
 * Only the module can settle it, which is why this takes one. It resolves **into** a menu
 * and never out of one: a sensor suite's `Sensor_LongRange` is already its own menu's id
 * and comes back unchanged, and asking for `Scanner_LongRange` on a sensor suite returns
 * it unchanged too — unchanged is not the same as offered, and `getBlueprintsForModule`
 * still says a suite does not take it.
 *
 * **Only the numbers differ, not the price.** All three pairs cost the same materials at
 * every grade, so `getBlueprintCost` needs no module and either spelling bills correctly;
 * `engineering.test.ts` holds upstream to that for the scanners. It is the stat block that
 * has to be resolved.
 *
 * **Not a generic-spelling resolver.** A generic `Misc_*` id — `Misc_Shielded` where a
 * life support's menu says `LifeSupport_Shielded` — comes back as it went in. That pair is
 * one recipe under two spellings, both published with their own numbers, so the id a
 * caller names is the one to roll. This function exists for the case where the id names no
 * recipe the module has: the game never rolls a sensor suite's Long Range on a scanner.
 *
 * @param symbol - A module symbol, e.g. `"Hpt_CloudScanner_Size0_Class5"`.
 * @param blueprint - A blueprint id, matched case-insensitively and trimmed.
 * @returns The id to join to `BLUEPRINTS`, in that catalogue's spelling when a journal
 * name resolved, and otherwise `blueprint` exactly as it was passed — byte for byte, so a
 * caller who never meets the collision never sees their own spelling rewritten.
 *
 * @example
 * ```ts
 * import { resolveBlueprintForModule } from '@elite-dangerous-almanac/core/ships/blueprint-journal';
 *
 * // A wake scanner's Long Range is the scanner recipe, whichever way the build spells it.
 * resolveBlueprintForModule('Hpt_CloudScanner_Size0_Class5', 'Sensor_LongRange');
 * // -> 'Scanner_LongRange'
 * resolveBlueprintForModule('Hpt_CloudScanner_Size0_Class5', 'Scanner_LongRange');
 * // -> 'Scanner_LongRange'
 *
 * // The sensor suite keeps its own, and every other module keeps whatever it was given.
 * resolveBlueprintForModule('Int_Sensors_Size4_Class5', 'Sensor_LongRange');
 * // -> 'Sensor_LongRange'
 * resolveBlueprintForModule('Int_Hyperdrive_Size5_Class5', 'FSD_LongRange');
 * // -> 'FSD_LongRange'
 *
 * // A multi-cannon's Overcharged is the multi-cannon recipe, clip penalty and all.
 * resolveBlueprintForModule('Hpt_MultiCannon_Fixed_Medium', 'Weapon_Overcharged');
 * // -> 'MC_Overcharged'
 * resolveBlueprintForModule('Hpt_ATMultiCannon_Gimbal_Medium', 'Weapon_Overcharged');
 * // -> 'MC_Overcharged'
 * resolveBlueprintForModule('Hpt_BeamLaser_Fixed_Small', 'Weapon_Overcharged');
 * // -> 'Weapon_Overcharged'
 * ```
 */
export function resolveBlueprintForModule(symbol: string, blueprint: string): string {
    const wanted = blueprint.trim().toLowerCase();
    const offered = getBlueprintsForModule(symbol);
    // An id the menu already lists is the recipe it names; hand back what the caller wrote,
    // so a caller who never meets the collision never sees their own spelling rewritten.
    if (offered.some((id) => id.toLowerCase() === wanted)) return blueprint;
    for (const id of offered) {
        const journalName = BLUEPRINT_JOURNAL_NAMES[id];
        if (journalName !== undefined && journalName.toLowerCase() === wanted) return id;
    }
    return blueprint;
}
