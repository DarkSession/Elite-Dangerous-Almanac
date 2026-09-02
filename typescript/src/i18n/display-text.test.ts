import assert from 'node:assert/strict';
import { test } from 'node:test';

import fixture from '../../../fixtures/i18n/display-text.jsonc' with { type: 'json' };
import { SUITS, type PersonalMount } from '../equipment/suits.js';
import type { CalculationIssue } from '../ships/loadout-calculations.js';
import type { LoadoutIssue } from '../ships/loadout-validation.js';
import { LoadoutEditError } from '../ships/ship-loadout.js';
import type { BuildSlot, SlotRestriction } from '../ships/slots.js';
import type { SlefDiagnostic } from '../ships/slef.js';
import {
    getCalculationIssueMessage,
    getLoadoutEditErrorMessage,
    getLoadoutIssueMessage,
    getSlefDiagnosticMessage,
} from './diagnostics.js';
import {
    getPreEngineeredVariantName,
    type PreEngineeredVariantIdentity,
} from './pre-engineered.js';
import { getLoadoutSlotName, getSlotRestrictionLabel } from './slots.js';
import { getPersonalMountName } from './suits.js';

for (const row of fixture.preEngineered) {
    test(`pre-engineered ${row.variant.blueprintSymbol} in ${row.locale}`, () => {
        assert.equal(
            getPreEngineeredVariantName(row.variant as PreEngineeredVariantIdentity, row.locale),
            row.expected,
        );
    });
}

for (const row of fixture.slots) {
    test(`slot ${row.slot.key} in ${row.locale}`, () => {
        assert.equal(getLoadoutSlotName(row.slot as BuildSlot, row.locale), row.expected);
    });
}

for (const row of fixture.mounts) {
    test(`mount ${row.mount.key} in ${row.locale}`, () => {
        assert.equal(getPersonalMountName(row.mount as PersonalMount, row.locale), row.expected);
    });
}

for (const row of fixture.restrictions) {
    test(`restriction ${row.restriction} in ${row.locale}`, () => {
        assert.equal(
            getSlotRestrictionLabel(row.restriction as SlotRestriction, row.locale),
            row.expected,
        );
    });
}

for (const row of fixture.diagnostics) {
    test(`${row.kind} diagnostic in ${row.locale}`, () => {
        const diagnostic = row.diagnostic as unknown;
        const actual = (() => {
            switch (row.kind) {
                case 'loadout':
                    return getLoadoutIssueMessage(diagnostic as LoadoutIssue, row.locale);
                case 'calculation':
                    return getCalculationIssueMessage(diagnostic as CalculationIssue, row.locale);
                case 'slef':
                    return getSlefDiagnosticMessage(diagnostic as SlefDiagnostic, row.locale);
                case 'edit': {
                    const value = diagnostic as {
                        readonly code: 'requiredSlot';
                        readonly message: string;
                        readonly params: Readonly<Record<string, string>>;
                    };
                    return getLoadoutEditErrorMessage(
                        new LoadoutEditError(value.message, value.code, value.params),
                        row.locale,
                    );
                }
            }
        })();
        assert.equal(actual, row.expected);
    });
}

test('every mount in the catalogue is named in English and in no other locale', () => {
    for (const suit of SUITS) {
        for (const mount of suit.mounts) {
            assert.ok(getPersonalMountName(mount, 'en'), mount.key);
            assert.equal(getPersonalMountName(mount, 'de'), null, mount.key);
        }
    }
});

test('mount names reject invalid objects and inherited lookup values', () => {
    assert.throws(
        () => getPersonalMountName(null as never, 'en'),
        /mount must be an object, received null/,
    );
    assert.equal(getPersonalMountName({ key: 'constructor' } as never, 'en'), null);
    assert.equal(getPersonalMountName({ key: '__proto__' } as never, 'en'), null);
});

test('slot restrictions reject inherited object properties', () => {
    assert.equal(getSlotRestrictionLabel('toString' as never, 'en'), null);
    assert.equal(getSlotRestrictionLabel('__proto__' as never, 'en'), null);
    assert.equal(getSlotRestrictionLabel('constructor' as never, 'en'), null);
});

test('slot names reject invalid objects and inherited lookup values', () => {
    assert.throws(
        () => getLoadoutSlotName(null as never, 42 as never),
        /slot must be an object, received null/,
    );
    assert.equal(getLoadoutSlotName({ kind: 'core', core: 'constructor' } as never, 'en'), null);
    assert.equal(
        getLoadoutSlotName(
            {
                kind: 'optional',
                restriction: 'toString',
                key: 'Slot01_Size4',
                size: 4,
            } as never,
            'en',
        ),
        'Slot01_Size4',
    );
});

test('diagnostic helpers validate public inputs', () => {
    assert.throws(
        () => getLoadoutIssueMessage(null as never, 'en'),
        /issue must be an object, received null/,
    );
    assert.throws(
        () => getLoadoutIssueMessage(42 as never, 'en'),
        /issue must be an object, received number 42/,
    );
    assert.throws(
        () => getLoadoutIssueMessage({ message: 42 } as never, 'en'),
        /issue\.message must be a string/,
    );
    assert.throws(
        () => getLoadoutIssueMessage({ message: 'x' } as never, null as never),
        /locale must be a string/,
    );
});

test('malformed pre-engineered identities fail at the public boundary', () => {
    assert.throws(
        () => getPreEngineeredVariantName(null as never, 'en'),
        /variant must be an object, received null/,
    );
    assert.throws(
        () => getPreEngineeredVariantName(42 as never, 'en'),
        /variant must be an object, received number 42/,
    );
    assert.throws(
        () =>
            getPreEngineeredVariantName(
                { symbol: 1 as never, blueprintSymbol: 'x', acquisition: 'mercenary' },
                'en',
            ),
        /variant\.symbol must be a string/,
    );
});
