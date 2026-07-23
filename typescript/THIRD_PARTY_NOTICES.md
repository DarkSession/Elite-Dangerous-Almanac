# Third-party notices

Elite Dangerous Almanac incorporates community-researched algorithms and factual
galaxy data. The project implementation is MIT-licensed; upstream material remains
subject to its respective terms.

- **Procedural sector and system naming:** reverse-engineered by the Elite
  Dangerous community and ported from the EDTS reference implementation
  (`pgdata.py`) by Alot/Esvandiary. The previously cited repository is no longer
  publicly available, so its original license could not be independently
  re-confirmed.
- **Galactic codex regions:** region names, ids, and lookup geometry derive from
  [EliteDangerousRegionMap](https://github.com/klightspeed/EliteDangerousRegionMap)
  by Ben Peddell (klightspeed), MIT.
- **Hand-authored sector spheres, named-sector origins, and validation fixtures:**
  factual records compiled and cross-checked against
  [EDSM](https://www.edsm.net) and [Spansh](https://spansh.co.uk). The NGC 2392
  fixture was obtained from the EDSM system API (system id 21224); its region
  origin is derived from the catalogued sphere bounds.

The detailed per-file provenance and derivation notes live in the repository's
`data/astro/SOURCES.md`.
