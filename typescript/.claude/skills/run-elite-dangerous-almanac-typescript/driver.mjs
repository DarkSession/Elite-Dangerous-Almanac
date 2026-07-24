#!/usr/bin/env node
/**
 * Smoke driver for the Elite Dangerous Almanac TypeScript library.
 *
 * This is a *library*, so "running" it means importing the built package the way
 * a consumer would (via the `./astro` subpath, from `dist/`) and exercising the
 * real algorithms end-to-end against the shared, language-neutral fixtures in
 * `../fixtures/`. Those fixtures carry in-game-verified ground truth, so a green
 * run here proves the shipped `dist/` output actually computes correct id64s and
 * names — not merely that it loads.
 *
 * Run from the `typescript/` directory after `npm run build`:
 *   node .claude/skills/run-elite-dangerous-almanac-typescript/driver.mjs
 *
 * Paths are resolved relative to THIS file, so the cwd does not matter.
 * Exits 0 on all-pass, 1 on any failure.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
// This file lives at typescript/.claude/skills/run-.../driver.mjs
const TS_ROOT = resolve(HERE, '../../..'); // -> typescript/
const REPO_ROOT = resolve(TS_ROOT, '..'); // -> repo root (holds fixtures/, data/)

// Import the built package exactly as a consumer would: the tree-shakeable
// `./astro` subpath export, from dist/. This validates the build + exports map,
// not the src/ tree.
const astro = await import(resolve(TS_ROOT, 'dist/astro/index.js'));
const {
    StarSystem,
    parseSystemName,
    formatSystemName,
    encodeSystemAddress,
    decodeSystemAddress,
    resolveRegionOrigin,
    findRegionAt,
    findRegionForBoxel,
    nearestNebulae,
    nebulaeWithin,
    getNebulaByName,
    REAL_NEBULAE,
    PLANETARY_NEBULAE,
    PROCGEN_NEBULAE,
    ALL_NEBULAE,
} = astro;

const fixture = (name) =>
    JSON.parse(readFileSync(resolve(REPO_ROOT, 'fixtures/astro', name), 'utf8'));

let pass = 0;
const failures = [];
const check = (name, cond, detail = '') => {
    if (cond) {
        pass++;
    } else {
        failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    }
};

// ── 1. Procedural name → id64, and id64 → name (the two-way ground truth) ──────
{
    const { systems } = fixture('system-addresses.json');
    for (const s of systems) {
        const sys = StarSystem.fromName(s.name);
        check(`fromName(${s.name})`, sys !== null, 'parse returned null');
        if (!sys) continue;
        check(
            `encode ${s.name}`,
            sys.systemAddress === BigInt(s.id64),
            `got ${sys.systemAddress}, want ${s.id64}`,
        );
        // Round-trip the id64 back to a name. Without coords the decoder can only
        // produce the PROCEDURAL name, so a hand-authored fixture name (e.g.
        // "Col 285 Sector …") is recovered only when coords are supplied — that
        // path is exercised in section [2]. Here, only assert on procedural ones.
        if (!sys.isHandAuthoredSector) {
            const back = StarSystem.fromSystemAddress(BigInt(s.id64));
            check(`decode ${s.id64}`, back.name === s.name, `got "${back.name}", want "${s.name}"`);
        }
    }
    console.log(`[1] name<->id64 across ${systems.length} verified systems`);
}

// ── 2. Hand-authored regions: coords rewrite the name; without coords, alias ──
{
    const { systems } = fixture('hand-authored-regions.json');
    for (const s of systems) {
        const id64 = BigInt(s.id64);
        const withCoords = StarSystem.fromSystemAddress(id64, s.coords);
        check(`HA name ${s.name}`, withCoords.name === s.name, `got "${withCoords.name}"`);
        check(`HA permit ${s.name}`, withCoords.needsPermit === s.needsPermit);
        if (s.proceduralName) {
            const noCoords = StarSystem.fromSystemAddress(id64);
            check(
                `HA alias ${s.name}`,
                noCoords.name === s.proceduralName,
                `got "${noCoords.name}", want "${s.proceduralName}"`,
            );
        }
    }
    console.log(`[2] hand-authored region override across ${systems.length} systems`);
}

// ── 3. Galactic region map: by coordinate and by boxel id64 ───────────────────
{
    const { coords, boxels } = fixture('galactic-region.json');
    for (const c of coords) {
        const r = findRegionAt({ x: c.x, z: c.z });
        check(`region@${c.name}`, r?.name === c.region, `got "${r?.name}", want "${c.region}"`);
    }
    for (const b of boxels) {
        const r = findRegionForBoxel(BigInt(b.id64)).region;
        check(
            `boxelRegion@${b.name}`,
            r?.name === b.region,
            `got "${r?.name}", want "${b.region}"`,
        );
    }
    console.log(
        `[3] galactic region lookup across ${coords.length} coords + ${boxels.length} boxels`,
    );
}

// ── 4. Direct pure-function path (what most internal PRs touch) ───────────────
{
    const parts = parseSystemName('synuefe en-h d11-96'); // lowercase in
    check('parse parts', parts && parts.n1 === 11 && parts.n2 === 96);
    // GOTCHA: parseSystemName preserves the region's input casing — it does NOT
    // canonicalize. Re-casing happens in StarSystem.fromName / canonicalizeSystemName.
    check(
        'format preserves casing',
        formatSystemName(parts) === 'synuefe EN-H d11-96',
        `got "${formatSystemName(parts)}"`,
    );
    check(
        'fromName canonicalizes',
        StarSystem.fromName('synuefe en-h d11-96').name === 'Synuefe EN-H d11-96',
        `got "${StarSystem.fromName('synuefe en-h d11-96').name}"`,
    );
    const origin = resolveRegionOrigin('Synuefe');
    check('origin resolves', origin != null);
    const id64 = encodeSystemAddress(parts, origin);
    const decoded = decodeSystemAddress(id64);
    check(
        'encode/decode roundtrip',
        decoded.sizeClass === parts.massCode && decoded.sequence === 96,
    );
    console.log(`[4] direct function path: Synuefe EN-H d11-96 -> id64 ${id64}`);
}

// ── 5. Nebula catalogues: counts, proximity queries, name lookup ──────────────
{
    const neb = fixture('nebulae.json');
    const catalogues = {
        real: REAL_NEBULAE,
        planetary: PLANETARY_NEBULAE,
        procgen: PROCGEN_NEBULAE,
        all: ALL_NEBULAE,
    };
    for (const [name, want] of Object.entries(neb.counts)) {
        check(
            `catalogue ${name}`,
            catalogues[name].length === want,
            `got ${catalogues[name].length}, want ${want}`,
        );
    }
    for (const q of neb.nearest) {
        const hits = nearestNebulae(q.from, catalogues[q.catalogue], q.count);
        for (const [i, want] of q.expect.entries()) {
            check(
                `nearest@${q.origin}[${i}]`,
                hits[i]?.name === want.name,
                `got "${hits[i]?.name}", want "${want.name}"`,
            );
            check(
                `nearest@${q.origin}[${i}] distance`,
                Math.abs(hits[i]?.distanceLy - want.distanceLy) < 1e-5,
                `got ${hits[i]?.distanceLy}, want ${want.distanceLy}`,
            );
        }
    }
    for (const q of neb.within) {
        const names = nebulaeWithin(q.from, catalogues[q.catalogue], q.radiusLy).map((n) => n.name);
        check(
            `within@${q.origin} ${q.radiusLy}ly`,
            names.join('|') === q.expect.map((e) => e.name).join('|'),
            `got [${names}]`,
        );
    }
    // Name lookup is case-insensitive but otherwise exact.
    for (const r of neb.records) {
        check(
            `byName ${r.name}`,
            getNebulaByName(r.name.toLowerCase(), catalogues[r.catalogue])?.system === r.system,
        );
    }
    console.log(
        `[5] nebulae: ${ALL_NEBULAE.length} catalogued, ${neb.nearest.length} nearest + ${neb.within.length} radius queries`,
    );
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
if (failures.length === 0) {
    console.log(`✅ SMOKE PASS — ${pass} assertions`);
    process.exit(0);
} else {
    console.log(`❌ SMOKE FAIL — ${pass} passed, ${failures.length} failed:`);
    for (const f of failures) console.log(`   - ${f}`);
    process.exit(1);
}
