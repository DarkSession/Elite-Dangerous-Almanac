/**
 * Generated fixture import types. Do not edit by hand.
 *
 * Run `pnpm run generate:fixtures` from `typescript/` after changing a fixture.
 */

type FixtureAstroGalacticRegion = {
    boxels: {
        id64: string;
        name: string;
        region: string;
        regionId: number;
        x: number;
        y: number;
        z: number;
    }[];
    coords: {
        name: string;
        region: string;
        regionId: number;
        x: number;
        z: number;
    }[];
};

declare module '*/fixtures/astro/galactic-region.jsonc' {
    const value: FixtureAstroGalacticRegion;
    export default value;
}

type FixtureAstroHandAuthoredRegions = {
    regionForCoords: {
        coords: {
            x: number;
            y: number;
            z: number;
        };
        region: string | null;
    }[];
    systems: {
        coords: {
            x: number;
            y: number;
            z: number;
        };
        id64: string;
        name: string;
        needsPermit: boolean;
        proceduralName?: string;
        source?: string;
    }[];
};

declare module '*/fixtures/astro/hand-authored-regions.jsonc' {
    const value: FixtureAstroHandAuthoredRegions;
    export default value;
}

type FixtureAstroNebulae = {
    counts: {
        all: number;
        planetary: number;
        procgen: number;
        real: number;
    };
    membershipSha256: {
        planetary: string;
        procgen: string;
        real: string;
    };
    nearest: {
        catalogue: string;
        count: number;
        expect: {
            distanceLy: number;
            name: string;
            system: string;
        }[];
        from: {
            x: number;
            y: number;
            z: number;
        };
        origin: string;
    }[];
    records: {
        catalogue: string;
        name: string;
        regionId: number;
        system: string;
        type: string;
        x: number;
        y: number;
        z: number;
    }[];
    within: {
        catalogue: string;
        expect: {
            distanceLy: number;
            name: string;
        }[];
        from: {
            x: number;
            y: number;
            z: number;
        };
        origin: string;
        radiusLy: number;
    }[];
};

declare module '*/fixtures/astro/nebulae.jsonc' {
    const value: FixtureAstroNebulae;
    export default value;
}

type FixtureAstroPermitLocks = {
    cases: {
        comment?: string;
        coords?: {
            x: number;
            y: number;
            z: number;
        };
        lock: {
            id64?: string;
            kind: string;
            name: string;
        } | null;
        name: string;
    }[];
    counts: {
        regions: number;
        systems: number;
    };
};

declare module '*/fixtures/astro/permit-locks.jsonc' {
    const value: FixtureAstroPermitLocks;
    export default value;
}

type FixtureAstroSystemAddresses = {
    systems: {
        id64: string;
        l1: string;
        l2: string;
        l3: string;
        massCode: string;
        n1: number;
        n2: number;
        name: string;
        region: string;
    }[];
};

declare module '*/fixtures/astro/system-addresses.jsonc' {
    const value: FixtureAstroSystemAddresses;
    export default value;
}

type FixtureCommoditiesCommodities = {
    categories: string[];
    categoryCounts: {
        Foods: number;
        'Legal Drugs': number;
        Metals: number;
        Salvage: number;
    };
    counts: {
        all: number;
        rare: number;
        standard: number;
    };
    records: {
        category: string;
        name: string;
        rare: boolean;
        symbol: string;
    }[];
};

declare module '*/fixtures/commodities/commodities.jsonc' {
    const value: FixtureCommoditiesCommodities;
    export default value;
}

type FixtureEquipmentEquipment = {
    counts: {
        modificationNames: number;
        modificationRecipes: number;
        suits: number;
        weapons: number;
    };
    modification: {
        journalSymbol: string;
        kineticFirstIngredient: {
            count: number;
            symbol: string;
        };
        kineticRecipeSymbol: string;
        laserFirstIngredient: {
            count: number;
            symbol: string;
        };
        laserRecipeSymbol: string;
    };
    suits: {
        family: string;
        grade: number;
        kineticResistance?: number;
        modificationSlots: number;
        name: string;
        primarySlots: number;
        secondarySlots: number;
        shieldStrength: number;
        symbol: string;
    }[];
    upgradeCosts: {
        ar50Grade5WeaponComponents: number;
        maverickGrade1To3Graphene: number;
        maverickGrade2: {
            count: number;
            symbol: string;
        }[];
    };
    weapons: {
        damage: number;
        effectiveRange: number;
        grade: number;
        magazineSize: number;
        modificationSlots: number;
        name: string;
        rateOfFire: number;
        symbol: string;
    }[];
};

declare module '*/fixtures/equipment/equipment.jsonc' {
    const value: FixtureEquipmentEquipment;
    export default value;
}

type FixtureI18nNames = {
    lookups: {
        expected: string | null;
        identifier: string;
        kind: string;
        locale: string;
    }[];
};

declare module '*/fixtures/i18n/names.jsonc' {
    const value: FixtureI18nNames;
    export default value;
}

type FixtureMaterialsMaterials = {
    counts: {
        all: number;
        encoded: number;
        manufactured: number;
        raw: number;
    };
    lineGrades: {
        catalogue: string;
        grades: number[];
        line: string;
    }[];
    notInFdevIds: string[];
    records: {
        category: string;
        elementSymbol: string | null;
        grade: number;
        line: string;
        name: string;
        symbol: string;
    }[];
};

declare module '*/fixtures/materials/materials.jsonc' {
    const value: FixtureMaterialsMaterials;
    export default value;
}

type FixtureMaterialsMicroResources = {
    counts: {
        all: number;
        component: number;
        consumable: number;
        data: number;
        item: number;
    };
    membershipSha256: {
        component: string;
        consumable: string;
        data: string;
        item: string;
    };
    records: {
        category: string;
        name: string;
        symbol: string;
    }[];
};

declare module '*/fixtures/materials/micro-resources.jsonc' {
    const value: FixtureMaterialsMicroResources;
    export default value;
}

