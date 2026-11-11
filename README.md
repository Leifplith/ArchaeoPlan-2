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

## v0.2.22 — præcisionsbeskæring
- Beskæring vælger ikke længere kun hele mesh-trekanter til/fra.
- Polygonen/frihåndslinjen trianguleres i skærmplanet, og de mesh-trekanter der rammes af grænsen splittes geometrisk.
- Nye skæringspunkter får interpolerede positioner, UV-koordinater, normaler, farver og øvrige vertex-attributter.
- Teksturen kan derfor fortsætte helt frem til den nye, præcise kant.
- Både **Behold indenfor** og **Fjern indenfor** bruger den nye motor.
- Originalmodellen bevares fortsat urørt; resultatet er en ny kopi.
- Resten af beskæringsarbejdsgangen (frihånd/polygon, undo/redo) er bevaret.

## v0.2.23 — lukket og optimeret frihåndskontur
- Frihåndskonturen vises og behandles nu som en lukket polygon.
- Før præcisionssnittet fjernes næsten identiske punkter.
- Meget tætte frihåndslinjer forenkles forsigtigt med ca. 1,25 skærmpixels tolerance før triangulering.
- Det reducerer kraftigt risikoen for at Safari/iPad går i stå ved **Behold indenfor** / **Fjern indenfor**.
- Selve den præcise trekantsplitting og UV-interpolation fra v0.2.22 er bevaret.

## v0.2.24 — lås polygon før præcisionssnit
- **Behold indenfor** og **Fjern indenfor** afslutter nu frihåndstegningen med det samme.
- Aktiv pointer/pen frigives, så man ikke kan fortsætte med at tegne under beregningen.
- Polygonen normaliseres, lukkes og vises låst før beregningen starter.
- Safari/iPad får en render-frame til at vise den lukkede polygon, før den tunge geometrioperation begynder.
- Status vises nu i trin: lukker/låser polygon → forbereder polygon → beregner præcisionssnit → opbygger beskåret model.
- Meshes behandles enkeltvis med små yields mellem dem for at mindske risikoen for, at brugerfladen ser fastfrosset ud.
- Den præcise trekantsplitting og UV-interpolation fra v0.2.22/23 er bevaret.

## v0.2.25 — kantbaseret præcisionssnit
- Den tunge polygon-Boolean fra v0.2.22–0.2.24 er erstattet.
- Hele trekanter klassificeres hurtigt som indenfor/udenfor og kopieres eller fjernes direkte.
- Kun trekanter, hvis skærmprojektion rammes af polygonens kant, går gennem den dyre geometriske splitting.
- Polygonens kanter ligger i et simpelt 96 px spatialt grid, så hver mesh-trekant kun undersøger nærliggende kantsegmenter.
- Nye snitpunkter interpolerer fortsat UV, normaler, vertexfarver og øvrige vertex-attributter.
- Status viser mesh-fremdrift under beregningen.
- Målet er markant kortere beregningstid på tætte fotogrammetrimodeller.

## v0.2.26 — fejlrettelse i polygonlåsning
- Kritisk fejl rettet: v0.2.25 kaldte `finalizeCropContour()` og `finishCropAfterCalculation()`, men funktionerne var ved en fejl blevet fjernet under udskiftningen af snitmotoren.
- Det forklarede præcist, hvorfor programmet stoppede ved **Lukker og låser polygon…** uden at gå videre.
- Polygonen låses nu uden geometriarbejde.
- Browseren får derefter en frame til at vise den lukkede polygon.
- Konturen forberedes bagefter med lineær udtynding og højst 1200 arbejds-punkter.
- Den kantbaserede præcisionsmotor fra v0.2.25 er bevaret.

## v0.2.27 — discard-first præcisionsbeskæring
- Beskæringsmotoren følger nu den ønskede pipeline:
  1. Trekanter sikkert på den forkerte side kasseres straks.
  2. Trekanter sikkert på den rigtige side beholdes urørte.
  3. Kun trekanter som rammer/straddler polygonkanten sendes til præcisionssplitting.
  4. Nye fragmenter klassificeres igen, og fragmenter på den forkerte side kasseres.
  5. Bevarede hele trekanter og nye kanttrekanter samles til den færdige mesh.
