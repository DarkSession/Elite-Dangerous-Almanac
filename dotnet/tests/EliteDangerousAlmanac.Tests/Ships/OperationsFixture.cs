using System.Collections.Generic;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The part of <c>fixtures/ships/operations.jsonc</c> the data-free calculators read.</summary>
internal sealed class OperationsFixture
{
    /// <summary>What a refused payload and a refused build report.</summary>
    public DiagnosticsFixture Diagnostics { get; set; } = new();

    /// <summary>The finding a second module of a one-per-ship family reports.</summary>
    public ExclusivityFixture Exclusivity { get; set; } = new();

    /// <summary>Thrusters rated below what the ship weighs.</summary>
    public ThrusterMassFixture ThrusterMass { get; set; } = new();

    /// <summary>The speed and handling of one loaded ship.</summary>
    public MobilityFixture Mobility { get; set; } = new();

    /// <summary>The three capacitors of one power distributor.</summary>
    public DistributorFixture Distributor { get; set; } = new();

    /// <summary>The time a collapsed shield takes to come back.</summary>
    public ShieldRecoveryFixture ShieldRecovery { get; set; } = new();

    /// <summary>The fitted shield cell banks and the pool they make.</summary>
    public CellBanksFixture CellBanks { get; set; } = new();

    /// <summary>The thermal load a set of weapons sums to.</summary>
    public WeaponsFixture Weapons { get; set; } = new();

    /// <summary>The recharge and the endurance of one weapons capacitor.</summary>
    public WeaponsCapacitorFixture WeaponsCapacitor { get; set; } = new();

    /// <summary>The per-ship module-count allowance and what a build makes of it.</summary>
    public ModuleLimitsFixture ModuleLimits { get; set; } = new();

    /// <summary>The edits a build refuses, and what each refusal reports.</summary>
    public EditorErrorsFixture EditorErrors { get; set; } = new();

    /// <summary>The mounts a hull holds shut, and why each is held.</summary>
    public SlotRemovalFixture SlotRemoval { get; set; } = new();

    /// <summary>The readings a capture's stated recipe gets.</summary>
    public StatedRecipesFixture StatedRecipes { get; set; } = new();

    /// <summary>The captures a build refuses to read at all.</summary>
    public ImportRejectionsFixture ImportRejections { get; set; } = new();

    /// <summary>What a build costs to own, in each currency the game charges for it.</summary>
    public BuildCostFixture BuildCost { get; set; } = new();
}

/// <summary>What a build costs to own.</summary>
internal sealed class BuildCostFixture
{
    public BuildCreditsCaseFixture Credits { get; set; } = new();

    /// <summary>One ordinary recipe, and the Merc Coin it bills.</summary>
    public OrdinaryEngineeringCostFixture OrdinaryEngineering { get; set; } = new();

    /// <summary>Two purchased articles, and what climbing one of them costs.</summary>
    public MercenaryCostFixture Mercenary { get; set; } = new();
}

/// <summary>One stock hull and what the shop asks for it.</summary>
internal sealed class BuildCreditsCaseFixture
{
    public string Ship { get; set; } = string.Empty;

    public BuildCreditsExpectationFixture Expected { get; set; } = new();
}

/// <summary>The four credit figures a build reports.</summary>
internal sealed class BuildCreditsExpectationFixture
{
    public double Total { get; set; }

    public double Hull { get; set; }

    public double Modules { get; set; }

    public double Rebuy { get; set; }
}

/// <summary>One recipe rolled on one mount, and the Merc Coin it bills.</summary>
internal sealed class OrdinaryEngineeringCostFixture
{
    public string Ship { get; set; } = string.Empty;

    public string Slot { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    public string Blueprint { get; set; } = string.Empty;

    public int Grade { get; set; }

    public int MercCoins { get; set; }
}

/// <summary>The purchased articles a build carries, and what climbing one costs.</summary>
internal sealed class MercenaryCostFixture
{
    public string Ship { get; set; } = string.Empty;

    public List<MercenaryArticleFixture> Modules { get; set; } = [];

    /// <summary>The Merc Coin the two purchases bill together.</summary>
    public int Expected { get; set; }

