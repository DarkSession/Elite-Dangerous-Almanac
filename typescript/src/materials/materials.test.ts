import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    getMaterial,
    getMaterialBySymbol,
    getMaterialByName,
    getMaterialByElementSymbol,
    materialsByGrade,
    materialsInLine,
    materialsInCategory,
    MaterialGrade,
    MaterialLine,
    type Material,
} from './materials.js';
import { RAW_MATERIALS } from './materials-raw.js';
import { MANUFACTURED_MATERIALS } from './materials-manufactured.js';
import { ENCODED_MATERIALS } from './materials-encoded.js';
import { ALL_MATERIALS } from './materials-all.js';
import materialsFixture from '../../../fixtures/materials/materials.json' with { type: 'json' };

const CATALOGUES: Record<string, readonly Material[]> = {
    raw: RAW_MATERIALS,
    manufactured: MANUFACTURED_MATERIALS,
    encoded: ENCODED_MATERIALS,
    all: ALL_MATERIALS,
};

const GRADES: readonly MaterialGrade[] = [
    MaterialGrade.VeryCommon,
    MaterialGrade.Common,
    MaterialGrade.Standard,
    MaterialGrade.Rare,
    MaterialGrade.VeryRare,
];

for (const [name, expected] of Object.entries(materialsFixture.counts)) {
    test(`the ${name} catalogue holds ${expected} materials`, () => {
        assert.equal(CATALOGUES[name]!.length, expected);
    });
}

test('ALL_MATERIALS is exactly the three catalogues concatenated', () => {
    assert.deepEqual(ALL_MATERIALS, [
        ...RAW_MATERIALS,
        ...MANUFACTURED_MATERIALS,
        ...ENCODED_MATERIALS,
    ]);
});

test('fixture records resolve by symbol and name with the expected fields', () => {
    for (const expected of materialsFixture.records) {
        const bySymbol = getMaterialBySymbol(expected.symbol, ALL_MATERIALS);
        assert.ok(bySymbol, `missing ${expected.symbol}`);
        assert.deepEqual(bySymbol, expected);
        // The same record is reachable by its display name.
        assert.deepEqual(getMaterialByName(expected.name, ALL_MATERIALS), expected);
    }
});

test('an empty or absent key never coincidentally matches a record', () => {
    // Manufactured/encoded materials carry a null elementSymbol; an empty or
    // absent-key query must return null rather than any of them.
    assert.equal(getMaterialBySymbol('', ALL_MATERIALS), null);
    assert.equal(getMaterialByElementSymbol('', ALL_MATERIALS), null);
});

test('grade is the rarity: every grade is 1-5, its enum name is the tier, raw never exceeds 4', () => {
    for (const material of ALL_MATERIALS) {
        assert.ok(material.grade >= 1 && material.grade <= 5);
        // The grade's enum member name is the rarity tier (no separate rarity field).
        assert.equal(typeof MaterialGrade[material.grade], 'string');
    }
    assert.ok(!('rarity' in (getMaterialByName('Iron', RAW_MATERIALS) as object)));
    assert.equal(MaterialGrade[MaterialGrade.VeryRare], 'VeryRare');
    assert.ok(RAW_MATERIALS.every((m) => m.grade <= MaterialGrade.Rare));
    assert.equal(materialsByGrade(MaterialGrade.VeryRare, RAW_MATERIALS).length, 0);
});

test('getMaterialBySymbol matches the Frontier symbol / journal id, case-insensitively', () => {
    // The journal reports the lower-cased symbol; it must still resolve.
    assert.equal(
        getMaterialBySymbol('temperedalloys', MANUFACTURED_MATERIALS)?.name,
        'Tempered Alloys',
    );
    assert.equal(
        getMaterialBySymbol('TemperedAlloys', MANUFACTURED_MATERIALS)?.name,
        'Tempered Alloys',
    );
    assert.equal(
        getMaterialByName('imperial shielding', MANUFACTURED_MATERIALS)?.grade,
        MaterialGrade.VeryRare,
    );
    assert.equal(getMaterialBySymbol('nonexistent', ALL_MATERIALS), null);
    assert.equal(getMaterialByName('nonexistent', ALL_MATERIALS), null);
});

