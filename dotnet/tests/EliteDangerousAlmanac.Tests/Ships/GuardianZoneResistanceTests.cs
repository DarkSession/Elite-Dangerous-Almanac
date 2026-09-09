using System;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>Anti-Guardian Zone Resistance, which grants a capability rather than a number.</summary>
/// <remarks>
/// The recipe emits one non-numeric journal modifier and turns the fitted module's effective
/// Guardian zone resistance strictly true. A producer that writes the displayed hundred per
/// cent as a number grants the same capability: the label decides, and its representation
/// cannot leak a number into the public module shape.
/// </remarks>
public class GuardianZoneResistanceTests
{
    private static readonly CapabilityFixture Fixture =
        SharedFixtures.Load<EngineeringFixture>("fixtures/ships/engineering.jsonc")
            .GuardianZoneResistanceCapability;

    private static readonly SlefHeader TestHeader = new("Almanac", "1.0.0");

    public static TheoryData<int> Cases()
    {
        TheoryData<int> positions = [];
        for (int index = 0; index < Fixture.Cases.Count; index++) positions.Add(index);
        return positions;
    }

    [Fact]
    public void TheCapabilityIsReadFromTheStatTheFixtureNames() =>
        Assert.Equal(
            Fixture.Field,
            char.ToLowerInvariant(nameof(OutfittingModule.GuardianZoneResistance)[0])
                + nameof(OutfittingModule.GuardianZoneResistance).Substring(1));

    [Theory]
    [MemberData(nameof(Cases))]
    public void TheRecipeTurnsTheCapabilityOnAndSurvivesAnExportAndARead(int position)
    {
        ModuleBlueprintFixture granted = Fixture.Cases[position];
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(granted.Symbol)!;

        // The article does not carry the capability before the recipe grants it.
        Assert.False(stock.GuardianZoneResistance);

        ShipLoadout build = ShipLoadout.Empty("Anaconda").SetModule(granted.Slot!, stock);
        Assert.Contains(
            build.AvailableBlueprints(granted.Slot!),
            offered => string.Equals(
                offered.BlueprintSymbol, Fixture.OfferedAs, StringComparison.OrdinalIgnoreCase));

        build.ApplyBlueprint(
            granted.Slot!, granted.Blueprint, new ApplyBlueprintOptions(Fixture.Grade));
        FittedModule fitted = build.FittedModuleAt(granted.Slot!)!;

        EngineeringModifier written = Assert.Single(fitted.Engineering!.Modifiers!);
        Assert.Equal(Fixture.Modifier.Label, written.Label);
        Assert.Equal(Fixture.Modifier.ValueStr, written.ValueStr);
        Assert.Null(written.Value);
        Assert.True(fitted.EffectiveStats!.GuardianZoneResistance);

        // The capability comes back from what the export wrote, rather than from the
        // build that wrote it.
        FittedModule read = ShipLoadout
            .FromSlef(build.ToSlefString(new SlefExportOptions(TestHeader)))
            .FittedModuleAt(granted.Slot!)!;
        Assert.True(read.EffectiveStats!.GuardianZoneResistance);
    }

    [Fact]
    public void AProducerThatWritesTheDisplayedNumberGrantsTheSameCapability()
    {
        ModifierFixture numeric = Fixture.NumericImportedModifier;
        ModuleBlueprintFixture granted = Fixture.Cases[0];

        ShipLoadout build = ShipLoadout.FromLoadout(new LoadoutEvent(
            "Anaconda",
            [
                new LoadoutModule(granted.Slot!, granted.Symbol)
                {
                    Engineering = new ModuleEngineering(Fixture.OfferedAs, Fixture.Grade, 1)
                    {
                        Modifiers =
                        [
                            new EngineeringModifier(
                                numeric.Label,
                                Value: numeric.Value,
                                OriginalValue: numeric.OriginalValue),
                        ],
                    },
                },
            ]));

        Assert.True(
            build.FittedModuleAt(granted.Slot!)!.EffectiveStats!.GuardianZoneResistance);
    }

    [Fact]
    public void AnOrdinaryArticleStillRefusesTheRecipe()
    {
        ModuleBlueprintFixture refused = Fixture.Refused;
        ShipLoadout build = ShipLoadout.Empty("Anaconda").SetModule(
            refused.Slot!, ModuleCatalogue.FindBySymbol(refused.Symbol)!);

        Assert.Throws<ArgumentException>(
            () => build.ApplyBlueprint(
                refused.Slot!, refused.Blueprint, new ApplyBlueprintOptions(Fixture.Grade)));
    }
}
