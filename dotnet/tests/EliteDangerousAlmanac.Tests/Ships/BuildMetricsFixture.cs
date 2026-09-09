using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/build-metrics.jsonc</c>.</summary>
internal sealed class BuildMetricsFixture
{
    /// <summary>The pure functions a build metric is composed from.</summary>
    public MetricFunctionsFixture Functions { get; set; } = new();

    /// <summary>What each catalogue weapon does per second.</summary>
    public List<CatalogueWeaponFixture> Weapons { get; set; } = [];

    /// <summary>What each module holds when fully rearmed.</summary>
    public AmmunitionFixture Ammunition { get; set; } = new();

    /// <summary>What the game's own panel shows for real captured builds.</summary>
    public Dictionary<string, InGameBuildFixture> InGame { get; set; } = [];

    /// <summary>One captured build's figures at full precision.</summary>
    public PinnedBuildFixture DeepBlack { get; set; } = new();

    /// <summary>One build assembled here rather than captured, at full precision.</summary>
    public AssembledBuildFixture Anaconda { get; set; } = new();

    /// <summary>Panel readings taken of the Guardian shard cannons one at a time.</summary>
    public ObservedShardCannonsFixture ObservedGuardianShardCannons { get; set; } = new();
}

/// <summary>What the game's own ship panel shows for one captured build.</summary>
/// <remarks>
/// These are readings taken in the game rather than figures this library produced, so a
/// case that reproduces them measures the whole calculation against the game itself. Each
/// figure is stated at the places the panel shows, and is compared at that precision.
/// </remarks>
internal sealed class InGameBuildFixture
{
    /// <summary>The fixture path of the capture.</summary>
    public string Build { get; set; } = string.Empty;

    /// <summary>Where the readings come from, in the fixture's own words.</summary>
    public string? Note { get; set; }

    /// <summary>The name the game shows for the ship, where the case states one.</summary>
    public string? ObservedShipName { get; set; }

    public InGameJumpRangeFixture JumpRange { get; set; } = new();

    public InGameSpeedFixture Speed { get; set; } = new();

    public InGamePowerFixture Power { get; set; } = new();

    /// <summary>What the weapons deal, where the build carries any.</summary>
    public InGameOffenceFixture? Offense { get; set; }

    public InGameShieldsFixture Shields { get; set; } = new();

    public InGameMassFixture Mass { get; set; } = new();

    public InGameArmourFixture Armour { get; set; } = new();
}

/// <summary>The jump the panel shows.</summary>
internal sealed class InGameJumpRangeFixture
{
    /// <summary>One jump on a full main tank, in light years.</summary>
    public double FullTank { get; set; }
}

/// <summary>The speed and handling the panel shows.</summary>
internal sealed class InGameSpeedFixture
{
    public double Top { get; set; }

    public double Boost { get; set; }

    public double Pitch { get; set; }

    public double Roll { get; set; }

    public double Yaw { get; set; }
}

/// <summary>The power the panel shows.</summary>
internal sealed class InGamePowerFixture
{
    public double Available { get; set; }

    /// <summary>The draw with the hardpoints stowed.</summary>
    public double Retracted { get; set; }

    /// <summary>The draw with the hardpoints run out.</summary>
    public double Deployed { get; set; }

    /// <summary>
    /// Whether the panel counts a module the commander powered down. It does, so the build
    /// is read with every module running.
    /// </summary>
    public bool IncludesDisabledModules { get; set; }
}

/// <summary>What the weapons deal, as the panel shows it.</summary>
internal sealed class InGameOffenceFixture
{
    public double DamagePerSecond { get; set; }

    public double DistributorDraw { get; set; }

    public double ThermalLoad { get; set; }
}

/// <summary>The shields the panel shows.</summary>
internal sealed class InGameShieldsFixture
{
    public double Strength { get; set; }

    public InGameResistancesFixture Resistances { get; set; } = new();

    public InGameRegenerationFixture Regeneration { get; set; } = new();
}

/// <summary>How fast the shield comes back, in megajoules a second.</summary>
internal sealed class InGameRegenerationFixture
{
    /// <summary>The rate while the shield still stands.</summary>
    public double Standard { get; set; }