type FixtureShipsBuildMetrics = {
    ammunition: {
        catalogue: {
            clipSize: number;
            hopper: number | null;
            note?: string;
            symbol: string;
            total: number | null;
            unlimited: boolean;
        }[];
        engineered: {
            note: string;
            rolls: {
                blueprint: string;
                burstRounds?: number;
                clipSize: number;
                experimental?: string;
                grade: number;
                hopper: number;
                module: string;
                note: string;
                slot: string;
                stock: {
                    clipSize: number;
                    hopper: number;
                    total: number;
                };
                total: number;
            }[];
        };
        engineeredGroundTruth: {
            cases: {
                agrees: boolean;
                base: {
                    ammoMaximum: number;
                    clipSize: number;
                };
                blueprint: string;
                capture: string;
                experimental: null | string;
                game: {
                    ammoMaximum: number;
                    clipSize?: number;
                    loadedClip: number;
                    loadedHopper: number;
                };
                grade: number;
                legacyEngineering?: boolean;
                note?: string;
                preEngineered?: boolean;
                quality: number;
                reportedQuality?: number;
                ship: string;
                simulated: {
                    ammoMaximum: number;
                    clipSize?: number;
                };
                slot: string;
                symbol: string;
            }[];
            note: string;
            recomputed: {
                cargoCapacity: number;
                journalMaxJumpRange: number;
                journalUnladenMass: number;
                maxJumpRange: number;
                note: string;
                unladenMass: number;
            };
        };
        journalReadings: {
            atCapacity: number;
            belowCapacity: never[];
            distinctModules: number;
            note: string;
            readings: number;
        };
        noAmmunition: string[];
        note: string;
    };
    anaconda: {
        armour: {
            bulkheads: number;
            effectiveHitPoints: {
                caustic: number;
                explosive: number;
                kinetic: number;
                thermal: number;
            };
            hitPoints: number;
            moduleArmour: number;
            moduleProtection: number;
            reinforcement: number;
            resistances: {
                caustic: number;
                explosive: number;
                kinetic: number;
                thermal: number;
            };
        };
        modules: {
            Armour: string;
            HugeHardpoint1: string;
            LargeHardpoint1: string;
            Military01: string;
            PowerPlant: string;
            Slot01_Size7: string;
            Slot02_Size6: string;
            TinyHardpoint1: string;
            TinyHardpoint2: string;
        };
        power: {
            available: number;
            bands: {
                deployed: number;
                deployedTotal: number;
                poweredDeployed: boolean;
                priority: number;
                retracted: number;
            }[];
            deployed: number;
            retracted: number;
        };
        shields: {
            boostMultiplier: number;
            boosters: number;
            effectiveHitPoints: {
                caustic: number;
                explosive: number;
                kinetic: number;
                thermal: number;
            };
            generator: number;
            massCurveMultiplier: number;
            resistances: {
                caustic: number;
                explosive: number;
                kinetic: number;
                thermal: number;
            };
            resistancesAtFourPips: {
                caustic: number;
                explosive: number;
                kinetic: number;
                thermal: number;
            };
            strength: number;
        };
        weapons: {
            damagePerSecond: number;
            energyPerSecond: number;
            heatPerSecond: number;
            kineticDamagePerSecond: number;
            powerDraw: number;
            sustainedDamagePerSecond: number;
            thermalDamagePerSecond: number;
        };
    };
    deepBlack: {
        armour: {
            bulkheads: number;
            effectiveHitPoints: {
                caustic: number;
                explosive: number;
                kinetic: number;
                thermal: number;
            };
            hitPoints: number;
            reinforcement: number;
            resistances: {
                caustic: number;
                explosive: number;
                kinetic: number;
                thermal: number;
            };
        };
        build: string;
        power: {
            available: number;
            deployed: number;
            headroom: number;
            retracted: number;
            withinBudget: boolean;
        };
        shields: {
            effectiveHitPoints: {
                caustic: number;
                explosive: number;
                kinetic: number;
                thermal: number;
            };
            massCurveMultiplier: number;
            resistances: {
                caustic: number;
                explosive: number;
                kinetic: number;
                thermal: number;
            };
            strength: number;
        };
        weaponCount: number;
    };
    functions: {
        armourPiercingFactor: {
            armourPiercing: number;
            expected: number;
            hardness: number;
        }[];
        damageFalloff: {
            expected: number;
            falloffRange: number;
            maximumRange: number;
            metres: number;
        }[];
        powerBudget: {
            available: number;
            bands: {
                deployed: number;
                deployedTotal: number;
                poweredDeployed: boolean;
                poweredRetracted: boolean;
                priority: number;
                retracted: number;
                retractedTotal: number;
            }[];
            consumers: {
                deployedOnly?: boolean;
                draw: number;
                priority: number;
            }[];
            deployed: number;
            retracted: number;
        };
        powerBudgetUnknownDraw: {
            available: number;
            consumers: {
                draw: number;
                drawUnknown?: boolean;
                label: string;
                priority: number;
            }[];
            deployed: number;
            headroom: number;
            note: string;
            retracted: number;
            unknownDraws: {
                draw: number;
                drawUnknown: boolean;
                label: string;
                priority: number;
            }[];
            withinBudget: boolean;
        };
        stackArmourResistance: {
            bulkhead: number;
            expected: number;
            reinforcements: number[];
        }[];
        stackShieldResistance: {
            boosters: number[];
            expected: number;
            generator: number;
        }[];
        systemsResistance: {
            expected: number;
            pips: number;
        }[];
    };
    inGame: {
        cobraMkV: {
            armour: {
                hitPoints: number;
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
            };
            build: string;
            jumpRange: {
                fullTank: number;
            };
            mass: {
                current: number;
                maximum: number;
            };
            note: string;
            offense: {
                damagePerSecond: number;
                distributorDraw: number;
                thermalLoad: number;
            };
            power: {
                available: number;
                deployed: number;
                includesDisabledModules: boolean;
                retracted: number;
            };
            shields: {
                regeneration: {
                    broken: number;
                    standard: number;
                };
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
                strength: number;
            };
            speed: {
                boost: number;
                pitch: number;
                roll: number;
                top: number;
                yaw: number;
            };
        };
        deepBlack: {
            armour: {
                hitPoints: number;
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
            };
            build: string;
            jumpRange: {
                fullTank: number;
            };
            mass: {
                current: number;
                maximum: number;
            };
            note: string;
            offense: {
                damagePerSecond: number;
                distributorDraw: number;
                thermalLoad: number;
            };
            power: {
                available: number;
                deployed: number;
                includesDisabledModules: boolean;
                retracted: number;
            };
            shields: {
                regeneration: {
                    broken: number;
                    standard: number;
                };
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
                strength: number;
            };
            speed: {
                boost: number;
                pitch: number;
                roll: number;
                top: number;
                yaw: number;
            };
        };
        fatArse: {
            armour: {
                hitPoints: number;
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
            };
            build: string;
            jumpRange: {
                fullTank: number;
            };
            mass: {
                current: number;
                maximum: number;
            };
            note: string;
            offense: {
                damagePerSecond: number;
                distributorDraw: number;
                thermalLoad: number;
            };
            power: {
                available: number;
                deployed: number;
                includesDisabledModules: boolean;
                retracted: number;
            };
            shields: {
                regeneration: {
                    broken: number;
                    standard: number;
                };
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
                strength: number;
            };
            speed: {
                boost: number;
                pitch: number;
                roll: number;
                top: number;
                yaw: number;
            };
        };
        federalCorvetteBeams: {
            armour: {
                hitPoints: number;
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
            };
            build: string;
            jumpRange: {
                fullTank: number;
            };
            mass: {
                current: number;
                maximum: number;
            };
            note: string;
            power: {
                available: number;
                deployed: number;
                includesDisabledModules: boolean;
                retracted: number;
            };
            shields: {
                regeneration: {
                    broken: number;
                    standard: number;
                };
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
                strength: number;
            };
            speed: {
                boost: number;
                pitch: number;
                roll: number;
                top: number;
                yaw: number;
            };
        };
        kestrelMkII: {
            armour: {
                hitPoints: number;
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
            };
            build: string;
            jumpRange: {
                fullTank: number;
            };
            mass: {
                current: number;
                maximum: number;
            };
            note: string;
            observedShipName: string;
            offense: {
                damagePerSecond: number;
                distributorDraw: number;
                thermalLoad: number;
            };
            power: {
                available: number;
                deployed: number;
                includesDisabledModules: boolean;
                retracted: number;
            };
            shields: {
                regeneration: {
                    broken: number;
                    standard: number;
                };
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
                strength: number;
            };
            speed: {
                boost: number;
                pitch: number;
                roll: number;
                top: number;
                yaw: number;
            };
        };
        rescue: {
            armour: {
                hitPoints: number;
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
            };
            build: string;
            jumpRange: {
                fullTank: number;
            };
            mass: {
                current: number;
                maximum: number;
            };
            note: string;
            offense: {
                damagePerSecond: number;
                distributorDraw: number;
                thermalLoad: number;
            };
            power: {
                available: number;
                deployed: number;
                includesDisabledModules: boolean;
                retracted: number;
            };
            shields: {
                regeneration: {
                    broken: number;
                    standard: number;
                };
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
                strength: number;
            };
            speed: {
                boost: number;
                pitch: number;
                roll: number;
                top: number;
                yaw: number;
            };
        };
        rescue01: {
            armour: {
                hitPoints: number;
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
            };
            build: string;
            jumpRange: {
                fullTank: number;
            };
            mass: {
                current: number;
                maximum: number;
            };
            note: string;
            offense: {
                damagePerSecond: number;
                distributorDraw: number;
                thermalLoad: number;
            };
            power: {
                available: number;
                deployed: number;
                includesDisabledModules: boolean;
                retracted: number;
            };
            shields: {
                regeneration: {
                    broken: number;
                    standard: number;
                };
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
                strength: number;
            };
            speed: {
                boost: number;
                pitch: number;
                roll: number;
                top: number;
                yaw: number;
            };
        };
        slapaconda: {
            armour: {
                hitPoints: number;
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
            };
            build: string;
            jumpRange: {
                fullTank: number;
            };
            mass: {
                current: number;
                maximum: number;
            };
            note: string;
            offense: {
                damagePerSecond: number;
                distributorDraw: number;
                thermalLoad: number;
            };
            power: {
                available: number;
                deployed: number;
                includesDisabledModules: boolean;
                retracted: number;
            };
            shields: {
                strength: number;
            };
            speed: {
                boost: number;
                pitch: number;
                roll: number;
                top: number;
                yaw: number;
            };
        };
        spireOps: {
            armour: {
                hitPoints: number;
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
            };
            build: string;
            jumpRange: {
                fullTank: number;
            };
            mass: {
                current: number;
                maximum: number;
            };
            note: string;
            offense: {
                damagePerSecond: number;
                distributorDraw: number;
                thermalLoad: number;
            };
            power: {
                available: number;
                deployed: number;
                includesDisabledModules: boolean;
                retracted: number;
            };
            shields: {
                regeneration: {
                    broken: number;
                    standard: number;
                };
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
                strength: number;
            };
            speed: {
                boost: number;
                pitch: number;
                roll: number;
                top: number;
                yaw: number;
            };
        };
        theFixer: {
            armour: {
                hitPoints: number;
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
            };
            build: string;
            jumpRange: {
                fullTank: number;
            };
            mass: {
                current: number;
                maximum: number;
            };
            note: string;
            offense: {
                damagePerSecond: number;
                distributorDraw: number;
                thermalLoad: number;
            };
            power: {
                available: number;
                deployed: number;
                includesDisabledModules: boolean;
                retracted: number;
            };
            shields: {
                regeneration: {
                    broken: number;
                    standard: number;
                };
                resistances: {
                    explosive: number;
                    kinetic: number;
                    thermal: number;
                };
                strength: number;
            };
            speed: {
                boost: number;
                pitch: number;
                roll: number;
                top: number;
                yaw: number;
            };
        };
    };
    observedGuardianShardCannons: {
        active: boolean;
        blueprint: string;
        grade: number;
        note: string;
        records: {
            ammoMaximum: number;
            armourPiercing: number;
            class: number;
            clipSize: number;
            damage: number;
            damagePerSecond: number;
            damageType: string;
            distributorDraw: number;
            falloffRange: number;
            integrity: number;
            mass: number;
            maximumRange: number;
            powerDraw: number;
            rateOfFire: number;
            shotSpeed: number;
            symbol: string;
            thermalLoad: number;
        }[];
    };
    unknownPowerDraw: {
        available: number;
        deployed: number;
        loadout: {
            Modules: {
                Item: string;
                On?: boolean;
                Priority?: number;
                Slot: string;
            }[];
            Ship: string;
            UnladenMass: number;
        };
        retracted: number;
        unknownDraws: {
            deployedOnly?: boolean;
            drawUnknown: boolean;
            enabled: boolean;
            label: string;
            priority: number;
        }[];
    };
    weapons: {
        continuous: boolean;
        damagePerSecond: number;
        energyPerSecond: number;
        heatPerSecond: number;
        sustainedDamagePerSecond: number;
        sustainedFireFactor: number;
        symbol: string;
    }[];
};

declare module '*/fixtures/ships/build-metrics.jsonc' {
    const value: FixtureShipsBuildMetrics;
    export default value;
}

type FixtureShipsBuildsIndex = {
    builds: {
        id: string;
        role: string;
        ship: string;
    }[];
    count: number;
    declaredEngineering: number;
};

declare module '*/fixtures/ships/builds/index.jsonc' {
    const value: FixtureShipsBuildsIndex;
    export default value;
}

type FixtureShipsDefaultLoadouts = {
    moduleCount: number;
    shipCount: number;
    spot: {
        empty: string[];
        modules: {
            slot: string;
            symbol: string;
        }[];
        ship: string;
    }[];
};

declare module '*/fixtures/ships/default-loadouts.jsonc' {
    const value: FixtureShipsDefaultLoadouts;
    export default value;
}

