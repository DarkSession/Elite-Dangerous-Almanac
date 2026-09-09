namespace EliteDangerousAlmanac.Ships;

/// <summary>A stable identifier for an outfitting module family.</summary>
/// <remarks>
/// <para>
/// A family is coarser than an engineering group and finer than an outfitting category:
/// ordinary, Bi-Weave and Prismatic generators all sit in
/// <see cref="ShieldGenerators"/>, while the eight core mounts each have their own family.
/// </para>
/// <para>
/// Every module carries one, core modules included, so an outfitting screen can group every
/// choice a loadout offers without a taxonomy of its own. Closely related variants share a
/// family: a Mk II or corrosion-resistant rack is a cargo rack, and a Powerplay or
/// pre-engineered variant stays with its base weapon.
/// </para>
/// <para>
/// The canonical English display name of each family comes from
/// <see cref="OutfittingFamilies.DisplayName"/>; a localized one comes from the i18n area.
/// </para>
/// </remarks>
public enum OutfittingFamilyId
{
    /// <summary>Armour.</summary>
    Armour,

    /// <summary>Power Plants.</summary>
    PowerPlants,

    /// <summary>Engines.</summary>
    Engines,

    /// <summary>FSD.</summary>
    Fsd,

    /// <summary>Life Support.</summary>
    LifeSupport,

    /// <summary>Power Distributors.</summary>
    PowerDistributors,

    /// <summary>Sensors.</summary>
    Sensors,

    /// <summary>Fuel Tanks.</summary>
    FuelTanks,

    /// <summary>Docking Computers.</summary>
    DockingComputers,

    /// <summary>Shield Generators.</summary>
    ShieldGenerators,

    /// <summary>Shield Cell Banks.</summary>
    ShieldCellBanks,

    /// <summary>Cargo Racks.</summary>
    CargoRacks,

    /// <summary>Hatch Breaker Limpets.</summary>
    HatchBreakerLimpets,

    /// <summary>Surface Scanners.</summary>
    SurfaceScanners,

    /// <summary>Fuel Scoops.</summary>
    FuelScoops,

    /// <summary>Refineries.</summary>
    Refineries,

    /// <summary>FSD Interdictors.</summary>
    FsdInterdictors,

    /// <summary>AFMs.</summary>
    Afms,

    /// <summary>Hull Reinforcements.</summary>
    HullReinforcements,

    /// <summary>Collector Limpets.</summary>
    CollectorLimpets,

    /// <summary>Fuel Transfer Limpets.</summary>
    FuelTransferLimpets,

    /// <summary>Prospecting Limpets.</summary>
    ProspectingLimpets,

    /// <summary>Planetary Vehicle Hangars.</summary>
    PlanetaryVehicleHangars,

    /// <summary>Planetary Approach Suites.</summary>
    PlanetaryApproachSuites,

    /// <summary>Cargo Hatches.</summary>
    CargoHatches,

    /// <summary>Passenger Cabins.</summary>
    PassengerCabins,

    /// <summary>Vessel Hangars.</summary>
    VesselHangars,

    /// <summary>Module Reinforcements.</summary>
    ModuleReinforcements,

    /// <summary>Repair Limpets.</summary>
    RepairLimpets,

    /// <summary>Research Limpets.</summary>
    ResearchLimpets,

    /// <summary>Decontamination Limpets.</summary>
    DecontaminationLimpets,

    /// <summary>Guardian Shield Reinforcement Packages.</summary>
    GuardianShieldReinforcementPackages,

    /// <summary>FSD Boosters.</summary>
    FsdBoosters,

    /// <summary>Guardian Hybrid Power Distributors.</summary>
    GuardianHybridPowerDistributors,

    /// <summary>Guardian Hybrid Power Plants.</summary>
    GuardianHybridPowerPlants,

    /// <summary>Recon Limpets.</summary>
    ReconLimpets,

    /// <summary>Flight Assists.</summary>
    FlightAssists,

    /// <summary>Mining Multi-Limpet Controllers.</summary>
    MiningMultiLimpetControllers,

    /// <summary>Multi-Limpet Controllers.</summary>
    MultiLimpetControllers,

    /// <summary>Experimental Weapon Stabilisers.</summary>
    ExperimentalWeaponStabilisers,

    /// <summary>Pulse Lasers.</summary>
    PulseLasers,

    /// <summary>Burst Lasers.</summary>
    BurstLasers,

    /// <summary>Beam Lasers.</summary>
    BeamLasers,

    /// <summary>Cannons.</summary>
    Cannons,

    /// <summary>Fragment Cannons.</summary>
    FragmentCannons,

    /// <summary>Multi-cannons.</summary>
    MultiCannons,

    /// <summary>Plasma Accelerators.</summary>
    PlasmaAccelerators,

    /// <summary>Rail Guns.</summary>
    RailGuns,

    /// <summary>Missiles.</summary>
    Missiles,

    /// <summary>Mines.</summary>
    Mines,

    /// <summary>Torpedoes.</summary>
    Torpedoes,

    /// <summary>Mining Lasers.</summary>
    MiningLasers,

    /// <summary>Remote Release Flak Launchers.</summary>
    RemoteReleaseFlakLaunchers,

    /// <summary>AX Missile Racks.</summary>
    AxMissileRacks,

    /// <summary>AX Multi-Cannons.</summary>
    AxMultiCannons,

    /// <summary>Guardian Gauss Cannons.</summary>
    GuardianGaussCannons,

    /// <summary>Remote Release Flechette Launchers.</summary>
    RemoteReleaseFlechetteLaunchers,

    /// <summary>Guardian Plasma Chargers.</summary>
    GuardianPlasmaChargers,

    /// <summary>Guardian Shard Cannons.</summary>
    GuardianShardCannons,

    /// <summary>Shock Cannons.</summary>
    ShockCannons,

    /// <summary>Sub-Surface Displacement Missiles.</summary>
    SubSurfaceDisplacementMissiles,

    /// <summary>Abrasion Blasters.</summary>
    AbrasionBlasters,

    /// <summary>Mining Tools.</summary>
    MiningTools,

    /// <summary>Sub-Surface Extraction Missiles.</summary>
    SubSurfaceExtractionMissiles,

    /// <summary>Guardian Nanite Torpedo Pylons.</summary>
    GuardianNaniteTorpedoPylons,

    /// <summary>Chaff Launchers.</summary>
    ChaffLaunchers,

    /// <summary>ECMs.</summary>
    Ecms,

    /// <summary>Heatsink Launchers.</summary>
    HeatsinkLaunchers,

    /// <summary>Point Defence.</summary>
    PointDefence,

    /// <summary>Manifest Scanners.</summary>
    ManifestScanners,

    /// <summary>Wake Scanners.</summary>
    WakeScanners,

    /// <summary>Kill Warrant Scanners.</summary>
    KillWarrantScanners,

    /// <summary>Shield Boosters.</summary>
    ShieldBoosters,

    /// <summary>Shutdown Field Neutralisers.</summary>
    ShutdownFieldNeutralisers,

    /// <summary>Xeno Scanners.</summary>
    XenoScanners,

    /// <summary>Pulse Wave Analyser.</summary>
    PulseWaveAnalyser,

    /// <summary>Caustic Sink Launchers.</summary>
    CausticSinkLaunchers,
}
