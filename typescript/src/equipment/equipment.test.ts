import assert from 'node:assert/strict';
import { test } from 'node:test';

import equipmentFixture from '../../../fixtures/equipment/equipment.jsonc' with { type: 'json' };
import { ALL_MICRO_RESOURCES } from '../materials/micro-resources-all.js';
import { getMicroResourceBySymbol } from '../materials/micro-resources.js';
import { SUITS, getSuitByFamily, getSuitByName, getSuitBySymbol, getSuitGrade } from './suits.js';
import {
    PERSONAL_WEAPONS,
    getPersonalWeaponByName,
    getPersonalWeaponBySymbol,
    getPersonalWeaponGrade,
} from './weapons.js';
import {
    PERSONAL_UPGRADE_COSTS,
    getPersonalWeaponUpgradeCost,
    getPersonalWeaponUpgradeStepCost,
    getSuitUpgradeCost,
    getSuitUpgradeStepCost,
} from './upgrade-costs.js';
import { PERSONAL_MODIFICATIONS, getPersonalModification } from './modifications.js';
import { PERSONAL_MODIFICATION_COSTS, getPersonalModificationCost } from './modification-costs.js';
import { resolvePersonalModificationForWeapon } from './modification-journal.js';
import { sumPersonalEngineeringIngredients } from './engineering.js';

test('catalogue counts are pinned by the shared fixture', () => {
    assert.equal(SUITS.length, equipmentFixture.counts.suits);
    assert.equal(PERSONAL_WEAPONS.length, equipmentFixture.counts.weapons);
    assert.equal(
        Object.keys(PERSONAL_MODIFICATIONS).length,
        equipmentFixture.counts.modificationRecipes,
    );
    assert.equal(
        new Set(Object.values(PERSONAL_MODIFICATIONS).map(({ name }) => name)).size,
        equipmentFixture.counts.modificationNames,
    );
});

test('representative suits resolve by family, name and grade-specific Frontier symbol', () => {
    for (const expected of equipmentFixture.suits) {
        const suit = getSuitByFamily(expected.family);
        assert.ok(suit);
        assert.equal(suit.name, expected.name);
        assert.equal(suit.primarySlots, expected.primarySlots);
        assert.equal(suit.secondarySlots, expected.secondarySlots);
        assert.equal(getSuitByName(expected.name), suit);

        const journal = getSuitBySymbol(expected.symbol);
        assert.ok(journal);
        assert.equal(journal.suit, suit);
        assert.equal(journal.grade, expected.grade);
        const grade = getSuitGrade(suit, expected.grade);
        assert.ok(grade);
        assert.equal(grade.shieldStrength, expected.shieldStrength);
        if ('kineticResistance' in expected) {
            assert.equal(grade.kineticResistance, expected.kineticResistance);
        }
        assert.equal(grade.modificationSlots, expected.modificationSlots);
    }
});

test('suit lookups ignore case and whitespace and return null for misses', () => {
    assert.equal(getSuitByFamily('  UTILITYSUIT ')?.name, 'Maverick Suit');
    assert.equal(getSuitByName(' maverick suit ')?.family, 'utilitysuit');
    assert.equal(getSuitBySymbol(' UTILITYSUIT_CLASS5 ')?.grade, 5);
    assert.equal(getSuitByFamily('unknown'), null);
    assert.equal(getSuitByName('unknown'), null);
    assert.equal(getSuitBySymbol('unknown'), null);
    assert.equal(getSuitBySymbol('constructor'), null);
    assert.equal(getSuitBySymbol('__proto__'), null);
    assert.throws(() => getSuitBySymbol(42 as unknown as string), TypeError);
});

test('suit grades enforce their range and preserve a deliberate missing grade', () => {
    const flightSuit = getSuitByFamily('flightsuit');
    assert.ok(flightSuit);
    assert.equal(getSuitGrade(flightSuit, 2), null);
    for (const invalid of [0, 1.5, 6]) {
        assert.throws(() => getSuitGrade(flightSuit, invalid), RangeError);
    }
});

test('representative handheld weapons resolve with their pinned grade stats', () => {
    for (const expected of equipmentFixture.weapons) {
        const weapon = getPersonalWeaponBySymbol(expected.symbol);
        assert.ok(weapon);
        assert.equal(weapon.name, expected.name);
        assert.equal(getPersonalWeaponByName(expected.name), weapon);
        assert.equal(weapon.rateOfFire, expected.rateOfFire);
        assert.equal(weapon.magazineSize, expected.magazineSize);
        assert.equal(weapon.effectiveRange, expected.effectiveRange);
        const grade = getPersonalWeaponGrade(weapon, expected.grade);
        assert.equal(grade.damage, expected.damage);
        assert.equal(grade.modificationSlots, expected.modificationSlots);
    }
});