type FixtureShipsEngineering = {
    anchor: {
        base: {
            FSDOptimalMass: number;
            Integrity: number;
            Mass: number;
            PowerDraw: number;
        };
        blueprint: string;
        expected: {
            FSDOptimalMass: number;
            Integrity: number;
            Mass: number;
            PowerDraw: number;
        };
        experimental: string;
        grade: number;
        quality: number;
    };
    blueprintCount: number;
    blueprintOnlyModifications: {
        description: string;
        excludedExperimentalIds: {
            special_guardian_module_resistance: {
                blueprints: {
                    GuardianModule_Sturdy: string;
                };
            };
            special_plasma_rounds: {
                blueprints: {
                    BeamLaser_ThermalPlasmaConversion: string;
                    BurstLaser_ThermalPlasmaConversion: string;
                    PulseLaser_ThermalPlasmaConversion: string;
                };
            };
        };
    };
    clipRounding: {
        cases: {
            AmmoClipSize: number;
            AmmoMaximum?: number;
            baseAmmoClipSize: number;
            blueprint: string;
            burstFrom: string;
            burstSize: number;
            grade: number;
            note: string;
            quality: number;
            symbol: string;
            unroundedAmmoClipSize: number;
        }[];
        description: string;
    };
    damageComponentScaling: {
        cases: {
            baseComponents: {
                absolute?: number;
                antiXeno?: number;
                explosive?: number;
                kinetic?: number;
                thermal?: number;
                unclassified?: number[];
            };
            baseDamage: number;
            effectiveDamage: number;
            expectedComponents: {
                absolute?: number;
                antiXeno?: number;
                explosive?: number;
                kinetic?: number;
                thermal?: number;
                unclassified?: number[];
            };
            symbol: string;
        }[];
        description: string;
    };
    decorativeModifications: {
        description: string;
        ids: {
            id: string;
            name: string;
        }[];
        modifiers: {
            label: string;
            method: string;
            value: number;
        }[];
        module: string;
        resolved: {
            baseDamage: number;
            damage: number;
            damagePerSecond: number;
            description: string;
            panel: {
                damage: number;
                damagePerSecond: number;
                percent: number;
            };
        };
    };
    experimentalCount: number;
    experimentalDamageDistributions: {
        description: string;
        map: {
            special_distortion_field: {
                kinetic: number;
                thermal: number;
            };
            special_high_yield_shell: {
                explosive: number;
                kinetic: number;
            };
            special_overload_munitions: {
                explosive: number;
                thermal: number;
            };
        };
    };
    experimentalNames: {
        description: string;
        map: {
            special_shield_efficient: string;
            special_shield_resistive: string;
            special_shiftlock_canister: string;
            special_super_penetrator: string;
            special_weapon_rateoffire: string;
        };
    };
    guardianZoneResistanceCapability: {
        cases: {
            blueprint: string;
            slot: string;
            symbol: string;
        }[];
        description: string;
        field: string;
        grade: number;
        modifier: {
            Label: string;
            ValueStr: string;
        };
        numericImportedModifier: {
            Label: string;
            OriginalValue: number;
            Value: number;
        };
        offeredAs: string;
        refused: {
            blueprint: string;
            slot: string;
            symbol: string;
        };
    };
    journalNames: {
        description: string;
        map: {
            MC_Overcharged: string;
            Scanner_LongRange: string;
            Scanner_WideAngle: string;
        };
    };
    journalSpellings: {
        cases: {
            blueprint: string;
            note?: string;
            resolved: string;
            symbol: string;
        }[];
        description: string;
        operationsKeys: {
            description: string;
            observed: {
                blueprint: string;
                grade: number;
                soldAtGrade: number;
                symbol: string;
            }[];
            prefixed: never[];
        };
    };
    overchargedIdCollision: {
        cases: {
            base: {
                AmmoClipSize: number;
                Damage: number;
                DistributorDraw: number;
                ThermalLoad: number;
            };
            blueprint: string;
            modifiers: {
                Label: string;
                OriginalValue: number;
                Value: number;
            }[];
            resolved: string;
            symbol: string;
        }[];
        description: string;
        grade: number;
        quality: number;
        refused: {
            blueprint: string;
            symbol: string;
        }[];
    };
    preEngineeredClimb: {
        base: {
            DamageProtection: number;
            Integrity: number;
            Mass: number;
        };
        blueprint: string;
        description: string;
        expected: {
            DamageProtection: number;
            Integrity: number;
            Mass: number;
        };
        grade: number;
        gradeUnavailable: number;
        quality: number;
        soldAtGrade: number;
        symbol: string;
    };
    reachability: {
        description: string;
        reachable: {
            accepts: string;
            id: string;
            modules: number;
            refuses: string;
        }[];
        unreachableBlueprints: never[];
        unreachableExperimentals: never[];
    };
    scannerIdCollision: {
        cases: {
            base: {
                Mass: number;
                PowerDraw: number;
                ScannerRange: number;
                ScannerTimeToScan?: number;
                SensorTargetScanAngle: number;
            };
            blueprint: string;
            modifiers: {
                Label: string;
                OriginalValue: number;
                Value: number;
            }[];
            resolved: string;
            symbol: string;
        }[];
        description: string;
        grade: number;
        quality: number;
        refused: {
            blueprint: string;
            symbol: string;
        }[];
    };
    thermalPlasmaConversions: {
        blueprints: {
            BeamLaser_ThermalPlasmaConversion: string;
            BurstLaser_ThermalPlasmaConversion: string;
            PulseLaser_ThermalPlasmaConversion: string;
        };
        description: string;
        grades: {
            '1': {
                absolute: number;
                thermal: number;
            };
            '2': {
                absolute: number;
                thermal: number;
            };
            '3': {
                absolute: number;
                thermal: number;
            };
            '4': {
                absolute: number;
                thermal: number;
            };
            '5': {
                absolute: number;
                thermal: number;
            };
        };
    };
};

declare module '*/fixtures/ships/engineering.jsonc' {
    const value: FixtureShipsEngineering;
    export default value;
}

type FixtureShipsEngineeringOptions = {
    antiGuardianZoneResistance: {
        blueprint: string;
        description: string;
        experimentals: never[];
        groups: string[];
        modules: string[];
    };
    blueprintUnion: {
        blueprint: string;
        experimentals: string[];
    };
    corpus: {
        aliasSpellingsAccepted: number;
        blueprintAliases: {
            Misc_LightWeight: string[];
            Misc_Reinforced: string[];
            Misc_Shielded: string[];
        };
        declaredEngineering: number;
        description: string;
        finalPreEngineered: {
            blueprint: string;
            entries: number;
            experimental?: string;
            symbol: string;
        }[];
        finalPreEngineeredEntries: number;
        journalSpellingsAccepted: number;
        notEngineerable: {
            blueprint: string;
            entries: number;
            symbol: string;
        }[];
        ungroupedEntries: number;
    };
    counts: {
        blueprintsOffered: number;
        exclusions: number;
        groups: number;
        modules: number;
        modulesWithoutExperimental: number;
    };
    exclusions: {
        excluded: string[];
        symbol: string;
    }[];
    groupSizes: {
        antiXenoMissileRacks: number;
        antiXenoMultiCannons: number;
        autoFieldMaintenanceUnits: number;
        beamLasers: number;
        bulkheads: number;
        burstLasers: number;
        cannons: number;
        cargoRacks: number;
        chaffLaunchers: number;
        collectionLimpets: number;
        ecms: number;
        experimentalWeapons: number;
        fragmentCannons: number;
        frameShiftDrives: number;
        frameShiftDrivesSCO: number;
        fsdBoosters: number;
        fsdInterdictors: number;
        fuelScoops: number;
        fuelTransferLimpets: number;
        guardianGauss: number;
        guardianHullReinforcements: number;
        guardianPlasma: number;
        guardianPowerDistributors: number;
        guardianPowerPlants: number;
        guardianShard: number;
        hatchBreakerLimpets: number;
        heatSinkLaunchers: number;
        hullReinforcements: number;
        killWarrantScanners: number;
        lifeSupports: number;
        manifestScanners: number;
        mines: number;
        miningToolsLasers: number;
        missiles: number;
        moduleReinforcements: number;
        multiCannons: number;
        plasmaAccelerators: number;
        pointDefence: number;
        powerDistributors: number;
        powerPlants: number;
        prospectingLimpets: number;
        pulseLasers: number;
        railGuns: number;
        refineries: number;
        sensors: number;
        shieldBoosters: number;
        shieldCellBanks: number;
        shieldGenerators: number;
        shieldReinforcements: number;
        surfaceScanners: number;
        thrusters: number;
        torpedoes: number;
        wakeScanners: number;
    };
    groups: {
        blueprints: string[];
        experimentals: string[];
        id: string;
        name: string;
    }[];
    modules: {
        group: string;
        symbol: string;
    }[];
    notEngineerable: string[];
    splitFamilies: {
        description?: string;
        guardian: {
            blueprints: string[];
            experimentals: never[];
            group: string;
            symbol: string;
        };
        ordinary: {
            blueprints: string[];
            experimentals: string[];
            group: string;
            symbol: string;
        };
    }[];
};

declare module '*/fixtures/ships/engineering-options.jsonc' {
    const value: FixtureShipsEngineeringOptions;
    export default value;
}

type FixtureShipsGunsights = {
    cases: {
        offsets: number[][];
        points: number[][];
        rangeMetres: number;
        ship: string;
        slots?: string[];
    }[];
    hardpointCount: number;
    shipCount: number;
};

declare module '*/fixtures/ships/gunsights.jsonc' {
    const value: FixtureShipsGunsights;
    export default value;
}

type FixtureShipsHeat = {
    builds: {
        deployedPowerDraw: number;
        firingDrained: {
            overheats: boolean;
            secondsToOverheat: number;
            thermalLoad: number;
        };
        firingSustained: {
            gauge?: number;
            overheats: boolean;
            secondsToOverheat?: number;
            thermalLoad: number;
        };
        fixture: string;
        fsdCharging: {
            gauge: number;
            overheats: boolean;
            thermalLoad: number;
        };
        heatEfficiency: number;
        hullHeatCapacity: number;
        hullHeatDissipation: number;
        idle: {
            gauge: number;
            overheats: boolean;
            thermalLoad: number;
        };
        retractedPowerDraw: number;
        ship: string;
        thrusters: {
            gauge: number;
            overheats: boolean;
            thermalLoad: number;
        };
    }[];
    drainedCapacitorMultiplier: number;
    equilibrium: {
        dissipation: number;
        heatLevel: number | null;
        thermalLoad: number;
    }[];
    hulls: {
        lynx: {
            heatDissipation: number;
            symbol: string;
        };
    };
    overheatHeatLevel: number;
    transient: {
        heatCapacity: number;
        heatDissipation: number;
        heatLevel?: number;
        seconds: number | null;
        startLevel: number;
        targetLevel?: number;
        thermalLoad: number;
    }[];
    unknownDraws: {
        fixture: string;
        idleThermalLoad: number;
        labels: string[];
        overheats: boolean;
        projection: {
            powerPlant: string;
            resolved: {
                idleThermalLoad: number;
                thrustersThermalLoad: number;
            };
            resolvedItem: string;
            ship: string;
            thrusterPriority: number;
            thrusters: string;
            unresolved: {
                idleThermalLoad: number;
                thrustersThermalLoad: number;
            };
            unresolvedItem: string;
        };
    };
    unknownHull: string;
    unpowered: {
        fixture: string;
        heatLevel: number;
        overheats: boolean;
        powerPlant: string;
        thermalLoad: number;
    };
    weaponThermalLoad: {
        capacitorLevel: number;
        distributorDraw: number;
        effective: number;
        thermalLoad: number;
        weaponsCapacity: number;
    }[];
};

