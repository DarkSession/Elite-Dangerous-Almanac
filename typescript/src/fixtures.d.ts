/**
 * Types the shared fixture imports under `fixtures/`.
 *
 * The fixtures carry their provenance in a comment header, which makes them JSONC, and
 * TypeScript cannot infer a JSONC file's shape the way `resolveJsonModule` does for
 * `.json`. Each fixture therefore declares the payload it holds here, so a test reads a
 * typed value rather than casting `unknown` at every import. The declarations are
 * patterns, because an ambient module declaration cannot name a relative path.
 *
 * These are the shapes the checked-in fixtures actually hold. A fixture that gains or
 * loses a field is updated here in the same change; a test reading a field this file does
 * not declare fails to compile, which is how the two stay in step. Nothing here exists at
 * runtime, and no shipped module imports a fixture — the loader that reads them is the
 * same `scripts/jsonc.mjs` the `data/` catalogues go through.
 */

declare module '*/fixtures/astro/galactic-region.jsonc' {
    const value: {
        coords: {
            name: string;
            x: number;
            z: number;
            regionId: number;
            region: string;
        }[];
        boxels: {
            name: string;
            id64: string;
            x: number;
            y: number;
            z: number;
            regionId: number;
            region: string;
        }[];
    };
    export default value;
}

declare module '*/fixtures/astro/hand-authored-regions.jsonc' {
    const value: {
        systems: {
            name: string;
            id64: string;
            coords: {
                x: number;
                y: number;
                z: number;
            };
            proceduralName?: string;
            needsPermit: boolean;
            source?: string;
        }[];
        regionForCoords: {
            coords: {
                x: number;
                y: number;
                z: number;
            };
            region: string | null;
        }[];
    };
    export default value;
}

declare module '*/fixtures/astro/nebulae.jsonc' {
    const value: {
        counts: {
            real: number;
            planetary: number;
            procgen: number;
            all: number;
        };
        records: {
            catalogue: string;
            name: string;
            system: string;
            x: number;
            y: number;
            z: number;
            type: string;
            regionId: number;
        }[];
        nearest: {
            origin: string;
            from: {
                x: number;
                y: number;
                z: number;
            };
            catalogue: string;
            count: number;
            expect: {
                name: string;
                system: string;
                distanceLy: number;
            }[];
        }[];
        within: {
            origin: string;
            from: {
                x: number;
                y: number;
                z: number;
            };
            radiusLy: number;
            catalogue: string;
            expect: {
                name: string;
                distanceLy: number;
            }[];
        }[];
    };
    export default value;
}

declare module '*/fixtures/astro/permit-locks.jsonc' {
    const value: {
        counts: {
            systems: number;
            regions: number;
        };
        cases: {
            name: string;
            lock: {
                kind: string;
                name: string;
                id64?: string;
            } | null;
            coords?: {
                x: number;
                y: number;
                z: number;
            };
            comment?: string;
        }[];
    };
    export default value;
}

declare module '*/fixtures/astro/system-addresses.jsonc' {
    const value: {
        systems: {
            id64: string;
            name: string;
            region: string;
            l1: string;
            l2: string;
            l3: string;
            massCode: string;
            n1: number;
            n2: number;
        }[];
    };
    export default value;
}

declare module '*/fixtures/commodities/commodities.jsonc' {
    const value: {
        counts: {
            standard: number;
            rare: number;
            all: number;
        };
        categories: string[];
        records: {
            symbol: string;
            name: string;
            category: string;
            rare: boolean;
        }[];
        categoryCounts: {
            Metals: number;
            Foods: number;
            Salvage: number;
            'Legal Drugs': number;
        };
    };
    export default value;
}

declare module '*/fixtures/materials/materials.jsonc' {
    const value: {
        counts: {
            raw: number;
            manufactured: number;
            encoded: number;
            all: number;
        };
        records: {
            category: string;
            symbol: string;
            name: string;
            elementSymbol: string | null;
            grade: number;
            line: string;
        }[];
        lineGrades: {
            catalogue: string;
            line: string;
            grades: number[];
        }[];
        notInFdevIds: string[];
    };
    export default value;
}

