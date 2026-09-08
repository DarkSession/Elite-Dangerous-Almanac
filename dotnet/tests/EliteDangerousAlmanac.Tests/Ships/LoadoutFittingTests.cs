using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Ships.Internal;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>Which module fits which mount.</summary>
public class LoadoutFittingTests
{
    private static readonly IReadOnlyList<BuildSlot> Sidewinder =
        BuildSlots.Enumerate(ShipCatalogue.FindSlots("SideWinder")!);

    private static readonly IReadOnlyList<BuildSlot> Prospector =
        BuildSlots.Enumerate(ShipCatalogue.FindSlots("LakonMiner")!);

    private static BuildSlot Mount(IReadOnlyList<BuildSlot> layout, string key) =>
        Assert.Single(layout, slot => slot.Key == key);

    private static OutfittingModule Module(string symbol) =>
        Assert.IsType<OutfittingModule>(ModuleCatalogue.FindBySymbol(symbol));

    private static ModuleFitProblem? Fit(string ship, BuildSlot slot, string symbol) =>
        LoadoutFitting.Problem(ship, slot, Module(symbol));

    [Fact]
    public void AModuleOfTheRightKindAndSizeFitsItsMount()
    {
        Assert.Null(Fit("SideWinder", Mount(Sidewinder, "PowerPlant"), "Int_PowerPlant_Size2_Class3"));
        Assert.Null(Fit("SideWinder", Mount(Sidewinder, "MainEngines"), "Int_Engine_Size2_Class3"));
        Assert.Null(Fit(
            "SideWinder", Mount(Sidewinder, "SmallHardpoint1"), "Hpt_PulseLaser_Fixed_Small"));
        Assert.Null(Fit(
            "SideWinder", Mount(Sidewinder, "TinyHardpoint1"), "Hpt_ChaffLauncher_Tiny"));
        Assert.Null(Fit("SideWinder", Mount(Sidewinder, "Slot01_Size2"), "Int_CargoRack_Size2_Class1"));
    }

    [Fact]
    public void TheCargoHatchMountAcceptsNothingAtAll()
    {
        ModuleFitProblem problem = Assert.IsType<ModuleFitProblem>(
            Fit("SideWinder", Mount(Sidewinder, "CargoHatch"), "Int_CargoRack_Size2_Class1"));

        Assert.Equal(ModuleFitConstraint.ImmutableSlot, problem.Constraint);
    }

    [Fact]
    public void TheHatchItselfFitsNoMountACallerCanSet()
    {
        // It arrives with the hull, no station sells it, and the one mount that holds it is the
        // fixed mount nothing may be set in. So an outfitting list must never offer it.
        ModuleFitProblem problem = Assert.IsType<ModuleFitProblem>(
            Fit("SideWinder", Mount(Sidewinder, "Slot01_Size2"), "ModularCargoBayDoor"));

        Assert.Equal(ModuleFitConstraint.BuiltInHullModule, problem.Constraint);
    }

    [Fact]
    public void TheArmourMountTakesThatHullsOwnBulkheads()
    {
        BuildSlot armour = Mount(Sidewinder, "Armour");

        Assert.Null(Fit("SideWinder", armour, "SideWinder_Armour_Grade1"));

        ModuleFitProblem wrongHull = Assert.IsType<ModuleFitProblem>(
            Fit("SideWinder", armour, "Eagle_Armour_Grade1"));
        Assert.Equal(ModuleFitConstraint.WrongHullArmour, wrongHull.Constraint);
        Assert.Equal("Eagle", wrongHull.ArmourShipName);
        Assert.Equal("Eagle", wrongHull.ArmourShipSymbol);
        Assert.Equal("SideWinder", wrongHull.ShipSymbol);
        Assert.Equal("Sidewinder", wrongHull.ShipName);
        Assert.Equal("armour belongs to Eagle, not Sidewinder", wrongHull.Message);

        ModuleFitProblem notArmour = Assert.IsType<ModuleFitProblem>(
            Fit("SideWinder", armour, "Int_CargoRack_Size2_Class1"));
        Assert.Equal(ModuleFitConstraint.ArmourRequired, notArmour.Constraint);
    }

    [Fact]
    public void AnUnknownHullTakesNoArmourAtAll()
    {
        ModuleFitProblem problem = Assert.IsType<ModuleFitProblem>(
            Fit("NoSuchHull", Mount(Sidewinder, "Armour"), "SideWinder_Armour_Grade1"));

        Assert.Equal(ModuleFitConstraint.WrongHullArmour, problem.Constraint);
        Assert.Equal("NoSuchHull", problem.ShipSymbol);
        Assert.Null(problem.ShipName);
    }