    public MercenaryClimbFixture Climbed { get; set; } = new();
}

/// <summary>One purchased article and its shop price.</summary>
internal sealed class MercenaryArticleFixture
{
    public string Slot { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    public string Blueprint { get; set; } = string.Empty;

    public int Cost { get; set; }
}

/// <summary>What climbing one purchased article to a grade costs.</summary>
internal sealed class MercenaryClimbFixture
{
    public int Grade { get; set; }

    public int MercCoins { get; set; }

    public List<EngineeringMaterial> Materials { get; set; } = [];
}

/// <summary>The edits a build refuses.</summary>
internal sealed class EditorErrorsFixture
{
    public EditorErrorCaseFixture IncompatibleModule { get; set; } = new();

    public EditorErrorCaseFixture BuiltInHullModule { get; set; } = new();

    public EditorErrorCaseFixture WrongHullArmour { get; set; } = new();

    public EditorErrorCaseFixture DuplicateExclusiveModule { get; set; } = new();

    public EditorErrorCaseFixture ModuleLimitExceeded { get; set; } = new();

    public EditorErrorCaseFixture ImmutableSlot { get; set; } = new();

    public EditorErrorCaseFixture RequiredSlot { get; set; } = new();

    public EditorErrorCaseFixture ImmutableSlotReplacement { get; set; } = new();
}

/// <summary>One refused edit, and what the build states about it.</summary>
internal sealed class EditorErrorCaseFixture
{
    public string Ship { get; set; } = string.Empty;

    public string Slot { get; set; } = string.Empty;

    public string Module { get; set; } = string.Empty;

    /// <summary>The mount that takes the article first, on the exclusive-fit case.</summary>
    public string FirstSlot { get; set; } = string.Empty;

    /// <summary>The mount that then refuses it, on the exclusive-fit case.</summary>
    public string SecondSlot { get; set; } = string.Empty;

    /// <summary>The mounts filled before the refused edit, on the module-limit case.</summary>
    public List<string> FittedSlots { get; set; } = [];

    /// <summary>The mount the refused edit asks for, on the module-limit case.</summary>
    public string TargetSlot { get; set; } = string.Empty;

    /// <summary>A capture to read first, where the case starts from one.</summary>
    public JsonElement? Input { get; set; }

    public EditorErrorExpectationFixture Expected { get; set; } = new();
}

/// <summary>What one refusal reports.</summary>
internal sealed class EditorErrorExpectationFixture
{
    public string Code { get; set; } = string.Empty;

    public string? Constraint { get; set; }

    public EditorErrorParamsFixture Params { get; set; } = new();
}

/// <summary>The language-neutral values a refusal carries.</summary>
internal sealed class EditorErrorParamsFixture
{
    public string? Slot { get; set; }

    public string? Symbol { get; set; }

    public string? Constraint { get; set; }

    public int? ModuleClass { get; set; }

    public int? SlotSize { get; set; }

    public string? ArmourShipName { get; set; }

    public string? ArmourShipSymbol { get; set; }

    public string? ShipSymbol { get; set; }

    public string? ShipName { get; set; }

    public string? ExclusionGroup { get; set; }

    public string? PreviousSlot { get; set; }

    public string? PreviousSymbol { get; set; }

    public string? Group { get; set; }

    public int? Count { get; set; }

    public int? Limit { get; set; }
}

/// <summary>The mounts a stock hull holds shut.</summary>
internal sealed class SlotRemovalFixture
{
    public string Ship { get; set; } = string.Empty;

    public List<SlotRemovalExpectationFixture> Expected { get; set; } = [];
}

/// <summary>One mount, and why it cannot be emptied.</summary>
internal sealed class SlotRemovalExpectationFixture
{
    public string Key { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public int Size { get; set; }

    public bool Removable { get; set; }

    public string? ImmovableReason { get; set; }
}

/// <summary>The readings a stated recipe gets when a build reads a capture.</summary>
internal sealed class StatedRecipesFixture
{
    public StatedRecipeCaseFixture CraftableRecipe { get; set; } = new();

    public StatedRecipeCaseFixture FixedArticle { get; set; } = new();

    public StatedRecipeCaseFixture UnresolvedRecipe { get; set; } = new();

