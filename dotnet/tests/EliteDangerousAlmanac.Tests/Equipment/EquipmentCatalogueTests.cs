using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Equipment;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Equipment;

/// <summary>The suits, the weapons, the tools and what each of them states.</summary>
public sealed class EquipmentCatalogueTests
{
    private static readonly EquipmentFixture Fixture =
        SharedFixtures.Load<EquipmentFixture>("fixtures/equipment/equipment.jsonc");

    public static TheoryData<int> SuitCases => Indices(Fixture.Suits.Count);

    public static TheoryData<int> MountCases => Indices(Fixture.SuitMounts.Count);

    public static TheoryData<int> ToolCases => Indices(Fixture.Tools.Count);

    public static TheoryData<int> WeaponCases => Indices(Fixture.Weapons.Count);

    [Fact]
    public void EveryCatalogueCarriesTheRecordsTheFixtureCounts()
    {
        Assert.Equal(Fixture.Counts.Suits, SuitCatalogue.All.Count);
        Assert.Equal(Fixture.Counts.Tools, PersonalToolCatalogue.All.Count);
        Assert.Equal(Fixture.Counts.Weapons, PersonalWeaponCatalogue.All.Count);
        Assert.Equal(
            Fixture.Counts.ModificationRecipes, PersonalModificationCatalogue.All.Count);
        Assert.Equal(
            Fixture.Counts.ModificationRecipes, PersonalModificationCatalogue.AllCosts.Count);
    }

    [Theory]
    [MemberData(nameof(SuitCases))]
    public void ASuitStatesItsFamilyStatsAndTheStatsOfOneGrade(int index)
    {
        SuitFixture expected = Fixture.Suits[index];

        Suit suit = Assert.IsType<Suit>(SuitCatalogue.FindByFamily(expected.Family));
        SuitIdentity identity = Assert.IsType<SuitIdentity>(
            SuitCatalogue.FindBySymbol(expected.Symbol));
        SuitGrade grade = Assert.IsType<SuitGrade>(SuitCatalogue.Grade(suit, expected.Grade));

        Assert.Equal(expected.Name, suit.Name);
        Assert.Same(suit, identity.Suit);
        Assert.Equal(expected.Grade, identity.Grade);
        Assert.Equal(expected.Symbol, grade.Symbol, ignoreCase: true);
        Assert.Equal(expected.ModificationSlots, grade.ModificationSlots);
        Assert.Equal(expected.ShieldStrength, grade.ShieldStrength);
        Assert.Equal(expected.ArmourKineticResistance, grade.ArmourKineticResistance);
        Assert.Equal(expected.ArmourThermalResistance, grade.ArmourThermalResistance);
        Assert.Equal(expected.ArmourPlasmaResistance, grade.ArmourPlasmaResistance);
        Assert.Equal(expected.ArmourExplosiveResistance, grade.ArmourExplosiveResistance);

        // The shield's four resistances belong to the family, so a grade leaves them alone.
        Assert.Equal(expected.ShieldKineticResistance, suit.ShieldKineticResistance);
        Assert.Equal(expected.ShieldThermalResistance, suit.ShieldThermalResistance);
        Assert.Equal(expected.ShieldPlasmaResistance, suit.ShieldPlasmaResistance);
        Assert.Equal(expected.ShieldExplosiveResistance, suit.ShieldExplosiveResistance);
        Assert.Equal(expected.BatteryCapacity, suit.BatteryCapacity);
        Assert.Equal(expected.GoodsCapacity, suit.GoodsCapacity);
    }

    [Theory]
    [MemberData(nameof(MountCases))]
    public void ASuitCarriesTheMountsItsFamilyStates(int index)
    {
        SuitMountsFixture expected = Fixture.SuitMounts[index];

        Suit suit = Assert.IsType<Suit>(SuitCatalogue.FindByFamily(expected.Family));

        Assert.Equal(expected.Mounts.Count, suit.Mounts.Count);
        for (int mount = 0; mount < expected.Mounts.Count; mount++)
        {
            Assert.Equal(expected.Mounts[mount].Key, suit.Mounts[mount].Key);
            Assert.Equal(
                expected.Mounts[mount].Kind,
                suit.Mounts[mount].Kind.ToString(),
                ignoreCase: true);
        }
    }

    [Theory]
    [MemberData(nameof(ToolCases))]
    public void AToolStatesOnlyTheFiguresItHas(int index)
    {
        ToolFixture expected = Fixture.Tools[index];

        PersonalTool tool = Assert.IsType<PersonalTool>(PersonalToolCatalogue.FindById(expected.Id));

        Assert.Equal(expected.Name, tool.Name);
        Assert.Equal(expected.SuitFamilies, tool.SuitFamilies);
        Assert.Equal(expected.RechargeRate, tool.RechargeRate);
        Assert.Equal(expected.DischargeRate, tool.DischargeRate);
        Assert.Equal(expected.DischargeDuration, tool.DischargeDuration);
        Assert.Equal(expected.OverloadPowerUsage, tool.OverloadPowerUsage);
        Assert.Equal(expected.PowerUsage, tool.PowerUsage);
        Assert.Equal(expected.ScanDuration, tool.ScanDuration);
        Assert.Equal(expected.CloneDuration, tool.CloneDuration);
    }

