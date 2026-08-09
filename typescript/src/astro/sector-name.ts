/**
 * Procedural (boxel) sector naming for the Elite Dangerous galaxy.
 *
 * Most of the galaxy is not hand-named. Instead the game derives a sector's name
 * algorithmically from its integer position on the 128×128×128 grid of 1280 ly
 * sector cubes. Two schemes exist, chosen per sector by a hash of its position:
 *
 * - **Class 1 (C1)** — a single run-together word, e.g. `Synuefe`, `Pyroifoo`.
 *   Built as `prefix + infix(+ infix) + suffix`.
 * - **Class 2 (C2)** — two words, e.g. `Blae Eock`, `Hypheasms Ni`.
 *   Built as `prefix₁suffix₁ prefix₂suffix₂`.
 *
 * This module implements the forward map ({@link sectorNameFromCoords}) and its
 * inverse ({@link sectorCoordsFromName}) as pure functions. The fragment tables
 * and the run-length/offset lookups derived from them are computed once as module
 * constants; nothing here mutates observable state between calls.
 *
 * Ported and restructured from the EDTS reference algorithm by Andy Martin
 * (Esvandiary), `edtslib/pgdata.py` at https://bitbucket.org/Esvandiary/edts,
 * BSD 3-Clause © 2016 Andy Martin (see ATTRIBUTIONS.md), via
 * the canonn-signals TypeScript port.
 *
 * @packageDocumentation
 */

/**
 * Integer position of a sector on the galaxy's sector grid.
 *
 * Each axis indexes a 1280 ly cube. `x` and `z` span the full 7-bit range
 * (0–127); `y` only reaches 0–63 for real systems (the system-address format has
 * a 6-bit y field), but the naming algorithm itself treats all three as 7-bit.
 */
export interface SectorCoords {
    /** Sector index along the galactic X axis (0–127). */
    x: number;
    /** Sector index along the galactic Y axis (0–63 for addressable systems). */
    y: number;
    /** Sector index along the galactic Z axis (0–127). */
    z: number;
}

// --- Fragment tables (verbatim from the EDTS reference) -------------------------

const PREFIXES: readonly string[] = [
    'Th',
    'Eo',
    'Oo',
    'Eu',
    'Tr',
    'Sly',
    'Dry',
    'Ou',
    'Tz',
    'Phl',
    'Ae',
    'Sch',
    'Hyp',
    'Syst',
    'Ai',
    'Kyl',
    'Phr',
    'Eae',
    'Ph',
    'Fl',
    'Ao',
    'Scr',
    'Shr',
    'Fly',
    'Pl',
    'Fr',
    'Au',
    'Pry',
    'Pr',
    'Hyph',
    'Py',
    'Chr',
    'Phyl',
    'Tyr',
    'Bl',
    'Cry',
    'Gl',
    'Br',
    'Gr',
    'By',
    'Aae',
    'Myc',
    'Gyr',
    'Ly',
    'Myl',
    'Lych',
    'Myn',
    'Ch',
    'Myr',
    'Cl',
    'Rh',
    'Wh',
    'Pyr',
    'Cr',
    'Syn',
    'Str',
    'Syr',
    'Cy',
    'Wr',
    'Hy',
    'My',
    'Sty',
    'Sc',
    'Sph',
    'Spl',
    'A',
    'Sh',
    'B',
    'C',
    'D',
    'Sk',
    'Io',
    'Dr',
    'E',
    'Sl',
    'F',
    'Sm',
    'G',
    'H',
    'I',
    'Sp',
    'J',
    'Sq',
    'K',
    'L',
    'Pyth',
    'M',
    'St',
    'N',
    'O',
    'Ny',
    'Lyr',
    'P',
    'Sw',
    'Thr',
    'Lys',
    'Q',
    'R',
    'S',
    'T',
    'Ea',
    'U',
    'V',
    'W',
    'Schr',
    'X',
    'Ee',
    'Y',
    'Z',
    'Ei',
    'Oe',
];