    public StatedRecipeCaseFixture MercenaryClimb { get; set; } = new();

    public StatedRecipeCaseFixture MercenaryPurchase { get; set; } = new();

    public StatedRecipeCaseFixture InertModifiers { get; set; } = new();
}

/// <summary>One capture stating a recipe, and the state a read of it produces.</summary>
internal sealed class StatedRecipeCaseFixture
{
    public JsonElement Input { get; set; }

    public StatedRecipeExpectationFixture Expected { get; set; } = new();
}

/// <summary>What one mount carries after the recipe is read.</summary>
internal sealed class StatedRecipeExpectationFixture
{
    public string Slot { get; set; } = string.Empty;

    /// <summary>The block the module states, or absent where it states none.</summary>
    public List<EngineeringModifier>? Modifiers { get; set; }

    /// <summary>The effective stats the module then publishes, keyed by stat name.</summary>
    public Dictionary<string, double> Stats { get; set; } = [];

    public List<StatedRecipeOutcomeFixture> Outcomes { get; set; } = [];
}

/// <summary>One finding a read of a stated recipe reports.</summary>
internal sealed class StatedRecipeOutcomeFixture
{
    public string Action { get; set; } = string.Empty;

    public string Slot { get; set; } = string.Empty;

    public string SourceSymbol { get; set; } = string.Empty;

    public string BlueprintSymbol { get; set; } = string.Empty;

    public PreEngineeredArticleFixture? PreEngineeredVariant { get; set; }
}

/// <summary>The catalogued article a reading passed over.</summary>
internal sealed class PreEngineeredArticleFixture
{
    /// <summary>The modifiers the article is sold carrying.</summary>
    public List<ModifierFixture>? Modifiers { get; set; }

    /// <summary>The name the shop lists the article under.</summary>
    public string? Name { get; set; }

    public string Symbol { get; set; } = string.Empty;

    public string BlueprintSymbol { get; set; } = string.Empty;

    public int Grade { get; set; }

    public string Acquisition { get; set; } = string.Empty;
}

/// <summary>The captures a build refuses to read.</summary>
internal sealed class ImportRejectionsFixture
{
    public ImportRejectionCaseFixture UnknownHull { get; set; } = new();
}

/// <summary>One refused capture.</summary>
internal sealed class ImportRejectionCaseFixture
{
    public JsonElement Input { get; set; }

    public ImportRejectionExpectationFixture Expected { get; set; } = new();
}

/// <summary>What a refused capture reports.</summary>
internal sealed class ImportRejectionExpectationFixture
{
    public bool Accepted { get; set; }

    public string Reason { get; set; } = string.Empty;
}

/// <summary>One fitted module list and the allowance it uses up.</summary>
internal sealed class ModuleLimitsFixture
{
    /// <summary>The finding an over-filled family reports.</summary>
    public ModuleLimitIssueFixture ExpectedIssue { get; set; } = new();

    public string Group { get; set; } = string.Empty;

    public List<ModuleLimitEntryFixture> Input { get; set; } = [];

    public ModuleLimitUsageFixture ExpectedUsage { get; set; } = new();

    /// <summary>The catalogue counts the allowance is pinned on.</summary>
    public ModuleLimitCatalogueFixture Catalogue { get; set; } = new();

    /// <summary>The mount a limit holds shut once the allowance it grants is spent.</summary>
    public ModuleLimitRemovalFixture Removal { get; set; } = new();
}

/// <summary>One fitted module's limit facts.</summary>
/// <summary>The mount a spent module-limit allowance holds shut.</summary>
internal sealed class ModuleLimitRemovalFixture
{
    public string Ship { get; set; } = string.Empty;

    public string Slot { get; set; } = string.Empty;

    /// <summary>The article that grants the allowance.</summary>
    public string Stabiliser { get; set; } = string.Empty;

    /// <summary>The mounts filled with the articles that spend it.</summary>
    public List<string> WeaponSlots { get; set; } = [];

    public SlotRemovalExpectationFixture Expected { get; set; } = new();
}

internal sealed class ModuleLimitEntryFixture
{
    public string? LimitGroup { get; set; }