    [Theory]
    [MemberData(nameof(WeaponCases))]
    public void AWeaponStatesItsOwnStatsAndTheDamageOfOneGrade(int index)
    {
        WeaponFixture expected = Fixture.Weapons[index];

        PersonalWeapon weapon = Assert.IsType<PersonalWeapon>(
            PersonalWeaponCatalogue.FindBySymbol(expected.Symbol));
        PersonalWeaponGrade grade = Assert.IsType<PersonalWeaponGrade>(
            PersonalWeaponCatalogue.Grade(weapon, expected.Grade));

        Assert.Equal(expected.Name, weapon.Name);
        Assert.Same(weapon, PersonalWeaponCatalogue.FindByName(expected.Name));
        Assert.Equal(expected.Damage, grade.Damage);
        Assert.Equal(expected.ModificationSlots, grade.ModificationSlots);
        Assert.Equal(expected.RateOfFire, weapon.RateOfFire);
        Assert.Equal(expected.MagazineSize, weapon.MagazineSize);
        Assert.Equal(expected.EffectiveRange, weapon.EffectiveRange);
        Assert.Equal(expected.ScopeMagnification, weapon.ScopeMagnification.Default);
        Assert.Equal(expected.ReloadTime.Default, weapon.ReloadTime.Default);
        Assert.Equal(expected.ReloadTime.Upgraded, weapon.ReloadTime.Upgraded);
    }

    [Fact]
    public void EveryLookupAnswersAMissRatherThanFailing()
    {
        Assert.Null(SuitCatalogue.FindByFamily("notasuit"));
        Assert.Null(SuitCatalogue.FindByFamily(null));
        Assert.Null(SuitCatalogue.FindByName(null));
        Assert.Null(SuitCatalogue.FindBySymbol("notasuit_class3"));
        Assert.Null(PersonalWeaponCatalogue.FindBySymbol(null));
        Assert.Null(PersonalWeaponCatalogue.FindByName("Not A Weapon"));
        Assert.Null(PersonalToolCatalogue.FindById("  "));
        Assert.Null(PersonalModificationCatalogue.Find("suit_notarecipe"));
        Assert.Null(PersonalModificationCatalogue.FindCost(null));
    }

    [Fact]
    public void EveryLookupIgnoresCaseAndSurroundingWhitespace()
    {
        Assert.NotNull(SuitCatalogue.FindByFamily("  UtilitySuit  "));
        Assert.NotNull(SuitCatalogue.FindByName(" maverick suit "));
        Assert.NotNull(SuitCatalogue.FindBySymbol("UTILITYSUIT_CLASS3"));
        Assert.NotNull(PersonalWeaponCatalogue.FindBySymbol(" WPN_S_Pistol_Kinetic_SAuto "));
        Assert.NotNull(PersonalToolCatalogue.FindById("ENERGYLINK"));
        Assert.NotNull(PersonalModificationCatalogue.Find(" Suit_IncreasedMeleeDamage "));
    }

    [Fact]
    public void TheFlightSuitTakesOneSidearmAndClimbsNoLadder()
    {
        Suit flightSuit = Assert.IsType<Suit>(SuitCatalogue.FindByFamily("flightsuit"));

        PersonalMount mount = Assert.Single(flightSuit.Mounts);

        Assert.Equal(PersonalWeaponSlot.Secondary, mount.Kind);
        Assert.Null(PersonalUpgradeCosts.SuitStep("flightsuit", 2));
        Assert.Null(PersonalUpgradeCosts.Suit("flightsuit", 5));
    }

    [Fact]
    public void NoGradeOutsideTheLadderIsRead()
    {
        Suit suit = Assert.IsType<Suit>(SuitCatalogue.FindByFamily("utilitysuit"));
        PersonalWeapon weapon = Assert.IsType<PersonalWeapon>(
            PersonalWeaponCatalogue.FindBySymbol("wpn_s_pistol_kinetic_sauto"));

        Assert.Throws<ArgumentOutOfRangeException>(() => SuitCatalogue.Grade(suit, 0));
        Assert.Throws<ArgumentOutOfRangeException>(() => SuitCatalogue.Grade(suit, 6));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => PersonalWeaponCatalogue.Grade(weapon, 0));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => PersonalWeaponCatalogue.Metrics(weapon, 6));
        Assert.Throws<ArgumentNullException>(() => SuitCatalogue.Grade(null!, 1));
    }

    [Fact]
    public void EveryCatalogueRefusesToBeChanged()
    {
        Assert.Throws<NotSupportedException>(() => ((IList<Suit>)SuitCatalogue.All).Clear());
        Assert.Throws<NotSupportedException>(
            () => ((IList<PersonalWeapon>)PersonalWeaponCatalogue.All).Clear());
        Assert.Throws<NotSupportedException>(
            () => ((IList<PersonalTool>)PersonalToolCatalogue.All).Clear());
        Assert.Throws<NotSupportedException>(
            () => ((IDictionary<string, PersonalModification>)PersonalModificationCatalogue.All)
                .Clear());
    }

    private static TheoryData<int> Indices(int count)
    {
        TheoryData<int> cases = [];
        for (int index = 0; index < count; index++) cases.Add(index);
        return cases;
    }
}