const INFIXES1: readonly string[] = [
    'o',
    'ai',
    'a',
    'oi',
    'ea',
    'ie',
    'u',
    'e',
    'ee',
    'oo',
    'ue',
    'i',
    'oa',
    'au',
    'ae',
    'oe',
];

const INFIXES2: readonly string[] = [
    'll',
    'ss',
    'b',
    'c',
    'd',
    'f',
    'dg',
    'g',
    'ng',
    'h',
    'j',
    'k',
    'l',
    'm',
    'n',
    'mb',
    'p',
    'q',
    'gn',
    'th',
    'r',
    's',
    't',
    'ch',
    'tch',
    'v',
    'w',
    'wh',
    'ck',
    'x',
    'y',
    'z',
    'ph',
    'sh',
    'ct',
    'wr',
];

const SUFFIXES1: readonly string[] = [
    'oe',
    'io',
    'oea',
    'oi',
    'aa',
    'ua',
    'eia',
    'ae',
    'ooe',
    'oo',
    'a',
    'ue',
    'ai',
    'e',
    'iae',
    'oae',
    'ou',
    'uae',
    'i',
    'ao',
    'au',
    'o',
    'eae',
    'u',
    'aea',
    'ia',
    'ie',
    'eou',
    'aei',
    'ea',
    'uia',
    'oa',
    'aae',
    'eau',
    'ee',
];

const SUFFIXES2: readonly string[] = [
    'b',
    'scs',
    'wsy',
    'c',
    'd',
    'vsky',
    'f',
    'sms',
    'dst',
    'g',
    'rb',
    'h',
    'nts',
    'ch',
    'rd',
    'rld',
    'k',
    'lls',
    'ck',
    'rgh',
    'l',
    'rg',
    'm',
    'n',
    'hm',
    'p',
    'hn',
    'rk',
    'q',
    'rl',
    'r',
    'rm',
    's',
    'cs',
    'wyg',
    'rn',
    'ct',
    't',
    'hs',
    'rbs',
    'rp',
    'tts',
    'v',
    'wn',
    'ms',
    'w',
    'rr',
    'mt',
    'x',
    'rs',
    'cy',
    'y',
    'rt',
    'z',
    'ws',
    'lch',
    'my',
    'ry',
    'nks',
    'nd',
    'sc',
    'ng',
    'sh',
    'nk',
    'sk',
    'nn',
    'ds',
    'sm',
    'sp',
    'ns',
    'nt',
    'dy',
    'ss',
    'st',
    'rrs',
    'xt',
    'nz',
    'sy',
    'xy',
    'rsch',
    'rphs',
    'sts',
    'sys',
    'sty',
    'th',
    'tl',
    'tls',
    'rds',
    'nch',
    'rns',
    'ts',
    'wls',
    'rnt',
    'tt',
    'rdy',
    'rst',
    'pps',
    'tz',
    'tch',
    'sks',
    'ppy',
    'ff',
    'sps',
    'kh',
    'sky',
    'ph',
    'lts',
    'wnst',
    'rth',
    'ths',
    'fs',
    'pp',
    'ft',
    'ks',
    'pr',
    'ps',
    'pt',
    'fy',
    'rts',
    'ky',
    'rshch',
    'mly',
    'py',
    'bb',
    'nds',
    'wry',
    'zz',
    'nns',
    'ld',
    'lf',
    'gh',
    'lks',
    'sly',
    'lk',
    'll',
    'rph',
    'ln',
    'bs',
    'rsts',
    'gs',
    'ls',
    'vvy',
    'lt',
    'rks',
    'qs',
    'rps',
    'gy',
    'wns',
    'lz',
    'nth',
    'phs',
];

/** Prefixes that, in a C2 name, pair with a `SUFFIXES2` suffix. */
const C2_PREFIX_SUFFIX2 = new Set(
    ['Eo', 'Oo', 'Eu', 'Ou', 'Ae', 'Ai', 'Eae', 'Ao', 'Au', 'Aae'].map((s) => s.toLowerCase()),
);