    public ModuleLimitIncreaseFixture? LimitIncrease { get; set; }
}

/// <summary>One module's increase to an allowance.</summary>
internal sealed class ModuleLimitIncreaseFixture
{
    public string Group { get; set; } = string.Empty;

    public int Amount { get; set; }
}

/// <summary>The allowance and the usage one case expects.</summary>
internal sealed class ModuleLimitUsageFixture
{
    public string Group { get; set; } = string.Empty;

    public int BaseLimit { get; set; }

    public int Increase { get; set; }

    public int Limit { get; set; }

    public int Count { get; set; }

    public int Excess { get; set; }
}

/// <summary>The catalogue modules that consume or raise the allowance.</summary>
internal sealed class ModuleLimitCatalogueFixture
{
    /// <summary>The modules that consume a place in a limit family.</summary>
    public int LimitedCount { get; set; }

    /// <summary>One module that consumes a place.</summary>
    public string Weapon { get; set; } = string.Empty;

    /// <summary>The modules that raise an allowance, and by how much.</summary>
    public List<ModuleLimitIncreaseModuleFixture> Increases { get; set; } = [];
}

/// <summary>One catalogue module that raises an allowance.</summary>
internal sealed class ModuleLimitIncreaseModuleFixture
{
    public string Symbol { get; set; } = string.Empty;

    public int Amount { get; set; }
}

/// <summary>Several weapons and the thermal load they sum to.</summary>
internal sealed class WeaponsFixture
{
    public List<WeaponThermalLoadFixture> Input { get; set; } = [];

    public double ExpectedThermalLoad { get; set; }
}

/// <summary>One weapon's thermal-load stat.</summary>
internal sealed class WeaponThermalLoadFixture
{
    public double ThermalLoad { get; set; }
}

/// <summary>One firing load and what the weapons capacitor makes of it.</summary>
internal sealed class WeaponsCapacitorFixture
{
    public WeaponsCapacitorInputFixture Input { get; set; } = new();

    public WeaponsCapacitorExpectedFixture Expected { get; set; } = new();
}

/// <summary>The capacity, the rated recharge, the sustained draw and the pips to model.</summary>
internal sealed class WeaponsCapacitorInputFixture
{
    public double WeaponsCapacity { get; set; }

    public double WeaponsRecharge { get; set; }

    public double SustainedEnergyPerSecond { get; set; }

    public double WeaponsPips { get; set; }
}

/// <summary>The recharge, the drain and the endurance one case expects.</summary>
internal sealed class WeaponsCapacitorExpectedFixture
{
    public double WeaponsPips { get; set; }

    public double Capacity { get; set; }

    public double RechargeRate { get; set; }

    public double SustainedEnergyPerSecond { get; set; }

    public double NetDrainRate { get; set; }

    public double TimeToDrain { get; set; }
}

/// <summary>One shield and SYS capacitor at four pips, and the same at a part allocation.</summary>
internal sealed class ShieldRecoveryFixture
{
    public ShieldRecoveryInputFixture Input { get; set; } = new();

    public ShieldRecoveryExpectedFixture Expected { get; set; } = new();

    /// <summary>The same arithmetic at a part allocation.</summary>
    public ShieldRecoveryCaseFixture PipAllocation { get; set; } = new();

    /// <summary>A shield strength the calculation must refuse.</summary>
    public ShieldRecoveryCaseFixture InvalidStrength { get; set; } = new();
}

/// <summary>One recovery case and what it answers, or the failure it is expected to raise.</summary>
internal sealed class ShieldRecoveryCaseFixture
{
    public ShieldRecoveryInputFixture Input { get; set; } = new();

    public ShieldRecoveryExpectedFixture Expected { get; set; } = new();

    public string? ExpectedError { get; set; }
}

/// <summary>The shield strength, generator rates and distributor figures one case states.</summary>
internal sealed class ShieldRecoveryInputFixture
{
    public double Strength { get; set; }

    public double RegenRate { get; set; }

    public double BrokenRegenRate { get; set; }

    public double DistributorDraw { get; set; }

    public double SystemsCapacity { get; set; }

    public double SystemsRecharge { get; set; }