    /// <summary>The rate while the shield is down.</summary>
    public double Broken { get; set; }
}

/// <summary>What the ship weighs, as the panel shows it.</summary>
internal sealed class InGameMassFixture
{
    /// <summary>The ship as fitted and fuelled, reserve fuel counted.</summary>
    public double Current { get; set; }

    /// <summary>What the thrusters are rated to move.</summary>
    public double Maximum { get; set; }
}

/// <summary>The hull the panel shows.</summary>
internal sealed class InGameArmourFixture
{
    public double HitPoints { get; set; }

    public InGameResistancesFixture Resistances { get; set; } = new();
}

/// <summary>The three resistances the panel shows.</summary>
internal sealed class InGameResistancesFixture
{
    public double Kinetic { get; set; }

    public double Thermal { get; set; }

    public double Explosive { get; set; }
}

/// <summary>One catalogue weapon and its per-second figures.</summary>
internal sealed class CatalogueWeaponFixture
{
    public string Symbol { get; set; } = string.Empty;

    public double DamagePerSecond { get; set; }

    public double SustainedDamagePerSecond { get; set; }

    public double SustainedFireFactor { get; set; }

    public double EnergyPerSecond { get; set; }

    public double HeatPerSecond { get; set; }

    public bool Continuous { get; set; }
}

/// <summary>The ammunition capacities the catalogue is pinned on.</summary>
internal sealed class AmmunitionFixture
{
    /// <summary>What the capacities are about, in the fixture's own words.</summary>
    public string? Note { get; set; }

    /// <summary>Each module and what it holds when fully rearmed.</summary>
    public List<AmmunitionCaseFixture> Catalogue { get; set; } = [];

    /// <summary>The modules that carry no ammunition at all.</summary>
    public List<string> NoAmmunition { get; set; } = [];

    /// <summary>Every non-zero loaded count the journal captures state.</summary>
    public JournalAmmunitionFixture JournalReadings { get; set; } = new();

    /// <summary>Rolls made here, and the whole rounds they load.</summary>
    public EngineeredAmmunitionFixture Engineered { get; set; } = new();

    /// <summary>Every engineered clip and reserve Frontier states across the captures.</summary>
    public AmmunitionGroundTruthFixture EngineeredGroundTruth { get; set; } = new();
}

/// <summary>What the captures say a module had loaded.</summary>
internal sealed class JournalAmmunitionFixture
{
    /// <summary>What the readings are and are not, in the fixture's own words.</summary>
    public string? Note { get; set; }

    public int Readings { get; set; }

    public int DistinctModules { get; set; }

    /// <summary>How many of the readings sit at the module's whole capacity.</summary>
    public int AtCapacity { get; set; }

    /// <summary>Readings below capacity. A rearm state is a lower bound, so these are allowed.</summary>
    public List<BelowCapacityFixture> BelowCapacity { get; set; } = [];
}

/// <summary>One reading that sits below the capacity the build computes.</summary>
internal sealed class BelowCapacityFixture
{
    public string Capture { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    public double AmmoInClip { get; set; }

    public double AmmoInHopper { get; set; }

    public double ClipSize { get; set; }

    public double AmmoMaximum { get; set; }
}

/// <summary>Rolls made on an empty hull, and the whole rounds each loads.</summary>
internal sealed class EngineeredAmmunitionFixture
{
    /// <summary>How the rounding works, in the fixture's own words.</summary>
    public string? Note { get; set; }

    public List<EngineeredRollFixture> Rolls { get; set; } = [];
}

/// <summary>One roll, its stock capacity and the capacity it leaves.</summary>
internal sealed class EngineeredRollFixture
{
    /// <summary>What the roll shows, in the fixture's own words.</summary>
    public string? Note { get; set; }

    public string Slot { get; set; } = string.Empty;

    public string Module { get; set; } = string.Empty;

    public string Blueprint { get; set; } = string.Empty;

    public int Grade { get; set; }

    public string? Experimental { get; set; }

    public AmmunitionCapacityFixture Stock { get; set; } = new();

    /// <summary>The burst the clip has to be a whole number of, where one applies.</summary>
    public double? BurstRounds { get; set; }