/** Prefixes that, in a C1 name, are followed by a consonant (`INFIXES2`) infix. */
const C1_PREFIX_INFIX2 = new Set(
    [
        'Eo',
        'Oo',
        'Eu',
        'Ou',
        'Ae',
        'Ai',
        'Eae',
        'Ao',
        'Au',
        'Aae',
        'A',
        'Io',
        'E',
        'I',
        'O',
        'Ea',
        'U',
        'Ee',
        'Ei',
        'Oe',
    ].map((s) => s.toLowerCase()),
);

/** Explicit fragment run lengths; every other fragment uses a per-table default. */
const PREFIX_RUN_LENGTHS = new Map<string, number>([
    ['eu', 31],
    ['sly', 4],
    ['tz', 1],
    ['phl', 13],
    ['ae', 12],
    ['hyp', 25],
    ['kyl', 30],
    ['phr', 10],
    ['eae', 4],
    ['ao', 5],
    ['scr', 24],
    ['shr', 11],
    ['fly', 20],
    ['pry', 3],
    ['hyph', 14],
    ['py', 12],
    ['phyl', 8],
    ['tyr', 25],
    ['cry', 5],
    ['aae', 5],
    ['myc', 2],
    ['gyr', 10],
    ['myl', 12],
    ['lych', 3],
    ['myn', 10],
    ['myr', 4],
    ['rh', 15],
    ['wr', 31],
    ['sty', 4],
    ['spl', 16],
    ['sk', 27],
    ['sq', 7],
    ['pyth', 1],
    ['lyr', 10],
    ['sw', 24],
    ['thr', 32],
    ['lys', 10],
    ['schr', 3],
    ['z', 34],
]);

const INFIX_RUN_LENGTHS = new Map<string, number>([
    ['oi', 88],
    ['ue', 147],
    ['oa', 57],
    ['au', 119],
    ['ae', 12],
    ['oe', 39],
    ['dg', 31],
    ['tch', 20],
    ['wr', 31],
]);

const PREFIX_DEFAULT_RUN_LENGTH = 35;

// --- Offset tables (built once from the fragment tables) ------------------------

/**
 * Assign each fragment a start offset within its table and return the total run
 * length. Fills a default run length into `runLengths` for every fragment lacking
 * an explicit one, so later run-length lookups never miss.
 */
function buildOffsets(
    items: readonly string[],
    runLengths: Map<string, number>,
    defaultLen: number,
): { offsets: Map<string, number>; total: number } {
    const offsets = new Map<string, number>();
    let cnt = 0;
    for (const item of items) {
        const key = item.toLowerCase();
        const len = runLengths.get(key) ?? defaultLen;
        if (!runLengths.has(key)) runLengths.set(key, len);
        offsets.set(key, cnt);
        cnt += len;
    }
    return { offsets, total: cnt };
}

const prefixTable = buildOffsets(PREFIXES, PREFIX_RUN_LENGTHS, PREFIX_DEFAULT_RUN_LENGTH);
const prefixOffsets = prefixTable.offsets;
const prefixTotalRunLength = prefixTable.total;

// Vowel infixes default to the consonant-suffix table length; consonant infixes to
// the vowel-suffix table length. Both passes share one run-length map (disjoint
// keys) and one offset map, mirroring the reference exactly.
const infix1Table = buildOffsets(INFIXES1, INFIX_RUN_LENGTHS, SUFFIXES2.length);
const infix2Table = buildOffsets(INFIXES2, INFIX_RUN_LENGTHS, SUFFIXES1.length);
const infixOffsets = new Map<string, number>([...infix1Table.offsets, ...infix2Table.offsets]);
const infix1TotalRunLength = infix1Table.total;
const infix2TotalRunLength = infix2Table.total;

const prefixRunLength = (key: string): number =>
    PREFIX_RUN_LENGTHS.get(key) ?? PREFIX_DEFAULT_RUN_LENGTH;