test('weapon lookups ignore case and reject invalid grades', () => {
    assert.equal(getPersonalWeaponByName(' karma ar-50 ')?.upgradeGroup, 'karma');
    assert.equal(getPersonalWeaponByName(' karma ar-50 ')?.engineeringType, 'kinetic');
    assert.equal(
        getPersonalWeaponBySymbol(' WPN_M_SNIPER_PLASMA_CHARGED ')?.name,
        'Manticore Executioner',
    );
    assert.equal(getPersonalWeaponBySymbol('unknown'), null);
    assert.equal(getPersonalWeaponByName('unknown'), null);
    const weapon = PERSONAL_WEAPONS[0]!;
    for (const invalid of [0, 2.5, 6]) {
        assert.throws(() => getPersonalWeaponGrade(weapon, invalid), RangeError);
    }
});

test('one-step suit upgrade costs match the shared fixture', () => {
    assert.deepEqual(
        getSuitUpgradeStepCost('utilitysuit', 2),
        equipmentFixture.upgradeCosts.maverickGrade2,
    );
    assert.equal(getSuitUpgradeStepCost('unknown', 2), null);
    assert.equal(getSuitUpgradeStepCost('flightsuit', 2), null);
});

test('multi-step suit upgrade costs sum repeated resources', () => {
    const costs = getSuitUpgradeCost('utilitysuit', 3);
    assert.ok(costs);
    assert.equal(
        costs.find((ingredient) => ingredient.symbol === 'graphene')?.count,
        equipmentFixture.upgradeCosts.maverickGrade1To3Graphene,
    );
    assert.deepEqual(getSuitUpgradeCost('utilitysuit', 3, 3), []);
    assert.deepEqual(getSuitUpgradeCost('utilitysuit', 2, 4), []);
    assert.equal(getSuitUpgradeCost('unknown', 3), null);
    assert.equal(getSuitUpgradeCost('flightsuit', 3), null);
});

test('weapon upgrade costs select the weapon technology family', () => {
    const ar50 = getPersonalWeaponByName('Karma AR-50');
    const aphelion = getPersonalWeaponByName('TK Aphelion');
    assert.ok(ar50 && aphelion);
    assert.equal(
        getPersonalWeaponUpgradeStepCost(ar50.symbol, 5)?.find(
            (ingredient) => ingredient.symbol === 'weaponcomponent',
        )?.count,
        equipmentFixture.upgradeCosts.ar50Grade5WeaponComponents,
    );
    assert.equal(
        getPersonalWeaponUpgradeStepCost(aphelion.symbol, 2)?.some(
            (ingredient) => ingredient.symbol === 'opticalfibre',
        ),
        true,
    );
    assert.deepEqual(getPersonalWeaponUpgradeCost(ar50.symbol, 1), []);
    assert.equal(getPersonalWeaponUpgradeStepCost('unknown', 2), null);
    assert.equal(getPersonalWeaponUpgradeCost('unknown', 5), null);
});

test('upgrade helpers reject invalid grade arguments', () => {
    for (const invalid of [1, 2.5, 6]) {
        assert.throws(() => getSuitUpgradeStepCost('utilitysuit', invalid), RangeError);
        assert.throws(
            () => getPersonalWeaponUpgradeStepCost(PERSONAL_WEAPONS[0]!.symbol, invalid),
            RangeError,
        );
    }
    for (const invalid of [0, 1.5, 6]) {
        assert.throws(() => getSuitUpgradeCost('utilitysuit', invalid), RangeError);
        assert.throws(() => getSuitUpgradeCost('utilitysuit', 5, invalid), RangeError);
        assert.throws(
            () => getPersonalWeaponUpgradeCost(PERSONAL_WEAPONS[0]!.symbol, invalid),
            RangeError,
        );
        assert.throws(
            () => getPersonalWeaponUpgradeCost(PERSONAL_WEAPONS[0]!.symbol, 5, invalid),
            RangeError,
        );
    }
});

test('modifications use recipe symbols as their only machine identity', () => {
    const expected = equipmentFixture.modification;
    const modification = getPersonalModification(expected.kineticRecipeSymbol);
    assert.ok(modification);
    assert.equal(modification.name, 'Greater Range');
    assert.equal(getPersonalModification(' WEAPON_RANGE_KINETIC '), modification);
    assert.equal(getPersonalModification('unknown'), null);
    assert.throws(() => getPersonalModification(42 as unknown as string), TypeError);
});

test('journal collisions resolve to technology-specific weapon recipes', () => {
    const expected = equipmentFixture.modification;
    const ar50 = getPersonalWeaponByName('Karma AR-50');
    const aphelion = getPersonalWeaponByName('TK Aphelion');
    assert.ok(ar50 && aphelion);
    assert.equal(
        resolvePersonalModificationForWeapon(ar50.symbol, expected.journalSymbol),
        equipmentFixture.modification.kineticRecipeSymbol,
    );
    assert.equal(
        resolvePersonalModificationForWeapon(
            aphelion.symbol,
            ` ${expected.journalSymbol.toUpperCase()} `,
        ),
        equipmentFixture.modification.laserRecipeSymbol,
    );
    assert.equal(resolvePersonalModificationForWeapon(ar50.symbol, 'weapon_scope'), 'weapon_scope');
    assert.equal(resolvePersonalModificationForWeapon('unknown', 'weapon_range'), 'weapon_range');
    assert.equal(
        resolvePersonalModificationForWeapon(ar50.symbol, 'weapon_range_kinetic'),
        'weapon_range_kinetic',
    );
    assert.throws(
        () => resolvePersonalModificationForWeapon(ar50.symbol, 42 as unknown as string),
        TypeError,
    );
    assert.throws(
        () => resolvePersonalModificationForWeapon(42 as unknown as string, 'weapon_range'),
        TypeError,
    );

    for (const weapon of PERSONAL_WEAPONS) {
        for (const journalSymbol of ['weapon_range', 'weapon_headshotdamage', 'weapon_accuracy']) {
            const recipeSymbol = resolvePersonalModificationForWeapon(weapon.symbol, journalSymbol);
            assert.equal(recipeSymbol, `${journalSymbol}_${weapon.engineeringType}`);
            assert.ok(getPersonalModification(recipeSymbol));
            assert.ok(getPersonalModificationCost(recipeSymbol));
        }
    }
});

