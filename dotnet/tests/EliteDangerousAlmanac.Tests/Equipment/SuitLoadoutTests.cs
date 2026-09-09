using System;
using System.Collections.Generic;
using System.Text.Json;
using EliteDangerousAlmanac.Equipment;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Equipment;

/// <summary>Reading a suit loadout out of the events the journal writes.</summary>
public sealed class SuitLoadoutTests
{
    private static readonly SuitLoadoutFixtures Fixture =
        SharedFixtures.Load<SuitLoadoutFixtures>("fixtures/equipment/suit-loadouts.jsonc");

    public static TheoryData<string> ImportCases => Keys(Fixture.Imports);

    public static TheoryData<string> RefusalCases => Keys(Fixture.Refusals);

    public static TheoryData<int> CaptureWeaponCases
    {
        get
        {
            TheoryData<int> cases = [];
            for (int index = 0; index < Fixture.Capture.Weapons.Count; index++) cases.Add(index);
            return cases;
        }
    }

    [Fact]
    public void ACapturedLoadoutIsReadWithEveryMountAndRecipeItStates()
    {
        CaptureFixture expected = Fixture.Capture;

        SuitLoadout loadout = SuitLoadout.Parse(Read(expected.Source));

        Assert.Equal(expected.SuitFamily, loadout.Suit.Family);
        Assert.Equal(expected.SuitName, loadout.Suit.Name);
        Assert.Equal(expected.Grade, loadout.Grade);
        Assert.Equal(expected.SuitId, loadout.SuitId);
        Assert.Equal(expected.LoadoutId, loadout.LoadoutId);
        Assert.Equal(expected.Name, loadout.Name);
        Assert.Equal(expected.Modifications, Symbols(loadout.Modifications));
        Assert.Equal(expected.ModifierStats, Stats(loadout.Modifiers));
        Assert.Empty(loadout.ImportOutcomes);
    }

    [Fact]
    public void ASwitchEventStatesTheSameLoadoutAsTheCaptureItSwitchesTo()
    {
        CaptureFixture expected = Fixture.Capture;

        SuitLoadout switched = SuitLoadout.Parse(Read(expected.SwitchSource));

        Assert.Equal(expected.SuitFamily, switched.Suit.Family);
        Assert.Equal(expected.Modifications, Symbols(switched.Modifications));
        Assert.Equal(
            Weapons(SuitLoadout.Parse(Read(expected.Source))), Weapons(switched));
    }

    [Fact]
    public void ACapturedLoadoutFoldsItsSuitRecipesOntoTheSuitStats()
    {
        CaptureFixture expected = Fixture.Capture;
        SuitLoadout loadout = SuitLoadout.Parse(Read(expected.Source));

        Assert.Equal(
            expected.ShieldRegeneration,
            PersonalEngineering.ApplyModifiers(
                "shieldRegeneration", loadout.Stats.ShieldRegeneration, loadout.Modifiers),
            1e-6);

        // Damage Resistance multiplies the damage taken, so a resistance compounds on
        // what gets through rather than on the resistance itself.
        Assert.Equal(
            expected.ArmourKineticResistance,
            PersonalEngineering.ApplyModifiers(
                "armourKineticResistance", loadout.Stats.ArmourKineticResistance, loadout.Modifiers),
            1e-6);
    }