    /// <summary>The pips assigned to SYS, where the case states one.</summary>
    public double? SystemsPips { get; set; }

    /// <summary>The stated figures as the calculator's own input record.</summary>
    internal ShieldRecoveryInput ToInput() => new(
        Strength, RegenRate, BrokenRegenRate, DistributorDraw, SystemsCapacity, SystemsRecharge);
}

/// <summary>The rates and the seconds one recovery case expects.</summary>
internal sealed class ShieldRecoveryExpectedFixture
{
    public double RegenRate { get; set; }

    public double BrokenRegenRate { get; set; }

    public double RecoveryTime { get; set; }

    public double RegenTime { get; set; }
}

/// <summary>The fitted cell banks and the totals the powered ones make.</summary>
internal sealed class CellBanksFixture
{
    public List<CellBankInputFixture> Input { get; set; } = [];

    public CellBanksExpectedFixture Expected { get; set; } = new();
}

/// <summary>One fitted shield cell bank.</summary>
internal sealed class CellBankInputFixture
{
    public string Slot { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    public double ReinforcementRate { get; set; }

    public double Cells { get; set; }

    public double SpinUp { get; set; }

    public double Duration { get; set; }

    public double Heat { get; set; }

    public bool Powered { get; set; }

    /// <summary>The stated bank as the calculator's own input record.</summary>
    internal CellBankInput ToInput() =>
        new(Slot, Symbol, ReinforcementRate, Cells, SpinUp, Duration, Heat, Powered);
}

/// <summary>The pool the powered banks make between them.</summary>
internal sealed class CellBanksExpectedFixture
{
    public double TotalRestorable { get; set; }

    public double TotalCells { get; set; }

    /// <summary>Each bank's power state, in slot order.</summary>
    public List<bool> Powered { get; set; } = [];
}

/// <summary>One loaded ship at full ENG, and the same hull at two other allocations.</summary>
internal sealed class MobilityFixture
{
    public MobilityInputFixture Input { get; set; } = new();

    public MobilityExpectedFixture Expected { get; set; } = new();

    /// <summary>A hull whose rotation rates do not move with the allocation.</summary>
    public MobilityCaseFixture ZeroPipRotation { get; set; } = new();

    /// <summary>A hull at a part allocation, whose every figure moves with it.</summary>
    public MobilityCaseFixture PipAllocation { get; set; } = new();

    /// <summary>One whole build, read at a fuel load of its caller's choosing.</summary>
    public MobilityFacadeFixture FacadeFuelOverride { get; set; } = new();

    /// <summary>A hull whose top speed is below its bottom one.</summary>
    public InvalidMobilityFixture InvalidSpeedEndpoints { get; set; } = new();
}

/// <summary>Figures that describe no hull, and the refusal they raise.</summary>
internal sealed class InvalidMobilityFixture
{
    public MobilityInputFixture Input { get; set; } = new();

    public string ExpectedError { get; set; } = string.Empty;
}

/// <summary>What one refused build reports, at the level the reader works at.</summary>
internal sealed class DiagnosticsFixture
{
    /// <summary>A payload the SLEF reader refuses before a build is built at all.</summary>
    public SlefDiagnosticCaseFixture Slef { get; set; } = new();

    /// <summary>An article too large for the mount it is fitted to.</summary>
    public LoadoutDiagnosticCaseFixture Loadout { get; set; } = new();

    /// <summary>A hatch every hull carries, fitted a second time to an optional mount.</summary>
    public LoadoutDiagnosticCaseFixture BuiltInHullModuleLoadout { get; set; } = new();

    /// <summary>A hatch one hull family carries, fitted a second time to an optional mount.</summary>
    public HullSpecificHatchFixture HullSpecificHullModuleLoadout { get; set; } = new();

    /// <summary>An article sold for one hull, fitted to another.</summary>
    public LoadoutDiagnosticCaseFixture RestrictedLoadout { get; set; } = new();
}

/// <summary>One payload the SLEF reader refuses, and the field it names.</summary>
internal sealed class SlefDiagnosticCaseFixture
{
    public JsonElement Input { get; set; }

