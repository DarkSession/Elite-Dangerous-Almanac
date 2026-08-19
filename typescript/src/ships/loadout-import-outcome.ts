/**
 * A change made while normalizing a journal or SLEF loadout against the catalogues.
 *
 * @remarks
 * An entry survives import unresolved on three grounds, and produces no outcome: the
 * module catalogue identifies it, its slot is a known cosmetic or hull-geometry key, or
 * it is a `ModularCargoBayDoor*` article in the cargo-hatch mount, which resolves
 * through the standard hatch's record. Everything else is normalized.
 *
 * Import removes an unresolved module from a hardpoint, utility, optional internal, or
 * unrecognised slot. Armour, the seven core internals, and the cargo hatch are fixed
 * mounts, so import installs the hull's stock module there instead when one is known.
 * Without a default, an unresolved fixed module is emptied and a required mount remains
 * incomplete. A mount the source named no module for is left as the source left it —
 * except the cargo hatch, which is part of the hull rather than an outfitting choice and
 * is restored from the same defaults.
 *
 * `sourceSymbol` is `null` only for that restored hatch, which is the one mount import
 * fills unasked. A defaulted module is a fresh stock identity: it keeps the source's
 * `On`, `Priority` and `Health`, which describe the mount rather than the article, and
 * inherits no engineering or captured value from the module it replaced.
 *
 * @example
 * ```ts
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 *
 * const build = ShipLoadout.fromLoadout({
 *   Ship: 'SideWinder',
 *   Modules: [{ Slot: 'SmallHardpoint1', Item: 'FutureWeapon' }],
 * });
 *
 * build.importOutcomes.find((outcome) => outcome.slot === 'SmallHardpoint1')?.action;
 * // -> 'emptied'
 * ```
 */
export type LoadoutImportOutcome =
    | {
          /** The unresolved module was removed because no replacement applies or exists. */
          readonly action: 'emptied';
          /** Exact slot spelling used by the imported build. */
          readonly slot: string;
          /** Unresolved module identity supplied by the source. */
          readonly sourceSymbol: string;
      }
    | {
          /** The hull's stock module was installed in a fixed mount. */
          readonly action: 'defaulted';
          /** Exact slot spelling used by the normalized build. */
          readonly slot: string;
          /** Unresolved source identity, or `null` when the mount was absent. */
          readonly sourceSymbol: string | null;
          /** Stock module identity installed in the mount. */
          readonly replacementSymbol: string;
      };