    public double ClipSize { get; set; }

    public double Hopper { get; set; }

    public double Total { get; set; }
}

/// <summary>One magazine and reserve.</summary>
internal sealed class AmmunitionCapacityFixture
{
    public double ClipSize { get; set; }

    public double Hopper { get; set; }

    public double Total { get; set; }
}

/// <summary>What Frontier states for an engineered magazine and reserve.</summary>
internal sealed class AmmunitionGroundTruthFixture
{
    /// <summary>What the readings settle, in the fixture's own words.</summary>
    public string? Note { get; set; }

    public List<AmmunitionGroundTruthCaseFixture> Cases { get; set; } = [];

    /// <summary>One capture whose own aggregates are recomputed from its parts.</summary>
    public RecomputedCaptureFixture Recomputed { get; set; } = new();
}

/// <summary>One engineered module a capture states a magazine or a reserve for.</summary>
internal sealed class AmmunitionGroundTruthCaseFixture
{
    /// <summary>What the case shows, in the fixture's own words.</summary>
    public string? Note { get; set; }

    public string Capture { get; set; } = string.Empty;

    public string Ship { get; set; } = string.Empty;

    public string Slot { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    public string Blueprint { get; set; } = string.Empty;

    public int Grade { get; set; }

    /// <summary>The quality the roll is reproduced at.</summary>
    public double Quality { get; set; }

    /// <summary>The quality the capture states, where it is stale.</summary>
    public double? ReportedQuality { get; set; }

    public string? Experimental { get; set; }

    /// <summary>Whether the article is sold already carrying this recipe.</summary>
    public bool PreEngineered { get; set; }

    /// <summary>Whether the roll predates the shared-quality engineering system.</summary>
    public bool LegacyEngineering { get; set; }

    public CatalogueAmmunitionFixture Base { get; set; } = new();

    public GameAmmunitionFixture Game { get; set; } = new();

    public CatalogueAmmunitionFixture Simulated { get; set; } = new();

    /// <summary>Whether a roll reproduced here reaches the figures the game states.</summary>
    public bool Agrees { get; set; }
}

/// <summary>A magazine and a reserve, either of which a recipe may leave alone.</summary>
internal sealed class CatalogueAmmunitionFixture
{
    public double? ClipSize { get; set; }

    public double? AmmoMaximum { get; set; }
}

/// <summary>What the game states and what the weapon had loaded.</summary>
internal sealed class GameAmmunitionFixture
{
    public double? ClipSize { get; set; }

    public double AmmoMaximum { get; set; }

    public double LoadedClip { get; set; }

    public double LoadedHopper { get; set; }
}

/// <summary>One capture rebuilt with its own aggregates stripped.</summary>
internal sealed class RecomputedCaptureFixture
{
    /// <summary>What the rebuild proves, in the fixture's own words.</summary>
    public string? Note { get; set; }

    /// <summary>The mass this library computes, in tonnes.</summary>
    public double UnladenMass { get; set; }

    /// <summary>The mass the capture states for itself.</summary>
    public double JournalUnladenMass { get; set; }

    /// <summary>The jump range this library computes, in light-years.</summary>
    public double MaxJumpRange { get; set; }

    /// <summary>The jump range the capture states for itself.</summary>
    public double JournalMaxJumpRange { get; set; }

    public int CargoCapacity { get; set; }
}

/// <summary>One module's magazine and reserve.</summary>
internal sealed class AmmunitionCaseFixture
{
    /// <summary>What the case is about, in the fixture's own words.</summary>
    public string? Note { get; set; }

    public string Symbol { get; set; } = string.Empty;

    public double ClipSize { get; set; }

    /// <summary>The reserve, or absent where nothing limits it.</summary>
    public double? Hopper { get; set; }

    /// <summary>The magazine and the reserve together, or absent where the reserve is unlimited.</summary>
    public double? Total { get; set; }

    public bool Unlimited { get; set; }
}

/// <summary>Each pure function, pinned at the arguments worth pinning.</summary>
internal sealed class MetricFunctionsFixture
{
    public PowerBudgetFixture PowerBudget { get; set; } = new();