    public SlefDiagnosticFixture Expected { get; set; } = new();
}

/// <summary>The field a refused payload is refused on.</summary>
internal sealed class SlefDiagnosticFixture
{
    public string Code { get; set; } = string.Empty;

    /// <summary>Where in the payload the field sits.</summary>
    public string Path { get; set; } = string.Empty;

    /// <summary>The rule the field breaks.</summary>
    public string Constraint { get; set; } = string.Empty;
}

/// <summary>One build a validation refuses, and the finding it reports.</summary>
internal sealed class LoadoutDiagnosticCaseFixture
{
    public JsonElement Input { get; set; }

    /// <summary>The mount a read keeps filled, where the case states one.</summary>
    public KeptModuleFixture? Kept { get; set; }

    public LoadoutDiagnosticFixture Expected { get; set; } = new();
}

/// <summary>A mount a read leaves filled, and what the read reported doing.</summary>
internal sealed class KeptModuleFixture
{
    public string Slot { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    public List<ImportOutcomeFixture> ImportOutcomes { get; set; } = [];
}

/// <summary>The finding one refused build reports, and every figure it quotes.</summary>
internal sealed class LoadoutDiagnosticFixture
{
    public string Code { get; set; } = string.Empty;

    public LoadoutDiagnosticParamsFixture Params { get; set; } = new();
}

/// <summary>The figures a finding quotes, which a caller composes its own text from.</summary>
internal sealed class LoadoutDiagnosticParamsFixture
{
    public string Slot { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    /// <summary>Why the article does not fit.</summary>
    public string Constraint { get; set; } = string.Empty;

    public int? ModuleClass { get; set; }

    public int? SlotSize { get; set; }

    /// <summary>The hulls a restricted article is sold for, by name.</summary>
    public List<string>? AllowedShipNames { get; set; }

    /// <summary>The same hulls, by symbol.</summary>
    public List<string>? AllowedShipSymbols { get; set; }

    /// <summary>The hull being fitted.</summary>
    public string? ShipSymbol { get; set; }
}

/// <summary>A hatch one hull family carries, fitted a second time.</summary>
/// <remarks>
/// The catalogue carries such a hatch once for every hull family that names its own, so a
/// read empties the second mount rather than reporting the build invalid.
/// </remarks>
internal sealed class HullSpecificHatchFixture
{
    public JsonElement Input { get; set; }

    /// <summary>The mount the read empties, and what it reported doing.</summary>
    public EmptiedModuleFixture Emptied { get; set; } = new();

    /// <summary>The hatch the hull family names.</summary>
    public string HatchSymbol { get; set; } = string.Empty;

    /// <summary>Whether the read build is valid once the second mount is empty.</summary>
    public bool Valid { get; set; }
}

/// <summary>A mount a read empties, and what the read reported doing.</summary>
internal sealed class EmptiedModuleFixture
{
    public string Slot { get; set; } = string.Empty;

    public List<ImportOutcomeFixture> ImportOutcomes { get; set; } = [];
}

/// <summary>One-per-ship families, and the finding a second one reports.</summary>
internal sealed class ExclusivityFixture
{
    public string Group { get; set; } = string.Empty;

    public string ExpectedCode { get; set; } = string.Empty;
}

/// <summary>Thrusters rated below what the ship weighs, load by load.</summary>
internal sealed class ThrusterMassFixture
{
    public ThrusterMassInputFixture Input { get; set; } = new();

    public List<ThrusterMassCaseFixture> Cases { get; set; } = [];

    /// <summary>Ship weights the same thrusters carry at every load, so nothing is reported.</summary>
    public List<ThrusterMassLoadFixture> Quiet { get; set; } = [];
}

/// <summary>The thrusters the cases are measured against.</summary>
internal sealed class ThrusterMassInputFixture
{
    public string Slot { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    /// <summary>What the thrusters are rated to move, in tonnes.</summary>
    public double ThrusterMaxMass { get; set; }
}

/// <summary>One ship weight, and the load at which the thrusters give out.</summary>
internal sealed class ThrusterMassCaseFixture
{
    public string Name { get; set; } = string.Empty;

    public ThrusterMassLoadFixture Mass { get; set; } = new();

