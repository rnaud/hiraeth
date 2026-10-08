# Traveller v1

Accepted coral-shirt, no-backpack Tripo character, promoted from the local experiment.
Source job: 734ea223-13c2-4406-a081-ef34a5612b5d.

- model.glb: fitted MakeHuman skin, 53 bones, the base-colour texture at 2048². Made by
  scripts/tripo/slim-traveller.mjs from the untouched export in data/characters/traveller-v1/
  (same geometry; the export's unused normal/roughness maps and 4096² texture stay there).
- rig.json: export parameters and fit report (source/output paths are provenance only).
- colors.json: sampled sRGB colours in the original mesh vertex order, used by garment separation and repair.

These three files must be regenerated/promoted together. Runtime clothing and ink
materials live in src/characters/. See scripts/tripo/README.md for reproduction.
