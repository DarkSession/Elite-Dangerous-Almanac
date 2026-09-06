import assert from 'node:assert/strict';
import { test } from 'node:test';

import suitLoadoutCapture from '../../../fixtures/equipment/journal-suit-loadout-dominator.jsonc' with { type: 'json' };
import switchSuitLoadoutCapture from '../../../fixtures/equipment/journal-switch-suit-loadout-dominator.jsonc' with { type: 'json' };
import suitLoadoutFixture from '../../../fixtures/equipment/suit-loadouts.jsonc' with { type: 'json' };
import { applyPersonalModifiers } from './engineering.js';
import { parseSuitLoadout, type SuitLoadout, type SuitLoadoutEvent } from './suit-loadout.js';

const round = (value: number) => Number(value.toFixed(3));
const asEvent = (event: unknown) => event as SuitLoadoutEvent;

test('a captured suit loadout imports with its suit, grade and loadout identity', () => {
    const expected = suitLoadoutFixture.capture;
    const loadout = parseSuitLoadout(asEvent(suitLoadoutCapture));

    assert.equal(loadout.suit.family, expected.suitFamily);
    assert.equal(loadout.suit.name, expected.suitName);
    assert.equal(loadout.grade, expected.grade);
    assert.equal(loadout.stats.symbol, suitLoadoutCapture.SuitName);
    assert.equal(loadout.suitId, expected.suitId);
    assert.equal(loadout.loadoutId, expected.loadoutId);
    assert.equal(loadout.name, expected.name);
    assert.deepEqual(
        loadout.modifications.map(({ symbol }) => symbol),
        expected.modifications,
    );
    assert.deepEqual(loadout.outcomes, []);
});

test('a captured suit loadout folds its suit modifiers onto the suit stats', () => {
    const expected = suitLoadoutFixture.capture;
    const { stats, modifiers } = parseSuitLoadout(asEvent(suitLoadoutCapture));

    assert.equal(
        round(applyPersonalModifiers('shieldRegeneration', stats.shieldRegeneration, modifiers)),
        expected.shieldRegeneration,
    );
    // Damage Resistance multiplies the damage taken, so a resistance compounds on 1 − r.
    assert.equal(
        round(
            applyPersonalModifiers(
                'armourKineticResistance',
                stats.armourKineticResistance,
                modifiers,
            ),
        ),
        expected.armourKineticResistance,
    );
});

test('a captured suit loadout resolves the weapon at every mount', () => {
    const { weapons } = parseSuitLoadout(asEvent(suitLoadoutCapture));
    assert.equal(weapons.length, suitLoadoutFixture.capture.weapons.length);

    for (const [index, expected] of suitLoadoutFixture.capture.weapons.entries()) {
        const fitted = weapons[index];
        assert.ok(fitted, expected.mount);
        assert.equal(fitted.mount, expected.mount);
        assert.equal(fitted.moduleId, expected.moduleId);
        assert.equal(fitted.weapon.symbol, expected.symbol);
        assert.equal(fitted.weapon.name, expected.name);
        assert.equal(fitted.grade, expected.grade);
        // `weapon_accuracy` names one recipe per weapon technology; the mount settles it.
        assert.deepEqual(
            fitted.modifications.map(({ symbol }) => symbol),
            expected.modifications,
        );
        assert.equal(fitted.reloadSpeed, expected.reloadSpeed);
        assert.equal(fitted.scope, expected.scope);
        assert.equal(
            applyPersonalModifiers('magazineSize', fitted.weapon.magazineSize, fitted.modifiers),
            expected.magazineSize,
        );
        // Extra Ammo Capacity sits on the suit and multiplies the weapon's reserve.
        assert.equal(
            applyPersonalModifiers('reserveAmmo', fitted.weapon.reserveAmmo, fitted.modifiers),
            expected.reserveAmmo,
        );
        assert.equal(round(fitted.metrics.damagePerShot), expected.damagePerShot);
        assert.equal(round(fitted.metrics.headshotDamagePerShot), expected.headshotDamagePerShot);
        assert.equal(round(fitted.metrics.damagePerSecond), expected.damagePerSecond);
        assert.equal(
            round(fitted.metrics.sustainedDamagePerSecond),
            expected.sustainedDamagePerSecond,
        );
    }
});

test('SwitchSuitLoadout and SuitLoadout carry the same loadout', () => {
    assert.notEqual(switchSuitLoadoutCapture.event, suitLoadoutCapture.event);
    assert.deepEqual(
        parseSuitLoadout(asEvent(switchSuitLoadoutCapture)),
        parseSuitLoadout(asEvent(suitLoadoutCapture)),
    );
});

test('Reload Speed shortens the reload the sustained figures average in', () => {
    const [withReload] = parseSuitLoadout(asEvent(suitLoadoutCapture)).weapons;
    assert.ok(withReload?.reloadSpeed);

    const stock = parseSuitLoadout({
        SuitName: 'tacticalsuit_class5',
        Modules: [
            {
                SlotName: 'PrimaryWeapon1',
                ModuleName: withReload.weapon.symbol,
                Class: withReload.grade,
                WeaponMods: ['weapon_clipsize'],
            },
        ],
    }).weapons[0];
    assert.ok(stock);
    assert.equal(stock.reloadSpeed, false);
    assert.equal(stock.metrics.damagePerSecond, withReload.metrics.damagePerSecond);
    assert.ok(stock.metrics.sustainedDamagePerSecond < withReload.metrics.sustainedDamagePerSecond);
});

for (const [name, pinned] of Object.entries(suitLoadoutFixture.imports)) {
    test(`an import reports ${name}`, () => {
        const loadout = parseSuitLoadout(asEvent(pinned.event));
        assert.deepEqual(
            loadout.weapons.map(({ mount }) => mount),
            pinned.mounts,
        );
        assert.deepEqual(loadout.outcomes, pinned.outcomes);
    });
}

for (const [name, event] of Object.entries(suitLoadoutFixture.refusals)) {
    test(`an event with ${name} is refused`, () => {
        assert.throws(() => parseSuitLoadout(asEvent(event)), TypeError);
    });
}

test('an event states no modifications and no modules', () => {
    const loadout = parseSuitLoadout({ SuitName: 'flightsuit' });

    assert.equal(loadout.suit.family, 'flightsuit');
    assert.equal(loadout.grade, 1);
    assert.equal(loadout.suitId, null);
    assert.equal(loadout.loadoutId, null);
    assert.equal(loadout.name, null);
    assert.deepEqual(loadout.modifications, []);
    assert.deepEqual(loadout.modifiers, []);
    assert.deepEqual(loadout.weapons, []);
    assert.deepEqual(loadout.outcomes, []);
});

test('an imported loadout is frozen through every nested record', () => {
    const loadout: SuitLoadout = parseSuitLoadout(asEvent(suitLoadoutCapture));

    assert.equal(Object.isFrozen(loadout), true);
    assert.equal(Object.isFrozen(loadout.weapons), true);
    assert.equal(Object.isFrozen(loadout.weapons[0]), true);
    assert.equal(Object.isFrozen(loadout.weapons[0]?.modifications[0]), true);
    assert.equal(Object.isFrozen(loadout.weapons[0]?.metrics), true);
    assert.equal(Object.isFrozen(loadout.modifications), true);
    assert.equal(Object.isFrozen(loadout.modifiers), true);
    assert.equal(Object.isFrozen(loadout.outcomes), true);
});