- Klassifikation bruger alle tre hjørner plus kontrol for kantkrydsning.
- Den dyre splitfunktion kaldes derfor kun i et smalt bælte langs den tegnede linje.
- Status viser antal kanttrekanter pr. mesh under beregningen.

## v0.2.28 — rigtig beregningslås og afbrydelig beskæring
- Ny global `cropCalculating`-tilstand.
- Når Behold/Fjern er valgt, deaktiveres Frihånd, Polygon, Start, Behold og Fjern.
- **Annullér** bliver til **Stop beregning** og forbliver aktiv.
- Tegne-input ignoreres helt under beregningen.
- Præcisionsmotoren giver Safari kontrollen tilbage for hver ca. 2.000 trekanter.
- Derfor kan en lang beregning nu faktisk stoppes, også når modellen består af én stor mesh.
- Status viser løbende antal behandlede trekanter.
- Ved stop bortskaffes arbejdskopiens geometri, originalmodellen berøres ikke.

## v0.2.29 — fejlrettelse: manglende skærmpunkter
- Fejlen `undefined is not an object (evaluating 'p.x')` er rettet.
- Årsagen var, at nye interpolerede vertices fra præcisionssplittingen ikke fik deres `_screen`-koordinat med videre.
- `cropLerpVertex()` interpolerer nu også skærmpositionen.
- Kant-/trekanttests er gjort defensive over for manglende eller ikke-endelige koordinater.
- En degenereret kant eller projektion kan derfor ikke længere vælte hele beskæringen.

## v0.2.30 — sikker kant-splitting og bevar markering ved fejl
- Alle fragment-skærmpositioner valideres nu gennem `cropSafeScreen()`.
- Bounding boxes bygges kun af gyldige skærmpunkter.
- Direkte `p.x`/`p.y`-adgang i den sårbare kant-splitting er fjernet.
- Ugyldige/degenererede fragmenter springes over i stedet for at stoppe hele beskæringen.
- Hvis præcisionssnittet fejler, bliver den tegnede polygon stående og beskæringstilstanden genåbnes.
- Originalmodellen berøres fortsat ikke ved fejl.

## v0.2.31 — stack-safe mesh-samling
- Sandsynlig hovedårsag til `Maximum call stack size exceeded` rettet.
- Den nye beskårne mesh blev tidligere samlet med `array.push(...meget_stort_array)`.
- På store Scaniverse-modeller kan spread af hundredtusinder/millioner værdier overskride JavaScripts call stack.
- Output-attributter bygges nu direkte i forudallokerede `Float32Array`-buffere uden spread.
- `cropSafeBBox()` bruger også iterative min/max-beregninger uden `Math.min(...stort_array)`.
- Ved en snitfejl bevares polygonen synligt **og låst**; tegning kan ikke fortsættes.
- Man kan enten prøve Behold/Fjern igen på samme polygon eller trykke Annullér og starte forfra.

## v0.2.32-clean — kodeoprydning
- Oprydningsversion baseret direkte på den fungerende v0.2.31.
- Ingen tilsigtede ændringer i funktionalitet eller brugerflade.
- Den fungerende præcisionsbeskæring er bevaret uændret.
- Gamle/ubrugte hjælpefunktioner fra tidligere beskæringsforsøg er fjernet, hvor de ikke længere havde aktive kald.
- Overflødige statusnøgler og kommentarer er ryddet op.
- Cache-busting og versionsnumre er opdateret.
- JavaScript-syntaks, dublerede navngivne funktioner og ZIP-indhold er kontrolleret.

## v0.2.33 — robust PNG/billedeksport på iPad
- Almindelig billedeksport bruger nu samme robuste to-trinsmodel som friseeksport.
- Først renderes hele billedet færdigt.
- Derefter vises dialogen **Billedet er klar**.
- Et nyt fysisk tryk på **Gem PNG** eller **Del / Gem til Fotos** udfører selve fil-/delehandlingen.
- Dette undgår Safari/iPad-problemet hvor brugeraktiveringen udløber under lang højopløsningsrendering.
- Renderingskvalitet, fliseeksport, skala, nordpil og originale teksturer er uændret.