declare module '*/fixtures/materials/micro-resources.jsonc' {
    const value: {
        counts: {
            component: number;
            consumable: number;
            data: number;
            item: number;
            all: number;
        };
        records: {
            symbol: string;
            category: string;
            name: string;
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/build-metrics.jsonc' {
    const value: {
        inGame: {
            federalCorvetteBeams: {
                build: string;
                note: string;
                jumpRange: {
                    fullTank: number;
                };
                speed: {
                    top: number;
                    boost: number;
                    pitch: number;
                    roll: number;
                    yaw: number;
                };
                power: {
                    available: number;
                    retracted: number;
                    deployed: number;
                    includesDisabledModules: boolean;
                };
                shields: {
                    strength: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                    regeneration: {
                        standard: number;
                        broken: number;
                    };
                };
                mass: {
                    current: number;
                    maximum: number;
                };
                armour: {
                    hitPoints: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                };
            };
            cobraMkV: {
                build: string;
                note: string;
                jumpRange: {
                    fullTank: number;
                };
                speed: {
                    top: number;
                    boost: number;
                    pitch: number;
                    roll: number;
                    yaw: number;
                };
                power: {
                    available: number;
                    retracted: number;
                    deployed: number;
                    includesDisabledModules: boolean;
                };
                offense: {
                    damagePerSecond: number;
                    distributorDraw: number;
                    thermalLoad: number;
                };
                shields: {
                    strength: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                    regeneration: {
                        standard: number;
                        broken: number;
                    };
                };
                mass: {
                    current: number;
                    maximum: number;
                };
                armour: {
                    hitPoints: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                };
            };
            kestrelMkII: {
                build: string;
                observedShipName: string;
                note: string;
                jumpRange: {
                    fullTank: number;
                };
                speed: {
                    top: number;
                    boost: number;
                    pitch: number;
                    roll: number;
                    yaw: number;
                };
                power: {
                    available: number;
                    retracted: number;
                    deployed: number;
                    includesDisabledModules: boolean;
                };
                offense: {
                    damagePerSecond: number;
                    distributorDraw: number;
                    thermalLoad: number;
                };
                shields: {
                    strength: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                    regeneration: {
                        standard: number;
                        broken: number;
                    };
                };
                mass: {
                    current: number;
                    maximum: number;
                };
                armour: {
                    hitPoints: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                };
            };
            deepBlack: {
                build: string;
                note: string;
                jumpRange: {
                    fullTank: number;
                };
                speed: {
                    top: number;
                    boost: number;
                    pitch: number;
                    roll: number;
                    yaw: number;
                };
                power: {
                    available: number;
                    retracted: number;
                    deployed: number;
                    includesDisabledModules: boolean;
                };
                offense: {
                    damagePerSecond: number;
                    distributorDraw: number;
                    thermalLoad: number;
                };
                shields: {
                    strength: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                    regeneration: {
                        standard: number;
                        broken: number;
                    };
                };
                mass: {
                    current: number;
                    maximum: number;
                };
                armour: {
                    hitPoints: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                };
            };
            rescue: {
                build: string;
                note: string;
                jumpRange: {
                    fullTank: number;
                };
                speed: {
                    top: number;
                    boost: number;
                    pitch: number;
                    roll: number;
                    yaw: number;
                };
                power: {
                    available: number;
                    retracted: number;
                    deployed: number;
                    includesDisabledModules: boolean;
                };
                offense: {
                    damagePerSecond: number;
                    distributorDraw: number;
                    thermalLoad: number;
                };
                shields: {
                    strength: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                    regeneration: {
                        standard: number;
                        broken: number;
                    };
                };
                mass: {
                    current: number;
                    maximum: number;
                };
                armour: {
                    hitPoints: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                };
            };
            rescue01: {
                build: string;
                note: string;
                jumpRange: {
                    fullTank: number;
                };
                speed: {
                    top: number;
                    boost: number;
                    pitch: number;
                    roll: number;
                    yaw: number;
                };
                power: {
                    available: number;
                    retracted: number;
                    deployed: number;
                    includesDisabledModules: boolean;
                };
                offense: {
                    damagePerSecond: number;
                    distributorDraw: number;
                    thermalLoad: number;
                };
                shields: {
                    strength: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                    regeneration: {
                        standard: number;
                        broken: number;
                    };
                };
                mass: {
                    current: number;
                    maximum: number;
                };
                armour: {
                    hitPoints: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                };
            };
            fatArse: {
                build: string;
                note: string;
                jumpRange: {
                    fullTank: number;
                };
                speed: {
                    top: number;
                    boost: number;
                    pitch: number;
                    roll: number;
                    yaw: number;
                };
                power: {
                    available: number;
                    retracted: number;
                    deployed: number;
                    includesDisabledModules: boolean;
                };
                offense: {
                    damagePerSecond: number;
                    distributorDraw: number;
                    thermalLoad: number;
                };
                shields: {
                    strength: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                    regeneration: {
                        standard: number;
                        broken: number;
                    };
                };
                mass: {
                    current: number;
                    maximum: number;
                };
                armour: {
                    hitPoints: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                };
            };
            theFixer: {
                build: string;
                note: string;
                jumpRange: {
                    fullTank: number;
                };
                speed: {
                    top: number;
                    boost: number;
                    pitch: number;
                    roll: number;
                    yaw: number;
                };
                power: {
                    available: number;
                    retracted: number;
                    deployed: number;
                    includesDisabledModules: boolean;
                };
                offense: {
                    damagePerSecond: number;
                    distributorDraw: number;
                    thermalLoad: number;
                };
                shields: {
                    strength: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                    regeneration: {
                        standard: number;
                        broken: number;
                    };
                };
                mass: {
                    current: number;
                    maximum: number;
                };
                armour: {
                    hitPoints: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                };
            };
            spireOps: {
                build: string;
                note: string;
                jumpRange: {
                    fullTank: number;
                };
                speed: {
                    top: number;
                    boost: number;
                    pitch: number;
                    roll: number;
                    yaw: number;
                };
                power: {
                    available: number;
                    retracted: number;
                    deployed: number;
                    includesDisabledModules: boolean;
                };
                offense: {
                    damagePerSecond: number;
                    distributorDraw: number;
                    thermalLoad: number;
                };
                shields: {
                    strength: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                    regeneration: {
                        standard: number;
                        broken: number;
                    };
                };
                mass: {
                    current: number;
                    maximum: number;
                };
                armour: {
                    hitPoints: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                };
            };
            slapaconda: {
                build: string;
                note: string;
                jumpRange: {
                    fullTank: number;
                };
                speed: {
                    top: number;
                    boost: number;
                    pitch: number;
                    roll: number;
                    yaw: number;
                };
                power: {
                    available: number;
                    retracted: number;
                    deployed: number;
                    includesDisabledModules: boolean;
                };
                offense: {
                    damagePerSecond: number;
                    distributorDraw: number;
                    thermalLoad: number;
                };
                shields: {
                    strength: number;
                };
                mass: {
                    current: number;
                    maximum: number;
                };
                armour: {
                    hitPoints: number;
                    resistances: {
                        kinetic: number;
                        thermal: number;
                        explosive: number;
                    };
                };
            };
        };
        deepBlack: {
            build: string;
            power: {
                available: number;
                retracted: number;
                deployed: number;
                headroom: number;
                withinBudget: boolean;
            };
            shields: {
                strength: number;
                massCurveMultiplier: number;
                resistances: {
                    kinetic: number;
                    thermal: number;
                    explosive: number;
                    caustic: number;
                };
                effectiveHitPoints: {
                    kinetic: number;
                    thermal: number;
                    explosive: number;
                    caustic: number;
                };
            };
            armour: {
                hitPoints: number;
                bulkheads: number;
                reinforcement: number;
                resistances: {
                    kinetic: number;
                    thermal: number;
                    explosive: number;
                    caustic: number;
                };
                effectiveHitPoints: {
                    kinetic: number;
                    thermal: number;
                    explosive: number;
                    caustic: number;
                };
            };
            weaponCount: number;
        };
        anaconda: {
            modules: {
                PowerPlant: string;
                Armour: string;
                Slot01_Size7: string;
                TinyHardpoint1: string;
                TinyHardpoint2: string;
                Military01: string;
                Slot02_Size6: string;
                HugeHardpoint1: string;
                LargeHardpoint1: string;
            };
            power: {
                available: number;
                retracted: number;
                deployed: number;
                bands: {
                    priority: number;
                    retracted: number;
                    deployed: number;
                    deployedTotal: number;
                    poweredDeployed: boolean;
                }[];
            };
            shields: {
                strength: number;
                generator: number;
                boosters: number;
                boostMultiplier: number;
                massCurveMultiplier: number;
                resistances: {
                    kinetic: number;
                    thermal: number;
                    explosive: number;
                    caustic: number;
                };
                resistancesAtFourPips: {
                    kinetic: number;
                    thermal: number;
                    explosive: number;
                    caustic: number;
                };
                effectiveHitPoints: {
                    kinetic: number;
                    thermal: number;
                    explosive: number;
                    caustic: number;
                };
            };
            armour: {
                hitPoints: number;
                bulkheads: number;
                reinforcement: number;
                resistances: {
                    kinetic: number;
                    thermal: number;
                    explosive: number;
                    caustic: number;
                };
                effectiveHitPoints: {
                    kinetic: number;
                    thermal: number;
                    explosive: number;
                    caustic: number;
                };
                moduleArmour: number;
                moduleProtection: number;
            };
            weapons: {
                damagePerSecond: number;
                sustainedDamagePerSecond: number;
                energyPerSecond: number;
                heatPerSecond: number;
                powerDraw: number;
                kineticDamagePerSecond: number;
                thermalDamagePerSecond: number;
            };
        };
        weapons: {
            symbol: string;
            damagePerSecond: number;
            sustainedDamagePerSecond: number;
            sustainedFireFactor: number;
            energyPerSecond: number;
            heatPerSecond: number;
            continuous: boolean;
        }[];
        observedGuardianShardCannons: {
            note: string;
            blueprint: string;
            grade: number;
            active: boolean;
            records: {
                symbol: string;
                class: number;
                mass: number;
                integrity: number;
                powerDraw: number;
                damagePerSecond: number;
                damage: number;
                distributorDraw: number;
                thermalLoad: number;
                armourPiercing: number;
                maximumRange: number;
                shotSpeed: number;
                rateOfFire: number;
                clipSize: number;
                ammoMaximum: number;
                damageType: string;
                falloffRange: number;
            }[];
        };
        ammunition: {
            note: string;
            catalogue: {
                symbol: string;
                clipSize: number;
                hopper: number | null;
                total: number | null;
                unlimited: boolean;
                note?: string;
            }[];
            noAmmunition: string[];
            journalReadings: {
                note: string;
                readings: number;
                distinctModules: number;
                atCapacity: number;
                belowCapacity: unknown[];
            };
            engineered: {
                note: string;
                rolls: {
                    note: string;
                    slot: string;
                    module: string;
                    blueprint: string;
                    grade: number;
                    stock: {
                        clipSize: number;
                        hopper: number;
                        total: number;
                    };
                    clipSize: number;
                    hopper: number;
                    total: number;
                    burstRounds?: number;
                    experimental?: string;
                }[];
            };
            engineeredGroundTruth: {
                note: string;
                cases: {
                    capture: string;
                    ship: string;
                    slot: string;
                    symbol: string;
                    blueprint: string;
                    grade: number;
                    quality: number;
                    experimental: string | null;
                    base: {
                        clipSize: number;
                        ammoMaximum: number;
                    };
                    game: {
                        ammoMaximum: number;
                        loadedClip: number;
                        loadedHopper: number;
                        clipSize?: number;
                    };
                    simulated: {
                        ammoMaximum: number;
                        clipSize?: number;
                    };
                    agrees: boolean;
                    preEngineered?: boolean;
                    reportedQuality?: number;
                    note?: string;
                    legacyEngineering?: boolean;
                }[];
                recomputed: {
                    note: string;
                    unladenMass: number;
                    journalUnladenMass: number;
                    maxJumpRange: number;
                    journalMaxJumpRange: number;
                    cargoCapacity: number;
                };
            };
        };
        functions: {
            powerBudget: {
                available: number;
                consumers: {
                    draw: number;
                    priority: number;
                    deployedOnly?: boolean;
                }[];
                retracted: number;
                deployed: number;
                bands: {
                    priority: number;
                    retracted: number;
                    deployed: number;
                    retractedTotal: number;
                    deployedTotal: number;
                    poweredRetracted: boolean;
                    poweredDeployed: boolean;
                }[];
            };
            powerBudgetUnknownDraw: {
                note: string;
                available: number;
                consumers: {
                    draw: number;
                    priority: number;
                    label: string;
                    drawUnknown?: boolean;
                }[];
                retracted: number;
                deployed: number;
                headroom: number;
                withinBudget: boolean;
                unknownDraws: {
                    draw: number;
                    drawUnknown: boolean;
                    priority: number;
                    label: string;
                }[];
            };
            stackShieldResistance: {
                generator: number;
                boosters: number[];
                expected: number;
            }[];
            stackArmourResistance: {
                bulkhead: number;
                reinforcements: number[];
                expected: number;
            }[];
            systemsResistance: {
                pips: number;
                expected: number;
            }[];
            damageFalloff: {
                maximumRange: number;
                falloffRange: number;
                metres: number;
                expected: number;
            }[];
            armourPiercingFactor: {
                armourPiercing: number;
                hardness: number;
                expected: number;
            }[];
        };
    };
    export default value;
}

declare module '*/fixtures/ships/builds/index.jsonc' {
    const value: {
        count: number;
        declaredEngineering: number;
        builds: {
            id: string;
            ship: string;
            role: string;
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/engineering-options.jsonc' {
    const value: {
        counts: {
            groups: number;
            modules: number;
            exclusions: number;
            modulesWithoutExperimental: number;
            blueprintsOffered: number;
        };
        groupSizes: {
            powerPlants: number;
            guardianPowerPlants: number;
            thrusters: number;
            frameShiftDrives: number;
            powerDistributors: number;
            guardianPowerDistributors: number;
            frameShiftDrivesSCO: number;
            shieldGenerators: number;
            shieldCellBanks: number;
            hullReinforcements: number;
            guardianHullReinforcements: number;
            pulseLasers: number;
            burstLasers: number;
            beamLasers: number;
            cannons: number;
            fragmentCannons: number;
            multiCannons: number;
            plasmaAccelerators: number;
            railGuns: number;
            missiles: number;
            mines: number;
            torpedoes: number;
            miningToolsLasers: number;
            antiXenoMultiCannons: number;
            shieldBoosters: number;
            bulkheads: number;
            lifeSupports: number;
            sensors: number;
            autoFieldMaintenanceUnits: number;
            cargoRacks: number;
            collectionLimpets: number;
            fsdBoosters: number;
            fsdInterdictors: number;
            fuelScoops: number;
            fuelTransferLimpets: number;
            hatchBreakerLimpets: number;
            moduleReinforcements: number;
            prospectingLimpets: number;
            refineries: number;
            shieldReinforcements: number;
            surfaceScanners: number;
            chaffLaunchers: number;
            ecms: number;
            heatSinkLaunchers: number;
            killWarrantScanners: number;
            manifestScanners: number;
            pointDefence: number;
            wakeScanners: number;
            experimentalWeapons: number;
            antiXenoMissileRacks: number;
            guardianGauss: number;
            guardianPlasma: number;
            guardianShard: number;
        };
        groups: {
            id: string;
            name: string;
            blueprints: string[];
            experimentals: string[];
        }[];
        modules: {
            symbol: string;
            group: string;
        }[];
        notEngineerable: string[];
        splitFamilies: {
            description?: string;
            ordinary: {
                group: string;
                symbol: string;
                blueprints: string[];
                experimentals: string[];
            };
            guardian: {
                group: string;
                symbol: string;
                blueprints: string[];
                experimentals: unknown[];
            };
        }[];
        exclusions: {
            symbol: string;
            excluded: string[];
        }[];
        blueprintUnion: {
            blueprint: string;
            experimentals: string[];
        };
        antiGuardianZoneResistance: {
            description: string;
            blueprint: string;
            experimentals: unknown[];
            groups: string[];
            modules: string[];
        };
        corpus: {
            description: string;
            declaredEngineering: number;
            ungroupedEntries: number;
            aliasSpellingsAccepted: number;
            journalSpellingsAccepted: number;
            finalPreEngineeredEntries: number;
            blueprintAliases: {
                Misc_LightWeight: string[];
                Misc_Reinforced: string[];
                Misc_Shielded: string[];
            };
            finalPreEngineered: {
                symbol: string;
                blueprint: string;
                entries: number;
                experimental?: string;
            }[];
            notEngineerable: {
                symbol: string;
                blueprint: string;
                entries: number;
            }[];
        };
    };
    export default value;
}

declare module '*/fixtures/ships/engineering.jsonc' {
    const value: {
        anchor: {
            blueprint: string;
            grade: number;
            quality: number;
            experimental: string;
            base: {
                FSDOptimalMass: number;
                Mass: number;
                Integrity: number;
                PowerDraw: number;
            };
            expected: {
                FSDOptimalMass: number;
                Mass: number;
                Integrity: number;
                PowerDraw: number;
            };
        };
        preEngineeredClimb: {
            description: string;
            symbol: string;
            blueprint: string;
            soldAtGrade: number;
            gradeUnavailable: number;
            grade: number;
            quality: number;
            base: {
                DamageProtection: number;
                Integrity: number;
                Mass: number;
            };
            expected: {
                DamageProtection: number;
                Integrity: number;
                Mass: number;
            };
        };
        scannerIdCollision: {
            description: string;
            grade: number;
            quality: number;
            cases: {
                symbol: string;
                blueprint: string;
                resolved: string;
                base: {
                    Mass: number;
                    PowerDraw: number;
                    ScannerRange: number;
                    SensorTargetScanAngle: number;
                    ScannerTimeToScan?: number;
                };
                modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                }[];
            }[];
            refused: {
                symbol: string;
                blueprint: string;
            }[];
        };
        overchargedIdCollision: {
            description: string;
            grade: number;
            quality: number;
            cases: {
                symbol: string;
                blueprint: string;
                resolved: string;
                base: {
                    Damage: number;
                    AmmoClipSize: number;
                    DistributorDraw: number;
                    ThermalLoad: number;
                };
                modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                }[];
            }[];
            refused: {
                symbol: string;
                blueprint: string;
            }[];
        };
        clipRounding: {
            description: string;
            cases: {
                note: string;
                symbol: string;
                blueprint: string;
                grade: number;
                quality: number;
                baseAmmoClipSize: number;
                unroundedAmmoClipSize: number;
                burstSize: number;
                burstFrom: string;
                AmmoClipSize: number;
                AmmoMaximum?: number;
            }[];
        };
        journalSpellings: {
            description: string;
            cases: {
                symbol: string;
                blueprint: string;
                resolved: string;
                note?: string;
            }[];
            operationsKeys: {
                description: string;
                prefixed: string[];
                observed: {
                    symbol: string;
                    blueprint: string;
                    grade: number;
                    soldAtGrade: number;
                }[];
            };
        };
        decorativeModifications: {
            description: string;
            module: string;
            ids: {
                id: string;
                name: string;
            }[];
            modifiers: {
                label: string;
                method: string;
                value: number;
            }[];
            resolved: {
                description: string;
                baseDamage: number;
                damage: number;
                damagePerSecond: number;
                panel: {
                    percent: number;
                    damage: number;
                    damagePerSecond: number;
                };
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
        reachability: {
            description: string;
            reachable: {
                id: string;
                accepts: string;
                refuses: string;
                modules: number;
            }[];
            unreachableBlueprints: unknown[];
            unreachableExperimentals: unknown[];
        };
        guardianZoneResistanceCapability: {
            description: string;
            field: string;
            offeredAs: string;
            grade: number;
            modifier: {
                Label: string;
                ValueStr: string;
            };
            numericImportedModifier: {
                Label: string;
                Value: number;
                OriginalValue: number;
            };
            cases: {
                slot: string;
                symbol: string;
                blueprint: string;
            }[];
            refused: {
                slot: string;
                symbol: string;
                blueprint: string;
            };
        };
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
        experimentalNames: {
            description: string;
            map: {
                special_weapon_rateoffire: string;
                special_shield_efficient: string;
                special_shield_resistive: string;
                special_shiftlock_canister: string;
                special_super_penetrator: string;
            };
        };
        experimentalDamageDistributions: {
            description: string;
            map: {
                special_high_yield_shell: {
                    kinetic: number;
                    explosive: number;
                };
                special_distortion_field: {
                    kinetic: number;
                    thermal: number;
                };
                special_overload_munitions: {
                    thermal: number;
                    explosive: number;
                };
            };
        };
        damageComponentScaling: {
            description: string;
            cases: {
                symbol: string;
                baseDamage: number;
                effectiveDamage: number;
                baseComponents: {
                    kinetic?: number;
                    thermal?: number;
                    explosive?: number;
                    absolute?: number;
                    antiXeno?: number;
                    unclassified?: number[];
                };
                expectedComponents: {
                    kinetic?: number;
                    thermal?: number;
                    explosive?: number;
                    absolute?: number;
                    antiXeno?: number;
                    unclassified?: number[];
                };
            }[];
        };
        thermalPlasmaConversions: {
            description: string;
            blueprints: {
                BeamLaser_ThermalPlasmaConversion: string;
                BurstLaser_ThermalPlasmaConversion: string;
                PulseLaser_ThermalPlasmaConversion: string;
            };
            grades: {
                '1': {
                    thermal: number;
                    absolute: number;
                };
                '2': {
                    thermal: number;
                    absolute: number;
                };
                '3': {
                    thermal: number;
                    absolute: number;
                };
                '4': {
                    thermal: number;
                    absolute: number;
                };
                '5': {
                    thermal: number;
                    absolute: number;
                };
            };
        };
        blueprintCount: number;
        experimentalCount: number;
    };
    export default value;
}

declare module '*/fixtures/ships/journal-anaconda-slapaconda.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        HullValue: number;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            AmmoInClip?: number;
            AmmoInHopper?: number;
            Health: number;
            Engineering?: {
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                Modifiers: {
                    Label: string;
                    Value?: number;
                    OriginalValue?: number;
                    LessIsGood?: number;
                    ValueStr?: string;
                    ValueStr_Localised?: string;
                }[];
                Engineer?: string;
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
            };
            Value?: number;
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-caspian-explorer.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            AmmoInClip?: number;
            AmmoInHopper?: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer?: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                Modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                    LessIsGood: number;
                }[];
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
            };
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-cobra-mkv.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        HullValue: number;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
                Modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                    LessIsGood: number;
                }[];
            };
            AmmoInClip?: number;
            AmmoInHopper?: number;
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-corsair.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        HullValue: number;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
                Modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                    LessIsGood: number;
                }[];
            };
            AmmoInClip?: number;
            AmmoInHopper?: number;
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-federation-corvette-beams.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        HullValue: number;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
                Modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                    LessIsGood: number;
                }[];
            };
            AmmoInClip?: number;
            AmmoInHopper?: number;
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-federation-corvette-mixed.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        HullValue: number;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            AmmoInClip?: number;
            AmmoInHopper?: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
                Modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                    LessIsGood: number;
                }[];
            };
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-federation-corvette-multirole.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        HullValue: number;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
                Modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                    LessIsGood: number;
                }[];
            };
            AmmoInClip?: number;
            AmmoInHopper?: number;
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-federation-corvette-plasma.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        HullValue: number;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            AmmoInClip?: number;
            AmmoInHopper?: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
                Modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                    LessIsGood: number;
                }[];
            };
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-federation-corvette.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        HullValue: number;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
                Modifiers: {
                    Label: string;
                    Value?: number;
                    OriginalValue?: number;
                    LessIsGood?: number;
                    ValueStr?: string;
                    ValueStr_Localised?: string;
                    Label_Localised?: string;
                }[];
            };
            AmmoInClip?: number;
            AmmoInHopper?: number;
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-kestrel-mkii.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        HullValue: number;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            AmmoInClip?: number;
            AmmoInHopper?: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
                Modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                    LessIsGood: number;
                }[];
            };
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-krait-phantom.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        HullValue: number;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            AmmoInClip?: number;
            AmmoInHopper?: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
                Modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                    LessIsGood: number;
                }[];
            };
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-lynx-highliner-rescue.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        HullValue: number;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
                Modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                    LessIsGood: number;
                }[];
            };
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-lynx-highliner-rescue01-current.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            AmmoInClip?: number;
            AmmoInHopper?: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
                Modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                    LessIsGood: number;
                }[];
            };
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-lynx-highliner.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            AmmoInClip?: number;
            AmmoInHopper?: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
                Modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                    LessIsGood: number;
                }[];
            };
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-panther-mkii-fat-arse.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            AmmoInClip?: number;
            AmmoInHopper?: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer?: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                Modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                    LessIsGood: number;
                }[];
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
            };
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-python-mkii-antixeno.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        HullValue: number;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            AmmoInClip?: number;
            AmmoInHopper?: number;
            Health: number;
            Value?: number;
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-python-mkii-spire-ops.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        HullValue: number;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            AmmoInClip?: number;
            AmmoInHopper?: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer?: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                Modifiers: {
                    Label: string;
                    ValueStr?: string;
                    ValueStr_Localised?: string;
                    Value?: number;
                    OriginalValue?: number;
                    LessIsGood?: number;
                }[];
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
            };
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-the-deep-black.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        ModulesValue: number;
        HullHealth: number;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            AmmoInClip?: number;
            AmmoInHopper?: number;
            Health: number;
            Value?: number;
            Engineering?: {
                Engineer?: string;
                EngineerID: number;
                BlueprintID: number;
                BlueprintName: string;
                Level: number;
                Quality: number;
                Modifiers: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                    LessIsGood: number;
                }[];
                ExperimentalEffect?: string;
                ExperimentalEffect_Localised?: string;
            };
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/journal-viper-mkiv.jsonc' {
    const value: {
        timestamp: string;
        event: string;
        Ship: string;
        ShipID: number;
        ShipName: string;
        ShipIdent: string;
        HullValue: number;
        ModulesValue: number;
        HullHealth: number;
        Hot: boolean;
        UnladenMass: number;
        CargoCapacity: number;
        MaxJumpRange: number;
        FuelCapacity: {
            Main: number;
            Reserve: number;
        };
        Rebuy: number;
        Modules: {
            Slot: string;
            Item: string;
            On: boolean;
            Priority: number;
            Health: number;
            Value?: number;
            AmmoInClip?: number;
            AmmoInHopper?: number;
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/jump-range.jsonc' {
    const value: {
        ship: string;
        frameShiftDrive: {
            symbol: string;
            optMass: number;
            maxFuel: number;
            fuelMul: number;
            fuelPower: number;
            jumpBoost: number;
        };
        unladenMass: number;
        mainFuel: number;
        cargoCapacity: number;
        maxJumpRange: number;
        edsyMaxJumpRange: number;
        unladenJumpRange: number;
        ladenJumpRange: number;
        totalRange: number;
        fuelPerJump50Ly: number;
        invalidInputs: {
            function: string;
            field: string;
            value: number | string | number | string | number | number | number;
        }[];
        excessiveJumpCount: {
            mass: number;
            fuel: number;
            maxFuel: number;
            error: string;
        };
        tinyFuel: {
            mass: number;
            fuel: number;
            minimumRange: number;
        };
        overflowingTotal: {
            mass: number;
            fuel: number;
            frameShiftDrive: {
                optMass: number;
                maxFuel: number;
                fuelMul: number;
                fuelPower: number;
                jumpBoost: number;
            };
            error: string;
        };
        builds: {
            kraitPhantom: {
                build: string;
                note: string;
                ship: string;
                frameShiftDrive: {
                    optMass: number;
                    maxFuel: number;
                    fuelMul: number;
                    fuelPower: number;
                    jumpBoost: number;
                };
                unladenMass: number;
                mainFuel: number;
                cargoCapacity: number;
                sourceMaxJumpRange: number;
                maxJumpRange: number;
                unladenJumpRange: number;
                ladenJumpRange: number;
                totalUnladenRange: number;
                totalLadenRange: number;
            };
            viperMkIV: {
                build: string;
                note: string;
                ship: string;
                frameShiftDrive: {
                    optMass: number;
                    maxFuel: number;
                    fuelMul: number;
                    fuelPower: number;
                    jumpBoost: number;
                };
                unladenMass: number;
                mainFuel: number;
                cargoCapacity: number;
                sourceMaxJumpRange: number;
                maxJumpRange: number;
                unladenJumpRange: number;
                ladenJumpRange: number;
                totalUnladenRange: number;
                totalLadenRange: number;
            };
            pythonMkII: {
                build: string;
                note: string;
                ship: string;
                frameShiftDrive: {
                    optMass: number;
                    maxFuel: number;
                    fuelMul: number;
                    fuelPower: number;
                    jumpBoost: number;
                };
                unladenMass: number;
                mainFuel: number;
                cargoCapacity: number;
                sourceMaxJumpRange: number;
                maxJumpRange: number;
                unladenJumpRange: number;
                ladenJumpRange: number;
                totalUnladenRange: number;
                totalLadenRange: number;
            };
        };
    };
    export default value;
}

declare module '*/fixtures/ships/module-stats.jsonc' {
    const value: {
        countsNote: string;
        counts: {
            core: number;
            internal: number;
            hardpoint: number;
            utility: number;
            all: number;
        };
        priceCounts: {
            core: number;
            internal: number;
            hardpoint: number;
            utility: number;
            all: number;
        };
        prices: {
            symbol: string;
            cost: number;
        }[];
        unpricedNote: string;
        unpriced: string[];
        withoutIntegrity: {
            note: string;
            count: number;
            symbols: string[];
        };
        freeModules: {
            note: string;
            symbols: string[];
        };
        spot: {
            symbol: string;
            name: string;
            mass?: number;
            integrity?: number;
            powerDraw?: number;
            optMass?: number;
            maxFuel?: number;
            fuelMul?: number;
            fuelPower?: number;
            bootTime?: number;
            jumpBoost?: number;
            guardianZoneResistance?: boolean;
            minMass?: number;
            maxMass?: number;
            optMultiplier?: number;
            minMultiplier?: number;
            maxMultiplier?: number;
            restrictedToShips?: string[];
            shieldRegenRate?: number;
            shieldBrokenRegenRate?: number;
            weaponsCapacity?: number;
            weaponsRecharge?: number;
            enginesCapacity?: number;
            enginesRecharge?: number;
            systemsCapacity?: number;
            systemsRecharge?: number;
            damage?: number;
            thermalLoad?: number;
            kineticResistance?: number;
            thermalResistance?: number;
            explosiveResistance?: number;
            distributorDraw?: number;
            fuelCapacity?: number;
            cargoCapacity?: number;
            ship?: string;
            hullBoost?: number;
            causticResistance?: number;
            hullReinforcement?: number;
            shieldBoost?: number;
            alwaysPowered?: boolean;
            damageDistribution?: {
                kinetic: number;
                thermal?: number;
            };
            rateOfFire?: number;
            burstInterval?: number;
            clipSize?: number;
            ammoMaximum?: number;
            reloadTime?: number;
            armourPiercing?: number;
            maximumRange?: number;
            falloffRange?: number;
            shotSpeed?: number;
            burstRounds?: number;
            burstRateOfFire?: number;
            chargeTime?: number;
            powerCapacity?: number;
            heatEfficiency?: number;
            engineHeatRate?: number;
            fsdHeatRate?: number;
            scannerRange?: number;
            scanAngle?: number;
            scanTime?: number;
            probeRadius?: number;
            shieldBankReinforcement?: number;
            shieldBankHeat?: number;
            shieldBankSpinUp?: number;
            shieldBankDuration?: number;
            interdictorFacingLimit?: number;
            interdictorRange?: number;
            refuelRate?: number;
        }[];
        continuousFire: string[];
        statCounts: {
            note: string;
            counts: {
                engineHeatRate: number;
                fsdHeatRate: number;
                refuelRate: number;
                shieldBankReinforcement: number;
                shieldBankHeat: number;
                shieldBankSpinUp: number;
                shieldBankDuration: number;
                scannerRange: number;
                scanAngle: number;
                scanTime: number;
                probeRadius: number;
                interdictorFacingLimit: number;
                interdictorRange: number;
            };
        };
        inGameAudit: {
            catalogueIdentities: number;
            identityMatches: number;
            registryOnlyIdentities: number;
            numericModulesVerified: number;
            armourModulesOutsideNumericVerification: number;
            verifiedRecords: number;
            verifiedFields: number;
            catalogueFieldCounts: {
                powerDraw: number;
                bootTime: number;
            };
            note: string;
            verifiedValueFields: number;
            verifiedAbsentFields: number;
        };
        inGameVerifiedValues: {
            symbol: string;
            clipSize?: number;
            thermalLoad?: number;
            damage?: number;
            damageDistribution?: {
                kinetic?: number;
                antiXeno?: number;
                absolute?: number;
                thermal?: number;
                unclassified?: number;
                explosive?: number;
            };
            damageComponents?: {
                kinetic?: number;
                antiXeno?: number;
                absolute?: number;
                thermal?: number;
                unclassified?: number[];
                explosive?: number;
            };
            falloffRange?: number;
            maximumRange?: number;
            reloadTime?: number;
            distributorDraw?: number;
            projectileRange?: {
                maximumBoundary: number;
                falloffBoundary: number;
            };
            rateOfFire?: number;
            burstInterval?: number;
            jitter?: number;
            optMultiplier?: number;
            maxMultiplier?: number;
            minMass?: number;
            maxMass?: number;
            refuelRate?: number;
            integrity?: number;
            optMass?: number;
            causticResistance?: number;
            ammoMaximum?: number;
            shieldBrokenRegenRate?: number;
            shieldRegenRate?: number;
        }[];
        inGameVerifiedAbsentFields: {
            symbol: string;
            fields: string[];
        }[];
        capturedBaseStats: {
            note: string;
            floatNoiseTolerance: number;
            unmappedNote: string;
            convertedDamageDistributions: {
                file: string;
                slot: string;
                symbol: string;
                experimental: string;
                base: {
                    kinetic: number;
                };
                effective: {
                    kinetic: number;
                    explosive: number;
                };
            }[];
            captures: {
                file: string;
                stated: number;
                mapped: number;
                exact: number;
                withinFloatNoise: number;
                unmapped: {
                    symbol: string;
                    label: string;
                }[];
            }[];
            weaponsNote: string;
            weapons: {
                symbol: string;
                damagePerSecond: number;
            }[];
            effectiveWeapons: {
                file: string;
                slot: string;
                symbol: string;
                damage: number;
                maximumRange?: number;
                falloffRange?: number;
            }[];
            rebuildNote: string;
            rebuildTolerance: number;
            rebuilds: {
                file: string;
                unladenMass: number;
                maxJumpRange: number;
            }[];
            engineeredNote: string;
            engineered: {
                file: string;
                slot: string;
                symbol: string;
                field: string;
                value: number;
            }[];
        };
    };
    export default value;
}

declare module '*/fixtures/ships/modules.jsonc' {
    const value: {
        counts: {
            core: number;
            internal: number;
            hardpoint: number;
            utility: number;
            all: number;
        };
        slotCounts: {
            armour: number;
            powerPlant: number;
            thrusters: number;
            frameShiftDrive: number;
            lifeSupport: number;
            powerDistributor: number;
            sensors: number;
            fuelTank: number;
            none: number;
        };
        records: {
            symbol: string;
            category: string;
            slot?: string;
            name: string;
            class: number;
            rating: string;
            ship?: string;
            mount?: string;
            guidance?: string;
            entitlement?: string;
            restrictedToShips?: string[];
            restrictedToSlot?: string;
        }[];
        shipArmour: {
            ship: string;
            count: number;
            names: string[];
        };
    };
    export default value;
}

declare module '*/fixtures/ships/pre-engineered.jsonc' {
    const value: {
        count: number;
        counts: {
            mercenary: number;
            communityGoal: number;
            techBroker: number;
        };
        modifierCounts: {
            withModifiers: number;
            withoutModifiers: number;
            withMercCoinCost: number;
        };
        engineeringLocked: {
            count: number;
            symbols: string[];
        };
        modifierLabels: string[];
        maxModifierDecimalPlaces: number;
        burstIntervalVariants: {
            count: number;
            variants: {
                symbol: string;
                blueprint: string;
                grade: number;
                experimental: string | null;
                stockBurstInterval: number;
                burstInterval: number;
                rateOfFire: number;
            }[];
        };
        authoredStats: {
            count: number;
            note: string;
        };
        fullyUnresolved: {
            note: string;
            count: number;
            symbols: unknown[];
        };
        mercCoin: {
            total: number;
            cheapest: number;
            dearest: number;
        };
        records: {
            symbol: string;
            name: string;
            blueprint: string;
            grade: number;
            acquisition: string;
            mercCoinCost?: number;
            experimental?: string;
            modifiers?: {
                label: string;
                method: string;
                value: number;
            }[];
            engineeringLocked?: boolean;
        }[];
        multiVariant: {
            symbol: string;
            blueprints: string[];
        };
        sameBlueprintTwice: {
            symbol: string;
            blueprint: string;
            experimentals: string[];
        };
        sameTripleDifferentGrade: {
            symbol: string;
            blueprint: string;
            grades: number[];
            acquisitions: string[];
        };
        resolved: {
            fsdV1Size5: {
                symbol: string;
                blueprint: string;
                base: {
                    optMass: number;
                    mass: number;
                    integrity: number;
                    fsdHeatRate: number;
                };
                engineered: {
                    optMass: number;
                    mass: number;
                    integrity: number;
                    fsdHeatRate: number;
                };
                unresolved: unknown[];
            };
            guardianShardMediumG1: {
                symbol: string;
                blueprint: string;
                grade: number;
                base: {
                    mass: number;
                    powerDraw: number;
                    damage: number;
                    distributorDraw: number;
                    maximumRange: number;
                    falloffRange: number;
                    shotSpeed: number;
                    jitter: number;
                    thermalLoad: number;
                    armourPiercing: number;
                    rateOfFire: number;
                    roundsPerShot: number;
                    clipSize: number;
                    ammoMaximum: number;
                };
                engineered: {
                    mass: number;
                    powerDraw: number;
                    damage: number;
                    distributorDraw: number;
                    maximumRange: number;
                    falloffRange: number;
                    shotSpeed: number;
                    jitter: number;
                    thermalLoad: number;
                    armourPiercing: number;
                    rateOfFire: number;
                    roundsPerShot: number;
                    clipSize: number;
                    ammoMaximum: number;
                };
                displayed: {
                    mass: number;
                    powerDraw: number;
                    distributorDraw: number;
                    thermalLoad: number;
                    armourPiercing: number;
                    maximumRange: number;
                    shotSpeed: number;
                    jitter: number;
                    falloffRange: number;
                    damagePerSecond: number;
                    damage: number;
                    rateOfFire: number;
                    clipSize: number;
                    ammoMaximum: number;
                    damageType: string;
                };
                displayedChanges: {
                    massPercent: number;
                    powerDrawPercent: number;
                    distributorDrawPercent: number;
                    thermalLoadPercent: number;
                    armourPiercingPercent: number;
                    maximumRangePercent: number;
                    shotSpeedPercent: number;
                    jitterDegrees: number;
                    falloffRangePercent: number;
                };
                unresolved: unknown[];
                note: string;
            };
            fragmentCannonDoubleShot: {
                symbol: string;
                blueprint: string;
                grade: number;
                base: {
                    clipSize: number;
                    ammoMaximum: number;
                };
                engineered: {
                    clipSize: number;
                    burstRounds: number;
                    ammoMaximum: number;
                };
                note: string;
            };
            guardianShardMediumLongRange: {
                symbol: string;
                blueprint: string;
                grade: number;
                engineered: {
                    maximumRange: number;
                    falloffRange: number;
                    shotSpeed: number;
                };
            };
        };
        identification: {
            description: string;
            matches: {
                source: string;
                slot: string;
                symbol: string;
                blueprint: string;
                grade: number;
                acquisition: string;
                experimental?: string;
                appliedExperimental?: string;
            }[];
            notMatches: {
                source: string;
                slot: string;
            }[];
            omittedBakedExperimental: {
                source: string;
                slot: string;
                reportedInstead: {
                    Label: string;
                    Value: number;
                    OriginalValue: number;
                };
                omitted: string;
                expectedThermalLoad: number;
                note: string;
            };
        };
        notPreEngineered: string[];
        joins: {
            everySymbolIsAKnownModule: boolean;
            everyBlueprintIsAKnownBlueprint: boolean;
            everyExperimentalIsAKnownEffect: boolean;
            everyMercenaryBlueprintStartsAtGradeTwo: boolean;
            everyRewardGradeIsARealGrade: boolean;
        };
    };
    export default value;
}

declare module '*/fixtures/ships/ship-slots.jsonc' {
    const value: {
        count: number;
        planetaryApproachSuiteCount: number;
        spot: {
            symbol: string;
            core: {
                powerPlant: number;
                thrusters: number;
                frameShiftDrive: number;
                lifeSupport: number;
                powerDistributor: number;
                sensors: number;
                fuelTank: number;
            };
            hardpoints: {
                size: number;
                name?: string;
                restriction?: string;
            }[];
            utility: number;
            optional: {
                size: number;
                restriction?: string;
                name?: string;
            }[];
        }[];
        keys: {
            Type7: string[];
            Vulture: string[];
            Federation_Dropship: string[];
            Type9: string[];
            Anaconda: string[];
            Independant_Trader: string[];
            Asp_Scout: string[];
            Type9_Military: string[];
            Type8: string[];
            PantherMkII: string[];
            LakonMiner: string[];
            Explorer_NX: string[];
            MediumTransport01: string[];
        };
        restrictions: {
            ship: string;
            slot: string;
            restriction: string | null;
            accepts: string[];
            rejects: string[];
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/ship-stats.jsonc' {
    const value: {
        count: number;
        pricedCount: number;
        prices: {
            symbol: string;
            hullCost: number;
            retailCost: number;
        }[];
        spot: {
            symbol: string;
            hullMass: number;
            speed: number;
            boost: number;
            baseShieldStrength: number;
            baseArmour: number;
            hardness: number;
            masslock: number;
            crew: number;
            heatCapacity: number;
            reserveFuelCapacity: number;
            pitch: number;
            roll: number;
            yaw: number;
            minThrust: number;
            pipSpeed: number;
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/ships.jsonc' {
    const value: {
        count: number;
        records: {
            symbol: string;
            name: string;
            entitlement?: string;
        }[];
        lookups: {
            query: string;
            by: string;
            name?: string;
            symbol?: string;
        }[];
    };
    export default value;
}

declare module '*/fixtures/ships/slef-export.jsonc' {
    const value: {
        rebuyFraction: number;
        classification: {
            note: string;
            outfittingSlotPatterns: string[];
            nonOutfittingSlotPattern: string;
            patternsMatchLowerCasedSlot: boolean;
            examples: {
                slot: string;
                item: string;
                verdict: string;
                why: string;
            }[];
        };
        engineeringWithoutModifiers: {
            note: string;
            modifiersRequired: boolean;
            exportInventsEmptyArray: boolean;
        };
        journalFieldExclusions: {
            note: string;
            topLevelBuild: string;
            topLevel: string[];
            engineeringBuild: string;
            engineering: string[];
        };
        deepBlack: {
            build: string;
            note: string;
            topLevelKeys: string[];
            moduleCount: number;
            recomputed: {
                Ship: string;
                HullValue: number;
                ModulesValue: number;
                UnladenMass: number;
                CargoCapacity: number;
                MaxJumpRange: number;
                FuelCapacity: {
                    Main: number;
                    Reserve: number;
                };
                Rebuy: number;
            };
            physicalFiguresMatchSource: string[];
            discount: {
                note: string;
                sourceHullValue: number;
                sourceModulesValue: number;
                sourceRebuy: number;
                moduleDiscount: number;
            };
            fittedOrder: string[];
            slotOrder: string[];
            afterEdit: {
                note: string;
                slot: string;
                item: string;
                topLevelKeys: string[];
                recomputed: {
                    ModulesValue: number;
                    UnladenMass: number;
                    CargoCapacity: number;
                    MaxJumpRange: number;
                    FuelCapacity: {
                        Main: number;
                        Reserve: number;
                    };
                    Rebuy: number;
                };
            };
        };
        kraitPhantom: {
            build: string;
            note: string;
            topLevelKeys: string[];
            moduleCount: number;
            nonOutfittingSlots: string[];
            recomputed: {
                Ship: string;
                HullValue: number;
                ModulesValue: number;
                UnladenMass: number;
                CargoCapacity: number;
                MaxJumpRange: number;
                FuelCapacity: {
                    Main: number;
                    Reserve: number;
                };
                Rebuy: number;
            };
            journalTolerance: {
                note: string;
                UnladenMass: number;
                MaxJumpRange: number;
            };
            discount: {
                note: string;
                sourceHullValue: number;
                sourceModulesValue: number;
                sourceRebuy: number;
                hullRetailCost: number;
                unpricedInSource: string[];
            };
        };
        viperMkIV: {
            build: string;
            note: string;
            topLevelKeys: string[];
            moduleCount: number;
            nonOutfittingSlots: string[];
            recomputed: {
                Ship: string;
                HullValue: number;
                ModulesValue: number;
                UnladenMass: number;
                CargoCapacity: number;
                MaxJumpRange: number;
                FuelCapacity: {
                    Main: number;
                    Reserve: number;
                };
                Rebuy: number;
            };
            journalTolerance: {
                note: string;
                UnladenMass: number;
                MaxJumpRange: number;
            };
            discount: {
                note: string;
                sourceHullValue: number;
                sourceModulesValue: number;
                sourceRebuy: number;
                hullRetailCost: number;
                hullCost: number;
                moduleDiscount: number;
                moduleDiscountToleranceCr: number;
                pricedInSource: number;
                rebuyFromOwnFigures: number;
                unpricedInSource: string[];
            };
        };
        pythonMkII: {
            build: string;
            note: string;
            topLevelKeys: string[];
            moduleCount: number;
            nonOutfittingSlots: string[];
            recomputed: {
                Ship: string;
                HullValue: number;
                ModulesValue: number;
                UnladenMass: number;
                CargoCapacity: number;
                MaxJumpRange: number;
                FuelCapacity: {
                    Main: number;
                    Reserve: number;
                };
                Rebuy: number;
            };
            journalTolerance: {
                note: string;
                UnladenMass: number;
                MaxJumpRange: number;
            };
            ammunition: {
                note: string;
                loaded: {
                    symbol: string;
                    AmmoInClip: number;
                    AmmoInHopper: number;
                }[];
            };
            discount: {
                note: string;
                sourceHullValue: number;
                sourceModulesValue: number;
                sourceRebuy: number;
                hullRetailCost: number;
                hullCost: number;
                moduleDiscount: number;
                moduleDiscountToleranceCr: number;
                pricedInSource: number;
                rebuyFromOwnFigures: number;
                unpricedInSource: string[];
            };
        };
        assembled: {
            note: string;
            ship: string;
            fit: {
                FrameShiftDrive: string;
                FuelTank: string;
            };
            topLevelKeys: string[];
            omittedKeys: string[];
            recomputed: {
                Ship: string;
                HullValue: number;
                ModulesValue: number;
                UnladenMass: number;
                CargoCapacity: number;
                MaxJumpRange: number;
                FuelCapacity: {
                    Main: number;
                    Reserve: number;
                };
                Rebuy: number;
            };
            valueNote: string;
            modules: {
                Slot: string;
                Item: string;
                Value: number;
            }[];
            modulesWithExplicitPower: {
                Slot: string;
                Item: string;
                On: boolean;
                Priority: number;
                Value: number;
            }[];
        };
        unknownHull: {
            note: string;
            ship: string;
            topLevelKeys: string[];
            omittedKeys: string[];
        };
    };
    export default value;
}

declare module '*/fixtures/ships/slef-inara-cutter-antixeno.jsonc' {
    const value: {
        header: {
            appName: string;
            appVersion: string;
        };
        data: {
            Ship: string;
            ShipID: number;
            ShipName: string;
            ShipIdent: string;
            HullValue: number;
            ModulesValue: number;
            Rebuy: number;
            Modules: {
                Slot: string;
                Item: string;
                On: boolean;
                Priority?: number;
                Value?: number;
                Engineering?: {
                    BlueprintName: string;
                    Level: number;
                    Quality: number;
                    ExperimentalEffect?: string;
                };
            }[];
        };
    }[];
    export default value;
}

declare module '*/fixtures/ships/slef-inara-lynx-highliner.jsonc' {
    const value: {
        header: {
            appName: string;
            appVersion: string;
        };
        data: {
            Ship: string;
            ShipID: number;
            ShipName: string;
            ShipIdent: string;
            ModulesValue: number;
            Rebuy: number;
            Modules: {
                Slot: string;
                Item: string;
                On: boolean;
                Priority?: number;
                Value?: number;
                Engineering?: {
                    BlueprintName: string;
                    Level: number;
                    Quality: number;
                    ExperimentalEffect?: string;
                };
            }[];
        };
    }[];
    export default value;
}

declare module '*/fixtures/ships/slef-inara-panther-mkii.jsonc' {
    const value: {
        header: {
            appName: string;
            appVersion: string;
        };
        data: {
            Ship: string;
            ShipID: number;
            ShipName: string;
            ShipIdent: string;
            ModulesValue: number;
            Rebuy: number;
            Modules: {
                Slot: string;
                Item: string;
                On: boolean;
                Priority?: number;
                Value?: number;
                Engineering?: {
                    BlueprintName: string;
                    Level: number;
                    Quality: number;
                    ExperimentalEffect?: string;
                };
            }[];
        };
    }[];
    export default value;
}

declare module '*/fixtures/ships/slef-inara-type-11.jsonc' {
    const value: {
        header: {
            appName: string;
            appVersion: string;
        };
        data: {
            Ship: string;
            ShipID: number;
            ShipName: string;
            ShipIdent: string;
            HullValue: number;
            ModulesValue: number;
            Rebuy: number;
            Modules: {
                Slot: string;
                Item: string;
                On: boolean;
                Priority?: number;
                Value?: number;
                Engineering?: {
                    BlueprintName: string;
                    Level: number;
                    Quality: number;
                    ExperimentalEffect?: string;
                };
            }[];
        };
    }[];
    export default value;
}

declare module '*/fixtures/ships/slef-the-deep-black.jsonc' {
    const value: {
        header: {
            appName: string;
            appVersion: number;
            appURL: string;
        };
        data: {
            event: string;
            Ship: string;
            ShipName: string;
            ShipIdent: string;
            HullValue: number;
            ModulesValue: number;
            UnladenMass: number;
            CargoCapacity: number;
            MaxJumpRange: number;
            FuelCapacity: {
                Main: number;
                Reserve: number;
            };
            Rebuy: number;
            Modules: {
                Slot: string;
                Item: string;
                On: boolean;
                Priority: number;
                Value?: number;
                Engineering?: {
                    BlueprintName: string;
                    Level: number;
                    Quality: number;
                    Modifiers: {
                        Label: string;
                        Value: number;
                        OriginalValue: number;
                    }[];
                    ExperimentalEffect?: string;
                };
            }[];
        };
    }[];
    export default value;
}

declare module '*/fixtures/ships/source-purchase.jsonc' {
    const value: {
        captures: {
            deepBlack: {
                build: string;
                note: string;
                record: {
                    hullValue: number;
                    modulesValue: number;
                    rebuy: number;
                    moduleCount: number;
                    pricedModulesValue: number;
                    moduleValues: {
                        slot: string;
                        item: string;
                        value: number;
                    }[];
                };
                sourceExport: {
                    note: string;
                    topLevelCredits: {
                        HullValue: number;
                        ModulesValue: number;
                        Rebuy: number;
                    };
                    pricedSlots: {
                        TinyHardpoint5: number;
                        TinyHardpoint6: number;
                        Armour: number;
                        PowerPlant: number;
                        MainEngines: number;
                        FrameShiftDrive: number;
                        LifeSupport: number;
                        PowerDistributor: number;
                        Radar: number;
                        FuelTank: number;
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
                    };
                };
            };
            viperMkIV: {
                build: string;
                note: string;
                record: {
                    hullValue: number;
                    modulesValue: number;
                    rebuy: number;
                    moduleCount: number;
                    pricedModulesValue: number;
                    moduleValues: {
                        slot: string;
                        item: string;
                        value: number;
                    }[];
                };
                sourceExport: {
                    note: string;
                    topLevelCredits: {
                        HullValue: number;
                        ModulesValue: number;
                        Rebuy: number;
                    };
                    pricedSlots: {
                        MediumHardpoint1: number;
                        MediumHardpoint2: number;
                        SmallHardpoint1: number;
                        SmallHardpoint2: number;
                        TinyHardpoint1: number;
                        TinyHardpoint2: number;
                        PowerPlant: number;
                        MainEngines: number;
                        FrameShiftDrive: number;
                        LifeSupport: number;
                        PowerDistributor: number;
                        Radar: number;
                        FuelTank: number;
                        Slot01_Size4: number;
                        Slot02_Size4: number;
                        Slot03_Size3: number;
                        Slot04_Size2: number;
                        Slot07_Size1: number;
                        Slot08_Size1: number;
                        PlanetaryApproachSuite: number;
                    };
                };
            };
            caspianExplorer: {
                build: string;
                note: string;
                record: {
                    hullValue: null;
                    modulesValue: number;
                    rebuy: number;
                    moduleCount: number;
                    pricedModulesValue: number;
                    moduleValues: {
                        slot: string;
                        item: string;
                        value: number;
                    }[];
                };
                sourceExport: {
                    note: string;
                    topLevelCredits: {
                        ModulesValue: number;
                        Rebuy: number;
                    };
                    pricedSlots: {
                        MediumHardpoint6: number;
                        TinyHardpoint1: number;
                        TinyHardpoint2: number;
                        PowerPlant: number;
                        MainEngines: number;
                        FrameShiftDrive: number;
                        LifeSupport: number;
                        PowerDistributor: number;
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
                    };
                };
            };
            kraitPhantom: {
                build: string;
                note: string;
                record: {
                    hullValue: number;
                    modulesValue: number;
                    rebuy: number;
                    moduleCount: number;
                    pricedModulesValue: number;
                    moduleValues: {
                        slot: string;
                        item: string;
                        value: number;
                    }[];
                };
                sourceExport: {
                    note: string;
                    topLevelCredits: {
                        HullValue: number;
                        ModulesValue: number;
                        Rebuy: number;
                    };
                    pricedSlots: {
                        MediumHardpoint1: number;
                        MediumHardpoint2: number;
                        TinyHardpoint1: number;
                        TinyHardpoint2: number;
                        TinyHardpoint3: number;
                        TinyHardpoint4: number;
                        PowerPlant: number;
                        MainEngines: number;
                        FrameShiftDrive: number;
                        LifeSupport: number;
                        PowerDistributor: number;
                        Radar: number;
                        Slot01_Size6: number;
                        Slot02_Size5: number;
                        Slot03_Size5: number;
                        Slot04_Size5: number;
                        Slot05_Size3: number;
                        Slot06_Size3: number;
                        Slot07_Size3: number;
                        Slot08_Size2: number;
                    };
                };
            };
        };
        syntheticCaptures: {
            noCredits: {
                note: string;
                event: {
                    Ship: string;
                    Modules: {
                        Slot: string;
                        Item: string;
                    }[];
                };
                record: null;
            };
            rebuyOnly: {
                note: string;
                event: {
                    Ship: string;
                    Rebuy: number;
                    Modules: {
                        Slot: string;
                        Item: string;
                    }[];
                };
                record: {
                    hullValue: null;
                    modulesValue: null;
                    rebuy: number;
                    moduleCount: number;
                    pricedModulesValue: number;
                    moduleValues: unknown[];
                };
            };
            partsDoNotAddUp: {
                note: string;
                event: {
                    Ship: string;
                    ModulesValue: number;
                    Modules: {
                        Slot: string;
                        Item: string;
                        Value?: number;
                    }[];
                };
                record: {
                    hullValue: null;
                    modulesValue: number;
                    rebuy: null;
                    moduleCount: number;
                    pricedModulesValue: number;
                    moduleValues: {
                        slot: string;
                        item: string;
                        value: number;
                    }[];
                };
            };
            repeatedSlotKey: {
                note: string;
                event: {
                    Ship: string;
                    Modules: {
                        Slot: string;
                        Item: string;
                        Value: number;
                    }[];
                };
                record: {
                    hullValue: null;
                    modulesValue: null;
                    rebuy: null;
                    moduleCount: number;
                    pricedModulesValue: number;
                    moduleValues: {
                        slot: string;
                        item: string;
                        value: number;
                    }[];
                };
            };
        };
        editedExports: {
            note: string;
            groups: {
                deepBlack: {
                    note: string;
                    scenarios: {
                        swapAPricedModule: {
                            edits: {
                                setModule: {
                                    slot: string;
                                    symbol: string;
                                };
                            }[];
                            why: string;
                            topLevelCredits: {
                                HullValue: number;
                            };
                            unpricedSlots: string[];
                        };
                        removeAPricedModule: {
                            edits: {
                                removeModule: {
                                    slot: string;
                                };
                            }[];
                            why: string;
                            topLevelCredits: {
                                HullValue: number;
                            };
                            unpricedSlots: string[];
                        };
                        refitTheSameArticle: {
                            edits: {
                                setModule: {
                                    slot: string;
                                    symbol: string;
                                };
                            }[];
                            why: string;
                            topLevelCredits: {
                                HullValue: number;
                                ModulesValue: number;
                                Rebuy: number;
                            };
                            unpricedSlots: unknown[];
                        };
                        engineerAPricedModule: {
                            edits: {
                                applyBlueprint: {
                                    slot: string;
                                    blueprint: string;
                                    grade: number;
                                };
                            }[];
                            why: string;
                            topLevelCredits: {
                                HullValue: number;
                                ModulesValue: number;
                                Rebuy: number;
                            };
                            unpricedSlots: unknown[];
                        };
                        fillAnEmptyMount: {
                            edits: {
                                setModule: {
                                    slot: string;
                                    symbol: string;
                                };
                            }[];
                            why: string;
                            topLevelCredits: {
                                HullValue: number;
                                ModulesValue: number;
                                Rebuy: number;
                            };
                            unpricedSlots: unknown[];
                            unpricedNewSlots: string[];
                        };
                        stripEveryPricedModule: {
                            edits: {
                                removeModule: {
                                    slot: string;
                                };
                            }[];
                            why: string;
                            topLevelCredits: {
                                HullValue: number;
                            };
                            unpricedSlots: string[];
                        };
                    };
                };
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
                            why: string;
                            topLevelCredits: Record<string, never>;
                            unpricedSlots: string[];
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
                            why: string;
                            topLevelCredits: {
                                ModulesValue: number;
                            };
                            unpricedSlots: unknown[];
                        };
                    };
                };
            };
        };
    };
    export default value;
}
