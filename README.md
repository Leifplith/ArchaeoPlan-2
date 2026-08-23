# ArchaeoPlan v0.2.9

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
Beskæring i v0.2.8 sker ved eksisterende trekantgrænser. Der skabes endnu ikke nye trekanter præcis langs den tegnede kant.


## v0.2.8
- Ny kameratilpasning beregner modellens faktiske projicerede udstrækning i den valgte synsretning.
- Import og standardvisninger centreres uden at flytte modellens koordinater.
- Ny **Tilpas model**-knap.
- **↶ Fortryd** og **↷ Annuller fortryd**.
- Historik for flytning, drejning, numeriske transformationsændringer og beskæring.
- Kameraets almindelige zoom/rotation/panorering lægges ikke i historikken.
- Den fungerende frihåndsbeskæring fra v0.2.6 er bevaret.


## v0.2.8
- Rettelse af selve kameraets grundposition.
- Et tomt projekt viser nu verdens nulpunkt (0,0,0) i centrum af arbejdsfeltet.
- **Nyt projekt** nulstiller kamera og OrbitControls til verdens nulpunkt.
- Når en model findes, bruges fortsat modellens geometriske bounding box til centrering og indramning.
- Modeller og deres originale koordinater flyttes ikke.
- Beskæring og Undo/Redo fra v0.2.7 er ikke ændret.


## v0.2.9
- Cache-busting på `app.js` og `style.css`, så Safari/GitHub Pages ikke genbruger en ældre JavaScript-version.
- Kamera-reset og centrering fra v0.2.8 bliver dermed faktisk indlæst.
- Ingen ændringer i den fungerende beskæring.
