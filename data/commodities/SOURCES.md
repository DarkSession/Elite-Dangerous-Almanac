# Data sources — `data/commodities/`

What each catalogue in this directory was taken from, when, and how it was derived.
Sources are named here; who to credit for them, with links and licence terms, is in
`ATTRIBUTIONS.md`. `../SNAPSHOTS.md` states what every entry has to record.

**Acquired:** 2026-07-24. **Upstream revision:** unavailable. One record comes from a
player-journal observation, documented under Standard commodities.

## Standard commodities

- **File:** `commodities.jsonc` (257 tradable goods).
- **Source:** EDCD FDevIDs, `commodity.csv` (columns `id,symbol,category,name`).
- **Derivation:** records are carried over in registry order as
  `{ symbol, name, category }`. `symbol` is Frontier's internal id (keyed on, matched
  case-insensitively as the market/journal reports it); `name` is the display name;
  `category` is the market group (Metals, Minerals, Foods, …), kept verbatim including the
  space in multi-word groups (`Consumer Items`, `Industrial Materials`, `Legal Drugs`). The
  CSV's numeric `id` column is dropped — commodities are keyed by `symbol`. The
  `NonMarketable` group (its one member, symbol `Drones`, is Limpets) is retained: a
  registry must resolve every symbol the market can report.
- **One record is not from FDevIDs** (acquired 2026-08-02 UTC) — `curatedcommodity` /
  "Curated Commodity Package". Acquired from a player-journal `MarketBuy` event timestamped
  `2026-08-01T16:12:01Z` (`MarketID` 128667761, `BuyPrice` 347), which supplies the
  `symbol` (`Type`) and `name` (`Type_Localised`) verbatim. A `MarketBuy` carries **no
  category**, so `Industrial Materials` is a maintainer assignment pending an upstream
  FDevIDs entry, not an observed value — treat it as the one field here that upstream may
  contradict. The record is appended after the registry order rather than inserted into it,
  so FDevIDs order is still recoverable by dropping the tail. Standard rather than rare: a
  `MarketBuy` of 388 units far exceeds any rare's per-station allocation. The event's
  `Count`, `BuyPrice`, `TotalCost` and `MarketID` are dropped — this is an
  id/name/category registry, not a price sheet.

## Rare commodities

- **File:** `rare-commodities.jsonc` (142 location-specific luxury goods).
- **Source:** EDCD FDevIDs, `rare_commodity.csv` (columns
  `id,symbol,market_id,category,name`).
- **Derivation:** records are carried over in registry order as
  `{ symbol, name, category }`, exactly as for standard commodities. Both the numeric `id`
  and the `market_id` columns are dropped: rares are keyed by `symbol`, and the `market_id`
  — the id of the single station that produces a rare — has no station registry in this
  library to resolve against, so a bare number would be a dangling reference rather than
  usable data. A record's rareness is not stored on it; it is derived from which catalogue
  the record lives in, the same way a material's category is derived from its catalogue.