## v0.2.34 — sikker eksportstørrelse
- Problemet efter sidste renderflise på iPad var den endelige 2D-canvas, ikke WebGL-fliserne.
- 50.000 × 50.000 px kræver ca. 10 GB rå RGBA-data og kan ikke samles i Safari.
- ArchaeoPlan begrænser nu **samlet pixelantal**, ikke kun bredde/højde hver for sig.
- iPad/iPhone: ca. 48 megapixel maksimum for den samlede PNG-canvas.
- Desktop: ca. 120 megapixel maksimum.
- Hvis brugeren indtaster mere, bevares billedformatet og dimensionerne skaleres automatisk ned.
- Brugerfladen viser altid **Faktisk eksport: B × H px** før rendering.
- v0.2.33's to-trins Gem/Del-dialog er bevaret.

## v0.2.35 — enkel eksport efter slutmedie
- Eksportpanelet er gjort mere tilgængeligt.
- Fem hovedvalg: **Skærm / PowerPoint**, **Bog / artikel**, **Plakat**, **Udstilling**, **Brugerdefineret**.
- Relevante størrelser vises som presets i stedet for at kræve manuel pixelindtastning.
- Bog/plakat bruger som standard 300 dpi.
- Udstilling bruger som standard 150 dpi.
- Skærm/PowerPoint tilbyder Full HD, QHD og 4K.
- Fysisk størrelse omregnes automatisk til pixels.
- Avancerede pixel-, format- og presetvalg er bevaret under **Avanceret…**.
- Brugerfladen viser stadig faktisk eksportstørrelse efter enhedens sikre hukommelsesgrænse.
- Den eksisterende højopløsningsrendering, originalteksturer, målestok, nordpil og to-trins Gem/Del-dialog er bevaret.

## v0.2.36 — repareret filindlæsning og versionsvisning
- Fejlen i v0.2.35 var ikke `loadFiles()` selv.
- Den nye eksportsektion havde ved en fejl fjernet HTML-kontrollerne for målestok og nordpil.
- JavaScript stoppede derfor ved opstart, før programmet kunne fungere normalt, herunder **Tilføj fil**.
- Målestok/nordpil er genetableret uden at ændre eksportmotoren.
- Den nye formålsbaserede eksportmenu fra v0.2.35 er bevaret.
- Statuslinjen nederst viser nu korrekt **ArchaeoPlan v0.2.36 klar.**

## v0.2.37 — robust og synlig projektgemning
- Projektgemning giver nu straks synlig respons.
- Under GLB-eksport vises en modal med fremdrift model for model.
- Safari får et render-yield før den tunge eksport starter.
- Den færdige `.archaeoplan` åbner fortsat en separat dialog, så iPad får et nyt fysisk brugertryk før **Gem i Filer**.
- Fejl vises nu i en tydelig dialog i stedet for kun i den lille statuslinje.
- En færdigpakket projektfil beholdes ved gemmefejl, så gemningen kan forsøges igen uden ny GLB-eksport.
- De nye eksportvalg (formål/preset/dpi) gemmes nu også i projektet, men gamle projektfiler er fortsat kompatible.


## v0.2.38 — tættere og mere jævn overfladeudfoldning
- `Udfold overflade` underinddeler nu midlertidigt store trekanter, når de spænder for langt rundt om objektets akse.
- Underinddelingen er adaptiv: kun trekanter med stor vinkeludstrækning deles.
- Målet er ca. 0,5° vinkeltrin, med en sikker maksimal dybde og en samlet trekantgrænse for at beskytte iPad-hukommelsen.
- Nye punkter beregnes på den eksisterende mesh-trekant; der opfindes ingen ny scanninggeometri.
- UV-koordinater og vertex-farver interpoleres, så original tekstur følger med gennem underinddelingen.
- Originalmodellen ændres ikke. Forbedringen findes kun i den midlertidige udfoldede kopi.
- Beskæring, projektfiler, kamera, eksport og øvrige værktøjer er ikke ændret.


## v0.2.39 – vektor-tegneark
- Nyt 2D-vektorlag bundet til en ortografisk visning.
- Frihånd, linje og polyline.
- Fire stregtyper: sammenhængende, stiplet, streg-prik og lang-kort.
- Farve, stregtykkelse, simple lag, synlighed, valg/flyt og slet.
- Undo/redo for tegning, flytning og sletning.
- Tegningen gemmes i .archaeoplan-projektet.
- SVG-eksport og valgfri medtagelse i PNG-eksport.
- Første version er et låst ortografisk tegneark; 3D-fastgjorte annotationer kommer senere.

