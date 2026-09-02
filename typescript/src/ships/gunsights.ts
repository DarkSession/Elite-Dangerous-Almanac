/**
 * Fixed-weapon frontal gunsights for every player-flyable ship.
 *
 * The catalogue keeps only the geometry needed to place each hardpoint at any target
 * range: a horizontal and vertical offset from the cockpit, both in metres. Use
 * {@link projectGunsight} to turn those physical offsets into dimensionless angular
 * tangents suitable for a renderer.
 *
 * The offsets are observed in-game; see
 * [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import gunsightsData from '../../../data/ships/gunsights.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { findByRawKey } from '../internal/registry-index.js';

/**
 * One fixed weapon's camera-relative origin in metres.
 *
 * @remarks
 * The first value is horizontal: positive points right. The second is vertical:
 * positive points up. Divide each value by a positive target range in metres to obtain
 * the corresponding angular tangent; {@link projectGunsight} performs that operation.
 */
export type GunsightOffset = readonly [
    horizontalOffsetMetres: number,
    verticalOffsetMetres: number,
];

/**
 * A hull's fixed-weapon offsets, in exactly the same order as {@link Ship.hardpoints}.
 *
 * @remarks
 * The shared ordering avoids repeating slot names in this compact catalogue. Pair an
 * offset with `ship.hardpoints[index]`, or with the hardpoint entries from
 * `enumerateSlots(ship)` in their returned order, when a renderer needs the mount's
 * size or journal-compatible slot key. **The number in a journal slot key is not the
 * array index**: some hulls skip or reorder those numbers, so resolve a journal key
 * through `enumerateSlots(ship)` before using its index here.
 */
export type ShipGunsight = readonly GunsightOffset[];

/** A projected fixed-weapon point relative to the cockpit's forward direction. */
export interface GunsightPoint {
    /** Dimensionless horizontal angular tangent; positive points right. */
    readonly horizontalTangent: number;
    /** Dimensionless vertical angular tangent; positive points up. */
    readonly verticalTangent: number;
}

/** A hull-symbol-keyed map of gunsights. */
export type ShipGunsightCatalogue = Readonly<Record<string, ShipGunsight>>;

/**
 * Fixed-weapon gunsights for every player-flyable hull, keyed by the hull symbols used
 * by {@link ships!SHIPS | SHIPS}.
 *
 * @remarks
 * The map, each hull array and every offset pair are deeply frozen. It covers every
 * hardpoint of every player-flyable hull. Importing this module adds only the compact
 * offset map; it does not import the ship or outfitting catalogues.
 *
 * @example
 * ```ts
 * import { SHIP_GUNSIGHTS } from '@elite-dangerous-almanac/core/ships/gunsights';
 *
 * SHIP_GUNSIGHTS.SideWinder?.length; // -> 2
 * SHIP_GUNSIGHTS.SideWinder?.[0]; // -> [-2.1956754, -1.166162]
 * ```
 */
export const SHIP_GUNSIGHTS: ShipGunsightCatalogue = deepFreeze(
    gunsightsData as ShipGunsightCatalogue,
);

/**
 * Look up a hull's gunsight by its internal symbol, case-insensitively.
 *
 * @param shipSymbol - Hull symbol, e.g. `"SideWinder"`. Leading/trailing whitespace
 * and case are ignored.
 * @returns The deeply frozen gunsight, or `null` when the hull is unknown.
 * @throws {TypeError} If `shipSymbol` is present and not a string. A nullish value is
 * a miss, like any other unrecognised symbol.
 * @example
 * ```ts
 * import { getShipGunsight } from '@elite-dangerous-almanac/core/ships/gunsights';
 *
 * getShipGunsight(' sidewinder ')?.length; // -> 2
 * getShipGunsight('not_a_ship'); // -> null
 * ```
 */
export function getShipGunsight(shipSymbol: string): ShipGunsight | null {
    return findByRawKey(SHIP_GUNSIGHTS, shipSymbol, 'getShipGunsight: shipSymbol');
}

/**
 * Project a gunsight onto a target plane at a chosen range.
 *
 * @param gunsight - Camera-relative hardpoint offsets in metres, normally returned by
 * {@link getShipGunsight}.
 * @param targetRangeMetres - Finite target-plane distance in metres; must be greater
 * than zero.
 * @returns One dimensionless angular-tangent point per input offset, preserving its
 * order. To place a point on a perspective display, divide `horizontalTangent` and
 * `verticalTangent` by the tangent of the corresponding half field of view; invert the
 * vertical result when screen coordinates increase downwards.
 * @remarks
 * This is fixed, ship-forward geometry. It does not model gimbal or turret tracking,
 * projectile travel, target motion, or head-look.
 * @throws {RangeError} If `targetRangeMetres` is not finite and greater than zero.
 * @example
 * ```ts
 * import {
 *   getShipGunsight,
 *   projectGunsight,
 * } from '@elite-dangerous-almanac/core/ships/gunsights';
 *
 * const gunsight = getShipGunsight('SideWinder')!;
 * projectGunsight(gunsight, 1000)[0];
 * // -> { horizontalTangent: -0.0021956754, verticalTangent: -0.001166162 }
 * ```
 */
export function projectGunsight(
    gunsight: ShipGunsight,
    targetRangeMetres: number,
): readonly GunsightPoint[] {
    if (!Number.isFinite(targetRangeMetres) || targetRangeMetres <= 0) {
        throw new RangeError('projectGunsight: targetRangeMetres must be a finite positive number');
    }
    return gunsight.map(([horizontalOffsetMetres, verticalOffsetMetres]) => ({
        horizontalTangent: horizontalOffsetMetres / targetRangeMetres,
        verticalTangent: verticalOffsetMetres / targetRangeMetres,
    }));
}
