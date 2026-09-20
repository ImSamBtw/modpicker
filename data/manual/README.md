# Manual catalog contributions

These files are the reviewable, version-controlled input for future human additions:

- `parts.json` — one part record per object.
- `vehicles.json` — exact vehicle or application records.
- `platforms.json` — engine, chassis, or other shared application groups.

Manual records are merged with the automated data pipeline every six hours. A record is not public simply because it exists here: the pipeline validates required fields, creates fitment/source/offer rows, and publishes only records that pass the publication gate.

Do not add ratings, review counts, reliability claims, horsepower gains, or prices without a source. Ratings are recalculated from eligible published review evidence. A platform entry controls which categories can be discovered in that platform view; it does not grant exact fitment to every vehicle in the group.

Use `python scripts/validate_catalog.py` before committing. See `MANUAL_CATALOG.md` for the complete process and templates.
