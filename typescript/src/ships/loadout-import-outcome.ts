import type { PreEngineeredVariant } from './pre-engineered.js';

/**
 * A change made while normalizing a journal or SLEF loadout against the catalogues.
 *
 * @remarks
 * `ShipLoadout.fromLoadout` states the rules these outcomes report: a removable mount is
 * `emptied` of an article the catalogue cannot resolve, and a fixed mount is `defaulted`
 * to the hull's stock article whenever the source left none it can hold — with a `null`
 * `sourceSymbol` when the source named nothing there at all. A module whose source stated
 * a recipe and no `Modifiers` reports `unresolvedEngineering` when neither a craftable
 * recipe nor a catalogued article answers to what it named, because that module alone
 * keeps the figures of an unengineered one. Two further entries report a *reading* the
 * import chose rather than a change it made: `ambiguousEngineering` where an identity-only
 * block was rolled while a catalogued article answers to it just as well, and
 * `rerolledEngineering` where a stated modifier block moved nothing the module has and the
 * recipe beside it was rolled in its place.
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
          /** The unresolved module was removed because no stock replacement applies. */
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
          /** Source identity the mount refused, or `null` when the mount was absent. */
          readonly sourceSymbol: string | null;
          /** Stock module identity installed in the mount. */
          readonly replacementSymbol: string;
      }
    | {
          /**
           * The source stated engineering with no `Modifiers`, and what it named could
           * not be rolled — an unknown or unoffered blueprint or experimental effect, a
           * grade or quality outside the recipe, or a base stat the catalogues do not
           * carry — so this module's figures are the unengineered ones.
           */
          readonly action: 'unresolvedEngineering';
          /** Exact slot spelling used by the imported build. */
          readonly slot: string;
          /** Module identity the recipe was stated for. */
          readonly sourceSymbol: string;
          /** Recipe the source named, in its own spelling. */
          readonly blueprintSymbol: string;
      }
    | {
          /**
           * The source stated a recipe and no `Modifiers`, and both readings of that
           * identity are legitimate: the module's own engineering menu offers the recipe,
           * *and* a catalogued fixed article carries the same blueprint at the same grade
           * and effect. The roll was fitted, because that is what nearly every such block
           * is; {@link preEngineeredVariant} is the article passed over.
           */
          readonly action: 'ambiguousEngineering';
          /** Exact slot spelling used by the imported build. */
          readonly slot: string;
          /** Module identity the recipe was stated for. */
          readonly sourceSymbol: string;
          /** Recipe the source named, in its own spelling. */
          readonly blueprintSymbol: string;
          /**
           * The catalogued article the same block equally describes. Pass it to
           * {@link ships!ShipLoadout.setPreEngineeredVariant |
           * ShipLoadout.setPreEngineeredVariant} to take that reading instead.
           */
          readonly preEngineeredVariant: PreEngineeredVariant;
      }
    | {
          /**
           * The source stated `Modifiers` that move no stat this module has — an empty
           * array, or labels the catalogues model nothing for — and identified no
           * catalogued article, so the module would have published unengineered figures
           * while reporting that it is engineered. The recipe stated beside them was
           * rolled at the stated grade and quality in their place, and the source's own
           * modifier block is gone from the build.
           */
          readonly action: 'rerolledEngineering';
          /** Exact slot spelling used by the imported build. */
          readonly slot: string;
          /** Module identity the recipe was stated for. */
          readonly sourceSymbol: string;
          /** Recipe the source named, in its own spelling. */
          readonly blueprintSymbol: string;
      };