const infixRunLength = (key: string): number =>
    INFIX_RUN_LENGTHS.get(key) ?? PREFIX_DEFAULT_RUN_LENGTH;

// --- Fragment table for parsing (name -> coords) --------------------------------

interface FragmentInfo {
    value: string;
    isPrefix: boolean;
    isC1VowelPrefix: boolean;
    isC2VowelPrefix: boolean;
    isInfix: boolean;
    isVowelInfix: boolean;
    isSuffix: boolean;
    isVowelSuffix: boolean;
    suffixIndex: number;
}

function emptyFragment(value: string): FragmentInfo {
    return {
        value,
        isPrefix: false,
        isC1VowelPrefix: false,
        isC2VowelPrefix: false,
        isInfix: false,
        isVowelInfix: false,
        isSuffix: false,
        isVowelSuffix: false,
        suffixIndex: 0,
    };
}

/**
 * Every distinct fragment string, tagged with the roles it can play, sorted
 * longest-first so a greedy parser matches maximal fragments.
 */
const FRAGMENTS: readonly FragmentInfo[] = (() => {
    const frags = new Map<string, FragmentInfo>();
    const get = (v: string): FragmentInfo => {
        const key = v.toLowerCase();
        let f = frags.get(key);
        if (!f) {
            f = emptyFragment(key);
            frags.set(key, f);
        }
        return f;
    };

    for (const p of PREFIXES) {
        const f = get(p);
        const key = p.toLowerCase();
        f.isPrefix = true;
        f.isC1VowelPrefix = C1_PREFIX_INFIX2.has(key);
        f.isC2VowelPrefix = C2_PREFIX_SUFFIX2.has(key);
    }
    for (const p of INFIXES1) {
        const f = get(p);
        f.isInfix = true;
        f.isVowelInfix = true;
    }
    for (const p of INFIXES2) {
        const f = get(p);
        f.isInfix = true;
        f.isVowelInfix = false;
    }
    for (let i = 0; i < SUFFIXES1.length; i++) {
        const f = get(SUFFIXES1[i]!);
        f.isSuffix = true;
        f.isVowelSuffix = true;
        f.suffixIndex = i;
    }
    for (let i = 0; i < SUFFIXES2.length; i++) {
        const f = get(SUFFIXES2[i]!);
        f.isSuffix = true;
        f.isVowelSuffix = false;
        f.suffixIndex = i;
    }

    return [...frags.values()].sort(
        (a, b) => b.value.length - a.value.length || a.value.localeCompare(b.value),
    );
})();

// --- Forward: coords -> name ----------------------------------------------------

/**
 * The C1/C2 selector: a 32-bit avalanche hash of the packed sector offset. Even
 * result → C1 (single word), odd → C2 (two words).
 */
function isC1Sector(offset: number): boolean {
    let key = offset >>> 0;
    key = (key + (key << 12)) >>> 0;
    key ^= key >>> 22;
    key = (key + (key << 4)) >>> 0;
    key ^= key >>> 9;
    key = (key + (key << 10)) >>> 0;
    key ^= key >>> 2;
    key = (key + (key << 7)) >>> 0;
    key ^= key >>> 12;
    return (key & 1) === 0;
}