declare module '*/fixtures/ships/heat.jsonc' {
    const value: FixtureShipsHeat;
    export default value;
}

type FixtureShipsJournalAnacondaSlapaconda = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    HullValue: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer?: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood?: number;
                OriginalValue?: number;
                Value?: number;
                ValueStr?: string;
                ValueStr_Localised?: string;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-anaconda-slapaconda.jsonc' {
    const value: FixtureShipsJournalAnacondaSlapaconda;
    export default value;
}

type FixtureShipsJournalCaspianExplorer = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer?: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood: number;
                OriginalValue: number;
                Value: number;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-caspian-explorer.jsonc' {
    const value: FixtureShipsJournalCaspianExplorer;
    export default value;
}

type FixtureShipsJournalCobraMkv = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    HullValue: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood: number;
                OriginalValue: number;
                Value: number;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-cobra-mkv.jsonc' {
    const value: FixtureShipsJournalCobraMkv;
    export default value;
}

type FixtureShipsJournalCorsair = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    HullValue: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood: number;
                OriginalValue: number;
                Value: number;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-corsair.jsonc' {
    const value: FixtureShipsJournalCorsair;
    export default value;
}

type FixtureShipsJournalFederationCorvetteBeams = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    HullValue: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood: number;
                OriginalValue: number;
                Value: number;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-federation-corvette-beams.jsonc' {
    const value: FixtureShipsJournalFederationCorvetteBeams;
    export default value;
}

type FixtureShipsJournalFederationCorvetteMixed = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    HullValue: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood: number;
                OriginalValue: number;
                Value: number;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-federation-corvette-mixed.jsonc' {
    const value: FixtureShipsJournalFederationCorvetteMixed;
    export default value;
}

type FixtureShipsJournalFederationCorvetteMultirole = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    HullValue: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood: number;
                OriginalValue: number;
                Value: number;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-federation-corvette-multirole.jsonc' {
    const value: FixtureShipsJournalFederationCorvetteMultirole;
    export default value;
}

type FixtureShipsJournalFederationCorvettePlasma = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    HullValue: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood: number;
                OriginalValue: number;
                Value: number;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-federation-corvette-plasma.jsonc' {
    const value: FixtureShipsJournalFederationCorvettePlasma;
    export default value;
}

type FixtureShipsJournalFederationCorvette = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    HullValue: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                Label_Localised?: string;
                LessIsGood?: number;
                OriginalValue?: number;
                Value?: number;
                ValueStr?: string;
                ValueStr_Localised?: string;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-federation-corvette.jsonc' {
    const value: FixtureShipsJournalFederationCorvette;
    export default value;
}

type FixtureShipsJournalKestrelMkii = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    HullValue: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood: number;
                OriginalValue: number;
                Value: number;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-kestrel-mkii.jsonc' {
    const value: FixtureShipsJournalKestrelMkii;
    export default value;
}

type FixtureShipsJournalKraitPhantom = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    HullValue: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood: number;
                OriginalValue: number;
                Value: number;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-krait-phantom.jsonc' {
    const value: FixtureShipsJournalKraitPhantom;
    export default value;
}

type FixtureShipsJournalLynxHighlinerRescue = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    HullValue: number;
    MaxJumpRange: number;
    Modules: {
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood: number;
                OriginalValue: number;
                Value: number;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-lynx-highliner-rescue.jsonc' {
    const value: FixtureShipsJournalLynxHighlinerRescue;
    export default value;
}

type FixtureShipsJournalLynxHighlinerRescue01Current = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood: number;
                OriginalValue: number;
                Value: number;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-lynx-highliner-rescue01-current.jsonc' {
    const value: FixtureShipsJournalLynxHighlinerRescue01Current;
    export default value;
}

type FixtureShipsJournalLynxHighliner = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood: number;
                OriginalValue: number;
                Value: number;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-lynx-highliner.jsonc' {
    const value: FixtureShipsJournalLynxHighliner;
    export default value;
}

type FixtureShipsJournalPantherMkiiFatArse = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer?: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood: number;
                OriginalValue: number;
                Value: number;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-panther-mkii-fat-arse.jsonc' {
    const value: FixtureShipsJournalPantherMkiiFatArse;
    export default value;
}

type FixtureShipsJournalPythonMkiiAntixeno = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    HullValue: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-python-mkii-antixeno.jsonc' {
    const value: FixtureShipsJournalPythonMkiiAntixeno;
    export default value;
}

type FixtureShipsJournalPythonMkiiSpireOps = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    HullValue: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer?: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood?: number;
                OriginalValue?: number;
                Value?: number;
                ValueStr?: string;
                ValueStr_Localised?: string;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-python-mkii-spire-ops.jsonc' {
    const value: FixtureShipsJournalPythonMkiiSpireOps;
    export default value;
}

type FixtureShipsJournalTheDeepBlack = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    HullHealth: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Engineering?: {
            BlueprintID: number;
            BlueprintName: string;
            Engineer?: string;
            EngineerID: number;
            ExperimentalEffect?: string;
            ExperimentalEffect_Localised?: string;
            Level: number;
            Modifiers: {
                Label: string;
                LessIsGood: number;
                OriginalValue: number;
                Value: number;
            }[];
            Quality: number;
        };
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-the-deep-black.jsonc' {
    const value: FixtureShipsJournalTheDeepBlack;
    export default value;
}

type FixtureShipsJournalViperMkiv = {
    CargoCapacity: number;
    FuelCapacity: {
        Main: number;
        Reserve: number;
    };
    Hot: boolean;
    HullHealth: number;
    HullValue: number;
    MaxJumpRange: number;
    Modules: {
        AmmoInClip?: number;
        AmmoInHopper?: number;
        Health: number;
        Item: string;
        On: boolean;
        Priority: number;
        Slot: string;
        Value?: number;
    }[];
    ModulesValue: number;
    Rebuy: number;
    Ship: string;
    ShipID: number;
    ShipIdent: string;
    ShipName: string;
    UnladenMass: number;
    event: string;
    timestamp: string;
};

declare module '*/fixtures/ships/journal-viper-mkiv.jsonc' {
    const value: FixtureShipsJournalViperMkiv;
    export default value;
}

type FixtureShipsJumpRange = {
    builds: {
        kraitPhantom: {
            build: string;
            cargoCapacity: number;
            frameShiftDrive: {
                fuelMul: number;
                fuelPower: number;
                jumpBoost: number;
                maxFuel: number;
                optMass: number;
            };
            ladenJumpRange: number;
            mainFuel: number;
            maxJumpRange: number;
            note: string;
            ship: string;
            sourceMaxJumpRange: number;
            totalJumps: number;
            totalLadenRange: number;
            totalUnladenRange: number;
            unladenJumpRange: number;
            unladenMass: number;
        };
        pythonMkII: {
            build: string;
            cargoCapacity: number;
            frameShiftDrive: {
                fuelMul: number;
                fuelPower: number;
                jumpBoost: number;
                maxFuel: number;
                optMass: number;
            };
            ladenJumpRange: number;
            mainFuel: number;
            maxJumpRange: number;
            note: string;
            ship: string;
            sourceMaxJumpRange: number;
            totalJumps: number;
            totalLadenRange: number;
            totalUnladenRange: number;
            unladenJumpRange: number;
            unladenMass: number;
        };
        viperMkIV: {
            build: string;
            cargoCapacity: number;
            frameShiftDrive: {
                fuelMul: number;
                fuelPower: number;
                jumpBoost: number;
                maxFuel: number;
                optMass: number;
            };
            ladenJumpRange: number;
            mainFuel: number;
            maxJumpRange: number;
            note: string;
            ship: string;
            sourceMaxJumpRange: number;
            totalJumps: number;
            totalLadenRange: number;
            totalUnladenRange: number;
            unladenJumpRange: number;
            unladenMass: number;
        };
    };
    cargoCapacity: number;
    edsyMaxJumpRange: number;
    excessiveJumpCount: {
        error: string;
        fuel: number;
        mass: number;
        maxFuel: number;
    };
    frameShiftDrive: {
        fuelMul: number;
        fuelPower: number;
        jumpBoost: number;
        maxFuel: number;
        optMass: number;
        symbol: string;
    };
    fuelPerJump50Ly: number;
    invalidInputs: {
        field: string;
        function: string;
        value: number | string;
    }[];
    ladenJumpRange: number;
    mainFuel: number;
    massFactor: number;
    maxJumpRange: number;
    overflowingTotal: {
        error: string;
        frameShiftDrive: {
            fuelMul: number;
            fuelPower: number;
            jumpBoost: number;
            maxFuel: number;
            optMass: number;
        };
        fuel: number;
        mass: number;
    };
    ship: string;
    tinyFuel: {
        fuel: number;
        mass: number;
        minimumRange: number;
    };
    totalJumps: number;
    totalRange: number;
    unladenJumpRange: number;
    unladenMass: number;
};

declare module '*/fixtures/ships/jump-range.jsonc' {
    const value: FixtureShipsJumpRange;
    export default value;
}

type FixtureShipsModules = {
    counts: {
        all: number;
        core: number;
        hardpoint: number;
        internal: number;
        utility: number;
    };
    records: {
        category: string;
        class: number;
        engineeringGroup?: string | null;
        entitlement?: string;
        guidance?: string;
        mount?: string;
        name: string;
        rating: string;
        restrictedToShips?: string[];
        restrictedToSlot?: string;
        ship?: string;
        slot?: string;
        symbol: string;
    }[];
    shipArmour: {
        count: number;
        names: string[];
        ship: string;
    };
    slotCounts: {
        armour: number;
        frameShiftDrive: number;
        fuelTank: number;
        lifeSupport: number;
        none: number;
        powerDistributor: number;
        powerPlant: number;
        sensors: number;
        thrusters: number;
    };
};

declare module '*/fixtures/ships/modules.jsonc' {
    const value: FixtureShipsModules;
    export default value;
}