    public List<ShieldResistanceCaseFixture> StackShieldResistance { get; set; } = [];

    public List<ArmourResistanceCaseFixture> StackArmourResistance { get; set; } = [];

    public List<SystemsResistanceCaseFixture> SystemsResistance { get; set; } = [];

    public List<DamageFalloffCaseFixture> DamageFalloff { get; set; } = [];

    public List<ArmourPiercingCaseFixture> ArmourPiercingFactor { get; set; } = [];
}

/// <summary>One weapon's range band and the share of its damage that lands.</summary>
internal sealed class DamageFalloffCaseFixture
{
    public double MaximumRange { get; set; }

    public double FalloffRange { get; set; }

    public double Metres { get; set; }

    public double Expected { get; set; }
}

/// <summary>One piercing rating against one hull hardness.</summary>
internal sealed class ArmourPiercingCaseFixture
{
    public double ArmourPiercing { get; set; }

    public double Hardness { get; set; }

    public double Expected { get; set; }
}

/// <summary>One shield stack and the resistance it leaves.</summary>
internal sealed class ShieldResistanceCaseFixture
{
    public double Generator { get; set; }

    public List<double> Boosters { get; set; } = [];

    public double Expected { get; set; }
}

/// <summary>One hull stack and the resistance it leaves.</summary>
internal sealed class ArmourResistanceCaseFixture
{
    public double Bulkhead { get; set; }

    public List<double> Reinforcements { get; set; } = [];

    public double Expected { get; set; }
}

/// <summary>One capacitor allocation and the resistance it buys.</summary>
internal sealed class SystemsResistanceCaseFixture
{
    public double Pips { get; set; }

    public double Expected { get; set; }
}

/// <summary>One power budget and the priority bands it leaves.</summary>
internal sealed class PowerBudgetFixture
{
    public double Available { get; set; }

    public List<PowerConsumerFixture> Consumers { get; set; } = [];

    public double Retracted { get; set; }

    public double Deployed { get; set; }

    public List<PowerBandFixture> Bands { get; set; } = [];
}

/// <summary>One fitted module's claim on the power plant.</summary>
internal sealed class PowerConsumerFixture
{
    public double Draw { get; set; }

    public int? Priority { get; set; }

    public bool DeployedOnly { get; set; }
}

/// <summary>One priority group's share of the power budget.</summary>
internal sealed class PowerBandFixture
{
    public int Priority { get; set; }

    public double Retracted { get; set; }

    public double Deployed { get; set; }

    public double RetractedTotal { get; set; }

    public double DeployedTotal { get; set; }

    public bool PoweredRetracted { get; set; }

    public bool PoweredDeployed { get; set; }
}

/// <summary>One captured build's figures at the full precision the library works in.</summary>
internal sealed class PinnedBuildFixture
{
    /// <summary>The fixture path of the capture.</summary>
    public string Build { get; set; } = string.Empty;

    public PinnedPowerFixture Power { get; set; } = new();

    public PinnedShieldsFixture Shields { get; set; } = new();

    public PinnedArmourFixture Armour { get; set; } = new();

    /// <summary>The weapons the build carries.</summary>
    public int WeaponCount { get; set; }
}

/// <summary>One build assembled here, at the full precision the library works in.</summary>
internal sealed class AssembledBuildFixture
{
    /// <summary>How the build is assembled, in the fixture's own words.</summary>
    public string? Note { get; set; }

    /// <summary>The articles fitted on top of the hull's own defaults, by mount.</summary>
    public Dictionary<string, string> Modules { get; set; } = [];

    public PinnedPowerFixture Power { get; set; } = new();

    public PinnedShieldsFixture Shields { get; set; } = new();

    public PinnedArmourFixture Armour { get; set; } = new();

    public PinnedWeaponsFixture Weapons { get; set; } = new();
}

/// <summary>The power a build draws, at full precision.</summary>
internal sealed class PinnedPowerFixture
{
    public double Available { get; set; }

    public double Retracted { get; set; }

    public double Deployed { get; set; }

    /// <summary>The power left over, where the case states one.</summary>
    public double? Headroom { get; set; }