function c1Name(offset: number): string | null {
    const frags: string[] = [];
    const prefixCnt = Math.floor(offset / prefixTotalRunLength);
    let curOffset = offset % prefixTotalRunLength;

    let prefix = '';
    for (const p of PREFIXES) {
        if ((prefixOffsets.get(p.toLowerCase()) ?? 0) <= curOffset) prefix = p;
    }
    const prefixLower = prefix.toLowerCase();
    frags.push(prefix);
    curOffset -= prefixOffsets.get(prefixLower) ?? 0;

    const infix1IsConsonant = C1_PREFIX_INFIX2.has(prefixLower);
    const infix1Total = infix1IsConsonant ? infix2TotalRunLength : infix1TotalRunLength;
    const infix1Table = infix1IsConsonant ? INFIXES2 : INFIXES1;

    const scaled = prefixCnt * prefixRunLength(prefixLower) + curOffset;
    const infix1Cnt = Math.floor(scaled / infix1Total);
    curOffset = scaled % infix1Total;

    let infix1 = '';
    for (const p of infix1Table) {
        const key = p.toLowerCase();
        if ((infixOffsets.get(key) ?? 0) <= curOffset) infix1 = key;
    }
    frags.push(infix1);
    curOffset -= infixOffsets.get(infix1) ?? 0;

    let suffixes = infix1IsConsonant ? SUFFIXES1 : SUFFIXES2;
    let nextIdx = infixRunLength(infix1) * infix1Cnt + curOffset;

    if (nextIdx >= suffixes.length) {
        const infix2IsConsonant = !infix1IsConsonant;
        const infix2Total = infix2IsConsonant ? infix2TotalRunLength : infix1TotalRunLength;
        const infix2Cnt = Math.floor(nextIdx / infix2Total);
        curOffset = nextIdx % infix2Total;

        const infix2Table = infix2IsConsonant ? INFIXES2 : INFIXES1;
        let infix2 = '';
        for (const p of infix2Table) {
            const key = p.toLowerCase();
            if ((infixOffsets.get(key) ?? 0) <= curOffset) infix2 = key;
        }
        frags.push(infix2);
        curOffset -= infixOffsets.get(infix2) ?? 0;

        suffixes = infix2IsConsonant ? SUFFIXES1 : SUFFIXES2;
        nextIdx = infixRunLength(infix2) * infix2Cnt + curOffset;
    }

    if (nextIdx >= suffixes.length) return null;
    frags.push(suffixes[nextIdx]!.toLowerCase());
    return frags.join('');
}

function c2Name(offset: number): string {
    const [idx0, idx1] = deinterleave2(offset);

    let p1 = '';
    for (const p of PREFIXES) {
        if ((prefixOffsets.get(p.toLowerCase()) ?? 0) <= idx0) p1 = p;
    }
    let p2 = '';
    for (const p of PREFIXES) {
        if ((prefixOffsets.get(p.toLowerCase()) ?? 0) <= idx1) p2 = p;
    }
    const p1Lower = p1.toLowerCase();
    const p2Lower = p2.toLowerCase();

    const s1s = C2_PREFIX_SUFFIX2.has(p1Lower) ? SUFFIXES2 : SUFFIXES1;
    const s2s = C2_PREFIX_SUFFIX2.has(p2Lower) ? SUFFIXES2 : SUFFIXES1;
    const s1 = s1s[idx0 - (prefixOffsets.get(p1Lower) ?? 0)]!;
    const s2 = s2s[idx1 - (prefixOffsets.get(p2Lower) ?? 0)]!;

    return `${p1}${s1.toLowerCase()} ${p2}${s2.toLowerCase()}`;
}

/**
 * The procedural sector name for a grid position.
 *
 * @param coords - Integer sector position on the galaxy grid. Each axis must be
 *   an integer in 0–127 (the 7-bit sector grid); the packed offset would
 *   otherwise bleed one axis into the next and produce a wrong or empty name.
 * @returns The canonically-cased sector name (e.g. `Synuefe`, `Blae Eock`).
 * @throws {RangeError} If any axis is not an integer in 0–127, or if the grid
 * slot is outside the procedural generator's assigned name range.
 * @example
 * ```ts
 * sectorNameFromCoords({ x: 39, y: 30, z: 20 }); // -> a procedural name
 * ```
 */
export function sectorNameFromCoords(coords: SectorCoords): string {
    for (const v of [coords.x, coords.y, coords.z]) {
        if (!Number.isInteger(v) || v < 0 || v > 127) {
            throw new RangeError(
                `Sector coordinate out of range (expected integer 0–127): ${JSON.stringify(coords)}`,
            );
        }
    }
    const offset = (coords.z << 14) + (coords.y << 7) + coords.x;
    const name = isC1Sector(offset) ? c1Name(offset) : c2Name(offset);
    if (name === null) {
        throw new RangeError(`Sector coordinate has no procedural name: ${JSON.stringify(coords)}`);
    }
    return name;
}

