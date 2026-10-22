# Font assets

`Geist-Variable.woff2` and `GeistMono-Variable.woff2` are optimized from `geist`
1.7.0. Their license is in `Geist-LICENSE.txt`. They retain every Unicode mapping,
all layout features, hinting and the 100–900 weight axis. Only unreachable glyphs
and redundant font data are removed; Vietnamese and other supported languages
remain available.

To refresh after updating `geist`, install the optional font tooling
(`python -m pip install 'fonttools[woff]'`) and run from `apps/web`:

```sh
python -m fontTools.subset node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2 --output-file=assets/fonts/Geist-Variable.woff2 --flavor=woff2 --unicodes='*' --layout-features='*' --name-IDs='*' --notdef-outline --recommended-glyphs --passthrough-tables
python -m fontTools.subset node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2 --output-file=assets/fonts/GeistMono-Variable.woff2 --flavor=woff2 --unicodes='*' --layout-features='*' --name-IDs='*' --notdef-outline --recommended-glyphs --passthrough-tables
```

The checked-in assets need no Python tooling during development or builds.
Compare Unicode coverage, variation axes and glyph metrics against the originals,
then run the production homepage paint check after regenerating them.