test('modification costs are keyed by the resolved recipe symbol', () => {
    const expected = equipmentFixture.modification;
    assert.deepEqual(
        getPersonalModificationCost(expected.kineticRecipeSymbol)?.[0],
        expected.kineticFirstIngredient,
    );
    assert.deepEqual(
        getPersonalModificationCost(expected.laserRecipeSymbol)?.[0],
        expected.laserFirstIngredient,
    );
    assert.equal(getPersonalModificationCost('unknown'), null);
    assert.throws(() => getPersonalModificationCost(42 as unknown as string), TypeError);
    assert.equal(
        getPersonalModificationCost('suit_nightvision')?.[0]?.symbol,
        'surveillanceequipment',
    );
});

test('all engineering ingredients join to the shared micro-resource catalogue', () => {
    const recipes = [
        ...Object.values(PERSONAL_UPGRADE_COSTS.suits).flatMap((costs) => Object.values(costs)),
        ...Object.values(PERSONAL_UPGRADE_COSTS.weaponGroups).flatMap((costs) =>
            Object.values(costs),
        ),
        ...Object.values(PERSONAL_MODIFICATION_COSTS),
    ];
    for (const recipe of recipes) {
        for (const ingredient of recipe) {
            assert.ok(
                getMicroResourceBySymbol(ingredient.symbol, ALL_MICRO_RESOURCES),
                `unknown micro resource ${ingredient.symbol}`,
            );
        }
    }
});

test('catalogue identities are unique and modification recipe targets are complete', () => {
    assert.equal(new Set(SUITS.map((suit) => suit.family.toLowerCase())).size, SUITS.length);
    assert.equal(new Set(SUITS.map((suit) => suit.name.toLowerCase())).size, SUITS.length);
    const suitGradeSymbols = SUITS.flatMap((suit) =>
        Object.values(suit.grades).map(({ symbol }) => symbol.toLowerCase()),
    );
    assert.equal(new Set(suitGradeSymbols).size, suitGradeSymbols.length);
    assert.equal(
        new Set(PERSONAL_WEAPONS.map((weapon) => weapon.symbol.toLowerCase())).size,
        PERSONAL_WEAPONS.length,
    );
    assert.equal(
        new Set(PERSONAL_WEAPONS.map((weapon) => weapon.name.toLowerCase())).size,
        PERSONAL_WEAPONS.length,
    );
    assert.equal(
        Object.values(PERSONAL_MODIFICATIONS).filter(({ target }) => target === 'suit').length,
        14,
    );
    assert.equal(
        Object.values(PERSONAL_MODIFICATIONS).filter(({ target }) => target === 'weapon').length,
        17,
    );
    assert.deepEqual(
        Object.keys(PERSONAL_MODIFICATION_COSTS).sort(),
        Object.keys(PERSONAL_MODIFICATIONS).sort(),
    );
});

test('sumPersonalEngineeringIngredients merges case-insensitively in first-seen order', () => {
    assert.deepEqual(
        sumPersonalEngineeringIngredients(
            [
                { symbol: 'graphene', count: 2 },
                { symbol: 'suitschematic', count: 1 },
            ],
            [{ symbol: 'Graphene', count: 5 }],
        ),
        [
            { symbol: 'graphene', count: 7 },
            { symbol: 'suitschematic', count: 1 },
        ],
    );
});

test('all personal-equipment catalogues and nested records are frozen', () => {
    for (const catalogue of [
        SUITS,
        PERSONAL_WEAPONS,
        PERSONAL_UPGRADE_COSTS,
        PERSONAL_MODIFICATIONS,
        PERSONAL_MODIFICATION_COSTS,
    ]) {
        assert.equal(Object.isFrozen(catalogue), true);
    }
    assert.equal(Object.isFrozen(SUITS[0]!.grades['1']), true);
    assert.equal(Object.isFrozen(PERSONAL_WEAPONS[0]!.grades['1']), true);
    assert.equal(Object.isFrozen(PERSONAL_MODIFICATIONS.suit_nightvision?.engineers), true);
    assert.equal(Object.isFrozen(PERSONAL_MODIFICATION_COSTS.suit_nightvision), true);
});