type FixtureShipsModuleStats = {
    capturedBaseStats: {
        captures: {
            exact: number;
            file: string;
            mapped: number;
            stated: number;
            unmapped: {
                label: string;
                symbol: string;
            }[];
            withinFloatNoise: number;
        }[];
        convertedDamageDistributions: {
            base: {
                kinetic: number;
            };
            effective: {
                explosive: number;
                kinetic: number;
            };
            experimental: string;
            file: string;
            slot: string;
            symbol: string;
        }[];
        effectiveWeapons: {
            damage: number;
            falloffRange?: number;
            file: string;
            maximumRange?: number;
            slot: string;
            symbol: string;
        }[];
        engineered: {
            field: string;
            file: string;
            slot: string;
            symbol: string;
            value: number;
        }[];
        engineeredNote: string;
        floatNoiseTolerance: number;
        note: string;
        rebuildNote: string;
        rebuildTolerance: number;
        rebuilds: {
            file: string;
            maxJumpRange: number;
            unladenMass: number;
        }[];
        unmappedNote: string;
        weapons: {
            damagePerSecond: number;
            symbol: string;
        }[];
        weaponsNote: string;
    };
    continuousFire: string[];
    counts: {
        all: number;
        core: number;
        hardpoint: number;
        internal: number;
        utility: number;
    };
    countsNote: string;
    freeModules: {
        note: string;
        symbols: string[];
    };
    inGameAudit: {
        armourModulesOutsideNumericVerification: number;
        catalogueFieldCounts: {
            bootTime: number;
            powerDraw: number;
        };
        catalogueIdentities: number;
        identityMatches: number;
        note: string;
        numericModulesVerified: number;
        registryOnlyIdentities: number;
        verifiedAbsentFields: number;
        verifiedFields: number;
        verifiedRecords: number;
        verifiedValueFields: number;
    };
    inGameVerifiedAbsentFields: {
        fields: string[];
        symbol: string;
    }[];
    inGameVerifiedValues: {
        ammoMaximum?: number;
        burstInterval?: number;
        causticResistance?: number;
        clipSize?: number;
        damage?: number;
        damageComponents?: {
            absolute?: number;
            antiXeno?: number;
            explosive?: number;
            kinetic?: number;
            thermal?: number;
            unclassified?: number[];
        };
        damageDistribution?: {
            absolute?: number;
            antiXeno?: number;
            explosive?: number;
            kinetic?: number;
            thermal?: number;
            unclassified?: number;
        };
        distributorDraw?: number;
        falloffRange?: number;
        integrity?: number;
        jitter?: number;
        maxMass?: number;
        maxMultiplier?: number;
        maximumRange?: number;
        minMass?: number;
        optMass?: number;
        optMultiplier?: number;
        projectileRange?: {
            falloffBoundary: number;
            maximumBoundary: number;
        };
        rateOfFire?: number;
        refuelRate?: number;
        reloadTime?: number;
        shieldBrokenRegenRate?: number;
        shieldRegenRate?: number;
        symbol: string;
        thermalLoad?: number;
    }[];
    priceCounts: {
        all: number;
        core: number;
        hardpoint: number;
        internal: number;
        utility: number;
    };
    prices: {
        cost: number;
        symbol: string;
    }[];
    spot: {
        alwaysPowered?: boolean;
        ammoMaximum?: number;
        armourPiercing?: number;
        bootTime?: number;
        burstInterval?: number;
        burstRateOfFire?: number;
        burstRounds?: number;
        cargoCapacity?: number;
        causticResistance?: number;
        chargeTime?: number;
        clipSize?: number;
        damage?: number;
        damageDistribution?: {
            kinetic: number;
            thermal?: number;
        };
        distributorDraw?: number;
        engineHeatRate?: number;
        enginesCapacity?: number;
        enginesRecharge?: number;
        explosiveResistance?: number;
        falloffRange?: number;
        fsdHeatRate?: number;
        fuelCapacity?: number;
        fuelMul?: number;
        fuelPower?: number;
        guardianZoneResistance?: boolean;
        heatEfficiency?: number;
        hullBoost?: number;
        hullReinforcement?: number;
        integrity?: number;
        interdictorFacingLimit?: number;
        interdictorRange?: number;
        jumpBoost?: number;
        kineticResistance?: number;
        mass?: number;
        maxFuel?: number;
        maxMass?: number;
        maxMultiplier?: number;
        maximumRange?: number;
        minMass?: number;
        minMultiplier?: number;
        name: string;
        optMass?: number;
        optMultiplier?: number;
        powerCapacity?: number;
        powerDraw?: number;
        probeRadius?: number;
        rateOfFire?: number;
        refuelRate?: number;
        reloadTime?: number;
        restrictedToShips?: string[];
        scanAngle?: number;
        scanTime?: number;
        scannerRange?: number;
        shieldBankDuration?: number;
        shieldBankHeat?: number;
        shieldBankReinforcement?: number;
        shieldBankSpinUp?: number;
        shieldBoost?: number;
        shieldBrokenRegenRate?: number;
        shieldRegenRate?: number;
        ship?: string;
        shotSpeed?: number;
        symbol: string;
        systemsCapacity?: number;
        systemsRecharge?: number;
        thermalLoad?: number;
        thermalResistance?: number;
        weaponsCapacity?: number;
        weaponsRecharge?: number;
    }[];
    statCounts: {
        counts: {
            engineHeatRate: number;
            fsdHeatRate: number;
            interdictorFacingLimit: number;
            interdictorRange: number;
            probeRadius: number;
            refuelRate: number;
            scanAngle: number;
            scanTime: number;
            scannerRange: number;
            shieldBankDuration: number;
            shieldBankHeat: number;
            shieldBankReinforcement: number;
            shieldBankSpinUp: number;
        };
        note: string;
    };
    unpriced: string[];
    unpricedNote: string;
    withoutIntegrity: {
        count: number;
        note: string;
        symbols: string[];
    };
};

declare module '*/fixtures/ships/module-stats.jsonc' {
    const value: FixtureShipsModuleStats;
    export default value;
}

