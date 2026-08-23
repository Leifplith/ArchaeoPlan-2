# ArchaeoPlan v0.2.5

Ren genopbygning af ArchaeoPlan.

Fokus:
1. Stabil tekstur på GLB og OBJ.
2. Simpel beskæring med frihånd eller polygon.
3. Automatisk centrering ved import og ved Top/Front/Side-visninger.

## Filimport
- GLB
- GLTF
- OBJ + MTL + teksturer
- PLY

Ved OBJ vælges OBJ, MTL og alle teksturbilleder samtidigt.

## Beskæring
- Frihånd med mus, finger eller Apple Pencil.
- Polygon med punkt-for-punkt markering.
- Behold indenfor / Fjern indenfor.
- Originalmodellen bevares og skjules.
- Der oprettes en beskåret kopi.

## Centrering
- Nyimporteret valgt model indrammes automatisk.
- Top, Bund, Front, Bag, Venstre og Højre indrammer og centrerer den valgte model.
- Modellens koordinater ændres ikke; kun kameraet flyttes.

## Bemærkning
Beskæring i v0.2.5 sker ved eksisterende trekantgrænser. Der skabes endnu ikke nye trekanter præcis langs den tegnede kant.
