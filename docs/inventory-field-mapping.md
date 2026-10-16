# Inventory sheet field mapping

Source: `docs/space-electronics-inventory.xlsx` (Sheet1, 213 rows incl. header, 13 fully empty rows).

| Sheet header | DB column | Type | Notes |
|---|---|---|---|
| Name | `components.name` | text, required, max 200 | Match key with location (case-insensitive) |
| Location | `components.location` | text, nullable, max 200 | Many sheet rows leave it blank |
| Count | `components.count` | int >= 0 | Used only when `New count` is blank |
| New count | `components.count` | int >= 0 | Wins over `Count` when both exist |
| Description | `components.description` | text, nullable, max 500 | Blank cell keeps the stored value |

Not in the sheet but kept as existing core fields: `returnable` (blank/absent column keeps the stored value; new rows default to true) and `image_url` (editable in the Edit dialog, or via an `image_url` / `image` / `image link` column in a sheet upload: full http(s) link, blank keeps the stored image).

## New DB columns

**None for stock fields.** The sheet has no columns beyond the five above, and no fields were invented.
Added instead: `components.updated_by uuid` and the `component_edits` audit table (migration `0019`).

## Ignored columns

None in the sample sheet. Any unrecognised header in a future upload is listed in the upload dialog as ignored.

## Aliases accepted by the parser

Headers are trimmed, lower-cased, and `_`/repeated spaces collapse to one space: `count`; `new count` / `latest count`; `name`; `location`; `description`; `returnable`.

## Admin-defined fields (migration 0020)

Anything beyond the five sheet columns is defined by an admin in Inventory > Fields instead of being hardcoded.

- Each field is a real typed column on `components` (text / int / numeric / bool), created only by the `create_component_field` RPC (admin only, snake_case key, whitelisted types, max 20).
- Searchable text fields get a trigram index and are included in the stock search.
- Upload headers match a field by key or label. Unrecognised headers are listed as ignored, with an "Add as fields" shortcut that creates them as text fields and re-reads the file.
- Renaming changes the label only. "Hide field" archives it and keeps the data. Built-in fields can only be relabelled or hidden from the table.
- Blank cells never erase stored values.