// --- Inverse: name -> coords ----------------------------------------------------

/**
 * Enumerate the possible role-tagged fragmentations of a sector name. Fragment
 * strings overlap, so the inverse must consider each parse instead of committing
 * greedily. Fragments are copied so the shared table is never mutated.
 */
function splitFragmentCandidates(name: string): FragmentInfo[][] {
    const candidates: FragmentInfo[][] = [];

    const visit = (remaining: string, out: readonly FragmentInfo[]): void => {
        if (remaining.length === 0) {
            candidates.push([...out]);
            return;
        }
        // A valid C1/C2 name has at most four fragments. Bounding the search also
        // prevents malformed strings with many ambiguous short fragments from
        // causing combinatorial work.
        if (out.length >= 4) return;

        const spaceStart = remaining.startsWith(' ');
        const current = remaining.trimStart();
        if (current.length === 0) return;

        for (const match of FRAGMENTS) {
            if (!current.startsWith(match.value)) continue;

            const frag = { ...match };
            if (spaceStart) {
                frag.isSuffix = false;
                frag.isInfix = false;
            } else if (
                out.length > 0 &&
                frag.isInfix &&
                frag.isVowelInfix !== out[out.length - 1]!.isVowelInfix
            ) {
                frag.isPrefix = false;
            }

            visit(current.substring(frag.value.length), [...out, frag]);
        }
    };

    visit(name.toLowerCase().trim(), []);
    return candidates;
}

function c1ProcessInfix(frag: FragmentInfo, offset: number): number {
    const runLen = infixRunLength(frag.value);
    const rem = offset % runLen;
    let out = Math.floor(offset / runLen);
    out *= frag.isVowelInfix ? infix1TotalRunLength : infix2TotalRunLength;
    out += rem;
    out += infixOffsets.get(frag.value) ?? 0;
    return out;
}

function c1ProcessPrefix(frag: FragmentInfo, offset: number): number {
    const runLen = prefixRunLength(frag.value);
    const rem = offset % runLen;
    let out = Math.floor(offset / runLen);
    out *= prefixTotalRunLength;
    out += rem;
    out += prefixOffsets.get(frag.value) ?? 0;
    return out;
}

function coordsFromOffset(offset: number): SectorCoords {
    return { x: offset & 0x7f, y: (offset >> 7) & 0x7f, z: (offset >> 14) & 0x7f };
}

function c2SectorCoords(f: FragmentInfo[]): SectorCoords | null {
    if (
        f[0]!.isC2VowelPrefix === f[1]!.isVowelSuffix ||
        f[2]!.isC2VowelPrefix === f[3]!.isVowelSuffix
    ) {
        return null;
    }
    const idx0 = (prefixOffsets.get(f[0]!.value) ?? 0) + f[1]!.suffixIndex;
    const idx1 = (prefixOffsets.get(f[2]!.value) ?? 0) + f[3]!.suffixIndex;
    return coordsFromOffset(interleave2(idx0, idx1));
}

function c1SectorCoords3(f: FragmentInfo[]): SectorCoords | null {
    if (
        f[0]!.isC1VowelPrefix === f[1]!.isVowelInfix ||
        f[1]!.isVowelInfix === f[2]!.isVowelSuffix
    ) {
        return null;
    }
    let offset = f[2]!.suffixIndex;
    offset = c1ProcessInfix(f[1]!, offset);
    offset = c1ProcessPrefix(f[0]!, offset);
    return coordsFromOffset(offset);
}