    [Fact]
    public void AMountRefusesAModuleOfAnotherKind()
    {
        ModuleFitProblem core = Assert.IsType<ModuleFitProblem>(
            Fit("SideWinder", Mount(Sidewinder, "PowerPlant"), "Int_Engine_Size2_Class3"));
        Assert.Equal(ModuleFitConstraint.WrongCoreType, core.Constraint);
        Assert.Equal(CoreSlotType.PowerPlant, core.RequiredCore);
        Assert.Equal(ModuleSlot.Thrusters, core.ModuleSlot);
        Assert.Equal("not a PowerPlant module", core.Message);

        Assert.Equal(
            ModuleFitConstraint.HardpointRequired,
            Assert.IsType<ModuleFitProblem>(Fit(
                "SideWinder",
                Mount(Sidewinder, "SmallHardpoint1"),
                "Int_CargoRack_Size2_Class1")).Constraint);

        Assert.Equal(
            ModuleFitConstraint.UtilityRequired,
            Assert.IsType<ModuleFitProblem>(Fit(
                "SideWinder",
                Mount(Sidewinder, "TinyHardpoint1"),
                "Hpt_PulseLaser_Fixed_Small")).Constraint);

        Assert.Equal(
            ModuleFitConstraint.OptionalInternalRequired,
            Assert.IsType<ModuleFitProblem>(Fit(
                "SideWinder",
                Mount(Sidewinder, "Slot01_Size2"),
                "Hpt_PulseLaser_Fixed_Small")).Constraint);
    }

    [Fact]
    public void ACoreModuleFitsItsOwnCoreMountAndNoOptionalOne()
    {
        // The Guardian hybrid distributor is the case the rule is for: the registry files it
        // under the internal category, which an unrestricted optional mount would otherwise
        // accept, and its own mount field says it goes in a core mount.
        ModuleFitProblem problem = Assert.IsType<ModuleFitProblem>(Fit(
            "SideWinder", Mount(Sidewinder, "Slot01_Size2"), "Int_GuardianPowerDistributor_Size1"));

        Assert.Equal(ModuleFitConstraint.CoreModuleInOptionalSlot, problem.Constraint);
        Assert.Equal(ModuleSlot.PowerDistributor, problem.ModuleSlot);
        Assert.Null(Fit(
            "SideWinder", Mount(Sidewinder, "PowerDistributor"), "Int_GuardianPowerDistributor_Size1"));

        // A core module the registry files as core reads as no optional internal at all.
        Assert.Equal(
            ModuleFitConstraint.OptionalInternalRequired,
            Assert.IsType<ModuleFitProblem>(Fit(
                "SideWinder",
                Mount(Sidewinder, "Slot01_Size2"),
                "Int_PowerPlant_Size2_Class3")).Constraint);
    }

    [Fact]
    public void AFuelTankIsTheOneCoreModuleAnOptionalMountTakes()
    {
        Assert.Null(Fit("SideWinder", Mount(Sidewinder, "Slot01_Size2"), "Int_FuelTank_Size1_Class3"));
        Assert.Null(Fit("SideWinder", Mount(Sidewinder, "FuelTank"), "Int_FuelTank_Size1_Class3"));
    }

    [Fact]
    public void AModuleLargerThanItsMountDoesNotFit()
    {
        ModuleFitProblem problem = Assert.IsType<ModuleFitProblem>(
            Fit("SideWinder", Mount(Sidewinder, "Slot01_Size2"), "Int_CargoRack_Size4_Class1"));

        Assert.Equal(ModuleFitConstraint.Oversized, problem.Constraint);
        Assert.Equal(4, problem.ModuleClass);
        Assert.Equal(2, problem.SlotSize);
        Assert.Equal("module size 4 exceeds slot size 2", problem.Message);
    }

    [Fact]
    public void AUtilityFittingIsNotWeighedAgainstTheMountsClass()
    {
        // A utility mount's fit rules are not size-based, so its class is zero and every
        // utility fitting still goes in.
        Assert.Equal(0, Mount(Sidewinder, "TinyHardpoint1").Size);
        Assert.Null(Fit("SideWinder", Mount(Sidewinder, "TinyHardpoint1"), "Hpt_ShieldBooster_Size0_Class5"));
    }

    [Fact]
    public void ARestrictedMountTakesOnlyTheFamilyItReserves()
    {
        BuildSlot mining = Mount(Prospector, "MediumMiningHardpoint1");

        Assert.Null(Fit("LakonMiner", mining, "Hpt_MiningLaser_Fixed_Medium"));

        ModuleFitProblem problem = Assert.IsType<ModuleFitProblem>(
            Fit("LakonMiner", mining, "Hpt_PulseLaser_Fixed_Medium"));
        Assert.Equal(ModuleFitConstraint.RestrictedMount, problem.Constraint);
        Assert.Equal(SlotRestriction.Mining, problem.Restriction);
        Assert.Equal("slot only takes mining tools", problem.Message);
    }

    [Fact]
    public void AModuleThatReservesAMountFitsNoOtherOne()
    {
        // The approach suite reserves its own mount, so an unrestricted optional refuses it.
        ModuleFitProblem problem = Assert.IsType<ModuleFitProblem>(Fit(
            "SideWinder",
            Mount(Sidewinder, "Slot01_Size2"),
            "Int_PlanetApproachSuite_Advanced"));

        Assert.Equal(ModuleFitConstraint.RestrictedMount, problem.Constraint);
        Assert.Equal(SlotRestriction.PlanetaryApproachSuite, problem.Restriction);
        Assert.Equal(
            "module only fits a mount that takes planetary approach suites", problem.Message);
        Assert.Null(Fit(
            "SideWinder", Mount(Sidewinder, "PlanetaryApproachSuite"), "Int_PlanetApproachSuite_Advanced"));
    }
}
