using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Equipment;

/// <summary>The part of <c>fixtures/equipment/equipment.jsonc</c> these tests read.</summary>
internal sealed class EquipmentFixture
{
    /// <summary>How many records each catalogue carries.</summary>
    public EquipmentCountsFixture Counts { get; set; } = new();

    /// <summary>Two suits, each at one grade.</summary>
    public List<SuitFixture> Suits { get; set; } = [];

    /// <summary>The mounts every suit family carries.</summary>
    public List<SuitMountsFixture> SuitMounts { get; set; } = [];

    /// <summary>Every suit tool and the figures it publishes.</summary>
    public List<ToolFixture> Tools { get; set; } = [];

    /// <summary>Three weapons, each at one grade.</summary>
    public List<WeaponFixture> Weapons { get; set; } = [];

    /// <summary>What three stock weapons deal.</summary>
    public List<WeaponMetricsFixture> WeaponMetrics { get; set; } = [];

    /// <summary>What two engineered weapons deal.</summary>
    public List<EngineeredWeaponMetricsFixture> EngineeredWeaponMetrics { get; set; } = [];

    /// <summary>What climbing a suit and a weapon costs.</summary>
    public UpgradeCostsFixture UpgradeCosts { get; set; } = new();

    /// <summary>One stat change from each kind of recipe.</summary>
    public List<ModifierFixture> Modifiers { get; set; } = [];

    /// <summary>The recipes bought for an unlock alone, which state no stat change.</summary>
    public List<string> ModificationsWithoutModifiers { get; set; } = [];

    /// <summary>The suit recipe that lowers what every tool draws.</summary>
    public ToolDrainFixture ToolDrain { get; set; } = new();

    /// <summary>One journal spelling that names three recipes.</summary>
    public ModificationSpellingFixture Modification { get; set; } = new();
}

/// <summary>How many records each catalogue carries.</summary>
internal sealed class EquipmentCountsFixture
{
    public int Suits { get; set; }

    public int Tools { get; set; }

    public int Weapons { get; set; }

    public int ModificationRecipes { get; set; }

    public int ModificationNames { get; set; }
}

/// <summary>One suit at one grade.</summary>
internal sealed class SuitFixture
{
    public string Family { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    public int Grade { get; set; }

    public double ShieldStrength { get; set; }

    public double ArmourKineticResistance { get; set; }

    public double ArmourThermalResistance { get; set; }

    public double ArmourPlasmaResistance { get; set; }

    public double ArmourExplosiveResistance { get; set; }

    public double ShieldKineticResistance { get; set; }

    public double ShieldThermalResistance { get; set; }

    public double ShieldPlasmaResistance { get; set; }

    public double ShieldExplosiveResistance { get; set; }

    public int ModificationSlots { get; set; }

    public double BatteryCapacity { get; set; }

    public double GoodsCapacity { get; set; }
}

/// <summary>The mounts one suit family carries.</summary>
internal sealed class SuitMountsFixture
{
    public string Family { get; set; } = string.Empty;

    public List<MountFixture> Mounts { get; set; } = [];
}

/// <summary>One weapon mount.</summary>
internal sealed class MountFixture
{
    public string Key { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;
}

/// <summary>One suit tool.</summary>
internal sealed class ToolFixture
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public List<string> SuitFamilies { get; set; } = [];

    public double? RechargeRate { get; set; }

    public double? DischargeRate { get; set; }

    public double? DischargeDuration { get; set; }

    public double? OverloadPowerUsage { get; set; }

    public double? PowerUsage { get; set; }

    public double? ScanDuration { get; set; }

    public double? CloneDuration { get; set; }
}

/// <summary>One weapon at one grade.</summary>
internal sealed class WeaponFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public int Grade { get; set; }

    public double Damage { get; set; }

    public double RateOfFire { get; set; }

    public double MagazineSize { get; set; }

    public double EffectiveRange { get; set; }

    public int ModificationSlots { get; set; }

    public double ScopeMagnification { get; set; }

    public ReloadTimeFixture ReloadTime { get; set; } = new();
}

/// <summary>The two reload times one weapon publishes.</summary>
internal sealed class ReloadTimeFixture
{
    public double Default { get; set; }

    public double Upgraded { get; set; }
}

/// <summary>What one stock weapon deals.</summary>
internal sealed class WeaponMetricsFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public int Grade { get; set; }

    public double DamagePerShot { get; set; }

    public double HeadshotDamagePerShot { get; set; }

    public double RateOfFire { get; set; }

    public double SustainedRateOfFire { get; set; }

    public double DamagePerSecond { get; set; }

    public double SustainedDamagePerSecond { get; set; }
}

/// <summary>What one engineered weapon deals.</summary>
internal sealed class EngineeredWeaponMetricsFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public int Grade { get; set; }

    public string RecipeSymbol { get; set; } = string.Empty;

    public double DamagePerShot { get; set; }

    public double HeadshotDamagePerShot { get; set; }

    public double SustainedDamagePerSecond { get; set; }
}

/// <summary>What climbing a suit and a weapon costs.</summary>
internal sealed class UpgradeCostsFixture
{
    /// <summary>The one step that takes the Maverick Suit to grade two.</summary>
    public List<IngredientFixture> MaverickGrade2 { get; set; } = [];

    /// <summary>The graphene the climb from grade one to grade three asks for.</summary>
    public int MaverickGrade1To3Graphene { get; set; }

    /// <summary>The weapon components the climb to grade five asks for.</summary>
    public int Ar50Grade5WeaponComponents { get; set; }
}

/// <summary>One material a recipe asks for.</summary>
internal sealed class IngredientFixture
{
    public string Symbol { get; set; } = string.Empty;

    public int Count { get; set; }
}

/// <summary>One stat change and what it does to one base figure.</summary>
internal sealed class ModifierFixture
{
    public string RecipeSymbol { get; set; } = string.Empty;

    public string Stat { get; set; } = string.Empty;

    public double Base { get; set; }

    public double Modified { get; set; }
}

/// <summary>The suit recipe that lowers what every tool draws.</summary>
internal sealed class ToolDrainFixture
{
    public string RecipeSymbol { get; set; } = string.Empty;

    public string Stat { get; set; } = string.Empty;

    public double Multiplier { get; set; }

    public double ArcCutterPowerUsage { get; set; }

    public double EnergylinkOverloadPowerUsage { get; set; }
}

/// <summary>One journal spelling that names a recipe in each weapon menu.</summary>
internal sealed class ModificationSpellingFixture
{
    public string JournalSymbol { get; set; } = string.Empty;

    public string KineticRecipeSymbol { get; set; } = string.Empty;

    public string LaserRecipeSymbol { get; set; } = string.Empty;

    public IngredientFixture KineticFirstIngredient { get; set; } = new();

    public IngredientFixture LaserFirstIngredient { get; set; } = new();
}
