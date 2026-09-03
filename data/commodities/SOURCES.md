# Data sources — `data/commodities/`

**Acquired:** FDevIDs 2026-07-24 UTC; player-journal record 2026-08-02 UTC; in-game
category verification 2026-08-12 and 2026-09-03 UTC; in-game commodity registry
2026-08-02 and 2026-09-03 UTC. **Upstream revision:** unavailable. One record combines
the journal and in-game sources, and the difference between the two registry readings
supplies the tail; both are documented under Standard commodities.

## Standard commodities

- **File:** `commodities.jsonc` (the tradable goods).
- **Source:** EDCD FDevIDs, `commodity.csv` (columns `id,symbol,category,name`).
- **Derivation:** records are carried over in registry order as
  `{ symbol, name, category }`. `symbol` is Frontier's internal id as the market and
  journal report it; `name` is the display name;
  `category` is the market group (Metals, Minerals, Foods, …), kept verbatim including the
  space in multi-word groups (`Consumer Items`, `Industrial Materials`, `Legal Drugs`). The
  CSV's numeric `id` column is dropped — commodities are keyed by `symbol`. The
  `NonMarketable` group (its one member, symbol `Drones`, is Limpets) is retained: a
  registry must resolve every symbol the market can report.
- **One record is not from FDevIDs** (acquired 2026-08-02 UTC) — `curatedcommodity` /
  "Curated Commodity Package". Acquired from a player-journal `MarketBuy` event timestamped
  `2026-08-01T16:12:01Z` (`MarketID` 128667761, `BuyPrice` 347), which supplies the
  `symbol` (`Type`) and `name` (`Type_Localised`) verbatim. A `MarketBuy` carries **no
  category**; `Industrial Materials` is separately observed in the running game's commodity
  market (2026-08-12 UTC; no immutable revision). The record is appended after the registry
  order rather than inserted into it, so FDevIDs order is still recoverable by dropping
  it and every record after it. Standard rather than rare: a `MarketBuy` of 388 units far exceeds any rare's
  per-station allocation. The event's `Count`, `BuyPrice`, `TotalCost` and `MarketID` are
  dropped — this is an id/name/category registry, not a price sheet.

### The tail, from the running game's own commodity registry

The game defines more commodity units than the FDevIDs snapshot carries. The registry is
read from the running game (2026-09-03 UTC; the game publishes no immutable identifier
for it, so the observation is the evidence) and compared against an earlier reading of
the same registry (2026-08-02 UTC). **The units the registry gained between the two
readings are appended, in symbol order, after `curatedcommodity`**: `Bastnasite`,
`Deuterium`, `Diamond`, `Helium`, `Helium3`, `Iridium`, `Magnesite`, `Olivine`,
`PericlaseDunite`, `QuartzPyroxenite`, `Ruby`, `Sapphire` and `Thortveitite`.

- **The symbol and the English name are the registry's**, and the name comes from the
  same in-game localisation table that `data/i18n/commodity-names.jsonc` is derived from,
  so an appended record's `name` and its English localized name are one string by
  construction.
- **The category is separately verified in the running game** (2026-09-03 UTC; no
  immutable revision), exactly as `curatedcommodity`'s is. The registry names a unit and
  its display name and does not say which market group it belongs to. Every one of these is
  `Minerals` except `Helium` and `Helium3`, which are `Chemicals`.
- **They are stored as standard, not rare.** The registry's English description marks a
  rare good with the phrase "This rare good". No appended unit carries the marker, no
  appended unit appears in FDevIDs' `rare_commodity.csv`, and every unit the marker does
  name is already in `rare-commodities.jsonc`. The marker alone would be weak evidence,
  because its absence does not make a good standard: five records the rare catalogue
  holds — `GalacticTravelGuide`, `Nanomedicines`, `Duradrives`, `ApaVietii` and
  `ClassifiedExperimentalEquipment` — are described without the phrase and keep their
  place, because the CSV lists them. Here every source is silent together.
- **The units both readings already held are deliberately not carried.** The registry
  has long held goods no market lists — powerplay cargo, mission and event freight, and
  legacy units such as `Wood`, `Ceramics` and `Anthracene`. They are not a change the
  game made, and carrying them is a separate decision about how wide this catalogue
  reaches rather than a currency update. What would carry them is that decision plus a
  category for each, not a new source: the same observation already names them.
- **Units the game names in no language stay out in any case.** The registry holds units
  whose localisation entry is empty in all six languages — `Advert2`,
  `BacteriostaticAgents`, `NvidiaTitanBlack` and others of that kind. A record needs a
  display name, and the only string available for these is the internal symbol, which is
  not a name. All of them predate this observation, so the rule above already excludes
  them; it stands as the second reason.
- **Appending rather than inserting keeps every earlier order recoverable**, exactly as
  the `curatedcommodity` record does: drop these records and the order that preceded
  them remains, and drop `curatedcommodity` as well and the FDevIDs order remains.

## Rare commodities

- **File:** `rare-commodities.jsonc` (the location-specific luxury goods).
- **Source:** EDCD FDevIDs, `rare_commodity.csv` (columns
  `id,symbol,market_id,category,name`).
- **Derivation:** records are carried over in registry order as
  `{ symbol, name, category }`, exactly as for standard commodities. Both the numeric `id`
  and the `market_id` columns are dropped: rares are keyed by `symbol`, and the `market_id`
  — the id of the single station that produces a rare — has no stable source referent in
  this data domain. A record's rareness is not stored on it; it is derived from which
  catalogue the record lives in, the same way a material's category is derived from its
  catalogue.
