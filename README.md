# ArchaeoPlan v0.2.12 clean

Denne udgave er en oprydningsversion baseret direkte på den testede og fungerende v0.2.11.

## Det fungerer i denne baseline
- GLB / GLTF import med tekstur.
- OBJ + MTL + teksturer.
- PLY.
- Perspektivisk og ortografisk visning.
- Top, Bund, Front, Bag, Venstre og Højre.
- Korrekt viewport- og kameracentrering.
- Frihåndsbeskæring med mus, finger og Apple Pencil.
- Frihånd kan fortsættes efter løft; nye strøg forbindes med en lige linje.
- Polygonbeskæring.
- Behold indenfor / Fjern indenfor.
- Original model bevares ved beskæring.
- Flyt, drej og lås.
- Fortryd / gentag for relevante modelhandlinger.
- Tilpas model.
- PNG-eksport.

## Hvad der er ryddet op
- Historiske versionsnoter og dobbelte README-afsnit er fjernet.
- Gamle patch-kommentarer i CSS er fjernet.
- Canvas-regler er samlet ét sted.
- Versions- og cachemarkører er ens i `index.html` og `app.js`.
- JavaScript-funktionerne er gennemgået for dubletter og ubrugte ældre kamerafunktioner.

## Bevidst ikke ændret
Der er ikke ændret i den fungerende programlogik fra v0.2.11. Denne build skal derfor testes som en ren baseline, før nye funktioner tilføjes.

## Teknisk note om beskæring
Beskæring sker stadig ved eksisterende trekantgrænser. Der skabes endnu ikke nye trekanter præcist langs den tegnede kant.