## v0.2.41 – knudepunkter og zoom i tegnearket
- Valgte vektorer viser alle deres knudepunkter.
- Et enkelt knudepunkt kan trækkes uden at flytte resten af linjen.
- **Tilføj knudepunkt**: klik/tryk på et segment for at indsætte et nyt punkt præcist på segmentet.
- **Fjern knudepunkt**: klik/tryk på et eksisterende punkt for at fjerne det. En linje bevarer mindst to punkter.
- **Panorér** flytter arbejdsvisningen uden at ændre vektorgeometrien.
- Zoomknapper `− / % / +` giver op til 32× zoom i tegnearket; midterknappen nulstiller til tegnearkets oprindelige visning.
- Musehjul/trackpad kan også zoome, når tegnearket er aktivt.
- Flytning af hele den valgte vektor er bevaret: træk på selve linjen i **Vælg / flyt**.


## v0.2.41
- iPad: to-finger pinch zoom and simultaneous two-finger pan now work while the drawing sheet is active.
- Drawing with Apple Pencil / one pointer remains separate from navigation.


## v0.2.42 – arkæologiske enheder og sammenklappeligt værktøjspanel
- Tegnearkets tidligere interne tegnelag bruges nu som **arkæologiske enheder** med frit valgte betegnelser, fx `A34`, `L98`, `SU45` eller lokale museumsstandarder.
- Nye vektorer knyttes automatisk til den aktive enhed.
- Enheder kan oprettes, omdøbes, vælges samt vises/skjules samlet.
- Sletning af en enhed fjerner de tilknyttede vektorer; funktionen kan fortrydes via undo.
- Projektformatet bevarer den eksisterende interne `layers`-struktur, så ældre `.archaeoplan`-projekter fortsat kan åbnes.
- PC: musehjul = zoom, og **musehjul/midterknap holdt nede + træk = panorering**, uden at skifte væk fra det aktive tegneværktøj.
- Hver hovedgruppe i venstre værktøjspanel kan foldes sammen til en bjælke med overskrift. Tilstanden huskes lokalt i browseren.
- Hele værktøjspanelet kan skjules med knappen ved ArchaeoPlan-logoet og åbnes igen samme sted.
- Harris-matrix og stratigrafiske relationer er bevidst ikke med i denne version.


## v0.2.44 – global navigation og vedvarende tegning

- Fast PC-navigation uafhængigt af aktivt værktøj: hjul = zoom, midterklik + træk = panorér, højreklik + træk = rotation.
- Venstre museknap forbliver reserveret til det aktive værktøj.
- Tegningen kan blive synlig, når tegnearket lukkes.
- Ny global **Vis tegning**-kontakt, uafhængig af enhedsvisning.
- **Medtag tegning i billedeksport** er fortsat en separat kontakt, så et rent ortobillede kan eksporteres uden streger.
- SVG gemmes nu direkte som fil via **Gem tegning (SVG)** i stedet for først at åbne delearket.
- Tegningens globale synlighed gemmes i `.archaeoplan`-projektet.

Bemærk: Under en allerede påbegyndt skærmbaseret beskærings-/områdekontur låses kameranavigation fortsat, fordi kamerabevægelse ellers ville flytte modellen væk fra de allerede tegnede skærmpunkter.

## v0.2.44 — navigation, vektorredigering og 3D-eksport
- Fast PC-navigation på tværs af værktøjer: musehjul zoomer, midterste museknap + træk panorerer, højre museknap + træk roterer, venstre museknap bruges af det aktive værktøj.
- Fjern knudepunkt er gjort mere tolerant og kan også udføres direkte på et valgt knudepunkt.
- Delete/Backspace sletter hele den valgte vektorlinje i tegnearket.
- Nyt sakseværktøj deler en linje i to selvstændige vektorer med samme enhed, farve, tykkelse og stregtype.
- Billedeksport kan automatisk skjule arbejdsmarkører som transform-gizmo, gitter, akser og målepunkter/-linjer; målestok og nordpil styres fortsat separat.
- Ny eksport af alle synlige 3D-modeller samlet i én GLB med deres indbyrdes placering, rotation, skala og teksturer bevaret.
- De nye handlinger understøtter undo/redo, hvor det er relevant.