test('only raw materials carry an element symbol', () => {
    assert.equal(getMaterialByName('iron', RAW_MATERIALS)?.elementSymbol, 'Fe');
    assert.equal(getMaterialByElementSymbol('fe', RAW_MATERIALS)?.name, 'Iron');
    assert.equal(getMaterialByElementSymbol('Fe', RAW_MATERIALS)?.name, 'Iron');
    assert.ok(RAW_MATERIALS.every((m) => typeof m.elementSymbol === 'string'));
    assert.ok(MANUFACTURED_MATERIALS.every((m) => m.elementSymbol === null));
    assert.ok(ENCODED_MATERIALS.every((m) => m.elementSymbol === null));
    // A manufactured material has no element symbol, so the lookup never finds it.
    assert.equal(getMaterialByElementSymbol('fe', MANUFACTURED_MATERIALS), null);
    assert.equal(getMaterialByElementSymbol('nonexistent', ALL_MATERIALS), null);
});

test('materialsByGrade selects by grade across every grade', () => {
    // Every grade 1-5 is represented somewhere (raw lacks 5, but manufactured/encoded have it).
    for (const grade of GRADES) {
        assert.ok(materialsByGrade(grade, ALL_MATERIALS).length > 0);
    }
    // A grade-4 raw material exists in each of the seven lines.
    assert.equal(materialsByGrade(MaterialGrade.Rare, RAW_MATERIALS).length, 7);
});

test('materialsInLine returns exactly the requested line', () => {
    for (const { catalogue, line, grades } of materialsFixture.lineGrades) {
        const found = materialsInLine(line as MaterialLine, CATALOGUES[catalogue]!);
        assert.deepEqual(
            found.map((m) => m.grade),
            grades,
        );
    }
    // A line with no members in this catalogue yields an empty array.
    assert.deepEqual(materialsInLine(MaterialLine.Guardian, RAW_MATERIALS), []);
});

test('materialsInLine ignores case and whitespace', () => {
    const alloys = materialsInLine(MaterialLine.Alloys, MANUFACTURED_MATERIALS);
    assert.ok(alloys.length > 0);
    for (const spelling of ['alloys', 'ALLOYS', ' Alloys ']) {
        assert.deepEqual(
            materialsInLine(spelling, MANUFACTURED_MATERIALS),
            alloys,
            `${spelling} should resolve like MaterialLine.Alloys`,
        );
    }
    // A multi-word line, where a caller is most likely to re-case.
    assert.deepEqual(
        materialsInLine('emission data', ENCODED_MATERIALS),
        materialsInLine(MaterialLine.EmissionData, ENCODED_MATERIALS),
    );
});

test('every material line value is a member of the MaterialLine enum', () => {
    const lines = new Set<string>(Object.values(MaterialLine));
    for (const material of ALL_MATERIALS) {
        assert.ok(lines.has(material.line), `unknown line ${material.line}`);
    }
});

test('the newer Thargoid materials not in FDevIDs are present and resolve by symbol', () => {
    for (const name of materialsFixture.notInFdevIds) {
        const material = getMaterialByName(name, ALL_MATERIALS);
        assert.ok(material, `missing ${name}`);
        // Sourced from INARA rather than FDevIDs, but still keyed by their journal symbol.
        assert.equal(typeof material.symbol, 'string');
        assert.deepEqual(getMaterialBySymbol(material.symbol, ALL_MATERIALS), material);
        assert.equal(material.elementSymbol, null);
        assert.equal(material.line, MaterialLine.Thargoid);
    }
});

test('every lookup searches all materials when no catalogue is given', () => {
    // The common call is the one-argument one: the catalogue argument only narrows,
    // and reaches the very same frozen record (identity, not just deep equality).
    assert.equal(
        getMaterialBySymbol('temperedalloys'),
        getMaterialBySymbol('temperedalloys', MANUFACTURED_MATERIALS),
    );
    assert.equal(getMaterialByName('iron')?.elementSymbol, 'Fe');
    assert.equal(getMaterialByElementSymbol('fe')?.name, 'Iron');
    assert.equal(
        materialsByGrade(MaterialGrade.VeryRare).length,
        materialsByGrade(MaterialGrade.VeryRare, ALL_MATERIALS).length,
    );
    assert.deepEqual(
        materialsInLine(MaterialLine.Chemical).map((m) => m.grade),
        [1, 2, 3, 4, 5],
    );
    // Encoded materials are reachable without naming their catalogue, which is the
    // whole point: a journal line does not say which category a symbol belongs to.
    assert.equal(getMaterialBySymbol('bulkscandata')?.category, 'encoded');
});

