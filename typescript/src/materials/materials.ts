/**
 * Engineering-material types and lookups.
 *
 * Elite Dangerous groups its engineering materials into three categories — raw,
 * manufactured and encoded — each material carrying a **grade** ({@link MaterialGrade})
 * and sitting in a **line** ({@link MaterialLine}: Chemical, Emission Data, the seven
 * raw element families, …). This module holds the {@link Material} record shape, the
 * grade ⇄ rarity mapping, and the functions that find one
 * ({@link getMaterialBySymbol}, {@link getMaterialByName}, {@link materialsByGrade},
 * {@link materialsInLine}, …).
 *
 * **Every lookup searches all 146 materials by default** — you do not have to hand it
 * a catalogue:
 *
 * ```ts
 * getMaterialByName('iron')?.grade; // -> MaterialGrade.VeryCommon (1)
 * ```
 *
 * The three **by-key** lookups take an optional second argument to **narrow** the
 * search to a subset — one category's catalogue, or any array you have filtered
 * yourself:
 *
 * | Module | Export | Entries |
 * | --- | --- | --- |
 * | `./materials-raw` | `RAW_MATERIALS` | 28 |
 * | `./materials-manufactured` | `MANUFACTURED_MATERIALS` | 71 |
 * | `./materials-encoded` | `ENCODED_MATERIALS` | 47 |
 * | `./materials-all` | `ALL_MATERIALS` | 146 (the default) |
 *
 * It narrows *results*, not bundle size: importing a lookup pulls all three
 * catalogues, since that is what it falls back to — ~17 KiB minified for all 146.
 * {@link materialsInCategory} reaches the same subsets from a plain string.
 *
 * **Only `ALL_MATERIALS` itself is indexed.** A by-key lookup answers from an O(1)
 * index when the catalogue you pass *is* `ALL_MATERIALS` — the same object, not a copy
 * — and scans linearly otherwise, including for `[...ALL_MATERIALS]`, which holds the
 * same 146 records. Omitting the argument always takes the indexed path, so pass one
 * only when you mean to exclude the rest.
 *
 * The filtering lookups ({@link materialsByGrade}, {@link materialsInLine},
 * {@link materialsInCategory}) take no catalogue: each returns an array, so narrowing
 * one is `.filter()` on the result or on the subset you already imported.
 *
 * Data originates from EDCD FDevIDs, with Thargoid materials absent from that
 * pinned source supplied by INARA; see [`data/materials/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/materials/SOURCES.md).
 *
 * @example
 * ```ts
 * import { getMaterialByName, materialsInCategory } from '@elite-dangerous-almanac/core/materials';
 *
 * getMaterialByName('iron')?.grade;     // -> MaterialGrade.VeryCommon (1)
 * materialsInCategory('raw').length;    // -> 28
 * ```
 *
 * @packageDocumentation
 */

import { ALL_MATERIALS } from './materials-all.js';
import { describeValue } from '../internal/argument-guards.js';
import {
    createKeyIndex,
    filterByKey,
    findByKey,
    findInKeyIndex,
} from '../internal/registry-index.js';

/** Which of the three engineering-material categories a material belongs to. */
export type MaterialCategory = 'raw' | 'manufactured' | 'encoded';

/**
 * A material grade, 1–5. **A material's grade is its rarity** — the members are named
 * for the rarity each grade denotes, so there is no separate rarity field.
 *
 * @remarks
 * Raw materials only reach {@link MaterialGrade.Rare} (4); grade 5 appears in the
 * manufactured and encoded categories only. The numeric values match Frontier's own
 * grading, so a `MaterialGrade` compares equal to the plain number (`grade === 5`).
 * The member name is the rarity — read it with `MaterialGrade[grade]` (`"VeryCommon"`)
 * if you need a string.
 */
export enum MaterialGrade {
    /** Grade 1 — Very Common. */
    VeryCommon = 1,
    /** Grade 2 — Common. */
    Common = 2,
    /** Grade 3 — Standard. */
    Standard = 3,
    /** Grade 4 — Rare. The highest grade a raw element reaches. */
    Rare = 4,
    /** Grade 5 — Very Rare. Manufactured and encoded materials only. */
    VeryRare = 5,
}