    /// <summary>The finding, or nothing where the thrusters carry every load.</summary>
    public ThrusterMassIssueFixture? ExpectedIssue { get; set; }
}

/// <summary>What the ship weighs, empty and at each thing it carries.</summary>
internal sealed class ThrusterMassLoadFixture
{
    public double Dry { get; set; }

    /// <summary>The main tank, which a load that carries none leaves out.</summary>
    public double Fuel { get; set; }

    /// <summary>The hold, which a load that carries none leaves out.</summary>
    public double Cargo { get; set; }
}

/// <summary>The finding one overloaded set of thrusters reports.</summary>
internal sealed class ThrusterMassIssueFixture
{
    public string Code { get; set; } = string.Empty;

    public string Severity { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public ThrusterMassParamsFixture Params { get; set; } = new();
}

/// <summary>The figures an overload finding quotes.</summary>
internal sealed class ThrusterMassParamsFixture
{
    public string Slot { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    /// <summary>The lightest load the thrusters cannot move.</summary>
    public string Load { get; set; } = string.Empty;

    public double Mass { get; set; }

    public double MaxMass { get; set; }
}

/// <summary>One build a metrics view reads for its speed and handling.</summary>
internal sealed class MobilityFacadeFixture
{
    /// <summary>The capture the build is read from.</summary>
    public JsonElement Loadout { get; set; }

    public BuildLoadFixture Options { get; set; } = new();

    public MobilityExpectedFixture Expected { get; set; } = new();

    /// <summary>The loads a metrics view refuses.</summary>
    public List<InvalidLoadFixture> InvalidLoads { get; set; } = [];
}

/// <summary>The fuel and the cargo one calculation runs at.</summary>
internal sealed class BuildLoadFixture
{
    public double? Fuel { get; set; }

    public double? Cargo { get; set; }
}

/// <summary>One load a metrics view refuses, and what it refuses with.</summary>
internal sealed class InvalidLoadFixture
{
    public BuildLoadFixture Options { get; set; } = new();

    public string ExpectedError { get; set; } = string.Empty;
}

/// <summary>One hull, loaded mass, thruster curve and ENG allocation, with its metrics.</summary>
internal sealed class MobilityCaseFixture
{
    public MobilityInputFixture Input { get; set; } = new();

    public MobilityExpectedFixture Expected { get; set; } = new();

    /// <summary>The speed at each whole allocation, from no ENG pips through four.</summary>
    public List<double> SpeedSequence { get; set; } = [];

    /// <summary>The pitch rate at each whole allocation, from no ENG pips through four.</summary>
    public List<double> PitchSequence { get; set; } = [];
}

/// <summary>The hull figures, loaded mass, thrusters and allocation one case states.</summary>
internal sealed class MobilityInputFixture
{
    public double MinimumSpeed { get; set; }

    public double MaximumSpeed { get; set; }

    public double Boost { get; set; }

    public double MinPitch { get; set; }

    public double Pitch { get; set; }

    public double MinRoll { get; set; }

    public double Roll { get; set; }

    public double MinYaw { get; set; }

    public double Yaw { get; set; }

    public double Mass { get; set; }

    public ThrusterFixture Thrusters { get; set; } = new();

    /// <summary>The pips assigned to ENG, where the case states one.</summary>
    public double? EnginesPips { get; set; }

    /// <summary>The stated figures as the calculator's own input record.</summary>
    internal MobilityInput ToInput() => new(
        MinimumSpeed,
        MaximumSpeed,
        Boost,
        MinPitch,
        Pitch,
        MinRoll,
        Roll,
        MinYaw,
        Yaw,
        Mass)
    {
        Thrusters = Thrusters.ToThrusters(),
    };
}

/// <summary>One thruster's mass curves.</summary>
internal sealed class ThrusterFixture
{
    public double MinMass { get; set; }

    public double OptMass { get; set; }

    public double MaxMass { get; set; }

    public double MinMultiplier { get; set; }

    public double OptMultiplier { get; set; }

    public double MaxMultiplier { get; set; }

    public ThrusterFixture? SpeedCurve { get; set; }

    public ThrusterFixture? RotationCurve { get; set; }