    [Theory]
    [MemberData(nameof(CaptureWeaponCases))]
    public void EveryFittedWeaponCarriesWhatItsMountAndItsSuitGiveIt(int index)
    {
        CaptureWeaponFixture expected = Fixture.Capture.Weapons[index];
        SuitLoadout loadout = SuitLoadout.Parse(Read(Fixture.Capture.Source));

        FittedPersonalWeapon fitted = loadout.Weapons[index];

        Assert.Equal(expected.Mount, fitted.Mount);
        Assert.Equal(expected.ModuleId, fitted.ModuleId);
        Assert.Equal(expected.Symbol, fitted.Weapon.Symbol, ignoreCase: true);
        Assert.Equal(expected.Name, fitted.Weapon.Name);
        Assert.Equal(expected.Grade, fitted.Grade);
        Assert.Equal(expected.Modifications, Symbols(fitted.Modifications));

        // The suit's Extra Ammo Capacity acts on a weapon and belongs here; the rest of
        // what the suit wears does not.
        Assert.Equal(expected.ModifierStats, Stats(fitted.Modifiers));
        Assert.Equal(expected.ReloadSpeed, fitted.ReloadSpeed);
        Assert.Equal(expected.Scope, fitted.Scope);
        Assert.Equal(
            expected.MagazineSize,
            PersonalEngineering.ApplyModifiers(
                "magazineSize", fitted.Weapon.MagazineSize, fitted.Modifiers));
        Assert.Equal(
            expected.ReserveAmmo,
            PersonalEngineering.ApplyModifiers(
                "reserveAmmo", fitted.Weapon.ReserveAmmo, fitted.Modifiers));
        Assert.Equal(expected.DamagePerShot, fitted.Metrics.DamagePerShot, 1e-3);
        Assert.Equal(expected.HeadshotDamagePerShot, fitted.Metrics.HeadshotDamagePerShot, 1e-3);
        Assert.Equal(expected.DamagePerSecond, fitted.Metrics.DamagePerSecond, 1e-3);
        Assert.Equal(
            expected.SustainedDamagePerSecond, fitted.Metrics.SustainedDamagePerSecond, 1e-3);
    }

    [Theory]
    [MemberData(nameof(ImportCases))]
    public void AnEntryAReadCannotFitIsPassedOverAndReported(string name)
    {
        ImportCaseFixture expected = Fixture.Imports[name];
        SuitLoadoutEvent stated = Read(expected.Event);

        SuitLoadout loadout = SuitLoadout.Parse(stated);

        Assert.Equal(expected.Mounts, Mounts(loadout));
        Assert.Equal(expected.Modifications, FittedSymbols(loadout));
        Assert.Equal(expected.ImportOutcomes.Count, loadout.ImportOutcomes.Count);
        for (int index = 0; index < expected.ImportOutcomes.Count; index++)
        {
            SuitLoadoutImportOutcome outcome = loadout.ImportOutcomes[index];
            Assert.Equal(
                expected.ImportOutcomes[index].Action, outcome.Action.ToString(), ignoreCase: true);
            Assert.Equal(expected.ImportOutcomes[index].Mount, outcome.Mount);
            Assert.Equal(expected.ImportOutcomes[index].SourceSymbol, outcome.SourceSymbol);
        }
    }

    [Theory]
    [MemberData(nameof(RefusalCases))]
    public void AnEventAReadCannotIdentifyIsRefused(string name)
    {
        RefusalFixture expected = Fixture.Refusals[name];

        if (expected.Event.ValueKind == JsonValueKind.Null)
        {
            Assert.Throws<ArgumentNullException>(() => SuitLoadout.Parse(null!));
            return;
        }

        // A field of the wrong shape is refused where the event is built, one step before
        // the loadout is read. What reaches the read is refused by the read itself.
        if (!Readable(expected.Event, out SuitLoadoutEvent? stated))
        {
            Assert.Throws<JsonException>(() => Read(expected.Event));
            return;
        }

        Assert.ThrowsAny<Exception>(() => SuitLoadout.Parse(stated!));
    }

    [Fact]
    public void AnEventWithNoSuitAtAllIsRefused()
    {
        Assert.Throws<ArgumentNullException>(() => SuitLoadout.Parse(null!));
        Assert.Throws<FormatException>(
            () => SuitLoadout.Parse(new SuitLoadoutEvent("notasuit_class5")));
    }

    [Fact]
    public void TwoWeaponsOnOneMountAreRefusedHoweverTheMountIsSpelled()
    {
        SuitLoadoutEvent stated = new(
            "tacticalsuit_class5",
            Modules:
            [
                new("PrimaryWeapon1", "wpn_m_assaultrifle_kinetic_fauto", 5),
                new("primaryweapon1", "wpn_m_submachinegun_kinetic_fauto", 5),
            ]);

        Assert.Throws<FormatException>(() => SuitLoadout.Parse(stated));
    }