/**
 * The in-game line (group) a material belongs to.
 *
 * @remarks
 * The seven raw lines are named after their grade-1 element (Carbon, Phosphorus,
 * Sulphur, Iron, Nickel, Rhenium, Lead). Manufactured and encoded materials use
 * Frontier's group names. Guardian and Thargoid materials — which Frontier files
 * outside the standard groups — are collected under {@link MaterialLine.Guardian}
 * and {@link MaterialLine.Thargoid}.
 */
export enum MaterialLine {
    /** Raw element family, grades 1–4: Carbon, Vanadium, Niobium, Yttrium. */
    Carbon = 'Carbon',
    /** Raw element family, grades 1–4, starting at Phosphorus. */
    Phosphorus = 'Phosphorus',
    /** Raw element family, grades 1–4, starting at Sulphur. */
    Sulphur = 'Sulphur',
    /** Raw element family, grades 1–4, starting at Iron. */
    Iron = 'Iron',
    /** Raw element family, grades 1–4, starting at Nickel. */
    Nickel = 'Nickel',
    /** Raw element family, grades 1–4, starting at Rhenium. */
    Rhenium = 'Rhenium',
    /** Raw element family, grades 1–4, starting at Lead. */
    Lead = 'Lead',
    /** Manufactured line, grades 1–5 (Chemical Storage Units → Chemical Manipulators). */
    Chemical = 'Chemical',
    /** Manufactured line, grades 1–5 (Thermic alloys and processors). */
    Thermic = 'Thermic',
    /** Manufactured line, grades 1–5 (heat conduction wiring → exchangers). */
    Heat = 'Heat',
    /** Manufactured line, grades 1–5 (conductive components → polymers). */
    Conductive = 'Conductive',
    /** Manufactured line, grades 1–5 (mechanical scrap → equipment). */
    MechanicalComponents = 'Mechanical Components',
    /** Manufactured line, grades 1–5 (grid resistors → military supercapacitors). */
    Capacitors = 'Capacitors',
    /** Manufactured line, grades 1–5 (worn shield emitters → imperial shielding). */
    Shielding = 'Shielding',
    /** Manufactured line, grades 1–5 (compact composites → core dynamics composites). */
    Composite = 'Composite',
    /** Manufactured line, grades 1–5 (crystal shards → exquisite focus crystals). */
    Crystals = 'Crystals',
    /** Manufactured line, grades 1–5 (salvaged alloys → proto light alloys). */
    Alloys = 'Alloys',
    /** Encoded line, grades 1–5 (exceptional scrambled emission data → abnormal compact emissions). */
    EmissionData = 'Emission Data',
    /** Encoded line, grades 1–5 (atypical disrupted wake echoes → datamined wake exceptions). */
    WakeScans = 'Wake Scans',
    /** Encoded line, grades 1–5 (distorted shield cycle recordings → inconsistent shield soak analysis). */
    ShieldData = 'Shield Data',
    /** Encoded line, grades 1–5 (unusual encrypted files → adaptive encryptors capture). */
    EncryptionFiles = 'Encryption Files',
    /** Encoded line, grades 1–5 (atypical encoded data → classified scan databanks). */
    DataArchives = 'Data Archives',
    /** Encoded line, grades 1–5 (specialised legacy firmware → modified embedded firmware). */
    EncodedFirmware = 'Encoded Firmware',
    /** Guardian technology materials, filed outside the standard lines. */
    Guardian = 'Guardian',
    /** Thargoid materials (including the caustic/Titan set), outside the standard lines. */
    Thargoid = 'Thargoid',
}

/**
 * One engineering material and how it is classified.
 *
 * @remarks
 * A `Material` is a plain, frozen value object. `category` is derived from the
 * catalogue the record lives in. There is no separate rarity field — the `grade` is
 * the rarity (its {@link MaterialGrade} member name is the rarity tier).
 */