test('an explicit catalogue still narrows the search', () => {
    // Iron is raw, so a manufactured-only search must not find it.
    assert.equal(getMaterialByName('iron', MANUFACTURED_MATERIALS), null);
    assert.equal(getMaterialByName('iron', RAW_MATERIALS)?.category, 'raw');
    assert.equal(materialsByGrade(MaterialGrade.VeryRare, RAW_MATERIALS).length, 0);
    assert.deepEqual(materialsInLine(MaterialLine.Chemical, ENCODED_MATERIALS), []);
    assert.deepEqual(materialsInCategory('raw', MANUFACTURED_MATERIALS), []);
    // Any array works, not only the shipped catalogues.
    const justIron = ALL_MATERIALS.filter((m) => m.name === 'Iron');
    assert.equal(getMaterialByName('carbon', justIron), null);
    assert.equal(getMaterialByName('iron', justIron)?.name, 'Iron');
});

test('getMaterial resolves a symbol, a display name or an element symbol', () => {
    const iron = getMaterialByName('Iron', RAW_MATERIALS);
    assert.ok(iron);
    // All three keys reach the same record — the caller need not know which it holds.
    assert.deepEqual(getMaterial('iron'), iron);
    assert.deepEqual(getMaterial('Iron'), iron);
    assert.deepEqual(getMaterial(' FE '), iron);
    // A multi-word display name and its journal symbol both resolve.
    assert.equal(getMaterial('grid resistors')?.symbol, 'GridResistors');
    assert.equal(getMaterial('gridresistors')?.name, 'Grid Resistors');
    assert.equal(getMaterial('nonexistent'), null);
    assert.equal(getMaterial(''), null);
    // The catalogue argument narrows it like every other lookup.
    assert.equal(getMaterial('fe', MANUFACTURED_MATERIALS), null);
});

test('getMaterial tries symbol, then name, then element symbol', () => {
    // The three keyspaces are disjoint in the shipped data, so the documented
    // precedence is only observable against a catalogue that makes them collide.
    const grid = getMaterialBySymbol('GridResistors');
    const iron = getMaterialByName('Iron');
    assert.ok(grid && iron);

    // A decoy whose *name* is another record's symbol: the symbol match must win.
    const nameDecoy: Material = { ...iron, name: 'GridResistors' };
    assert.equal(getMaterial('gridresistors', [nameDecoy, grid])?.symbol, 'GridResistors');

    // A decoy whose *element symbol* is another record's display name: name wins.
    const elementDecoy: Material = { ...iron, elementSymbol: 'Grid Resistors' };
    assert.equal(getMaterial('grid resistors', [elementDecoy, grid])?.symbol, 'GridResistors');

    // With no higher-precedence match, the element symbol still resolves.
    assert.equal(getMaterial('fe', [grid, iron])?.name, 'Iron');
});

test('materialsInCategory returns exactly one category, case-insensitively', () => {
    for (const [category, expected] of Object.entries(materialsFixture.counts)) {
        if (category === 'all') continue;
        assert.equal(materialsInCategory(category).length, expected);
        assert.ok(materialsInCategory(category).every((m) => m.category === category));
    }
    assert.equal(materialsInCategory(' Encoded ').length, materialsInCategory('encoded').length);
    assert.deepEqual(materialsInCategory('nonexistent'), []);
    // The same answer as importing the category's own catalogue module.
    assert.deepEqual(materialsInCategory('raw'), [...RAW_MATERIALS]);
});

test('catalogues and their records are frozen', () => {
    const iron = getMaterialByName('Iron', RAW_MATERIALS);
    assert.ok(iron);
    assert.equal(Object.isFrozen(RAW_MATERIALS), true);
    assert.equal(Object.isFrozen(ALL_MATERIALS), true);
    assert.equal(Object.isFrozen(iron), true);
    assert.throws(() => Object.assign(iron, { name: 'Changed' }), TypeError);
    assert.throws(() => Array.prototype.push.call(RAW_MATERIALS, iron as unknown), TypeError);
});
