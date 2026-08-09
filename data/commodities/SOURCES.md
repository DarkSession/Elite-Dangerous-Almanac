# Data sources — `data/commodities/`

**Acquired:** 2026-07-24. **Upstream revision:** unavailable. One record comes from
a player-journal observation documented under Standard commodities. See
`../SNAPSHOTS.md` for the provenance requirements.

Attribution for the market-commodity data files in this directory. This file is the
long form; each data file also repeats its own credit in a comment header, so the
provenance meets you where you meet the data.

The data files are **JSONC** (`.jsonc`): attribution lives in a comment so it
documents the file without becoming part of the payload every consumer inlines
into their bundle. Comments are the only JSONC extension used — no trailing commas —
so stripping comments leaves strict JSON any language's standard parser accepts.
See AGENTS.md §Attribution for how to consume them.

## Standard commodities

- **Files:** `commodities.jsonc` (257 tradable goods) and
  `fixtures/commodities/commodities.json`.
- **Source:** [EDCD FDevIDs](https://github.com/EDCD/FDevIDs), the community-maintained
  registry of Frontier's internal ids and names (`commodity.csv`, columns
  `id,symbol,category,name`). FDevIDs states no explicit licence; consult the
  repository terms before redistributing the raw identifiers.
- **Derivation:** records are carried over in registry order as
  `{ symbol, name, category }`. `symbol` is Frontier's internal id (keyed on, matched
  case-insensitively as the market/journal reports it); `name` is the display name;
  `category` is the market group (Metals, Minerals, Foods, …), kept verbatim including
  the space in multi-word groups (`Consumer Items`, `Industrial Materials`, `Legal
  Drugs`). The CSV's numeric `id` column is dropped — commodities are keyed by
  `symbol`. The `NonMarketable` group (its one member, symbol `Drones`, is Limpets) is
  retained: a registry must resolve every symbol the market can report.
- **One record is not from FDevIDs** (acquired 2026-08-02 UTC) —
  `curatedcommodity` / "Curated Commodity Package". Acquired from a player-journal
  `MarketBuy` event timestamped `2026-08-01T16:12:01Z` (`MarketID` 128667761,
  `BuyPrice` 347), which supplies the `symbol` (`Type`) and `name` (`Type_Localised`)
  verbatim. A `MarketBuy` carries **no category**, so `Industrial Materials` is a
  maintainer assignment pending an upstream FDevIDs entry, not an observed value —
  treat it as the one field here that upstream may contradict. The record is appended
  after the registry order rather than inserted into it, so FDevIDs order is still
  recoverable by dropping the tail. Standard rather than rare: a `MarketBuy` of 388
  units far exceeds any rare's per-station allocation. The event's `Count`,
  `BuyPrice`, `TotalCost` and `MarketID` are dropped — this is an id/name/category
  registry, not a price sheet. Pinned in `fixtures/commodities/commodities.json`
  `records` so a regression cannot pass silently.

## Rare commodities

- **Files:** `rare-commodities.jsonc` (142 location-specific luxury goods) and the
  same fixture.
- **Source:** [EDCD FDevIDs](https://github.com/EDCD/FDevIDs), `rare_commodity.csv`
  (columns `id,symbol,market_id,category,name`), same licence note as above.
- **Derivation:** records are carried over in registry order as
  `{ symbol, name, category }`, exactly as for standard commodities. Both the numeric
  `id` and the `market_id` columns are dropped: rares are keyed by `symbol`, and the
  `market_id` — the id of the single station that produces a rare — has no station
  registry in this library to resolve against, so a bare number would be a dangling
  reference rather than usable data. A record's rareness is not stored on it; it is
  derived from which catalogue (`RARE_COMMODITIES`) the record lives in and surfaced as
  the `rare` flag, the same way a material's category is derived from its catalogue.
