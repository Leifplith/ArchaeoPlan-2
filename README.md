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


## v0.2.13
- Måleværktøj: klik to punkter direkte på modellen og få afstand.
- Eksport-ramme med Skærm, 3:2, 4:3, 1:1, A-format liggende/stående og frit format.
- Opløsning: Skærm, 3000 px, 6000 px eller brugerdefineret.
- Synlig eksport-ramme oven på 3D-visningen.
- "Tilpas model til ramme".
- Gem PNG.
- Del/Gem til Fotos via iPad/iOS deleark, når browseren tillader fildeling.
- Eksportopløsning er uafhængig af iPad-skærmens opløsning.


## v0.2.14
- Beskæring af én model bevarer de andre modeller og kameraudsnittet.
- Individuel 🔓/🔒 model-lås i modellisten samt eksisterende Lås-knap.
- Låste modeller kan ses, vælges, måles og eksporteres, men ikke flyttes, drejes eller beskæres.
- Flere navngivne, gemte kameravisninger.
- Gemte visninger husker projektion, kamera, target, zoom/FOV og eksportformat.
- Valgfri metrisk målestok på eksport i ortografisk visning.
- Automatisk eller fast målestokslængde.
- Valgfri frit roterbar nordpil og fire hjørneplaceringer.
- Automatisk geografisk nord er bevidst parkeret til senere.


## v0.2.15 — projektfiler
- **Gem projekt** og **Åbn projekt** i topbjælken.
- Projektet gemmes som én fil med endelsen `.archaeoplan`.
- Filen er et ZIP-baseret ArchaeoPlan-format med `project.json` og indlejrede GLB-modeller.
- Modeller og teksturer pakkes ind i projektfilen; de oprindelige importfiler behøver derfor ikke vælges igen ved genåbning.
- Gemmer modelnavn, beskåret-status, synlighed, position, rotation, skala og låsestatus.
- Gemmer aktuelle kamera/projektion og gemte kameravisninger.
- Gemmer eksportformat, opløsning, eksport-ramme, målestok og nordpil.
- Gemmer aktuelt måleresultat.
- Undo/redo-historikken gemmes ikke mellem sessioner.
- Ved åbning valideres hele projektfilen og modellerne læses, før det eksisterende arbejdsområde erstattes.


## v0.2.16 — sprog og valg af gemmested
- Fire brugerfladesprog: dansk (DA), tysk (DE), engelsk (EN) og fransk (FR).
- Sprog vælges direkte i topbjælken og huskes lokalt.
- Det valgte sprog gemmes også i `.archaeoplan`-projektfilen.
- Projektgemning er ændret, så projektet først pakkes færdigt og derefter viser en særskilt **Vælg placering…**-knap.
- På iPad/iPhone åbner knappen iOS-delearket; vælg **Gem i Filer** og derefter ønsket mappe.
- På browsere med `showSaveFilePicker()` bruges en rigtig Gem som-dialog.
- Hvis ingen af delene understøttes, bruges almindelig browser-download som reserve.
- Eksisterende modeller, beskæring, måling, målestok, nordpil og billedeksport er ikke omskrevet.

## v0.2.17 — grundplan / underlag
- PNG, JPG, WEBP og SVG kan indlæses som særskilt grundplan under 3D-modellerne.
- Grundplanen kan flyttes, drejes, skaleres og justeres i gennemsigtighed.
- Den kan låses, vises/skjules og valgfrit medtages i billedeksport.
- Grundplanen indgår ikke i beskæring eller almindelig modelmåling.
- Billede og indstillinger gemmes i `.archaeoplan`-projektfilen.
- Manuel indpasning i denne version; automatisk 2-/3-punkts indpasning er gemt til senere.


## v0.2.18 — højopløsnings-eksport
- Den tidligere skjulte 12.000 px-grænse er fjernet.
- Brugerdefinerede eksportmål respekteres nu op til 50.000 px pr. dimension.
- Store billeder renderes flisevis og samles bagefter til ét PNG-billede.
- Flisestørrelsen tilpasses GPU/WebGL-grænserne og holdes højst omkring 4096 px for stabilitet på iPad.
- Målestok og nordpil tegnes først efter samling, så de bevarer korrekt størrelse og skarphed.
- Projektgemning nedskalerer ikke længere teksturer til 4096 px.
- Teksturer får maksimal tilgængelig anisotropisk filtrering til dokumentationsvisning.
- Øvrige værktøjer og projektformat er ikke ændret.


## v0.2.19 — friseudrulning
- Første version af cylindrisk/konisk friseudrulning.
- Vælg X-, Y- eller Z-akse gennem genstanden.
- Vælg start og slut direkte på den valgte 3D-model.
- Hele omkredsen kan vælges, og retningen kan vendes.
- Udrulningen bruger modellens eksisterende UV-koordinater og originale teksturkort.
- Eksportbredden kan sættes op til 50.000 px og renderes flisevist.
- Funktionen ændrer ikke original model eller tekstur.
- Indstillingerne gemmes i `.archaeoplan`-projektet.
- Denne version er beregnet til cylindriske eller næsten cylindriske former.

## v0.2.20 — friseeksport på iPad
- Frisen renderes først helt færdig.
- Derefter vises en dialog med et nyt fysisk brugertryk.
- **Gem PNG** gemmer som almindelig fil.
- **Del / Gem til Fotos** åbner iOS-delearket, så Safari ikke mister brugeraktiveringen under den lange renderproces.
- Selve friseudrulningen er ellers uændret fra v0.2.19.

## v0.2.21 — Udfold overflade
- Reliefdybde bevares ved udfoldning.
- Området kan afgrænses før udfoldning med frihånd på modellen.
- Originalmodellen ændres ikke.
- Hele udfoldningen vises først i preview.
- Øvre og nedre kant på eksportbånd kan trækkes.
- Valgt bånd eller hele udfoldningen kan eksporteres.
- Originale UV-koordinater og teksturer bevares; højopløsnings-eksport er fortsat flisebaseret.