type FixtureShipsOperations = {
    cellBanks: {
        expected: {
            totalCells: number;
            totalRestorable: number;
        };
        input: {
            cells: number;
            duration: number;
            heat: number;
            reinforcementRate: number;
            slot: string;
            spinUp: number;
            symbol: string;
        }[];
    };
    diagnostics: {
        calculation: {
            expected: {
                field: string;
                params: {
                    field: string;
                    slot: string;
                    symbol: string;
                };
                slot: string;
                symbol: string;
            };
            input: {
                mass: number;
                slot: string;
                symbol: string;
            };
        };
        loadout: {
            expected: {
                code: string;
                params: {
                    constraint: string;
                    moduleClass: number;
                    slot: string;
                    slotSize: number;
                    symbol: string;
                };
            };
            input: {
                Modules: {
                    Item: string;
                    Slot: string;
                }[];
                Ship: string;
            };
        };
        restrictedLoadout: {
            expected: {
                code: string;
                params: {
                    allowedShipNames: string[];
                    allowedShipSymbols: string[];
                    constraint: string;
                    shipSymbol: string;
                    slot: string;
                    symbol: string;
                };
            };
            input: {
                Modules: {
                    Item: string;
                    Slot: string;
                }[];
                Ship: string;
            };
        };
        slef: {
            expected: {
                code: string;
                constraint: string;
                path: string;
            };
            input: {
                Modules: {
                    Slot: string;
                }[];
                Ship: string;
            };
        };
        wrongArmourLoadout: {
            expected: {
                code: string;
                params: {
                    armourShipName: string;
                    armourShipSymbol: string;
                    constraint: string;
                    shipName: string;
                    shipSymbol: string;
                    slot: string;
                    symbol: string;
                };
            };
            input: {
                Modules: {
                    Item: string;
                    Slot: string;
                }[];
                Ship: string;
            };
        };
    };
    editorErrors: {
        duplicateExclusiveModule: {
            expected: {
                code: string;
                params: {
                    exclusionGroup: string;
                    previousSlot: string;
                    previousSymbol: string;
                    slot: string;
                    symbol: string;
                };
            };
            firstSlot: string;
            module: string;
            secondSlot: string;
            ship: string;
        };
        immutableSlot: {
            expected: {
                code: string;
                params: {
                    slot: string;
                };
            };
            ship: string;
            slot: string;
        };
        immutableSlotReplacement: {
            expected: {
                code: string;
                params: {
                    slot: string;
                };
            };
            module: string;
            ship: string;
            slot: string;
        };
        incompatibleModule: {
            expected: {
                code: string;
                constraint: string;
                params: {
                    constraint: string;
                    moduleClass: number;
                    slot: string;
                    slotSize: number;
                    symbol: string;
                };
            };
            module: string;
            ship: string;
            slot: string;
        };
        moduleLimitExceeded: {
            expected: {
                code: string;
                params: {
                    count: number;
                    group: string;
                    limit: number;
                    slot: string;
                    symbol: string;
                };
            };
            fittedSlots: string[];
            module: string;
            ship: string;
            targetSlot: string;
        };
    };
    exclusivity: {
        expectedCode: string;
        group: string;
    };
    mobility: {
        expected: {
            boost: number;
            massCurveMultiplier: number;
            pitch: number;
            roll: number;
            rotationMassCurveMultiplier: number;
            speed: number;
            yaw: number;
        };
        facadeExplicitFuel: {
            expected: {
                boost: number;
                massCurveMultiplier: number;
                pitch: number;
                roll: number;
                rotationMassCurveMultiplier: number;
                speed: number;
                yaw: number;
            };
            invalidLoads: {
                expectedError: string;
                options: {
                    cargo?: number;
                    fuel?: number;
                };
            }[];
            loadout: {
                Modules: {
                    Item: string;
                    Slot: string;
                }[];
                Ship: string;
                UnladenMass: number;
            };
            omittedFuelFails: boolean;
            options: {
                fuel: number;
            };
            partialCapacityLoadout: {
                FuelCapacity: {
                    Main: number;
                };
                Modules: {
                    Item: string;
                    Slot: string;
                }[];
                Ship: string;
                UnladenMass: number;
            };
        };
        input: {
            boost: number;
            mass: number;
            maximumSpeed: number;
            minPitch: number;
            minRoll: number;
            minYaw: number;
            minimumSpeed: number;
            pitch: number;
            roll: number;
            thrusters: {
                maxMass: number;
                maxMultiplier: number;
                minMass: number;
                minMultiplier: number;
                optMass: number;
                optMultiplier: number;
                rotationCurve: {
                    maxMass: number;
                    maxMultiplier: number;
                    minMass: number;
                    minMultiplier: number;
                    optMass: number;
                    optMultiplier: number;
                };
                speedCurve: {
                    maxMass: number;
                    maxMultiplier: number;
                    minMass: number;
                    minMultiplier: number;
                    optMass: number;
                    optMultiplier: number;
                };
            };
            yaw: number;
        };
        invalidSpeedEndpoints: {
            expectedError: string;
            input: {
                boost: number;
                mass: number;
                maximumSpeed: number;
                minPitch: number;
                minRoll: number;
                minYaw: number;
                minimumSpeed: number;
                pitch: number;
                roll: number;
                thrusters: {
                    maxMass: number;
                    maxMultiplier: number;
                    minMass: number;
                    minMultiplier: number;
                    optMass: number;
                    optMultiplier: number;
                };
                yaw: number;
            };
        };
        pipAllocation: {
            expected: {
                boost: number;
                massCurveMultiplier: number;
                pitch: number;
                roll: number;
                rotationMassCurveMultiplier: number;
                speed: number;
                yaw: number;
            };
            input: {
                boost: number;
                enginesPips: number;
                mass: number;
                maximumSpeed: number;
                minPitch: number;
                minRoll: number;
                minYaw: number;
                minimumSpeed: number;
                pitch: number;
                roll: number;
                thrusters: {
                    maxMass: number;
                    maxMultiplier: number;
                    minMass: number;
                    minMultiplier: number;
                    optMass: number;
                    optMultiplier: number;
                };
                yaw: number;
            };
        };
        zeroPipRotation: {
            expected: {
                boost: number;
                massCurveMultiplier: number;
                pitch: number;
                roll: number;
                rotationMassCurveMultiplier: number;
                speed: number;
                yaw: number;
            };
            input: {
                boost: number;
                enginesPips: number;
                mass: number;
                maximumSpeed: number;
                minPitch: number;
                minRoll: number;
                minYaw: number;
                minimumSpeed: number;
                pitch: number;
                roll: number;
                thrusters: {
                    maxMass: number;
                    maxMultiplier: number;
                    minMass: number;
                    minMultiplier: number;
                    optMass: number;
                    optMultiplier: number;
                };
                yaw: number;
            };
            pitchSequence: number[];
            speedSequence: number[];
        };
    };
    moduleLimits: {
        catalogue: {
            increases: {
                amount: number;
                symbol: string;
            }[];
            limitedCount: number;
            weapon: string;
        };
        expectedIssue: {
            code: string;
            params: {
                count: number;
                group: string;
                limit: number;
            };
        };
        expectedUsage: {
            baseLimit: number;
            count: number;
            excess: number;
            group: string;
            increase: number;
            limit: number;
        };
        group: string;
        input: {
            limitGroup?: string;
            limitIncrease?: {
                amount: number;
                group: string;
            };
        }[];
        removal: {
            expected: {
                immovableReason: string;
                key: string;
                removable: boolean;
            };
            ship: string;
            slot: string;
            stabiliser: string;
            weaponSlots: string[];
        };
    };
    retailCredits: {
        expected: {
            hull: number;
            modules: number;
            rebuy: number;
        };
        ship: string;
    };
    shieldRecovery: {
        expected: {
            brokenRegenRate: number;
            recoveryTime: number;
            regenRate: number;
            regenTime: number;
        };
        input: {
            brokenRegenRate: number;
            distributorDraw: number;
            regenRate: number;
            strength: number;
            systemsCapacity: number;
            systemsRecharge: number;
        };
        invalidStrength: {
            expectedError: string;
            input: {
                brokenRegenRate: number;
                distributorDraw: number;
                regenRate: number;
                strength: number;
                systemsCapacity: number;
                systemsRecharge: number;
            };
        };
        pipAllocation: {
            expected: {
                brokenRegenRate: number;
                recoveryTime: number;
                regenRate: number;
                regenTime: number;
            };
            input: {
                brokenRegenRate: number;
                distributorDraw: number;
                regenRate: number;
                strength: number;
                systemsCapacity: number;
                systemsPips: number;
                systemsRecharge: number;
            };
        };
    };
    slotRemoval: {
        expected: {
            immovableReason: string;
            key: string;
            kind: string;
            removable: boolean;
            size: number;
        };
        ship: string;
    };
    weapons: {
        expectedThermalLoad: number;
        input: {
            thermalLoad: number;
        }[];
    };
    weaponsCapacitor: {
        expected: {
            capacity: number;
            netDrainRate: number;
            rechargeRate: number;
            sustainedEnergyPerSecond: number;
            timeToDrain: number;
            weaponsPips: number;
        };
        input: {
            sustainedEnergyPerSecond: number;
            weaponsCapacity: number;
            weaponsPips: number;
            weaponsRecharge: number;
        };
    };
};

declare module '*/fixtures/ships/operations.jsonc' {
    const value: FixtureShipsOperations;
    export default value;
}

type FixtureShipsPreEngineered = {
    authoredStats: {
        count: number;
        note: string;
    };
    burstIntervalVariants: {
        count: number;
        variants: {
            blueprint: string;
            burstInterval: number;
            experimental: string | null;
            grade: number;
            rateOfFire: number;
            stockBurstInterval: number;
            symbol: string;
        }[];
    };
    count: number;
    counts: {
        communityGoal: number;
        mercenary: number;
        techBroker: number;
    };
    engineeringLocked: {
        count: number;
        symbols: string[];
    };
    fullyUnresolved: {
        count: number;
        note: string;
        symbols: never[];
    };
    identification: {
        description: string;
        matches: {
            acquisition: string;
            appliedExperimental?: string;
            blueprint: string;
            experimental?: string;
            grade: number;
            slot: string;
            source: string;
            symbol: string;
        }[];
        notMatches: {
            slot: string;
            source: string;
        }[];
        omittedBakedExperimental: {
            expectedThermalLoad: number;
            note: string;
            omitted: string;
            reportedInstead: {
                Label: string;
                OriginalValue: number;
                Value: number;
            };
            slot: string;
            source: string;
        };
    };
    joins: {
        everyBlueprintIsAKnownBlueprint: boolean;
        everyExperimentalIsAKnownEffect: boolean;
        everyMercenaryBlueprintStartsAtGradeTwo: boolean;
        everyRewardGradeIsARealGrade: boolean;
        everySymbolIsAKnownModule: boolean;
    };
    maxModifierDecimalPlaces: number;
    mercCoin: {
        cheapest: number;
        dearest: number;
        total: number;
    };
    modifierCounts: {
        withMercCoinCost: number;
        withModifiers: number;
        withoutModifiers: number;
    };
    modifierLabels: string[];
    multiVariant: {
        blueprints: string[];
        symbol: string;
    };
    notPreEngineered: string[];
    records: {
        acquisition: string;
        blueprint: string;
        engineeringLocked?: boolean;
        experimental?: string;
        grade: number;
        mercCoinCost?: number;
        modifiers?: {
            label: string;
            method: string;
            value: number;
        }[];
        name: string;
        symbol: string;
    }[];
    resolved: {
        fragmentCannonDoubleShot: {
            base: {
                ammoMaximum: number;
                clipSize: number;
            };
            blueprint: string;
            engineered: {
                ammoMaximum: number;
                burstRounds: number;
                clipSize: number;
            };
            grade: number;
            note: string;
            symbol: string;
        };
        fsdV1Size5: {
            base: {
                fsdHeatRate: number;
                integrity: number;
                mass: number;
                optMass: number;
            };
            blueprint: string;
            engineered: {
                fsdHeatRate: number;
                integrity: number;
                mass: number;
                optMass: number;
            };
            symbol: string;
            unresolved: never[];
        };
        guardianShardMediumG1: {
            base: {
                ammoMaximum: number;
                armourPiercing: number;
                clipSize: number;
                damage: number;
                distributorDraw: number;
                falloffRange: number;
                jitter: number;
                mass: number;
                maximumRange: number;
                powerDraw: number;
                rateOfFire: number;
                roundsPerShot: number;
                shotSpeed: number;
                thermalLoad: number;
            };
            blueprint: string;
            displayed: {
                ammoMaximum: number;
                armourPiercing: number;
                clipSize: number;
                damage: number;
                damagePerSecond: number;
                damageType: string;
                distributorDraw: number;
                falloffRange: number;
                jitter: number;
                mass: number;
                maximumRange: number;
                powerDraw: number;
                rateOfFire: number;
                shotSpeed: number;
                thermalLoad: number;
            };
            displayedChanges: {
                armourPiercingPercent: number;
                distributorDrawPercent: number;
                falloffRangePercent: number;
                jitterDegrees: number;
                massPercent: number;
                maximumRangePercent: number;
                powerDrawPercent: number;
                shotSpeedPercent: number;
                thermalLoadPercent: number;
            };
            engineered: {
                ammoMaximum: number;
                armourPiercing: number;
                clipSize: number;
                damage: number;
                distributorDraw: number;
                falloffRange: number;
                jitter: number;
                mass: number;
                maximumRange: number;
                powerDraw: number;
                rateOfFire: number;
                roundsPerShot: number;
                shotSpeed: number;
                thermalLoad: number;
            };
            grade: number;
            note: string;
            symbol: string;
            unresolved: never[];
        };
        guardianShardMediumLongRange: {
            blueprint: string;
            engineered: {
                falloffRange: number;
                maximumRange: number;
                shotSpeed: number;
            };
            grade: number;
            symbol: string;
        };
    };
    sameBlueprintTwice: {
        blueprint: string;
        experimentals: string[];
        symbol: string;
    };
    sameTripleDifferentGrade: {
        acquisitions: string[];
        blueprint: string;
        grades: number[];
        symbol: string;
    };
};

declare module '*/fixtures/ships/pre-engineered.jsonc' {
    const value: FixtureShipsPreEngineered;
    export default value;
}

type FixtureShipsShips = {
    count: number;
    displayNameCorrections: {
        name: string;
        symbol: string;
    }[];
    lookups: {
        by: string;
        name?: string;
        query: string;
        symbol?: string;
    }[];
    records: {
        entitlement?: string;
        manufacturer: string;
        name: string;
        size: string;
        symbol: string;
    }[];
};

declare module '*/fixtures/ships/ships.jsonc' {
    const value: FixtureShipsShips;
    export default value;
}