export interface Material {
    /** Which category this material belongs to. */
    readonly category: MaterialCategory;
    /**
     * Frontier's internal symbol, e.g. `"GridResistors"` — the id the player journal
     * reports (case-insensitively, so `"gridresistors"` matches). This is the same
     * field, with the same meaning, as `symbol` on a ship or outfitting module.
     */
    readonly symbol: string;
    /** Display name, e.g. `"Grid Resistors"`. */
    readonly name: string;
    /**
     * The chemical element symbol for a raw material, e.g. `"Fe"` for Iron.
     *
     * @remarks
     * Only raw materials — which are chemical elements — have one. Manufactured and
     * encoded materials are `null`.
     */
    readonly elementSymbol: string | null;
    /** The material grade, 1–5 (raw materials only reach 4) — this is its rarity. */
    readonly grade: MaterialGrade;
    /** The in-game line (group) this material sits in. */
    readonly line: MaterialLine;
}

const MATERIALS_BY_SYMBOL = /* @__PURE__ */ createKeyIndex(ALL_MATERIALS, 'symbol');
const MATERIALS_BY_NAME = /* @__PURE__ */ createKeyIndex(ALL_MATERIALS, 'name');
const MATERIALS_BY_ELEMENT = /* @__PURE__ */ createKeyIndex(ALL_MATERIALS, 'elementSymbol');

/**
 * Look up a material by its Frontier symbol / journal id (case-insensitive).
 *
 * Here, `symbol` is Frontier's internal item id for the material.
 *
 * @param symbol - The internal symbol, e.g. `"GridResistors"`, or the lower-cased
 * form the player journal reports (`"gridresistors"`). Leading/trailing whitespace
 * and case are ignored.
 * @param materials - Optional subset to search instead of all 146 materials —
 * `RAW_MATERIALS`, `MANUFACTURED_MATERIALS`, `ENCODED_MATERIALS`, or any array you
 * have filtered yourself. Omit it unless you specifically want to exclude the rest:
 * the indexed O(1) path is taken only when the argument is omitted or is
 * `ALL_MATERIALS` **by reference**, and every other array — a copy of that same
 * catalogue included — is scanned.
 * @returns The matching {@link Material}, or `null` if no material has that symbol.
 * @throws {TypeError} If `symbol` is present and not a string. A nullish
 * `symbol` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getMaterialBySymbol } from '@elite-dangerous-almanac/core/materials/materials';
 *
 * getMaterialBySymbol('temperedalloys')?.name; // -> 'Tempered Alloys'
 * ```
 */
export function getMaterialBySymbol(
    symbol: string,
    materials: readonly Material[] = ALL_MATERIALS,
): Material | null {
    return materials === ALL_MATERIALS
        ? findInKeyIndex(MATERIALS_BY_SYMBOL, symbol, 'getMaterialBySymbol: symbol')
        : findByKey(materials, 'symbol', symbol, 'getMaterialBySymbol: symbol');
}

/**
 * Look up a material by its display name (case-insensitive).
 *
 * @param name - The display name as the catalogue spells it, e.g. `"Grid Resistors"`.
 * Leading/trailing whitespace and case are ignored.
 * @param materials - Optional subset to search (see {@link getMaterialBySymbol}).
 * @returns The matching {@link Material}, or `null` if no material has that name.
 * @throws {TypeError} If `name` is present and not a string. A nullish
 * `name` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getMaterialByName } from '@elite-dangerous-almanac/core/materials/materials';
 *
 * getMaterialByName('imperial shielding')?.grade; // -> 5
 * ```
 */
export function getMaterialByName(
    name: string,
    materials: readonly Material[] = ALL_MATERIALS,
): Material | null {
    return materials === ALL_MATERIALS
        ? findInKeyIndex(MATERIALS_BY_NAME, name, 'getMaterialByName: name')
        : findByKey(materials, 'name', name, 'getMaterialByName: name');
}

