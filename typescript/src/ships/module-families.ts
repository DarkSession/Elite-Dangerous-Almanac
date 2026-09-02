/**
 * The outfitting **module families** — the grouping an outfitting list shows above the
 * modules that share it, and the id every {@link OutfittingModuleIdentity} carries.
 *
 * A family is coarser than an engineering group and finer than an outfitting category:
 * ordinary, Bi-Weave and Prismatic generators are all `shieldGenerators`, while the
 * eight core mounts each have their own family. Localized display text for these ids is
 * `getOutfittingFamilyName` in `i18n/module-families`.
 *
 * @packageDocumentation
 */

import familiesData from '../../../data/ships/module-families.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';

/**
 * A stable identifier for an outfitting module family.
 *
 * @remarks
 * These are the keys of {@link OUTFITTING_FAMILIES}. Every module carries one, core
 * modules included, so an outfitting list can group every choice
 * `ShipLoadout.modulesForSlot()` returns without a private taxonomy. Closely related
 * variants share a family: Mk II and corrosion-resistant racks are `cargoRacks`, and a
 * pre-engineered or Powerplay variant stays in its base module's family.
 *
 * @example
 * ```ts
 * import type { OutfittingFamilyId } from '@elite-dangerous-almanac/core/ships/module-families';
 *
 * const family: OutfittingFamilyId = 'shieldGenerators';
 * ```
 */
export type OutfittingFamilyId =
    | 'armour'
    | 'powerPlants'
    | 'engines'
    | 'fsd'
    | 'lifeSupport'
    | 'powerDistributors'
    | 'sensors'
    | 'fuelTanks'
    | 'dockingComputers'
    | 'shieldGenerators'
    | 'shieldCellBanks'
    | 'cargoRacks'
    | 'hatchBreakerLimpets'
    | 'surfaceScanners'
    | 'fuelScoops'
    | 'refineries'
    | 'fsdInterdictors'
    | 'afms'
    | 'hullReinforcements'
    | 'collectorLimpets'
    | 'fuelTransferLimpets'
    | 'prospectingLimpets'
    | 'planetaryVehicleHangars'
    | 'planetaryApproachSuites'
    | 'cargoHatches'
    | 'passengerCabins'
    | 'vesselHangars'
    | 'moduleReinforcements'
    | 'repairLimpets'
    | 'researchLimpets'
    | 'decontaminationLimpets'
    | 'guardianShieldReinforcementPackages'
    | 'fsdBoosters'
    | 'guardianHybridPowerDistributors'
    | 'guardianHybridPowerPlants'
    | 'reconLimpets'
    | 'flightAssists'
    | 'miningMultiLimpetControllers'
    | 'multiLimpetControllers'
    | 'experimentalWeaponStabilisers'
    | 'pulseLasers'
    | 'burstLasers'
    | 'beamLasers'
    | 'cannons'
    | 'fragmentCannons'
    | 'multiCannons'
    | 'plasmaAccelerators'
    | 'railGuns'
    | 'missiles'
    | 'mines'
    | 'torpedoes'
    | 'miningLasers'
    | 'remoteReleaseFlakLaunchers'
    | 'axMissileRacks'
    | 'axMultiCannons'
    | 'guardianGaussCannons'
    | 'remoteReleaseFlechetteLaunchers'
    | 'guardianPlasmaChargers'
    | 'guardianShardCannons'
    | 'shockCannons'
    | 'subSurfaceDisplacementMissiles'
    | 'abrasionBlasters'
    | 'miningTools'
    | 'subSurfaceExtractionMissiles'
    | 'guardianNaniteTorpedoPylons'
    | 'chaffLaunchers'
    | 'ecms'
    | 'heatsinkLaunchers'
    | 'pointDefence'
    | 'manifestScanners'
    | 'wakeScanners'
    | 'killWarrantScanners'
    | 'shieldBoosters'
    | 'shutdownFieldNeutralisers'
    | 'xenoScanners'
    | 'pulseWaveAnalyser'
    | 'causticSinkLaunchers';

/**
 * Every outfitting family's canonical English display name, keyed by id.
 *
 * @remarks
 * The names are Frontier's own outfitting category labels where the game publishes one,
 * and the Almanac's descriptive name for the families it does not. They are
 * canonical English, not localized UI text: use
 * `getOutfittingFamilyName` for a locale.
 *
 * @example
 * ```ts
 * import { OUTFITTING_FAMILIES } from '@elite-dangerous-almanac/core/ships/module-families';
 *
 * OUTFITTING_FAMILIES.shieldGenerators; // -> 'Shield Generators'
 * OUTFITTING_FAMILIES.armour; // -> 'Armour'
 * ```
 */
export const OUTFITTING_FAMILIES: Readonly<Record<OutfittingFamilyId, string>> = deepFreeze(
    familiesData as Record<OutfittingFamilyId, string>,
);