type FixtureShipsShipSlots = {
    count: number;
    keys: {
        Anaconda: string[];
        Asp_Scout: string[];
        Explorer_NX: string[];
        Federation_Dropship: string[];
        Independant_Trader: string[];
        LakonMiner: string[];
        MediumTransport01: string[];
        PantherMkII: string[];
        Type7: string[];
        Type8: string[];
        Type9: string[];
        Type9_Military: string[];
        Vulture: string[];
    };
    planetaryApproachSuiteCount: number;
    restrictions: {
        accepts: string[];
        rejects: string[];
        restriction: string | null;
        ship: string;
        slot: string;
    }[];
    spot: {
        core: {
            frameShiftDrive: number;
            fuelTank: number;
            lifeSupport: number;
            powerDistributor: number;
            powerPlant: number;
            sensors: number;
            thrusters: number;
        };
        hardpoints: {
            name?: string;
            restriction?: string;
            size: number;
        }[];
        optional: {
            name?: string;
            restriction?: string;
            size: number;
        }[];
        symbol: string;
        utility: number;
    }[];
};

declare module '*/fixtures/ships/ship-slots.jsonc' {
    const value: FixtureShipsShipSlots;
    export default value;
}

type FixtureShipsShipStats = {
    count: number;
    heatDissipation: {
        maximum: {
            heatDissipation: number;
            symbol: string;
        };
        minimum: {
            heatDissipation: number;
            symbol: string;
        };
        values: {
            heatDissipation: number;
            symbol: string;
        }[];
    };
    inGameCorrections: {
        baseShieldStrength?: number;
        boost?: number;
        heatCapacity?: number;
        masslock?: number;
        maximumSpeed?: number;
        pitch?: number;
        reserveFuelCapacity?: number;
        roll?: number;
        symbol: string;
        yaw?: number;
    }[];
    pricedCount: number;
    prices: {
        hullCost: number;
        retailCost: number;
        symbol: string;
    }[];
    rotationEndpoints: {
        minPitch: number;
        minRoll: number;
        minYaw: number;
        pitch: number;
        roll: number;
        symbol: string;
        yaw: number;
    }[];
    speedEndpoints: {
        maximumSpeed: number;
        minimumSpeed: number;
        symbol: string;
    }[];
    spot: {
        baseArmour: number;
        baseShieldStrength: number;
        boost: number;
        crew: number;
        hardness: number;
        heatCapacity: number;
        heatDissipation: number;
        hullMass: number;
        masslock: number;
        maximumSpeed: number;
        minPitch: number;
        minRoll: number;
        minYaw: number;
        minimumSpeed: number;
        pitch: number;
        reserveFuelCapacity: number;
        roll: number;
        symbol: string;
        yaw: number;
    }[];
};

declare module '*/fixtures/ships/ship-stats.jsonc' {
    const value: FixtureShipsShipStats;
    export default value;
}

type FixtureShipsSlefInaraCutterAntixeno = {
    data: {
        HullValue: number;
        Modules: {
            Engineering?: {
                BlueprintName: string;
                ExperimentalEffect?: string;
                Level: number;
                Quality: number;
            };
            Item: string;
            On: boolean;
            Priority?: number;
            Slot: string;
            Value?: number;
        }[];
        ModulesValue: number;
        Rebuy: number;
        Ship: string;
        ShipID: number;
        ShipIdent: string;
        ShipName: string;
    };
    header: {
        appName: string;
        appVersion: string;
    };
}[];

declare module '*/fixtures/ships/slef-inara-cutter-antixeno.jsonc' {
    const value: FixtureShipsSlefInaraCutterAntixeno;
    export default value;
}

type FixtureShipsSlefInaraLynxHighliner = {
    data: {
        Modules: {
            Engineering?: {
                BlueprintName: string;
                ExperimentalEffect?: string;
                Level: number;
                Quality: number;
            };
            Item: string;
            On: boolean;
            Priority?: number;
            Slot: string;
            Value?: number;
        }[];
        ModulesValue: number;
        Rebuy: number;
        Ship: string;
        ShipID: number;
        ShipIdent: string;
        ShipName: string;
    };
    header: {
        appName: string;
        appVersion: string;
    };
}[];

declare module '*/fixtures/ships/slef-inara-lynx-highliner.jsonc' {
    const value: FixtureShipsSlefInaraLynxHighliner;
    export default value;
}

type FixtureShipsSlefInaraPantherMkii = {
    data: {
        Modules: {
            Engineering?: {
                BlueprintName: string;
                ExperimentalEffect?: string;
                Level: number;
                Quality: number;
            };
            Item: string;
            On: boolean;
            Priority?: number;
            Slot: string;
            Value?: number;
        }[];
        ModulesValue: number;
        Rebuy: number;
        Ship: string;
        ShipID: number;
        ShipIdent: string;
        ShipName: string;
    };
    header: {
        appName: string;
        appVersion: string;
    };
}[];

declare module '*/fixtures/ships/slef-inara-panther-mkii.jsonc' {
    const value: FixtureShipsSlefInaraPantherMkii;
    export default value;
}

type FixtureShipsSlefInaraType11 = {
    data: {
        HullValue: number;
        Modules: {
            Engineering?: {
                BlueprintName: string;
                ExperimentalEffect?: string;
                Level: number;
                Quality: number;
            };
            Item: string;
            On: boolean;
            Priority?: number;
            Slot: string;
            Value?: number;
        }[];
        ModulesValue: number;
        Rebuy: number;
        Ship: string;
        ShipID: number;
        ShipIdent: string;
        ShipName: string;
    };
    header: {
        appName: string;
        appVersion: string;
    };
}[];

declare module '*/fixtures/ships/slef-inara-type-11.jsonc' {
    const value: FixtureShipsSlefInaraType11;
    export default value;
}

type FixtureShipsSlefTheDeepBlack = {
    data: {
        CargoCapacity: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        HullValue: number;
        MaxJumpRange: number;
        Modules: {
            Engineering?: {
                BlueprintName: string;
                ExperimentalEffect?: string;
                Level: number;
                Modifiers: {
                    Label: string;
                    OriginalValue: number;
                    Value: number;
                }[];
                Quality: number;
            };
            Item: string;
            On: boolean;
            Priority: number;
            Slot: string;
            Value?: number;
        }[];
        ModulesValue: number;
        Rebuy: number;
        Ship: string;
        ShipIdent: string;
        ShipName: string;
        UnladenMass: number;
        event: string;
    };
    header: {
        appName: string;
        appURL: string;
        appVersion: number;
    };
}[];

declare module '*/fixtures/ships/slef-the-deep-black.jsonc' {
    const value: FixtureShipsSlefTheDeepBlack;
    export default value;
}

type FixtureShipsSlefExport = {
    assembled: {
        fit: {
            FrameShiftDrive: string;
            FuelTank: string;
        };
        modules: {
            Item: string;
            Slot: string;
            Value: number;
        }[];
        modulesWithExplicitPower: {
            Item: string;
            On: boolean;
            Priority: number;
            Slot: string;
            Value: number;
        }[];
        note: string;
        omittedKeys: string[];
        recomputed: {
            CargoCapacity: number;
            FuelCapacity: {
                Main: number;
                Reserve: number;
            };
            HullValue: number;
            MaxJumpRange: number;
            ModulesValue: number;
            Rebuy: number;
            Ship: string;
            UnladenMass: number;
        };
        ship: string;
        topLevelKeys: string[];
        valueNote: string;
    };
    classification: {
        examples: {
            item: string;
            slot: string;
            verdict: string;
            why: string;
        }[];
        nonOutfittingSlotPattern: string;
        note: string;
        outfittingSlotPatterns: string[];
        patternsMatchLowerCasedSlot: boolean;
    };
    deepBlack: {
        afterEdit: {
            item: string;
            note: string;
            recomputed: {
                CargoCapacity: number;
                FuelCapacity: {
                    Main: number;
                    Reserve: number;
                };
                MaxJumpRange: number;
                ModulesValue: number;
                Rebuy: number;
                UnladenMass: number;
            };
            slot: string;
            topLevelKeys: string[];
        };
        build: string;
        discount: {
            moduleDiscount: number;
            note: string;
            sourceHullValue: number;
            sourceModulesValue: number;
            sourceRebuy: number;
        };
        fittedOrder: string[];
        moduleCount: number;
        note: string;
        physicalFiguresMatchSource: string[];
        recomputed: {
            CargoCapacity: number;
            FuelCapacity: {
                Main: number;
                Reserve: number;
            };
            HullValue: number;
            MaxJumpRange: number;
            ModulesValue: number;
            Rebuy: number;
            Ship: string;
            UnladenMass: number;
        };
        slotOrder: string[];
        topLevelKeys: string[];
    };
    engineeringWithoutModifiers: {
        exportInventsEmptyArray: boolean;
        modifiersRequired: boolean;
        note: string;
    };
    journalFieldExclusions: {
        engineering: string[];
        engineeringBuild: string;
        note: string;
        topLevel: string[];
        topLevelBuild: string;
    };
    kraitPhantom: {
        build: string;
        discount: {
            hullRetailCost: number;
            note: string;
            sourceHullValue: number;
            sourceModulesValue: number;
            sourceRebuy: number;
            unpricedInSource: string[];
        };
        journalTolerance: {
            MaxJumpRange: number;
            UnladenMass: number;
            note: string;
        };
        moduleCount: number;
        nonOutfittingSlots: string[];
        note: string;
        recomputed: {
            CargoCapacity: number;
            FuelCapacity: {
                Main: number;
                Reserve: number;
            };
            HullValue: number;
            MaxJumpRange: number;
            ModulesValue: number;
            Rebuy: number;
            Ship: string;
            UnladenMass: number;
        };
        topLevelKeys: string[];
    };
    pythonMkII: {
        ammunition: {
            loaded: {
                AmmoInClip: number;
                AmmoInHopper: number;
                symbol: string;
            }[];
            note: string;
        };
        build: string;
        discount: {
            hullCost: number;
            hullRetailCost: number;
            moduleDiscount: number;
            moduleDiscountToleranceCr: number;
            note: string;
            pricedInSource: number;
            rebuyFromOwnFigures: number;
            sourceHullValue: number;
            sourceModulesValue: number;
            sourceRebuy: number;
            unpricedInSource: string[];
        };
        journalTolerance: {
            MaxJumpRange: number;
            UnladenMass: number;
            note: string;
        };
        moduleCount: number;
        nonOutfittingSlots: string[];
        note: string;
        recomputed: {
            CargoCapacity: number;
            FuelCapacity: {
                Main: number;
                Reserve: number;
            };
            HullValue: number;
            MaxJumpRange: number;
            ModulesValue: number;
            Rebuy: number;
            Ship: string;
            UnladenMass: number;
        };
        topLevelKeys: string[];
    };
    rebuyFraction: number;
    unknownHull: {
        note: string;
        omittedKeys: string[];
        ship: string;
        topLevelKeys: string[];
    };
    viperMkIV: {
        build: string;
        discount: {
            hullCost: number;
            hullRetailCost: number;
            moduleDiscount: number;
            moduleDiscountToleranceCr: number;
            note: string;
            pricedInSource: number;
            rebuyFromOwnFigures: number;
            sourceHullValue: number;
            sourceModulesValue: number;
            sourceRebuy: number;
            unpricedInSource: string[];
        };
        journalTolerance: {
            MaxJumpRange: number;
            UnladenMass: number;
            note: string;
        };
        moduleCount: number;
        nonOutfittingSlots: string[];
        note: string;
        recomputed: {
            CargoCapacity: number;
            FuelCapacity: {
                Main: number;
                Reserve: number;
            };
            HullValue: number;
            MaxJumpRange: number;
            ModulesValue: number;
            Rebuy: number;
            Ship: string;
            UnladenMass: number;
        };
        topLevelKeys: string[];
    };
};