/**
 * Look up a raw material by its chemical element symbol (case-insensitive).
 *
 * @param elementSymbol - The element symbol, e.g. `"Fe"` or `"fe"`. Leading/trailing
 * whitespace and case are ignored.
 * @param materials - Optional subset to search (see {@link getMaterialBySymbol}).
 * @returns The matching {@link Material}, or `null`. Only raw materials carry an
 * element symbol, so a manufactured or encoded subset never matches.
 * @throws {TypeError} If `elementSymbol` is present and not a string. A nullish
 * `elementSymbol` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getMaterialByElementSymbol } from '@elite-dangerous-almanac/core/materials/materials';
 *
 * getMaterialByElementSymbol('fe')?.name; // -> 'Iron'
 * ```
 */
export function getMaterialByElementSymbol(
    elementSymbol: string,
    materials: readonly Material[] = ALL_MATERIALS,
): Material | null {
    return materials === ALL_MATERIALS
        ? findInKeyIndex(
              MATERIALS_BY_ELEMENT,
              elementSymbol,
              'getMaterialByElementSymbol: elementSymbol',
          )
        : findByKey(
              materials,
              'elementSymbol',
              elementSymbol,
              'getMaterialByElementSymbol: elementSymbol',
          );
}

/**
 * Every material of a given grade, across all three categories, in catalogue order.
 *
 * @param grade - The grade to match, 1–5 (or a {@link MaterialGrade} member). A grade
 * no material carries matches nothing, the way an unrecognised symbol does.
 * @returns A new array of matches (possibly empty).
 * @throws {TypeError} If `grade` is present and not a number. A nullish `grade` is a
 * miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { MaterialGrade, materialsByGrade } from '@elite-dangerous-almanac/core/materials/materials';
 * import { RAW_MATERIALS } from '@elite-dangerous-almanac/core/materials/materials-raw';
 *
 * materialsByGrade(MaterialGrade.VeryRare).length;                        // -> across every category
 * RAW_MATERIALS.filter((m) => m.grade === MaterialGrade.Rare).length;     // -> 7, one per raw line
 * ```
 */
export function materialsByGrade(grade: MaterialGrade): Material[] {
    if (grade == null) return [];
    if (typeof grade !== 'number') {
        throw new TypeError(
            `materialsByGrade: grade must be a number, received ${describeValue(grade)}`,
        );
    }
    return ALL_MATERIALS.filter((material) => material.grade === grade);
}

/**
 * Every material in a given line, in catalogue order.
 *
 * @param line - The line to match, e.g. `MaterialLine.Chemical`. A plain string of
 * the line's value works too: leading/trailing whitespace and case are ignored, like
 * every other lookup here.
 * @returns A new array of matches (possibly empty).
 * @throws {TypeError} If `line` is present and not a string. A nullish
 * `line` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { MaterialLine, materialsInLine } from '@elite-dangerous-almanac/core/materials/materials';
 *
 * materialsInLine(MaterialLine.Chemical).map((m) => m.grade); // -> [1, 2, 3, 4, 5]
 * ```
 */
export function materialsInLine(line: string): Material[] {
    return filterByKey(ALL_MATERIALS, 'line', line, 'materialsInLine: line');
}

/**
 * Every material in a given category, in catalogue order.
 *
 * @remarks
 * The same answer as importing that category's own catalogue module, reached from a
 * string — which is what you have when the category came from a dropdown or a saved
 * filter rather than from your own source code.
 *
 * @param category - The category to match: `'raw'`, `'manufactured'` or `'encoded'`.
 * Leading/trailing whitespace and case are ignored, like every other lookup here.
 * @returns A new array of matches (possibly empty).
 * @throws {TypeError} If `category` is present and not a string. A nullish
 * `category` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { materialsInCategory } from '@elite-dangerous-almanac/core/materials/materials';
 *
 * materialsInCategory('raw').length;          // -> 28
 * materialsInCategory('Encoded').length;      // -> 47; case is ignored
 * ```
 */
export function materialsInCategory(category: string): Material[] {
    return filterByKey(ALL_MATERIALS, 'category', category, 'materialsInCategory: category');
}
