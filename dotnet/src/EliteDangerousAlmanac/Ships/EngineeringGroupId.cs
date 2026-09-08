namespace EliteDangerousAlmanac.Ships;

/// <summary>A stock module's ordinary engineering menu.</summary>
/// <remarks>
/// <para>
/// Availability is a property of the module, not of the blueprint: a pulse laser and a rail
/// gun share the Efficient blueprint but offer different experimental effects. So modules are
/// grouped, and each group lists the blueprints and the experimental effects it offers.
/// </para>
/// <para>
/// A group is one menu, so modules of the same kind with different menus are different groups:
/// a Guardian power plant takes Anti-Guardian Zone Resistance and none of the ordinary
/// power-plant blueprints, and an ordinary one the reverse.
/// </para>
/// </remarks>
public enum EngineeringGroupId
{
    /// <summary>The engineering menu the power plants share.</summary>
    PowerPlants,

    /// <summary>The engineering menu the guardian power plants share.</summary>
    GuardianPowerPlants,

    /// <summary>The engineering menu the thrusters share.</summary>
    Thrusters,

    /// <summary>The engineering menu the frame shift drives share.</summary>
    FrameShiftDrives,

    /// <summary>The engineering menu the power distributors share.</summary>
    PowerDistributors,

    /// <summary>The engineering menu the guardian power distributors share.</summary>
    GuardianPowerDistributors,

    /// <summary>The engineering menu the frame shift drives s c o share.</summary>
    FrameShiftDrivesSCO,

    /// <summary>The engineering menu the shield generators share.</summary>
    ShieldGenerators,

    /// <summary>The engineering menu the shield cell banks share.</summary>
    ShieldCellBanks,

    /// <summary>The engineering menu the hull reinforcements share.</summary>
    HullReinforcements,

    /// <summary>The engineering menu the guardian hull reinforcements share.</summary>
    GuardianHullReinforcements,

    /// <summary>The engineering menu the pulse lasers share.</summary>
    PulseLasers,

    /// <summary>The engineering menu the burst lasers share.</summary>
    BurstLasers,

    /// <summary>The engineering menu the beam lasers share.</summary>
    BeamLasers,

    /// <summary>The engineering menu the cannons share.</summary>
    Cannons,

    /// <summary>The engineering menu the fragment cannons share.</summary>
    FragmentCannons,

    /// <summary>The engineering menu the multi cannons share.</summary>
    MultiCannons,

    /// <summary>The engineering menu the plasma accelerators share.</summary>
    PlasmaAccelerators,

    /// <summary>The engineering menu the rail guns share.</summary>
    RailGuns,

    /// <summary>The engineering menu the missiles share.</summary>
    Missiles,

    /// <summary>The engineering menu the mines share.</summary>
    Mines,

    /// <summary>The engineering menu the torpedoes share.</summary>
    Torpedoes,

    /// <summary>The engineering menu the shield boosters share.</summary>
    ShieldBoosters,

    /// <summary>The engineering menu the bulkheads share.</summary>
    Bulkheads,

    /// <summary>The engineering menu the life supports share.</summary>
    LifeSupports,

    /// <summary>The engineering menu the sensors share.</summary>
    Sensors,

    /// <summary>The engineering menu the auto field maintenance units share.</summary>
    AutoFieldMaintenanceUnits,

    /// <summary>The engineering menu the collection limpets share.</summary>
    CollectionLimpets,

    /// <summary>The engineering menu the fsd boosters share.</summary>
    FsdBoosters,

    /// <summary>The engineering menu the fsd interdictors share.</summary>
    FsdInterdictors,

    /// <summary>The engineering menu the fuel scoops share.</summary>
    FuelScoops,

    /// <summary>The engineering menu the fuel transfer limpets share.</summary>
    FuelTransferLimpets,

    /// <summary>The engineering menu the hatch breaker limpets share.</summary>
    HatchBreakerLimpets,

    /// <summary>The engineering menu the module reinforcements share.</summary>
    ModuleReinforcements,

    /// <summary>The engineering menu the prospecting limpets share.</summary>
    ProspectingLimpets,

    /// <summary>The engineering menu the refineries share.</summary>
    Refineries,

    /// <summary>The engineering menu the shield reinforcements share.</summary>
    ShieldReinforcements,

    /// <summary>The engineering menu the surface scanners share.</summary>
    SurfaceScanners,

    /// <summary>The engineering menu the chaff launchers share.</summary>
    ChaffLaunchers,

    /// <summary>The engineering menu the ecms share.</summary>
    Ecms,

    /// <summary>The engineering menu the heat sink launchers share.</summary>
    HeatSinkLaunchers,

    /// <summary>The engineering menu the kill warrant scanners share.</summary>
    KillWarrantScanners,

    /// <summary>The engineering menu the manifest scanners share.</summary>
    ManifestScanners,

    /// <summary>The engineering menu the point defence share.</summary>
    PointDefence,

    /// <summary>The engineering menu the wake scanners share.</summary>
    WakeScanners,

    /// <summary>The engineering menu the guardian gauss share.</summary>
    GuardianGauss,

    /// <summary>The engineering menu the guardian plasma share.</summary>
    GuardianPlasma,

    /// <summary>The engineering menu the guardian shard share.</summary>
    GuardianShard,
}