declare module '*/fixtures/ships/slef-export.jsonc' {
    const value: FixtureShipsSlefExport;
    export default value;
}

type FixtureShipsSourcePurchase = {
    captures: {
        caspianExplorer: {
            build: string;
            note: string;
            record: {
                hullValue: null;
                moduleCount: number;
                moduleValues: {
                    item: string;
                    slot: string;
                    value: number;
                }[];
                modulesValue: number;
                pricedModulesValue: number;
                rebuy: number;
            };
            sourceExport: {
                note: string;
                pricedSlots: {
                    FrameShiftDrive: number;
                    LifeSupport: number;
                    MainEngines: number;
                    MediumHardpoint6: number;
                    PowerDistributor: number;
                    PowerPlant: number;
                    Radar: number;
                    Slot01_Size7: number;
                    Slot02_Size6: number;
                    Slot03_Size6: number;
                    Slot04_Size5: number;
                    Slot05_Size5: number;
                    Slot06_Size5: number;
                    Slot08_Size4: number;
                    Slot09_Size4: number;
                    Slot10_Size3: number;
                    Slot12_Size1: number;
                    TinyHardpoint1: number;
                    TinyHardpoint2: number;
                };
                topLevelCredits: {
                    ModulesValue: number;
                    Rebuy: number;
                };
            };
        };
        deepBlack: {
            build: string;
            note: string;
            record: {
                hullValue: number;
                moduleCount: number;
                moduleValues: {
                    item: string;
                    slot: string;
                    value: number;
                }[];
                modulesValue: number;
                pricedModulesValue: number;
                rebuy: number;
            };
            sourceExport: {
                note: string;
                pricedSlots: {
                    Armour: number;
                    FrameShiftDrive: number;
                    FuelTank: number;
                    LifeSupport: number;
                    MainEngines: number;
                    PowerDistributor: number;
                    PowerPlant: number;
                    Radar: number;
                    Slot01_Size7: number;
                    Slot02_Size6: number;
                    Slot03_Size6: number;
                    Slot06_Size5: number;
                    Slot07_Size5: number;
                    Slot08_Size4: number;
                    Slot09_Size4: number;
                    Slot10_Size3: number;
                    Slot13_Size1: number;
                    Slot14_Size1: number;
                    TinyHardpoint5: number;
                    TinyHardpoint6: number;
                };
                topLevelCredits: {
                    HullValue: number;
                    ModulesValue: number;
                    Rebuy: number;
                };
            };
        };
        kraitPhantom: {
            build: string;
            note: string;
            record: {
                hullValue: number;
                moduleCount: number;
                moduleValues: {
                    item: string;
                    slot: string;
                    value: number;
                }[];
                modulesValue: number;
                pricedModulesValue: number;
                rebuy: number;
            };
            sourceExport: {
                note: string;
                pricedSlots: {
                    FrameShiftDrive: number;
                    LifeSupport: number;
                    MainEngines: number;
                    MediumHardpoint1: number;
                    MediumHardpoint2: number;
                    PowerDistributor: number;
                    PowerPlant: number;
                    Radar: number;
                    Slot01_Size6: number;
                    Slot02_Size5: number;
                    Slot03_Size5: number;
                    Slot04_Size5: number;
                    Slot05_Size3: number;
                    Slot06_Size3: number;
                    Slot07_Size3: number;
                    Slot08_Size2: number;
                    TinyHardpoint1: number;
                    TinyHardpoint2: number;
                    TinyHardpoint3: number;
                    TinyHardpoint4: number;
                };
                topLevelCredits: {
                    HullValue: number;
                    ModulesValue: number;
                    Rebuy: number;
                };
            };
        };
        viperMkIV: {
            build: string;
            note: string;
            record: {
                hullValue: number;
                moduleCount: number;
                moduleValues: {
                    item: string;
                    slot: string;
                    value: number;
                }[];
                modulesValue: number;
                pricedModulesValue: number;
                rebuy: number;
            };
            sourceExport: {
                note: string;
                pricedSlots: {
                    FrameShiftDrive: number;
                    FuelTank: number;
                    LifeSupport: number;
                    MainEngines: number;
                    MediumHardpoint1: number;
                    MediumHardpoint2: number;
                    PlanetaryApproachSuite: number;
                    PowerDistributor: number;
                    PowerPlant: number;
                    Radar: number;
                    Slot01_Size4: number;
                    Slot02_Size4: number;
                    Slot03_Size3: number;
                    Slot04_Size2: number;
                    Slot07_Size1: number;
                    Slot08_Size1: number;
                    SmallHardpoint1: number;
                    SmallHardpoint2: number;
                    TinyHardpoint1: number;
                    TinyHardpoint2: number;
                };
                topLevelCredits: {
                    HullValue: number;
                    ModulesValue: number;
                    Rebuy: number;
                };
            };
        };
    };
    editedExports: {
        groups: {
            caspianExplorer: {
                note: string;
                scenarios: {
                    swapAPricedModule: {
                        edits: {
                            setModule: {
                                slot: string;
                                symbol: string;
                            };
                        }[];
                        topLevelCredits: Record<string, never>;
                        unpricedSlots: string[];
                        why: string;
                    };
                };
            };
            deepBlack: {
                note: string;
                scenarios: {
                    engineerAPricedModule: {
                        edits: {
                            applyBlueprint: {
                                blueprint: string;
                                grade: number;
                                slot: string;
                            };
                        }[];
                        topLevelCredits: {
                            HullValue: number;
                            ModulesValue: number;
                            Rebuy: number;
                        };
                        unpricedSlots: never[];
                        why: string;
                    };
                    fillAnEmptyMount: {
                        edits: {
                            setModule: {
                                slot: string;
                                symbol: string;
                            };
                        }[];
                        topLevelCredits: {
                            HullValue: number;
                            ModulesValue: number;
                            Rebuy: number;
                        };
                        unpricedNewSlots: string[];
                        unpricedSlots: never[];
                        why: string;
                    };
                    refitTheSameArticle: {
                        edits: {
                            setModule: {
                                slot: string;
                                symbol: string;
                            };
                        }[];
                        topLevelCredits: {
                            HullValue: number;
                            ModulesValue: number;
                            Rebuy: number;
                        };
                        unpricedSlots: never[];
                        why: string;
                    };
                    removeAPricedModule: {
                        edits: {
                            removeModule: {
                                slot: string;
                            };
                        }[];
                        topLevelCredits: {
                            HullValue: number;
                        };
                        unpricedSlots: string[];
                        why: string;
                    };
                    stripEveryPricedModule: {
                        edits: {
                            removeModule: {
                                slot: string;
                            };
                        }[];
                        topLevelCredits: {
                            HullValue: number;
                        };
                        unpricedSlots: string[];
                        why: string;
                    };
                    swapAPricedModule: {
                        edits: {
                            setModule: {
                                slot: string;
                                symbol: string;
                            };
                        }[];
                        topLevelCredits: {
                            HullValue: number;
                        };
                        unpricedSlots: string[];
                        why: string;
                    };
                };
            };
            partsDoNotAddUp: {
                note: string;
                scenarios: {
                    removeAnUnpricedModule: {
                        edits: {
                            removeModule: {
                                slot: string;
                            };
                        }[];
                        topLevelCredits: {
                            ModulesValue: number;
                        };
                        unpricedSlots: never[];
                        why: string;
                    };
                };
            };
        };
        note: string;
    };
    syntheticCaptures: {
        noCredits: {
            event: {
                Modules: {
                    Item: string;
                    Slot: string;
                }[];
                Ship: string;
            };
            note: string;
            record: null;
        };
        partsDoNotAddUp: {
            event: {
                Modules: {
                    Item: string;
                    Slot: string;
                    Value?: number;
                }[];
                ModulesValue: number;
                Ship: string;
            };
            note: string;
            record: {
                hullValue: null;
                moduleCount: number;
                moduleValues: {
                    item: string;
                    slot: string;
                    value: number;
                }[];
                modulesValue: number;
                pricedModulesValue: number;
                rebuy: null;
            };
        };
        rebuyOnly: {
            event: {
                Modules: {
                    Item: string;
                    Slot: string;
                }[];
                Rebuy: number;
                Ship: string;
            };
            note: string;
            record: {
                hullValue: null;
                moduleCount: number;
                moduleValues: never[];
                modulesValue: null;
                pricedModulesValue: number;
                rebuy: number;
            };
        };
        repeatedSlotKey: {
            event: {
                Modules: {
                    Item: string;
                    Slot: string;
                    Value: number;
                }[];
                Ship: string;
            };
            note: string;
            record: {
                hullValue: null;
                moduleCount: number;
                moduleValues: {
                    item: string;
                    slot: string;
                    value: number;
                }[];
                modulesValue: null;
                pricedModulesValue: number;
                rebuy: null;
            };
        };
    };
};

declare module '*/fixtures/ships/source-purchase.jsonc' {
    const value: FixtureShipsSourcePurchase;
    export default value;
}