function c1SectorCoords4(f: FragmentInfo[]): SectorCoords | null {
    if (
        f[0]!.isC1VowelPrefix === f[1]!.isVowelInfix ||
        f[1]!.isVowelInfix === f[2]!.isVowelInfix ||
        f[2]!.isVowelInfix === f[3]!.isVowelSuffix
    ) {
        return null;
    }
    let offset = f[3]!.suffixIndex;
    offset = c1ProcessInfix(f[2]!, offset);
    offset = c1ProcessInfix(f[1]!, offset);
    offset = c1ProcessPrefix(f[0]!, offset);
    return coordsFromOffset(offset);
}

/**
 * The grid position a procedural sector name maps to, or `null` if the name is
 * not a valid procedural sector name.
 *
 * Every assigned name produced by {@link sectorNameFromCoords} round-trips through
 * this function. A valid fragment sequence that is not the canonical name emitted for
 * its coordinates is rejected.
 *
 * @param name - A procedural sector name in any casing (e.g. `blae eock`).
 * @returns The sector grid position, or `null` when the name is not procedural.
 */
export function sectorCoordsFromName(name: string): SectorCoords | null {
    const candidates = splitFragmentCandidates(name);
    const normalizedName = name.trim().toLowerCase().replace(/\s+/g, ' ');
    for (const f of candidates) {
        let coords: SectorCoords | null = null;
        if (
            f.length === 4 &&
            f[0]!.isPrefix &&
            f[1]!.isSuffix &&
            f[2]!.isPrefix &&
            f[3]!.isSuffix
        ) {
            coords = c2SectorCoords(f);
        } else if (f.length === 3 && f[0]!.isPrefix && f[1]!.isInfix && f[2]!.isSuffix) {
            coords = c1SectorCoords3(f);
        } else if (
            f.length === 4 &&
            f[0]!.isPrefix &&
            f[1]!.isInfix &&
            f[2]!.isInfix &&
            f[3]!.isSuffix
        ) {
            coords = c1SectorCoords4(f);
        }
        if (!coords) continue;

        // Fragment strings overlap ("Aoe" can be A+oe or Ao+e), so accept only the
        // interpretation that reproduces the supplied name.
        try {
            const canonicalName = sectorNameFromCoords(coords);
            if (canonicalName.toLowerCase() === normalizedName) return coords;
        } catch (error) {
            if (!(error instanceof RangeError)) throw error;
        }
    }
    return null;
}

/**
 * Re-derive a sector name's canonical casing by round-tripping it through the
 * grid, e.g. `blae eock` → `Blae Eock`. Returns `null` for non-procedural names.
 *
 * @param name - A procedural sector name in any casing.
 */
export function canonicalizeSectorName(name: string): string | null {
    const coords = sectorCoordsFromName(name);
    return coords ? sectorNameFromCoords(coords) : null;
}

// --- Morton (bit-interleave) helpers for the C2 scheme --------------------------

/** Interleave two 16-bit values into a 32-bit Morton code (C2 forward map). */
function interleave2(v1: number, v2: number): number {
    let x = BigInt(v1) | (BigInt(v2) << 32n);
    x = (x | (x << 8n)) & 0x00ff00ff00ff00ffn;
    x = (x | (x << 4n)) & 0x0f0f0f0f0f0f0f0fn;
    x = (x | (x << 2n)) & 0x3333333333333333n;
    x = (x | (x << 1n)) & 0x5555555555555555n;
    return Number((x | (x >> 31n)) & 0xffffffffn);
}

/** Split a 32-bit Morton code back into its two 16-bit values (C2 inverse map). */
function deinterleave2(val: number): [number, number] {
    const v = BigInt(val);
    let x = (v & 0x55555555n) | ((v & 0xaaaaaaaan) << 31n);
    x = (x | (x >> 1n)) & 0x3333333333333333n;
    x = (x | (x >> 2n)) & 0x0f0f0f0f0f0f0f0fn;
    x = (x | (x >> 4n)) & 0x00ff00ff00ff00ffn;
    x = (x | (x >> 8n)) & 0x0000ffff0000ffffn;
    return [Number(x & 0xffffn), Number((x >> 32n) & 0xffffn)];
}