    /// <summary>The stated curve as a fitted thruster, with its two optional curves.</summary>
    internal ThrusterParams ToThrusters() => new(
        MinMass, OptMass, MaxMass, MinMultiplier, OptMultiplier, MaxMultiplier)
    {
        SpeedCurve = SpeedCurve?.ToCurve(),
        RotationCurve = RotationCurve?.ToCurve(),
    };

    /// <summary>The stated curve on its own.</summary>
    internal ThrusterCurveParams ToCurve() => new(
        MinMass, OptMass, MaxMass, MinMultiplier, OptMultiplier, MaxMultiplier);
}

/// <summary>The speed, boost, handling and curve multipliers one case expects.</summary>
internal sealed class MobilityExpectedFixture
{
    public double Speed { get; set; }

    public double Boost { get; set; }

    public double Pitch { get; set; }

    public double Roll { get; set; }

    public double Yaw { get; set; }

    public double MassCurveMultiplier { get; set; }

    public double RotationMassCurveMultiplier { get; set; }
}

/// <summary>One distributor and the three capacitor figures it leaves.</summary>
internal sealed class DistributorFixture
{
    public DistributorInputFixture Input { get; set; } = new();

    public DistributorExpectedFixture Expected { get; set; } = new();

    /// <summary>One whole build, read at an allocation of its caller's choosing.</summary>
    public DistributorFacadeFixture Facade { get; set; } = new();
}

/// <summary>One build a metrics view reads its distributor from.</summary>
internal sealed class DistributorFacadeFixture
{
    /// <summary>What an absent build means here, in the fixture's own words.</summary>
    public string? NullLoadoutsNote { get; set; }

    /// <summary>What the case is about, in the fixture's own words.</summary>
    public string? Note { get; set; }

    /// <summary>The capture the build is read from.</summary>
    public JsonElement Loadout { get; set; }

    public DistributorFacadePipsFixture Options { get; set; } = new();

    public DistributorExpectedFixture Expected { get; set; } = new();

    /// <summary>The captures whose distributor has no power, so no figures follow.</summary>
    public List<JsonElement> NullLoadouts { get; set; } = [];
}

/// <summary>The three capacities, their rated recharge rates and the pips to model.</summary>
internal sealed class DistributorInputFixture
{
    public double SystemsCapacity { get; set; }

    public double SystemsRecharge { get; set; }

    public double EnginesCapacity { get; set; }

    public double EnginesRecharge { get; set; }

    public double WeaponsCapacity { get; set; }

    public double WeaponsRecharge { get; set; }

    public double SystemsPips { get; set; }

    public double EnginesPips { get; set; }

    public double WeaponsPips { get; set; }
}

/// <summary>The three capacitors and the allocation they were calculated at.</summary>
internal sealed class DistributorExpectedFixture
{
    public CapacitorFixture Systems { get; set; } = new();

    public CapacitorFixture Engines { get; set; } = new();

    public CapacitorFixture Weapons { get; set; } = new();

    public DistributorPipsFixture Pips { get; set; } = new();
}

/// <summary>One capacitor's capacity, rated recharge and recharge at the stated pips.</summary>
internal sealed class CapacitorFixture
{
    public double Capacity { get; set; }

    public double RatedRecharge { get; set; }

    public double RechargeRate { get; set; }
}

/// <summary>The pips one facade case asks its build for.</summary>
internal sealed class DistributorFacadePipsFixture
{
    public double SystemsPips { get; set; }

    public double EnginesPips { get; set; }

    public double WeaponsPips { get; set; }
}

/// <summary>The allocation one distributor result was calculated at.</summary>
internal sealed class DistributorPipsFixture
{
    public double Systems { get; set; }

    public double Engines { get; set; }

    public double Weapons { get; set; }
}

/// <summary>The finding an over-filled per-ship count family reports.</summary>
internal sealed class ModuleLimitIssueFixture
{
    public string Code { get; set; } = string.Empty;

    public ModuleLimitIssueParamsFixture Params { get; set; } = new();
}

/// <summary>The figures an over-filled family quotes.</summary>
internal sealed class ModuleLimitIssueParamsFixture
{
    public string Group { get; set; } = string.Empty;

    public int Count { get; set; }

    public int Limit { get; set; }
}