    [Fact]
    public void ARecipeIsReadHoweverTheEventSpellsIt()
    {
        RecipeSpellingFixture expected = Fixture.RecipeSpelling;
        SuitLoadoutEvent stated = Read(expected.Event);

        FittedPersonalWeapon fitted = Assert.Single(SuitLoadout.Parse(stated).Weapons);

        Assert.Equal(expected.Mount, fitted.Mount);
        Assert.Equal(expected.Modifications, Symbols(fitted.Modifications));
        Assert.Equal(
            expected.JournalSymbols, JournalSymbols(fitted.Modifications));
        Assert.Equal(expected.ReloadSpeed, fitted.ReloadSpeed);
        Assert.Equal(expected.Scope, fitted.Scope);
        Assert.Equal(
            expected.SustainedDamagePerSecond, fitted.Metrics.SustainedDamagePerSecond, 1e-3);
    }

    [Fact]
    public void AnEmptyLoadoutStatesTheSuitAndNothingElse()
    {
        SuitLoadout loadout = SuitLoadout.Parse(new SuitLoadoutEvent("flightsuit"));

        Assert.Equal("flightsuit", loadout.Suit.Family);
        Assert.Empty(loadout.Weapons);
        Assert.Empty(loadout.Modifications);
        Assert.Empty(loadout.Modifiers);
        Assert.Empty(loadout.ImportOutcomes);
        Assert.Null(loadout.SuitId);
        Assert.Null(loadout.LoadoutId);
        Assert.Null(loadout.Name);
    }

    private static SuitLoadoutEvent Read(string path) =>
        SharedFixtures.LoadCapture<SuitLoadoutEvent>(path);

    private static SuitLoadoutEvent Read(JsonElement stated) =>
        JsonSerializer.Deserialize<SuitLoadoutEvent>(stated.GetRawText(), Options)!;

    private static bool Readable(JsonElement stated, out SuitLoadoutEvent? loadout)
    {
        try
        {
            loadout = stated.ValueKind == JsonValueKind.Null ? null : Read(stated);
            return loadout is not null;
        }
        catch (JsonException)
        {
            loadout = null;
            return false;
        }
    }

    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private static List<string> Symbols(IReadOnlyList<FittedPersonalModification> modifications)
    {
        List<string> symbols = [];
        foreach (FittedPersonalModification fitted in modifications) symbols.Add(fitted.Symbol);
        return symbols;
    }

    private static List<string> JournalSymbols(
        IReadOnlyList<FittedPersonalModification> modifications)
    {
        List<string> symbols = [];
        foreach (FittedPersonalModification fitted in modifications)
        {
            symbols.Add(fitted.JournalSymbol);
        }

        return symbols;
    }

    private static List<string> Stats(IReadOnlyList<PersonalModifier> modifiers)
    {
        List<string> stats = [];
        foreach (PersonalModifier modifier in modifiers) stats.Add(modifier.Stat);
        return stats;
    }

    private static List<string> Mounts(SuitLoadout loadout)
    {
        List<string> mounts = [];
        foreach (FittedPersonalWeapon fitted in loadout.Weapons) mounts.Add(fitted.Mount);
        return mounts;
    }

    private static List<string> FittedSymbols(SuitLoadout loadout)
    {
        List<string> symbols = [.. Symbols(loadout.Modifications)];
        foreach (FittedPersonalWeapon fitted in loadout.Weapons)
        {
            symbols.AddRange(Symbols(fitted.Modifications));
        }

        return symbols;
    }

    private static List<string> Weapons(SuitLoadout loadout)
    {
        List<string> weapons = [];
        foreach (FittedPersonalWeapon fitted in loadout.Weapons)
        {
            weapons.Add($"{fitted.Mount}:{fitted.Weapon.Symbol}:{fitted.Grade}");
        }

        return weapons;
    }

    private static TheoryData<string> Keys<T>(Dictionary<string, T> cases)
    {
        TheoryData<string> names = [];
        foreach (string name in cases.Keys) names.Add(name);
        return names;
    }
}