    /// <summary>Whether the plant carries the whole draw, where the case states it.</summary>
    public bool? WithinBudget { get; set; }

    /// <summary>Each priority group's share, where the case states them.</summary>
    public List<PowerBandFixture>? Bands { get; set; }
}

/// <summary>The shields a build carries, at full precision.</summary>
internal sealed class PinnedShieldsFixture
{
    public double Strength { get; set; }

    /// <summary>The generator's own share of the strength.</summary>
    public double? Generator { get; set; }

    /// <summary>The boosters' share of the strength.</summary>
    public double? Boosters { get; set; }

    /// <summary>What the boosters multiply the generator by.</summary>
    public double? BoostMultiplier { get; set; }

    /// <summary>What the hull's mass does to the generator's rating.</summary>
    public double MassCurveMultiplier { get; set; }

    public FourResistancesFixture Resistances { get; set; } = new();

    /// <summary>The same resistances with a full allocation to systems.</summary>
    public FourResistancesFixture? ResistancesAtFourPips { get; set; }

    public FourResistancesFixture EffectiveHitPoints { get; set; } = new();
}

/// <summary>The hull a build carries, at full precision.</summary>
internal sealed class PinnedArmourFixture
{
    public double HitPoints { get; set; }

    /// <summary>The bulkheads' own share.</summary>
    public double Bulkheads { get; set; }

    /// <summary>The reinforcement packages' share.</summary>
    public double Reinforcement { get; set; }

    public FourResistancesFixture Resistances { get; set; } = new();

    public FourResistancesFixture EffectiveHitPoints { get; set; } = new();

    /// <summary>The module reinforcement fitted, where the case states any.</summary>
    public double? ModuleArmour { get; set; }

    /// <summary>The share of a hit that reinforcement takes, where the case states it.</summary>
    public double? ModuleProtection { get; set; }
}

/// <summary>What a build's weapons deal together, at full precision.</summary>
internal sealed class PinnedWeaponsFixture
{
    public double DamagePerSecond { get; set; }

    public double SustainedDamagePerSecond { get; set; }

    public double EnergyPerSecond { get; set; }

    public double HeatPerSecond { get; set; }

    public double PowerDraw { get; set; }

    public double KineticDamagePerSecond { get; set; }

    public double ThermalDamagePerSecond { get; set; }
}

/// <summary>The four damage types a resistance or a hit-point total is quoted for.</summary>
internal sealed class FourResistancesFixture
{
    public double Kinetic { get; set; }

    public double Thermal { get; set; }

    public double Explosive { get; set; }

    public double Caustic { get; set; }
}

/// <summary>Panel readings taken of the Guardian shard cannons one at a time.</summary>
/// <remarks>
/// The one-decimal readings do not on their own reveal the figures behind them. The
/// catalogue applies one correction to the older registry figures, which agrees both with
/// these readings and with the mixed build they were taken on.
/// </remarks>
internal sealed class ObservedShardCannonsFixture
{
    /// <summary>Where the readings come from, in the fixture's own words.</summary>
    public string? Note { get; set; }

    /// <summary>The recipe running when the readings were taken.</summary>
    public string Blueprint { get; set; } = string.Empty;

    public int Grade { get; set; }

    /// <summary>Whether the recipe was active for the readings.</summary>
    public bool Active { get; set; }

    public List<ObservedShardCannonFixture> Records { get; set; } = [];
}

/// <summary>One shard cannon as the outfitting panel showed it.</summary>
internal sealed class ObservedShardCannonFixture
{
    public string Symbol { get; set; } = string.Empty;

    public int Class { get; set; }

    public double Mass { get; set; }

    public double Integrity { get; set; }

    public double PowerDraw { get; set; }

    public double DamagePerSecond { get; set; }

    public double Damage { get; set; }

    public double DistributorDraw { get; set; }

    public double ThermalLoad { get; set; }

    public double ArmourPiercing { get; set; }

    public double MaximumRange { get; set; }

    public double ShotSpeed { get; set; }

    public double RateOfFire { get; set; }

    public double ClipSize { get; set; }

    public double AmmoMaximum { get; set; }

    public string DamageType { get; set; } = string.Empty;

    public double FalloffRange { get; set; }
}
