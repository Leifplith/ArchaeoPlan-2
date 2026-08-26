import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js';

// ArchaeoPlan 0.2.12-clean
// Cleanup release based directly on the tested 0.2.11 behavior.

const VERSION='0.2.23';
const $=id=>document.getElementById(id);
const viewport=$('viewport'),status=$('status'),fileInput=$('fileInput'),projectInput=$('projectInput'),underlayInput=$('underlayInput'),modelList=$('modelList'),languageSelect=$('languageSelect'),projectSaveDialog=$('projectSaveDialog'),friezeSaveDialog=$('friezeSaveDialog'),unwrapPreviewDialog=$('unwrapPreviewDialog'),unwrapPreviewStage=$('unwrapPreviewStage'),unwrapPreviewImage=$('unwrapPreviewImage'),unwrapBandOverlay=$('unwrapBandOverlay');
const cropInputLayer=$('cropInputLayer'),cropOverlay=$('cropOverlay'),cropLine=$('cropLine'),cropPolygon=$('cropPolygon'),cropPointsGroup=$('cropPoints'),cropHint=$('cropHint');
const exportFrame=$('exportFrame'),measureResult=$('measureResult'),scaleBarOverlay=$('scaleBarOverlay'),northArrowOverlay=$('northArrowOverlay');

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xd6d9dc);

const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NoToneMapping;
viewport.prepend(renderer.domElement);

const perspectiveCamera=new THREE.PerspectiveCamera(45,1,.001,1e7);
perspectiveCamera.position.set(8,6,8);
const orthographicCamera=new THREE.OrthographicCamera(-5,5,5,-5,-1e7,1e7);
orthographicCamera.position.set(0,12,0.001);
let camera=perspectiveCamera;

function createOrbit(cam){
  const o=new OrbitControls(cam,renderer.domElement);
  o.enableDamping=true;o.dampingFactor=.08;o.screenSpacePanning=true;o.enablePan=true;
  o.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
  return o;
}
let orbit=createOrbit(camera);
orbit.target.set(0,0,0);
camera.lookAt(0,0,0);
orbit.update();

const transform=new TransformControls(camera,renderer.domElement);
transform.setMode('translate');
transform.addEventListener('dragging-changed',e=>{
  if(transform.object===underlay){
    if(underlay?.userData.locked){transform.detach();orbit.enabled=true;return}
    orbit.enabled=!e.value;
    if(!e.value)updateUnderlayUi();
    return;
  }
  if(selectedModel?.root.userData.locked){transform.detach();orbit.enabled=true;return}
  orbit.enabled=!e.value;
  if(e.value){
    transformStartState=cloneTransformState(selectedModel);
  }else if(transformStartState&&selectedModel===transformStartState.model){
    const before=transformStartState,after=cloneTransformState(selectedModel);
    if(!sameTransform(before,after)){
      pushHistory({
        label:transform.getMode()==='rotate'?'drej model':'flyt model',
        undo:()=>applyTransformState(before),
        redo:()=>applyTransformState(after)
      });
    }
    transformStartState=null;
  }
});
transform.addEventListener('objectChange',syncTransformFields);
scene.add(transform);

const grid=new THREE.GridHelper(20,20,0x6c7379,0xaab0b5);scene.add(grid);scene.add(new THREE.AxesHelper(1));

const models=[];let selectedModel=null;let modelNumber=1;
const liveObjectUrls=new Set();
let cropMode=false,cropTool='freehand',cropPoints=[],cropDrawing=false,cropPointerId=null;
let measureMode=false,measurePoints=[],measureLine=null,measureDots=[],measureLabel=null;
let exportFrameVisible=false;
let savedViews=[];
let preparedProject=null;
let underlay=null,underlayImageData=null,underlaySelected=false;
let unwrapPickMode=null,unwrapStartAngle=null,unwrapEndAngle=null,unwrapReverse=false,preparedFrieze=null;
let unwrapAreaMode=false,unwrapAreaPoints=[],unwrapBandTop=0,unwrapBandBottom=1,unwrapPreviewUrl=null;

function setStatus(t){status.textContent=t}
function releaseAllObjectUrls(){for(const u of liveObjectUrls)URL.revokeObjectURL(u);liveObjectUrls.clear()}


// ---------- Language / i18n ----------
const I18N={
da:{
  precisionCropNote:'Præcisionssnit: frihåndskonturen lukkes automatisk, og trekanter deles ved klippelinjen.', preciseCropWorking:'Laver præcisionssnit…', preciseCropFallback:'Præcisionssnittet kunne ikke beregnes for dette område.',

  unwrapSurface:'Udfold overflade', unwrapSelectArea:'Vælg område', unwrapClearArea:'Ryd område', unwrapPreview:'Lav udfoldning', unwrapWholeHeight:'Hele omkredsen og hele højden bruges.', unwrapPreviewHeading:'Forhåndsvisning af udfoldning', unwrapPreviewHelp:'Træk den øverste og nederste kant for at vælge eksportbåndet.', unwrapBandAll:'Bånd: hele højden', unwrapExportBand:'Eksportér valgt bånd', unwrapExportFull:'Eksportér hele udfoldningen', unwrapAreaActive:'Tegn området direkte på modellen.', unwrapAreaChosen:'Område valgt til udfoldning.', unwrapAreaCleared:'Afgrænsning ryddet.',

  friezeReady:'Frisen er klar', friezeReadyText:'Vælg hvordan det udfoldede billede skal gemmes.', friezeSavePng:'Gem PNG', friezeShare:'Del / Gem til Fotos', friezeClose:'Luk', friezePrepared:'Frisen er klar til at blive gemt.',

  unwrap:'Friseudrulning', unwrapHelp:'Til cylindriske eller næsten cylindriske genstande. Vælg aksen gennem genstanden, og markér start og slut direkte på modellen.', unwrapAxis:'Akse', unwrapWidth:'Bredde', unwrapStart:'Vælg start', unwrapEnd:'Vælg slut', unwrapFull:'Hele omkredsen', unwrapReverse:'Vend retning', unwrapExport:'Eksportér udfoldet frise', unwrapFullStatus:'Start/slut er ikke valgt. Hele omkredsen bruges.', unwrapStartChosen:'Startpunkt valgt. Vælg nu slutpunkt.', unwrapEndChosen:'Slutpunkt valgt.', unwrapPickStart:'Tryk på modellen for at vælge frisenes start.', unwrapPickEnd:'Tryk på modellen for at vælge frisenes slut.', unwrapNeedModel:'Vælg først en model.', unwrapWorking:'Ruller frisen ud…', unwrapDone:'Udfoldet frise eksporteret.', unwrapNoGeometry:'Der blev ikke fundet egnet geometri i det valgte område.',

  underlay:'Grundplan / underlag', loadUnderlay:'Indlæs grundplan', removeUnderlay:'Fjern grundplan', underlayMove:'Flyt', underlayRotate:'Drej', underlayScale:'Skala', underlayOpacity:'Gennemsigtighed', underlayVisible:'Vis grundplan', underlayExport:'Medtag i eksport', underlayHelp:'Grundplanen ligger som et særskilt, plant underlag under 3D-modellerne. Tilpas den og lås den derefter.', underlayLoaded:'Grundplan indlæst.', underlayRemoved:'Grundplan fjernet.', underlayLocked:'Grundplanen er låst.', underlayUnlocked:'Grundplanen er låst op.', underlaySelect:'Indlæs først en grundplan.', underlayFileError:'Kunne ikke indlæse grundplanen: {error}',

  languageName:'Dansk',
  newProject:'Nyt projekt', saveProject:'Gem projekt', openProject:'Åbn projekt', addFile:'Tilføj fil',
  undo:'Fortryd', redo:'Annuller fortryd', fitModel:'Tilpas model',
  view:'Visning', perspective:'Perspektiv', orthographic:'Ortografisk',
  top:'Top', front:'Front', right:'Højre', bottom:'Bund', back:'Bag', left:'Venstre', showGrid:'Vis gitter',
  models:'Modeller', noModels:'Ingen modeller åbnet.', selectedModel:'Valgt model',
  move:'Flyt', rotate:'Drej', lock:'Lås', unlock:'Lås op',
  crop:'Beskæring', cropHelp:'Vælg en model. Vælg frihånd eller polygon. Start beskæring og tegn direkte på modellen.',
  freehand:'Frihånd', polygon:'Polygon', startCrop:'Start beskæring', cancel:'Annullér',
  keepInside:'Behold indenfor', removeInside:'Fjern indenfor',
  cropNote:'Originalen bevares. Beskæringen laves som en ny kopi.',
  savedViews:'Gemte visninger', saveView:'Gem visning', clearViews:'Ryd visninger', noSavedViews:'Ingen gemte visninger.',
  measure:'Måling', measureDistance:'Mål afstand', clearMeasure:'Ryd måling', noMeasurement:'Ingen måling.',
  exportFrame:'Eksport-ramme', format:'Format', resolution:'Opløsning', width:'Bredde', height:'Højde',
  screenFormat:'Skærmformat', aLandscape:'A-format liggende', aPortrait:'A-format stående', customFormat:'Frit format',
  screen:'Skærm', px3000:'3000 px bredde', px6000:'6000 px bredde', custom:'Brugerdefineret',
  showExportFrame:'Vis eksport-ramme', hideExportFrame:'Skjul eksport-ramme', fitExport:'Tilpas model til ramme',
  savePng:'Gem PNG', sharePhotos:'Del / Gem til Fotos',
  annotations:'Eksportmarkeringer', showScale:'Vis målestok', length:'Længde', automatic:'Automatisk',
  position:'Placering', bottomLeft:'Nederst venstre', bottomRight:'Nederst højre', topLeft:'Øverst venstre', topRight:'Øverst højre',
  showNorth:'Vis nordpil', rotationDeg:'Rotation °',
  scaleNorthNote:'Målestokken er metrisk korrekt i ortografisk visning. Nordpilen drejes manuelt indtil videre.',
  exportNote:'Det synlige udsnit inden for rammen eksporteres. Opløsningen ændrer kun detaljegraden, ikke udsnittet.',
  docs:'Dokumentationsvisning', docsText:'GLB- og OBJ-teksturer bevares. ArchaeoPlan ændrer ikke de originale teksturfiler.',
  drop:'Slip filer her', dropText:'GLB, GLTF, OBJ + MTL + teksturer eller PLY',
  projectReady:'Projektet er klar', projectReadyText:'Vælg hvor projektfilen skal gemmes.',
  chooseLocation:'Vælg placering…', cancelSave:'Annullér',
  projectNamePrompt:'Navn på projektfilen:', viewNamePrompt:'Navn på visningen:', clearViewsConfirm:'Ryd alle gemte visninger?',
  replaceProjectConfirm:'Åbn projektet og erstat det nuværende arbejdsområde?',
  newProjectConfirm:'Opret nyt projekt og fjern modellerne fra arbejdsfladen?',
  loaded:'Indlæst: {name}', modelLocked:'Modellen er låst.', modelUnlocked:'Modellen er låst op.',
  selectModel:'Vælg først en model.', noModelFit:'Ingen model at tilpasse.', modelFit:'Valgt model tilpasset og centreret.',
  centered:'{name}: centreret', selectModelFile:'Vælg en model-fil.', fileError:'Fejl ved {name}: {error}',
  newEmpty:'Nyt tomt projekt – centrum (0,0,0).', toolSelected:'{tool} valgt.', cropActive:'Beskæring aktiv.',
  strokeSaved:'Strøg gemt. Fortsæt et andet sted, eller vælg Behold/Fjern.',
  cropCreated:'Beskåret kopi oprettet. Originalen er bevaret og skjult.',
  viewSaved:'Visning "{name}" gemt.', viewRestored:'Visning "{name}" hentet.', viewsCleared:'Gemte visninger ryddet.',
  measureActive:'Måling aktiv: tryk to punkter på modellen.', measureEnded:'Måling afsluttet.', measureValue:'Måling: {value}',
  exportFit:'Model tilpasset eksport-rammen.', pngExported:'PNG eksporteret.', imageShare:'Billede sendt til iOS deleark.',
  imageFallback:'Deling understøttes ikke her – PNG blev gemt i stedet.',
  noModelsToSave:'Der er ingen modeller at gemme i projektet.', preparingProject:'Forbereder projekt…',
  savingModel:'Gemmer projekt: model {i} af {n}…', packingProject:'Pakker projektfil…',
  projectPrepared:'Projektet er klar til at blive gemt.', projectSaved:'Projekt gemt: {name}',
  saveError:'Kunne ikke gemme projekt: {error}', openingProject:'Åbner projektfil…', openingCancelled:'Åbning annulleret.',
  openingModel:'Åbner projekt: model {i} af {n}…', projectOpened:'Projekt åbnet: {name}', openError:'Kunne ikke åbne projekt: {error}',
  undone:'Fortrudt: {label}', redone:'Gentaget: {label}', orthoScaleOnly:'Målestok er kun metrisk korrekt i ortografisk visning.',
  ready:'ArchaeoPlan v{version} klar.', savedToFiles:'Projektfil sendt til delearket.', downloaded:'Projektfil downloadet.'
},
de:{
  precisionCropNote:'Präzisionsschnitt: Die Freihandkontur wird automatisch geschlossen und die Dreiecke werden an der Schnittlinie geteilt.', preciseCropWorking:'Präzisionsschnitt wird berechnet…', preciseCropFallback:'Der Präzisionsschnitt konnte für diesen Bereich nicht berechnet werden.',

  unwrapSurface:'Oberfläche abwickeln', unwrapSelectArea:'Bereich wählen', unwrapClearArea:'Bereich löschen', unwrapPreview:'Abwicklung erstellen', unwrapWholeHeight:'Gesamter Umfang und gesamte Höhe werden verwendet.', unwrapPreviewHeading:'Vorschau der Abwicklung', unwrapPreviewHelp:'Obere und untere Kante ziehen, um den Exportstreifen zu wählen.', unwrapBandAll:'Streifen: gesamte Höhe', unwrapExportBand:'Gewählten Streifen exportieren', unwrapExportFull:'Gesamte Abwicklung exportieren', unwrapAreaActive:'Bereich direkt auf dem Modell zeichnen.', unwrapAreaChosen:'Bereich für die Abwicklung gewählt.', unwrapAreaCleared:'Abgrenzung gelöscht.',

  friezeReady:'Der Fries ist fertig', friezeReadyText:'Wählen Sie, wie das abgewickelte Bild gespeichert werden soll.', friezeSavePng:'PNG speichern', friezeShare:'Teilen / In Fotos sichern', friezeClose:'Schließen', friezePrepared:'Der Fries kann jetzt gespeichert werden.',

  unwrap:'Fries abwickeln', unwrapHelp:'Für zylindrische oder annähernd zylindrische Objekte. Achse wählen und Start und Ende direkt am Modell markieren.', unwrapAxis:'Achse', unwrapWidth:'Breite', unwrapStart:'Start wählen', unwrapEnd:'Ende wählen', unwrapFull:'Gesamter Umfang', unwrapReverse:'Richtung umkehren', unwrapExport:'Abgewickelten Fries exportieren', unwrapFullStatus:'Start/Ende nicht gewählt. Der gesamte Umfang wird verwendet.', unwrapStartChosen:'Startpunkt gewählt. Jetzt Endpunkt wählen.', unwrapEndChosen:'Endpunkt gewählt.', unwrapPickStart:'Auf das Modell tippen, um den Start des Frieses zu wählen.', unwrapPickEnd:'Auf das Modell tippen, um das Ende des Frieses zu wählen.', unwrapNeedModel:'Bitte zuerst ein Modell wählen.', unwrapWorking:'Fries wird abgewickelt…', unwrapDone:'Abgewickelter Fries exportiert.', unwrapNoGeometry:'Im gewählten Bereich wurde keine geeignete Geometrie gefunden.',

  underlay:'Grundplan / Unterlage', loadUnderlay:'Grundplan laden', removeUnderlay:'Grundplan entfernen', underlayMove:'Verschieben', underlayRotate:'Drehen', underlayScale:'Skalierung', underlayOpacity:'Transparenz', underlayVisible:'Grundplan anzeigen', underlayExport:'Beim Export einbeziehen', underlayHelp:'Der Grundplan liegt als separate ebene Unterlage unter den 3D-Modellen. Ausrichten und anschließend sperren.', underlayLoaded:'Grundplan geladen.', underlayRemoved:'Grundplan entfernt.', underlayLocked:'Der Grundplan ist gesperrt.', underlayUnlocked:'Der Grundplan ist entsperrt.', underlaySelect:'Bitte zuerst einen Grundplan laden.', underlayFileError:'Grundplan konnte nicht geladen werden: {error}',

  newProject:'Neues Projekt', saveProject:'Projekt speichern', openProject:'Projekt öffnen', addFile:'Datei hinzufügen',
  undo:'Rückgängig', redo:'Wiederholen', fitModel:'Modell einpassen',
  view:'Ansicht', perspective:'Perspektivisch', orthographic:'Orthografisch',
  top:'Oben', front:'Vorne', right:'Rechts', bottom:'Unten', back:'Hinten', left:'Links', showGrid:'Raster anzeigen',
  models:'Modelle', noModels:'Keine Modelle geöffnet.', selectedModel:'Ausgewähltes Modell',
  move:'Verschieben', rotate:'Drehen', lock:'Sperren', unlock:'Entsperren',
  crop:'Beschneiden', cropHelp:'Modell wählen. Freihand oder Polygon wählen. Beschneiden starten und direkt auf dem Modell zeichnen.',
  freehand:'Freihand', polygon:'Polygon', startCrop:'Beschneiden starten', cancel:'Abbrechen',
  keepInside:'Innen behalten', removeInside:'Innen entfernen', cropNote:'Das Original bleibt erhalten. Der Beschnitt wird als neue Kopie erstellt.',
  savedViews:'Gespeicherte Ansichten', saveView:'Ansicht speichern', clearViews:'Ansichten löschen', noSavedViews:'Keine gespeicherten Ansichten.',
  measure:'Messen', measureDistance:'Abstand messen', clearMeasure:'Messung löschen', noMeasurement:'Keine Messung.',
  exportFrame:'Exportrahmen', format:'Format', resolution:'Auflösung', width:'Breite', height:'Höhe',
  screenFormat:'Bildschirmformat', aLandscape:'A-Format Querformat', aPortrait:'A-Format Hochformat', customFormat:'Freies Format',
  screen:'Bildschirm', px3000:'3000 px Breite', px6000:'6000 px Breite', custom:'Benutzerdefiniert',
  showExportFrame:'Exportrahmen anzeigen', hideExportFrame:'Exportrahmen ausblenden', fitExport:'Modell an Rahmen anpassen',
  savePng:'PNG speichern', sharePhotos:'Teilen / In Fotos sichern',
  annotations:'Exportmarkierungen', showScale:'Maßstab anzeigen', length:'Länge', automatic:'Automatisch',
  position:'Position', bottomLeft:'Unten links', bottomRight:'Unten rechts', topLeft:'Oben links', topRight:'Oben rechts',
  showNorth:'Nordpfeil anzeigen', rotationDeg:'Drehung °',
  scaleNorthNote:'Der Maßstab ist in der orthografischen Ansicht metrisch korrekt. Der Nordpfeil wird vorerst manuell gedreht.',
  exportNote:'Der sichtbare Ausschnitt innerhalb des Rahmens wird exportiert. Die Auflösung ändert nur den Detailgrad, nicht den Ausschnitt.',
  docs:'Dokumentationsansicht', docsText:'GLB- und OBJ-Texturen bleiben erhalten. ArchaeoPlan verändert die Originaltexturen nicht.',
  drop:'Dateien hier ablegen', dropText:'GLB, GLTF, OBJ + MTL + Texturen oder PLY',
  projectReady:'Projekt ist bereit', projectReadyText:'Wählen Sie, wo die Projektdatei gespeichert werden soll.',
  chooseLocation:'Speicherort wählen…', cancelSave:'Abbrechen',
  projectNamePrompt:'Name der Projektdatei:', viewNamePrompt:'Name der Ansicht:', clearViewsConfirm:'Alle gespeicherten Ansichten löschen?',
  replaceProjectConfirm:'Projekt öffnen und den aktuellen Arbeitsbereich ersetzen?', newProjectConfirm:'Neues Projekt erstellen und Modelle von der Arbeitsfläche entfernen?',
  loaded:'Geladen: {name}', modelLocked:'Das Modell ist gesperrt.', modelUnlocked:'Das Modell ist entsperrt.',
  selectModel:'Bitte zuerst ein Modell wählen.', noModelFit:'Kein Modell zum Einpassen.', modelFit:'Ausgewähltes Modell eingepasst und zentriert.',
  centered:'{name}: zentriert', selectModelFile:'Bitte eine Modelldatei wählen.', fileError:'Fehler bei {name}: {error}',
  newEmpty:'Neues leeres Projekt – Zentrum (0,0,0).', toolSelected:'{tool} gewählt.', cropActive:'Beschneiden aktiv.',
  strokeSaved:'Strich gespeichert. An anderer Stelle fortfahren oder Innen behalten/entfernen wählen.',
  cropCreated:'Beschnittene Kopie erstellt. Original erhalten und ausgeblendet.',
  viewSaved:'Ansicht „{name}“ gespeichert.', viewRestored:'Ansicht „{name}“ geladen.', viewsCleared:'Gespeicherte Ansichten gelöscht.',
  measureActive:'Messung aktiv: zwei Punkte auf dem Modell antippen.', measureEnded:'Messung beendet.', measureValue:'Messung: {value}',
  exportFit:'Modell an Exportrahmen angepasst.', pngExported:'PNG exportiert.', imageShare:'Bild an das iOS-Teilen-Menü übergeben.',
  imageFallback:'Teilen wird hier nicht unterstützt – PNG wurde stattdessen gespeichert.',
  noModelsToSave:'Keine Modelle im Projekt zum Speichern.', preparingProject:'Projekt wird vorbereitet…',
  savingModel:'Projekt speichern: Modell {i} von {n}…', packingProject:'Projektdatei wird gepackt…',
  projectPrepared:'Projekt kann jetzt gespeichert werden.', projectSaved:'Projekt gespeichert: {name}',
  saveError:'Projekt konnte nicht gespeichert werden: {error}', openingProject:'Projektdatei wird geöffnet…', openingCancelled:'Öffnen abgebrochen.',
  openingModel:'Projekt öffnen: Modell {i} von {n}…', projectOpened:'Projekt geöffnet: {name}', openError:'Projekt konnte nicht geöffnet werden: {error}',
  undone:'Rückgängig: {label}', redone:'Wiederholt: {label}', orthoScaleOnly:'Der Maßstab ist nur in der orthografischen Ansicht metrisch korrekt.',
  ready:'ArchaeoPlan v{version} bereit.', savedToFiles:'Projektdatei an das Teilen-Menü übergeben.', downloaded:'Projektdatei heruntergeladen.'
},
en:{
  precisionCropNote:'Precision cut: the freehand contour is closed automatically and triangles are split at the cut line.', preciseCropWorking:'Creating precision cut…', preciseCropFallback:'The precision cut could not be calculated for this area.',

  unwrapSurface:'Unwrap surface', unwrapSelectArea:'Select area', unwrapClearArea:'Clear area', unwrapPreview:'Create unwrap', unwrapWholeHeight:'Full circumference and full height will be used.', unwrapPreviewHeading:'Unwrap preview', unwrapPreviewHelp:'Drag the upper and lower edges to choose the export band.', unwrapBandAll:'Band: full height', unwrapExportBand:'Export selected band', unwrapExportFull:'Export full unwrap', unwrapAreaActive:'Draw the area directly on the model.', unwrapAreaChosen:'Area selected for unwrap.', unwrapAreaCleared:'Area selection cleared.',

  friezeReady:'Frieze is ready', friezeReadyText:'Choose how to save the unwrapped image.', friezeSavePng:'Save PNG', friezeShare:'Share / Save to Photos', friezeClose:'Close', friezePrepared:'The frieze is ready to save.',

  unwrap:'Frieze unwrap', unwrapHelp:'For cylindrical or near-cylindrical objects. Choose the object axis, then mark start and end directly on the model.', unwrapAxis:'Axis', unwrapWidth:'Width', unwrapStart:'Choose start', unwrapEnd:'Choose end', unwrapFull:'Full circumference', unwrapReverse:'Reverse direction', unwrapExport:'Export unwrapped frieze', unwrapFullStatus:'Start/end not selected. Full circumference will be used.', unwrapStartChosen:'Start point selected. Now choose the end point.', unwrapEndChosen:'End point selected.', unwrapPickStart:'Tap the model to choose the frieze start.', unwrapPickEnd:'Tap the model to choose the frieze end.', unwrapNeedModel:'Select a model first.', unwrapWorking:'Unwrapping frieze…', unwrapDone:'Unwrapped frieze exported.', unwrapNoGeometry:'No suitable geometry was found in the selected area.',

  underlay:'Plan / underlay', loadUnderlay:'Load plan', removeUnderlay:'Remove plan', underlayMove:'Move', underlayRotate:'Rotate', underlayScale:'Scale', underlayOpacity:'Opacity', underlayVisible:'Show plan', underlayExport:'Include in export', underlayHelp:'The plan is a separate flat underlay beneath the 3D models. Align it, then lock it.', underlayLoaded:'Plan loaded.', underlayRemoved:'Plan removed.', underlayLocked:'The plan is locked.', underlayUnlocked:'The plan is unlocked.', underlaySelect:'Load a plan first.', underlayFileError:'Could not load plan: {error}',

  newProject:'New project', saveProject:'Save project', openProject:'Open project', addFile:'Add file',
  undo:'Undo', redo:'Redo', fitModel:'Fit model',
  view:'View', perspective:'Perspective', orthographic:'Orthographic',
  top:'Top', front:'Front', right:'Right', bottom:'Bottom', back:'Back', left:'Left', showGrid:'Show grid',
  models:'Models', noModels:'No models open.', selectedModel:'Selected model',
  move:'Move', rotate:'Rotate', lock:'Lock', unlock:'Unlock',
  crop:'Crop', cropHelp:'Select a model. Choose freehand or polygon. Start cropping and draw directly on the model.',
  freehand:'Freehand', polygon:'Polygon', startCrop:'Start crop', cancel:'Cancel',
  keepInside:'Keep inside', removeInside:'Remove inside', cropNote:'The original is preserved. Cropping creates a new copy.',
  savedViews:'Saved views', saveView:'Save view', clearViews:'Clear views', noSavedViews:'No saved views.',
  measure:'Measurement', measureDistance:'Measure distance', clearMeasure:'Clear measurement', noMeasurement:'No measurement.',
  exportFrame:'Export frame', format:'Format', resolution:'Resolution', width:'Width', height:'Height',
  screenFormat:'Screen format', aLandscape:'A-format landscape', aPortrait:'A-format portrait', customFormat:'Custom format',
  screen:'Screen', px3000:'3000 px width', px6000:'6000 px width', custom:'Custom',
  showExportFrame:'Show export frame', hideExportFrame:'Hide export frame', fitExport:'Fit model to frame',
  savePng:'Save PNG', sharePhotos:'Share / Save to Photos',
  annotations:'Export annotations', showScale:'Show scale bar', length:'Length', automatic:'Automatic',
  position:'Position', bottomLeft:'Bottom left', bottomRight:'Bottom right', topLeft:'Top left', topRight:'Top right',
  showNorth:'Show north arrow', rotationDeg:'Rotation °',
  scaleNorthNote:'The scale bar is metrically correct in orthographic view. The north arrow is rotated manually for now.',
  exportNote:'The visible area inside the frame is exported. Resolution changes detail only, not the crop.',
  docs:'Documentation view', docsText:'GLB and OBJ textures are preserved. ArchaeoPlan does not alter the original texture files.',
  drop:'Drop files here', dropText:'GLB, GLTF, OBJ + MTL + textures or PLY',
  projectReady:'Project is ready', projectReadyText:'Choose where to save the project file.',
  chooseLocation:'Choose location…', cancelSave:'Cancel',
  projectNamePrompt:'Project file name:', viewNamePrompt:'View name:', clearViewsConfirm:'Clear all saved views?',
  replaceProjectConfirm:'Open the project and replace the current workspace?', newProjectConfirm:'Create a new project and remove the models from the workspace?',
  loaded:'Loaded: {name}', modelLocked:'The model is locked.', modelUnlocked:'The model is unlocked.',
  selectModel:'Select a model first.', noModelFit:'No model to fit.', modelFit:'Selected model fitted and centred.',
  centered:'{name}: centred', selectModelFile:'Select a model file.', fileError:'Error with {name}: {error}',
  newEmpty:'New empty project – centre (0,0,0).', toolSelected:'{tool} selected.', cropActive:'Cropping active.',
  strokeSaved:'Stroke saved. Continue elsewhere, or choose Keep/Remove.',
  cropCreated:'Cropped copy created. Original preserved and hidden.',
  viewSaved:'View “{name}” saved.', viewRestored:'View “{name}” restored.', viewsCleared:'Saved views cleared.',
  measureActive:'Measurement active: tap two points on the model.', measureEnded:'Measurement ended.', measureValue:'Measurement: {value}',
  exportFit:'Model fitted to export frame.', pngExported:'PNG exported.', imageShare:'Image sent to the iOS share sheet.',
  imageFallback:'Sharing is not supported here – PNG was saved instead.',
  noModelsToSave:'There are no models to save in the project.', preparingProject:'Preparing project…',
  savingModel:'Saving project: model {i} of {n}…', packingProject:'Packing project file…',
  projectPrepared:'Project is ready to save.', projectSaved:'Project saved: {name}',
  saveError:'Could not save project: {error}', openingProject:'Opening project file…', openingCancelled:'Opening cancelled.',
  openingModel:'Opening project: model {i} of {n}…', projectOpened:'Project opened: {name}', openError:'Could not open project: {error}',
  undone:'Undone: {label}', redone:'Redone: {label}', orthoScaleOnly:'The scale bar is only metrically correct in orthographic view.',
  ready:'ArchaeoPlan v{version} ready.', savedToFiles:'Project file sent to the share sheet.', downloaded:'Project file downloaded.'
},
fr:{
  precisionCropNote:'Coupe de précision : le contour à main levée est fermé automatiquement et les triangles sont divisés sur la ligne de coupe.', preciseCropWorking:'Calcul de la coupe de précision…', preciseCropFallback:'La coupe de précision n’a pas pu être calculée pour cette zone.',

  unwrapSurface:'Dérouler la surface', unwrapSelectArea:'Choisir une zone', unwrapClearArea:'Effacer la zone', unwrapPreview:'Créer le déroulé', unwrapWholeHeight:'Toute la circonférence et toute la hauteur seront utilisées.', unwrapPreviewHeading:'Aperçu du déroulé', unwrapPreviewHelp:'Faites glisser les bords supérieur et inférieur pour choisir la bande à exporter.', unwrapBandAll:'Bande : toute la hauteur', unwrapExportBand:'Exporter la bande sélectionnée', unwrapExportFull:'Exporter tout le déroulé', unwrapAreaActive:'Dessinez la zone directement sur le modèle.', unwrapAreaChosen:'Zone choisie pour le déroulé.', unwrapAreaCleared:'Sélection de zone effacée.',

  friezeReady:'La frise est prête', friezeReadyText:'Choisissez comment enregistrer l’image déroulée.', friezeSavePng:'Enregistrer PNG', friezeShare:'Partager / Enregistrer dans Photos', friezeClose:'Fermer', friezePrepared:'La frise est prête à être enregistrée.',

  unwrap:'Dérouler la frise', unwrapHelp:'Pour les objets cylindriques ou presque cylindriques. Choisissez l’axe, puis marquez le début et la fin directement sur le modèle.', unwrapAxis:'Axe', unwrapWidth:'Largeur', unwrapStart:'Choisir le début', unwrapEnd:'Choisir la fin', unwrapFull:'Circonférence complète', unwrapReverse:'Inverser le sens', unwrapExport:'Exporter la frise déroulée', unwrapFullStatus:'Début/fin non choisis. Toute la circonférence sera utilisée.', unwrapStartChosen:'Point de départ choisi. Choisissez maintenant la fin.', unwrapEndChosen:'Point de fin choisi.', unwrapPickStart:'Touchez le modèle pour choisir le début de la frise.', unwrapPickEnd:'Touchez le modèle pour choisir la fin de la frise.', unwrapNeedModel:'Sélectionnez d’abord un modèle.', unwrapWorking:'Déroulement de la frise…', unwrapDone:'Frise déroulée exportée.', unwrapNoGeometry:'Aucune géométrie appropriée n’a été trouvée dans la zone choisie.',

  underlay:'Plan / fond', loadUnderlay:'Charger le plan', removeUnderlay:'Supprimer le plan', underlayMove:'Déplacer', underlayRotate:'Tourner', underlayScale:'Échelle', underlayOpacity:'Opacité', underlayVisible:'Afficher le plan', underlayExport:'Inclure dans l’export', underlayHelp:'Le plan est un fond plat séparé sous les modèles 3D. Ajustez-le puis verrouillez-le.', underlayLoaded:'Plan chargé.', underlayRemoved:'Plan supprimé.', underlayLocked:'Le plan est verrouillé.', underlayUnlocked:'Le plan est déverrouillé.', underlaySelect:'Chargez d’abord un plan.', underlayFileError:'Impossible de charger le plan : {error}',

  newProject:'Nouveau projet', saveProject:'Enregistrer le projet', openProject:'Ouvrir le projet', addFile:'Ajouter un fichier',
  undo:'Annuler', redo:'Rétablir', fitModel:'Ajuster le modèle',
  view:'Vue', perspective:'Perspective', orthographic:'Orthographique',
  top:'Dessus', front:'Face', right:'Droite', bottom:'Dessous', back:'Arrière', left:'Gauche', showGrid:'Afficher la grille',
  models:'Modèles', noModels:'Aucun modèle ouvert.', selectedModel:'Modèle sélectionné',
  move:'Déplacer', rotate:'Tourner', lock:'Verrouiller', unlock:'Déverrouiller',
  crop:'Découpage', cropHelp:'Sélectionnez un modèle. Choisissez main levée ou polygone. Lancez le découpage et dessinez directement sur le modèle.',
  freehand:'Main levée', polygon:'Polygone', startCrop:'Démarrer le découpage', cancel:'Annuler',
  keepInside:'Conserver l’intérieur', removeInside:'Supprimer l’intérieur', cropNote:'L’original est conservé. Le découpage crée une nouvelle copie.',
  savedViews:'Vues enregistrées', saveView:'Enregistrer la vue', clearViews:'Effacer les vues', noSavedViews:'Aucune vue enregistrée.',
  measure:'Mesure', measureDistance:'Mesurer une distance', clearMeasure:'Effacer la mesure', noMeasurement:'Aucune mesure.',
  exportFrame:'Cadre d’export', format:'Format', resolution:'Résolution', width:'Largeur', height:'Hauteur',
  screenFormat:'Format écran', aLandscape:'Format A paysage', aPortrait:'Format A portrait', customFormat:'Format libre',
  screen:'Écran', px3000:'Largeur 3000 px', px6000:'Largeur 6000 px', custom:'Personnalisé',
  showExportFrame:'Afficher le cadre', hideExportFrame:'Masquer le cadre', fitExport:'Ajuster le modèle au cadre',
  savePng:'Enregistrer PNG', sharePhotos:'Partager / Enregistrer dans Photos',
  annotations:'Annotations d’export', showScale:'Afficher l’échelle', length:'Longueur', automatic:'Automatique',
  position:'Position', bottomLeft:'Bas gauche', bottomRight:'Bas droite', topLeft:'Haut gauche', topRight:'Haut droite',
  showNorth:'Afficher la flèche du nord', rotationDeg:'Rotation °',
  scaleNorthNote:'L’échelle est métriquement correcte en vue orthographique. La flèche du nord est tournée manuellement pour le moment.',
  exportNote:'La zone visible à l’intérieur du cadre est exportée. La résolution modifie uniquement le niveau de détail, pas le cadrage.',
  docs:'Vue de documentation', docsText:'Les textures GLB et OBJ sont conservées. ArchaeoPlan ne modifie pas les fichiers de texture originaux.',
  drop:'Déposez les fichiers ici', dropText:'GLB, GLTF, OBJ + MTL + textures ou PLY',
  projectReady:'Le projet est prêt', projectReadyText:'Choisissez où enregistrer le fichier du projet.',
  chooseLocation:'Choisir l’emplacement…', cancelSave:'Annuler',
  projectNamePrompt:'Nom du fichier de projet :', viewNamePrompt:'Nom de la vue :', clearViewsConfirm:'Effacer toutes les vues enregistrées ?',
  replaceProjectConfirm:'Ouvrir le projet et remplacer l’espace de travail actuel ?', newProjectConfirm:'Créer un nouveau projet et retirer les modèles de l’espace de travail ?',
  loaded:'Chargé : {name}', modelLocked:'Le modèle est verrouillé.', modelUnlocked:'Le modèle est déverrouillé.',
  selectModel:'Sélectionnez d’abord un modèle.', noModelFit:'Aucun modèle à ajuster.', modelFit:'Modèle sélectionné ajusté et centré.',
  centered:'{name} : centré', selectModelFile:'Sélectionnez un fichier de modèle.', fileError:'Erreur avec {name} : {error}',
  newEmpty:'Nouveau projet vide – centre (0,0,0).', toolSelected:'{tool} sélectionné.', cropActive:'Découpage actif.',
  strokeSaved:'Trait enregistré. Continuez ailleurs ou choisissez Conserver/Supprimer.',
  cropCreated:'Copie découpée créée. Original conservé et masqué.',
  viewSaved:'Vue « {name} » enregistrée.', viewRestored:'Vue « {name} » restaurée.', viewsCleared:'Vues enregistrées effacées.',
  measureActive:'Mesure active : touchez deux points sur le modèle.', measureEnded:'Mesure terminée.', measureValue:'Mesure : {value}',
  exportFit:'Modèle ajusté au cadre d’export.', pngExported:'PNG exporté.', imageShare:'Image envoyée à la feuille de partage iOS.',
  imageFallback:'Le partage n’est pas pris en charge ici – le PNG a été enregistré à la place.',
  noModelsToSave:'Aucun modèle à enregistrer dans le projet.', preparingProject:'Préparation du projet…',
  savingModel:'Enregistrement du projet : modèle {i} sur {n}…', packingProject:'Création du fichier projet…',
  projectPrepared:'Le projet est prêt à être enregistré.', projectSaved:'Projet enregistré : {name}',
  saveError:'Impossible d’enregistrer le projet : {error}', openingProject:'Ouverture du fichier projet…', openingCancelled:'Ouverture annulée.',
  openingModel:'Ouverture du projet : modèle {i} sur {n}…', projectOpened:'Projet ouvert : {name}', openError:'Impossible d’ouvrir le projet : {error}',
  undone:'Annulé : {label}', redone:'Rétabli : {label}', orthoScaleOnly:'L’échelle n’est métriquement correcte qu’en vue orthographique.',
  ready:'ArchaeoPlan v{version} prêt.', savedToFiles:'Fichier projet envoyé à la feuille de partage.', downloaded:'Fichier projet téléchargé.'
}
};

let currentLanguage=localStorage.getItem('archaeoplan-language')||'da';
if(!I18N[currentLanguage])currentLanguage='da';

function tr(key,vars={}){
  const dict=I18N[currentLanguage]||I18N.da;
  let s=dict[key]??I18N.da[key]??key;
  for(const [k,v] of Object.entries(vars))s=s.replaceAll(`{${k}}`,String(v));
  return s;
}
function setText(id,key){
  const el=$(id);if(el)el.textContent=tr(key);
}
function setLabelPrefix(controlId,key){
  const el=$(controlId);const label=el?.closest('label');if(!label)return;
  const node=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.nodeValue.trim());
  if(node)node.nodeValue=tr(key)+' ';
}
function setCheckText(controlId,key){
  const el=$(controlId);const label=el?.closest('label');if(!label)return;
  const nodes=[...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE);
  const node=nodes[nodes.length-1];
  if(node)node.nodeValue=' '+tr(key);
}
function setOption(selectId,value,key){
  const opt=[...($(selectId)?.options||[])].find(o=>o.value===String(value));
  if(opt)opt.textContent=tr(key);
}
function applyLanguage(lang){
  if(I18N[lang])currentLanguage=lang;
  localStorage.setItem('archaeoplan-language',currentLanguage);
  document.documentElement.lang=currentLanguage;
  if(languageSelect)languageSelect.value=currentLanguage;

  setText('newProjectButton','newProject');setText('saveProjectButton','saveProject');setText('openProjectButton','openProject');setText('addFileButton','addFile');
  $('undoButton').title=tr('undo');$('undoButton').setAttribute('aria-label',tr('undo'));
  $('redoButton').title=tr('redo');$('redoButton').setAttribute('aria-label',tr('redo'));
  setText('fitModelButton','fitModel');

  setText('viewHeading','view');setText('perspectiveButton','perspective');setText('orthographicButton','orthographic');
  document.querySelectorAll('[data-view]').forEach(b=>b.textContent=tr(b.dataset.view));
  setCheckText('gridToggle','showGrid');

  setText('underlayHeading','underlay');setText('loadUnderlayButton','loadUnderlay');setText('removeUnderlayButton','removeUnderlay');
  setText('underlayMoveButton','underlayMove');setText('underlayRotateButton','underlayRotate');
  setLabelPrefix('underlayScale','underlayScale');setLabelPrefix('underlayOpacity','underlayOpacity');
  setCheckText('underlayVisible','underlayVisible');setCheckText('underlayExport','underlayExport');setText('underlayHelp','underlayHelp');
  setText('modelsHeading','models');setText('selectedModelHeading','selectedModel');
  setText('translateButton','move');setText('rotateButton','rotate');
  $('lockButton').textContent=selectedModel?.root.userData.locked?tr('unlock'):tr('lock');

  setText('cropHeading','crop');setText('cropHelp','cropHelp');setText('freehandCropButton','freehand');setText('polygonCropButton','polygon');
  setText('startCropButton','startCrop');setText('cancelCropButton','cancel');setText('cropInsideButton','keepInside');setText('cropOutsideButton','removeInside');setText('cropNote','cropNote');setText('precisionCropNote','precisionCropNote');

  setText('savedViewsHeading','savedViews');setText('saveViewButton','saveView');setText('clearViewsButton','clearViews');
  setText('measureHeading','measure');setText('measureButton','measureDistance');setText('clearMeasureButton','clearMeasure');
  if(!measurePoints.length)setText('measureResult','noMeasurement');

  setText('exportHeading','exportFrame');setLabelPrefix('exportRatio','format');setLabelPrefix('exportPreset','resolution');
  setLabelPrefix('exportWidth','width');setLabelPrefix('exportHeight','height');
  setOption('exportRatio','screen','screenFormat');setOption('exportRatio','1.41421356237','aLandscape');setOption('exportRatio','0.70710678118','aPortrait');setOption('exportRatio','custom','customFormat');
  setOption('exportPreset','screen','screen');setOption('exportPreset','3000','px3000');setOption('exportPreset','6000','px6000');setOption('exportPreset','custom','custom');
  $('toggleExportFrameButton').textContent=exportFrameVisible?tr('hideExportFrame'):tr('showExportFrame');
  setText('fitToExportFrameButton','fitExport');setText('exportPngButton','savePng');setText('shareImageButton','sharePhotos');

  setText('annotationsHeading','annotations');setCheckText('showScaleBar','showScale');setLabelPrefix('scaleBarLength','length');setLabelPrefix('scaleBarPosition','position');
  setOption('scaleBarLength','auto','automatic');
  ['scaleBarPosition','northPosition'].forEach(id=>{
    setOption(id,'bottom-left','bottomLeft');setOption(id,'bottom-right','bottomRight');setOption(id,'top-left','topLeft');setOption(id,'top-right','topRight');
  });
  setCheckText('showNorthArrow','showNorth');setLabelPrefix('northAngle','rotationDeg');setLabelPrefix('northPosition','position');
  setText('scaleNorthNote','scaleNorthNote');setText('exportNote','exportNote');
  setText('unwrapHeading','unwrapSurface');setText('unwrapHelp','unwrapHelp');setLabelPrefix('unwrapAxis','unwrapAxis');setLabelPrefix('unwrapWidth','unwrapWidth');setText('unwrapStartButton','unwrapStart');setText('unwrapEndButton','unwrapEnd');
  setText('unwrapSelectAreaButton','unwrapSelectArea');setText('unwrapClearAreaButton','unwrapClearArea');setText('unwrapPreviewButton','unwrapPreview');setText('unwrapFullButton','unwrapFull');setText('unwrapReverseButton','unwrapReverse');setText('unwrapExportButton','unwrapExport');updateUnwrapStatus();
  setText('unwrapPreviewHeading','unwrapPreviewHeading');setText('unwrapPreviewHelp','unwrapPreviewHelp');setText('unwrapExportBandButton','unwrapExportBand');setText('unwrapExportFullButton','unwrapExportFull');
  setText('friezeReadyHeading','friezeReady');setText('friezeReadyText','friezeReadyText');
  setText('saveFriezePngButton','friezeSavePng');setText('shareFriezeButton','friezeShare');setText('cancelFriezeSaveButton','friezeClose');
  setText('docsHeading','docs');setText('docsText','docsText');setText('dropStrong','drop');setText('dropText','dropText');

  setText('projectReadyHeading','projectReady');setText('projectReadyText','projectReadyText');
  setText('chooseProjectLocationButton','chooseLocation');setText('cancelProjectSaveButton','cancelSave');

  rebuildModelList();renderSavedViews();syncTransformFields();
}


function optimiseTextureForDocumentation(tex){
  if(!tex)return;
  const maxAniso=renderer.capabilities.getMaxAnisotropy?.()||1;
  tex.anisotropy=Math.max(1,maxAniso);
  tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.magFilter=THREE.LinearFilter;
  tex.generateMipmaps=true;
  tex.needsUpdate=true;
}

function documentationMaterial(source,obj){
  const texture=source?.map||null;
  if(texture){texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true}
  const hasVertexColors=Boolean(obj.geometry?.attributes?.color);
  return new THREE.MeshBasicMaterial({
    map:texture,alphaMap:source?.alphaMap||null,
    color:texture?0xffffff:(source?.color?.clone?.()||new THREE.Color(0xd0d0d0)),
    vertexColors:hasVertexColors&&!texture,
    transparent:Boolean(source?.transparent||(source?.opacity??1)<1),
    opacity:source?.opacity??1,alphaTest:source?.alphaTest??0,side:THREE.DoubleSide
  });
}
function prepareDocumentationMaterials(root){
  root.traverse(obj=>{
    const mats=Array.isArray(obj.material)?obj.material:[obj.material];
    for(const m of mats){
      if(!m)continue;
      for(const key of ['map','aoMap','lightMap','normalMap','roughnessMap','metalnessMap','alphaMap','emissiveMap']){
        if(m[key])optimiseTextureForDocumentation(m[key]);
      }
    }
  });

  root.traverse(obj=>{
    if(obj.isPoints){
      const old=obj.material;
      obj.material=new THREE.PointsMaterial({size:old?.size||.01,sizeAttenuation:old?.sizeAttenuation??true,map:old?.map||null,color:old?.color?.clone?.()||new THREE.Color(0xffffff),vertexColors:Boolean(obj.geometry?.attributes?.color),transparent:Boolean(old?.transparent),opacity:old?.opacity??1});
    }else if(obj.isMesh){
      const src=Array.isArray(obj.material)?obj.material:[obj.material];
      const converted=src.map(m=>documentationMaterial(m,obj));
      obj.material=Array.isArray(obj.material)?converted:converted[0];
    }
  });
}




// ---------- Cylindrical surface unwrap ----------
function normAngle(a){const t=Math.PI*2;return((a%t)+t)%t}
function unwrapAxisInfo(axis){if(axis==='x')return{axial:p=>p.x,radial:(p,c)=>({u:p.z-c.z,v:p.y-c.y})};if(axis==='z')return{axial:p=>p.z,radial:(p,c)=>({u:p.x-c.x,v:p.y-c.y})};return{axial:p=>p.y,radial:(p,c)=>({u:p.x-c.x,v:p.z-c.z})}}
function angleForPoint(p,center,axis){const r=unwrapAxisInfo(axis).radial(p,center);return normAngle(Math.atan2(r.v,r.u))}
function angleOffset(a,start,reverse=false){return reverse?normAngle(start-a):normAngle(a-start)}
function selectedModelWorldBox(){if(!selectedModel)return null;selectedModel.root.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(selectedModel.root,true);return b.isEmpty()?null:b}
function selectedModelCenter(){const b=selectedModelWorldBox();return b?b.getCenter(new THREE.Vector3()):new THREE.Vector3()}
function updateUnwrapStatus(){const el=$('unwrapStatus');if(!el)return;if(unwrapStartAngle==null||unwrapEndAngle==null)el.textContent=tr('unwrapWholeHeight');else el.textContent=`${tr('unwrapStart')}: ${THREE.MathUtils.radToDeg(unwrapStartAngle).toFixed(1)}° · ${tr('unwrapEnd')}: ${THREE.MathUtils.radToDeg(unwrapEndAngle).toFixed(1)}°`;$('unwrapReverseButton')?.classList.toggle('active',unwrapReverse)}
function beginUnwrapPick(which){if(!selectedModel){setStatus(tr('unwrapNeedModel'));return}unwrapPickMode=which;transform.detach();$('unwrapStartButton').classList.toggle('active',which==='start');$('unwrapEndButton').classList.toggle('active',which==='end');setStatus(which==='start'?tr('unwrapPickStart'):tr('unwrapPickEnd'))}
function finishUnwrapPick(point){if(!selectedModel||!unwrapPickMode)return;const a=angleForPoint(point,selectedModelCenter(),$('unwrapAxis').value);if(unwrapPickMode==='start'){unwrapStartAngle=a;setStatus(tr('unwrapStartChosen'))}else{unwrapEndAngle=a;setStatus(tr('unwrapEndChosen'))}unwrapPickMode=null;$('unwrapStartButton').classList.remove('active');$('unwrapEndButton').classList.remove('active');updateUnwrapStatus();if(selectedModel&&!selectedModel.root.userData.locked&&!cropMode&&!measureMode)transform.attach(selectedModel.root)}
function resetUnwrapFull(){unwrapStartAngle=null;unwrapEndAngle=null;unwrapPickMode=null;updateUnwrapStatus()}
function reverseUnwrap(){unwrapReverse=!unwrapReverse;updateUnwrapStatus()}
function materialForUnwrap(mat){const m=new THREE.MeshBasicMaterial({map:mat?.map||null,color:mat?.color?.clone?.()||new THREE.Color(0xffffff),vertexColors:!!mat?.vertexColors,transparent:!!mat?.transparent,opacity:mat?.opacity??1,alphaMap:mat?.alphaMap||null,alphaTest:mat?.alphaTest||0,side:THREE.DoubleSide,depthWrite:true,depthTest:true});if(m.map)optimiseTextureForDocumentation(m.map);if(m.alphaMap)optimiseTextureForDocumentation(m.alphaMap);return m}
function materialIndexForTriangle(geometry,triIndex){const vi=triIndex*3;for(const g of geometry.groups||[])if(vi>=g.start&&vi<g.start+g.count)return g.materialIndex||0;return 0}
function beginUnwrapArea(){if(!selectedModel){setStatus(tr('unwrapNeedModel'));return}unwrapAreaMode=true;unwrapAreaPoints=[];cropPoints=[];cropDrawing=false;cropPointerId=null;transform.detach();orbit.enabled=false;orbit.enableRotate=false;orbit.enablePan=false;orbit.enableZoom=false;renderer.domElement.style.pointerEvents='none';cropInputLayer.classList.add('active');cropOverlay.classList.add('active');cropHint.classList.add('active');cropHint.textContent=tr('unwrapAreaActive');redrawCrop();setStatus(tr('unwrapAreaActive'))}
function clearUnwrapArea(){unwrapAreaMode=false;unwrapAreaPoints=[];cropPoints=[];cropDrawing=false;cropPointerId=null;renderer.domElement.style.pointerEvents='';cropInputLayer.classList.remove('active');cropOverlay.classList.remove('active');cropHint.classList.remove('active');orbit.enabled=true;orbit.enableRotate=true;orbit.enablePan=true;orbit.enableZoom=true;redrawCrop();setStatus(tr('unwrapAreaCleared'));if(selectedModel&&!selectedModel.root.userData.locked)transform.attach(selectedModel.root)}
function pointInsideScreenPolygon(x,y,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a.y>y)!==(b.y>y))&&(x<(b.x-a.x)*(y-a.y)/((b.y-a.y)||1e-12)+a.x))inside=!inside}return inside}
function triangleAllowedByArea(p0,p1,p2){if(!unwrapAreaPoints.length)return true;const c=p0.clone().add(p1).add(p2).multiplyScalar(1/3).project(camera),r=renderer.domElement.getBoundingClientRect();return pointInsideScreenPolygon((c.x*.5+.5)*r.width,(-c.y*.5+.5)*r.height,unwrapAreaPoints)}
function buildUnwrappedGroup(){
  if(!selectedModel)return null;
  const axis=$('unwrapAxis').value,box=selectedModelWorldBox();if(!box)return null;
  const center=box.getCenter(new THREE.Vector3()),info=unwrapAxisInfo(axis),full=(unwrapStartAngle==null||unwrapEndAngle==null),start=full?0:unwrapStartAngle;
  let span=full?Math.PI*2:angleOffset(unwrapEndAngle,start,unwrapReverse);if(span<THREE.MathUtils.degToRad(.5))span=Math.PI*2;
  const meshes=[];let radiusSum=0,radiusCount=0,axisMin=Infinity,axisMax=-Infinity;
  selectedModel.root.updateWorldMatrix(true,true);
  selectedModel.root.traverse(obj=>{if(!obj.isMesh||!obj.geometry?.attributes?.position)return;const geo=obj.geometry.index?obj.geometry.toNonIndexed():obj.geometry.clone(),pos=geo.attributes.position,uv=geo.attributes.uv,col=geo.attributes.color,verts=[];for(let i=0;i<pos.count;i++){const p=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(obj.matrixWorld);verts.push(p);const rr=info.radial(p,center);radiusSum+=Math.hypot(rr.u,rr.v);radiusCount++;const ax=info.axial(p);axisMin=Math.min(axisMin,ax);axisMax=Math.max(axisMax,ax)}meshes.push({obj,geo,verts,uv,col})});
  if(!meshes.length||!radiusCount)return null;
  const refRadius=Math.max(radiusSum/radiusCount,1e-6),out=new THREE.Group();let kept=0,minDepth=Infinity,maxDepth=-Infinity;
  for(const item of meshes){
    const {obj,geo,verts,uv,col}=item,mats=Array.isArray(obj.material)?obj.material:[obj.material],buckets=new Map(),triCount=Math.floor(verts.length/3);
    for(let t=0;t<triCount;t++){
      const p0=verts[t*3],p1=verts[t*3+1],p2=verts[t*3+2];if(!triangleAllowedByArea(p0,p1,p2))continue;
      const centroid=p0.clone().add(p1).add(p2).multiplyScalar(1/3),co=angleOffset(angleForPoint(centroid,center,axis),start,unwrapReverse);if(!full&&co>span)continue;
      const mi=materialIndexForTriangle(geo,t);if(!buckets.has(mi))buckets.set(mi,{p:[],uv:[],c:[]});const b=buckets.get(mi);
      for(let k=0;k<3;k++){const vi=t*3+k,p=verts[vi],rr=info.radial(p,center),radius=Math.hypot(rr.u,rr.v);let off=angleOffset(angleForPoint(p,center,axis),start,unwrapReverse);while(off-co>Math.PI)off-=Math.PI*2;while(co-off>Math.PI)off+=Math.PI*2;const x=off*refRadius,y=info.axial(p)-axisMin,z=radius-refRadius;minDepth=Math.min(minDepth,z);maxDepth=Math.max(maxDepth,z);b.p.push(x,y,z);if(uv)b.uv.push(uv.getX(vi),uv.getY(vi));if(col)b.c.push(col.getX(vi),col.getY(vi),col.getZ(vi))}
      kept++;
    }
    for(const [mi,b] of buckets){if(!b.p.length)continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));if(b.uv.length)g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));if(b.c.length)g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));out.add(new THREE.Mesh(g,materialForUnwrap(mats[mi]||mats[0])))}
  }
  if(!kept)return null;out.userData.unwrapWidth=span*refRadius;out.userData.unwrapHeight=Math.max(axisMax-axisMin,1e-6);out.userData.depthMin=minDepth;out.userData.depthMax=maxDepth;return out
}
async function renderUnwrappedGroup(group,outW,bandTop=0,bandBottom=1){
  const fullW=group.userData.unwrapWidth,fullH=group.userData.unwrapHeight,bt=Math.max(0,Math.min(.999,bandTop)),bb=Math.max(bt+.001,Math.min(1,bandBottom)),selH=fullH*(bb-bt),aspect=Math.max(fullW/selH,.01),outH=Math.max(500,Math.min(50000,Math.round(outW/aspect)));
  const scene2=new THREE.Scene();scene2.background=new THREE.Color(0xffffff);scene2.add(group);
  const yTop=fullH*(1-bt),yBottom=fullH*(1-bb),front=(group.userData.depthMax||0)+Math.max(Math.abs(group.userData.depthMax||0),Math.abs(group.userData.depthMin||0))+10;
  const cam=new THREE.OrthographicCamera(0,fullW,yTop,yBottom,-10000,10000);cam.position.set(0,0,front);cam.lookAt(0,0,0);cam.updateProjectionMatrix();
  const canvas=document.createElement('canvas');canvas.width=outW;canvas.height=outH;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Kunne ikke oprette eksportlærred.');
  const oldSize=new THREE.Vector2();renderer.getSize(oldSize);const oldPR=renderer.getPixelRatio(),tileMax=rendererMaxTileSize(),cols=Math.ceil(outW/tileMax),rows=Math.ceil(outH/tileMax),full={left:0,right:fullW,top:yTop,bottom:yBottom};let done=0,total=cols*rows;renderer.setPixelRatio(1);
  try{for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const x=col*tileMax,y=row*tileMax,tw=Math.min(tileMax,outW-x),th=Math.min(tileMax,outH-y);renderer.setSize(tw,th,false);setOrthoTile(cam,outW,outH,x,y,tw,th,full);renderer.render(scene2,cam);ctx.drawImage(renderer.domElement,0,0,tw,th,x,y,tw,th);done++;setStatus(`${tr('unwrapWorking')} ${done}/${total}`);await new Promise(r=>setTimeout(r,0))}return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG kunne ikke oprettes.')),'image/png'))}
  finally{renderer.setPixelRatio(oldPR);renderer.setSize(oldSize.x,oldSize.y,false);scene2.remove(group);orbit.update()}
}
function disposeUnwrapGroup(group){group?.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}})}
async function createUnwrapPreview(){if(!selectedModel){setStatus(tr('unwrapNeedModel'));return}setStatus(tr('unwrapWorking'));try{const group=buildUnwrappedGroup();if(!group){setStatus(tr('unwrapNoGeometry'));return}const w=Math.min(5000,Math.max(1800,parseInt($('unwrapWidth').value)||12000)),blob=await renderUnwrappedGroup(group,w,0,1);disposeUnwrapGroup(group);if(unwrapPreviewUrl)URL.revokeObjectURL(unwrapPreviewUrl);unwrapPreviewUrl=URL.createObjectURL(blob);unwrapPreviewImage.src=unwrapPreviewUrl;unwrapBandTop=0;unwrapBandBottom=1;updateUnwrapBandUi();unwrapPreviewDialog.showModal()}catch(err){console.error(err);setStatus(`${tr('unwrapNoGeometry')} ${err.message||err}`)}}
function updateUnwrapBandUi(){unwrapBandOverlay.style.top=`${unwrapBandTop*100}%`;unwrapBandOverlay.style.height=`${(unwrapBandBottom-unwrapBandTop)*100}%`;$('unwrapBandInfo').textContent=(unwrapBandTop<=.001&&unwrapBandBottom>=.999)?tr('unwrapBandAll'):`${Math.round(unwrapBandTop*100)}–${Math.round(unwrapBandBottom*100)} %`}
function attachBandHandle(handle,isTop){let active=false;const move=e=>{if(!active)return;const r=unwrapPreviewStage.getBoundingClientRect(),y=Math.max(0,Math.min(r.height,e.clientY-r.top))/Math.max(r.height,1);if(isTop)unwrapBandTop=Math.min(y,unwrapBandBottom-.03);else unwrapBandBottom=Math.max(y,unwrapBandTop+.03);updateUnwrapBandUi()};handle.addEventListener('pointerdown',e=>{active=true;handle.setPointerCapture?.(e.pointerId);move(e)});handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',()=>active=false);handle.addEventListener('pointercancel',()=>active=false)}
async function exportUnwrapBand(full=false){if(!selectedModel){setStatus(tr('unwrapNeedModel'));return}const group=buildUnwrappedGroup();if(!group){setStatus(tr('unwrapNoGeometry'));return}try{const outW=Math.max(1000,Math.min(50000,parseInt($('unwrapWidth').value)||12000)),blob=await renderUnwrappedGroup(group,outW,full?0:unwrapBandTop,full?1:unwrapBandBottom),suffix=full?'udfoldning':'udfoldning-band',filename=`${selectedModel.name.replace(/\.[^.]+$/,'')}-${suffix}.png`;preparedFrieze={blob,filename};unwrapPreviewDialog.close();if(friezeSaveDialog?.showModal)friezeSaveDialog.showModal();setStatus(tr('friezePrepared'))}finally{disposeUnwrapGroup(group)}}
function downloadPreparedFrieze(){if(!preparedFrieze)return;const{blob,filename}=preparedFrieze,url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);friezeSaveDialog?.close();preparedFrieze=null;setStatus(tr('unwrapDone'))}
async function sharePreparedFrieze(){if(!preparedFrieze)return;const{blob,filename}=preparedFrieze;try{const file=new File([blob],filename,{type:'image/png'});if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({files:[file],title:'ArchaeoPlan unwrap'});friezeSaveDialog?.close();preparedFrieze=null;setStatus(tr('unwrapDone'));return}downloadPreparedFrieze()}catch(err){if(err?.name==='AbortError')return;console.error(err);setStatus(`${tr('unwrapNoGeometry')} ${err.message||err}`)}}

// ---------- Plan / underlay ----------
function updateUnderlayUi(){
  const has=!!underlay;
  for(const id of ['removeUnderlayButton','underlayMoveButton','underlayRotateButton','underlayLockButton','underlayScale','underlayOpacity','underlayVisible','underlayExport']){
    const el=$(id);if(el)el.disabled=!has;
  }
  if(!has){$('underlayLockButton').textContent='🔓';return}
  $('underlayScale').value=underlay.scale.x.toFixed(3);
  $('underlayOpacity').value=Math.round((underlay.material.opacity??.55)*100);
  $('underlayVisible').checked=underlay.visible;
  $('underlayExport').checked=underlay.userData.includeInExport!==false;
  $('underlayLockButton').textContent=underlay.userData.locked?'🔒':'🔓';
  $('underlayLockButton').title=underlay.userData.locked?tr('unlock'):tr('lock');
}
function readFileAsDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('FileReader error'));r.readAsDataURL(file)})}
function makeUnderlayFromTexture(tex,name='underlay'){
  tex.colorSpace=THREE.SRGBColorSpace;tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;
  const img=tex.image,aspect=(img?.width&&img?.height)?img.width/img.height:1.41421356;
  const h=6,w=h*aspect;
  const material=new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);
  mesh.name=name;mesh.rotation.x=-Math.PI/2;mesh.position.y=-.005;mesh.renderOrder=-10;
  mesh.userData.isUnderlay=true;mesh.userData.locked=false;mesh.userData.includeInExport=true;
  return mesh;
}
async function loadUnderlayFile(file){
  if(!file)return;
  try{
    const dataUrl=await readFileAsDataUrl(file);
    const tex=await new THREE.TextureLoader().loadAsync(dataUrl);
    if(underlay){if(transform.object===underlay)transform.detach();scene.remove(underlay);underlay.geometry.dispose();underlay.material.map?.dispose();underlay.material.dispose()}
    underlay=makeUnderlayFromTexture(tex,file.name);underlayImageData=dataUrl;underlaySelected=false;scene.add(underlay);updateUnderlayUi();setStatus(tr('underlayLoaded'));
  }catch(err){console.error(err);setStatus(tr('underlayFileError',{error:err.message||err}))}
  finally{underlayInput.value=''}
}
function removeUnderlay(){
  if(!underlay)return;if(transform.object===underlay)transform.detach();scene.remove(underlay);underlay.geometry.dispose();underlay.material.map?.dispose();underlay.material.dispose();
  underlay=null;underlayImageData=null;underlaySelected=false;updateUnderlayUi();setStatus(tr('underlayRemoved'));
}
function selectUnderlayForTransform(mode){
  if(!underlay){setStatus(tr('underlaySelect'));return}underlaySelected=true;
  if(underlay.userData.locked){transform.detach();setStatus(tr('underlayLocked'));return}
  transform.detach();transform.attach(underlay);transform.setMode(mode);
}
function toggleUnderlayLock(){
  if(!underlay){setStatus(tr('underlaySelect'));return}
  underlay.userData.locked=!underlay.userData.locked;
  if(underlay.userData.locked&&transform.object===underlay)transform.detach();
  updateUnderlayUi();setStatus(underlay.userData.locked?tr('underlayLocked'):tr('underlayUnlocked'));
}
function setUnderlayScale(){if(!underlay||underlay.userData.locked)return;const s=Math.max(.001,parseFloat($('underlayScale').value)||1);underlay.scale.setScalar(s)}
function setUnderlayOpacity(){if(!underlay)return;underlay.material.opacity=Math.max(0,Math.min(1,(parseFloat($('underlayOpacity').value)||0)/100));underlay.material.needsUpdate=true}
function underlayMetadata(){return underlay?{name:underlay.name,imageData:underlayImageData,position:underlay.position.toArray(),quaternion:underlay.quaternion.toArray(),scale:underlay.scale.toArray(),opacity:underlay.material.opacity,visible:underlay.visible,locked:!!underlay.userData.locked,includeInExport:underlay.userData.includeInExport!==false}:null}
async function restoreUnderlay(meta){
  if(!meta?.imageData)return;const tex=await new THREE.TextureLoader().loadAsync(meta.imageData);underlay=makeUnderlayFromTexture(tex,meta.name||'underlay');
  underlay.position.fromArray(meta.position||[0,-.005,0]);underlay.quaternion.fromArray(meta.quaternion||[-Math.SQRT1_2,0,0,Math.SQRT1_2]);underlay.scale.fromArray(meta.scale||[1,1,1]);
  underlay.material.opacity=meta.opacity??.55;underlay.visible=meta.visible!==false;underlay.userData.locked=!!meta.locked;underlay.userData.includeInExport=meta.includeInExport!==false;
  underlayImageData=meta.imageData;scene.add(underlay);updateUnderlayUi();
}

function addModel(root,name,{prepared=false,cropped=false,frame=true}={}){
  root.name=name||`Model ${modelNumber}`;root.userData.locked=false;
  if(!prepared)prepareDocumentationMaterials(root);
  scene.add(root);
  const model={id:modelNumber++,name:root.name,root,cropped};
  models.push(model);selectModel(model);rebuildModelList();
  if(frame)frameCurrentView();
  setStatus(tr('loaded',{name:model.name}));
  return model;
}
function selectModel(m){
  underlaySelected=false;selectedModel=m;transform.detach();
  if(m&&!m.root.userData.locked&&!cropMode)transform.attach(m.root);
  rebuildModelList();syncTransformFields();updateCropButtons();
}
function rebuildModelList(){
  modelList.innerHTML='';
  if(!models.length){modelList.innerHTML=`<p class="muted">${tr('noModels')}</p>`;return}
  models.forEach(m=>{
    const row=document.createElement('div');row.className='model-row'+(m===selectedModel?' selected':'');
    const vis=document.createElement('input');vis.type='checkbox';vis.checked=m.root.visible;vis.onchange=()=>m.root.visible=vis.checked;
    const name=document.createElement('div');name.className='model-name';name.textContent=(m.cropped?'✂ ':'')+m.name;name.onclick=()=>selectModel(m);
    const lock=document.createElement('button');lock.className='model-lock'+(m.root.userData.locked?' locked':'');lock.textContent=m.root.userData.locked?'🔒':'🔓';lock.title=m.root.userData.locked?tr('unlock'):tr('lock');lock.onclick=e=>{e.stopPropagation();setModelLock(m,!m.root.userData.locked)};
    const del=document.createElement('button');del.className='model-delete';del.textContent='×';del.onclick=()=>{if(selectedModel===m)selectModel(null);scene.remove(m.root);models.splice(models.indexOf(m),1);rebuildModelList()};
    row.append(vis,name,lock,del);modelList.append(row);
  });
}

function setModelLock(m,locked){
  if(!m)return;
  m.root.userData.locked=!!locked;
  if(selectedModel===m){transform.detach();if(!locked&&!cropMode&&!measureMode)transform.attach(m.root)}
  rebuildModelList();syncTransformFields();updateCropButtons();setStatus(locked?tr('modelLocked'):tr('modelUnlocked'));
}
function selectedEditable(){
  if(!selectedModel){setStatus(tr('selectModel'));return false}
  if(selectedModel.root.userData.locked){setStatus(tr('modelLocked'));return false}
  return true;
}
function syncTransformFields(){
  ['posX','posY','posZ','rotX','rotY','rotZ'].forEach(id=>$(id).disabled=!selectedModel||selectedModel.root.userData.locked);
  if(!selectedModel){$('lockButton').textContent=tr('lock');return}
  const p=selectedModel.root.position,r=selectedModel.root.rotation;
  $('posX').value=p.x.toFixed(3);$('posY').value=p.y.toFixed(3);$('posZ').value=p.z.toFixed(3);
  $('rotX').value=THREE.MathUtils.radToDeg(r.x).toFixed(2);$('rotY').value=THREE.MathUtils.radToDeg(r.y).toFixed(2);$('rotZ').value=THREE.MathUtils.radToDeg(r.z).toFixed(2);
  $('lockButton').textContent=selectedModel.root.userData.locked?tr('unlock'):tr('lock');
}
function applyTransformFields(){
  if(!selectedEditable())return;const n=id=>parseFloat($(id).value)||0;
  selectedModel.root.position.set(n('posX'),n('posY'),n('posZ'));
  selectedModel.root.rotation.set(THREE.MathUtils.degToRad(n('rotX')),THREE.MathUtils.degToRad(n('rotY')),THREE.MathUtils.degToRad(n('rotZ')));
}
['posX','posY','posZ','rotX','rotY','rotZ'].forEach(id=>$(id).addEventListener('change',()=>{
  if(!selectedEditable())return;
  const before=cloneTransformState(selectedModel);
  applyTransformFields();
  const after=cloneTransformState(selectedModel);
  if(!sameTransform(before,after))pushHistory({
    label:'ændr model',
    undo:()=>applyTransformState(before),
    redo:()=>applyTransformState(after)
  });
}));


function viewportAspect(){
  const r=viewport.getBoundingClientRect();
  return Math.max(r.width/Math.max(r.height,1),0.05);
}
function resetViewToOrigin(useOrtho=camera.isOrthographicCamera){
  const aspect=viewportAspect();
  orbit.target.set(0,0,0);

  if(useOrtho){
    camera.up.set(0,0,-1);
    camera.position.set(0,12,0.001);
    const halfH=6;
    camera.left=-halfH*aspect;
    camera.right=halfH*aspect;
    camera.top=halfH;
    camera.bottom=-halfH;
    camera.near=-1000;
    camera.far=1000;
    camera.zoom=1;
  }else{
    camera.up.set(0,1,0);
    camera.position.set(8,6,8);
    camera.aspect=aspect;
    camera.near=.01;
    camera.far=5000;
  }

  camera.lookAt(0,0,0);
  camera.updateProjectionMatrix();
  orbit.target.set(0,0,0);
  orbit.update();
}

function framingBox(){
  const candidates=selectedModel&&selectedModel.root.visible?[selectedModel]:models.filter(m=>m.root.visible);
  const box=new THREE.Box3();let ok=false;
  for(const m of candidates){
    m.root.updateWorldMatrix(true,true);
    const b=new THREE.Box3().setFromObject(m.root,true);
    if(!b.isEmpty()){box.union(b);ok=true}
  }
  return ok?box:null;
}
function directionVector(name){
  return ({
    top:new THREE.Vector3(0,1,0),bottom:new THREE.Vector3(0,-1,0),
    front:new THREE.Vector3(0,0,1),back:new THREE.Vector3(0,0,-1),
    left:new THREE.Vector3(-1,0,0),right:new THREE.Vector3(1,0,0)
  })[name]||new THREE.Vector3(1,1,1).normalize();
}
function boxCorners(box){
  const a=box.min,b=box.max;
  return [
    new THREE.Vector3(a.x,a.y,a.z),new THREE.Vector3(a.x,a.y,b.z),
    new THREE.Vector3(a.x,b.y,a.z),new THREE.Vector3(a.x,b.y,b.z),
    new THREE.Vector3(b.x,a.y,a.z),new THREE.Vector3(b.x,a.y,b.z),
    new THREE.Vector3(b.x,b.y,a.z),new THREE.Vector3(b.x,b.y,b.z)
  ];
}
function cameraBasis(direction, upHint){
  const forward=direction.clone().normalize().multiplyScalar(-1);
  let up=upHint.clone().normalize();
  if(Math.abs(forward.dot(up))>.98) up=new THREE.Vector3(0,0,1);
  const right=new THREE.Vector3().crossVectors(forward,up).normalize();
  up=new THREE.Vector3().crossVectors(right,forward).normalize();
  return {right,up,forward};
}
function fitCameraToBox(box,direction=null){
  if(!box)return;
  const center=box.getCenter(new THREE.Vector3());
  const size=box.getSize(new THREE.Vector3());
  const radius=Math.max(size.length()/2,1e-6);
  const aspect=Math.max(viewport.clientWidth/Math.max(viewport.clientHeight,1),0.05);

  let dir=direction?direction.clone().normalize():camera.position.clone().sub(orbit.target).normalize();
  if(!Number.isFinite(dir.x)||dir.lengthSq()<.1)dir=new THREE.Vector3(1,1,1).normalize();

  const basis=cameraBasis(dir,camera.up);
  let halfW=1e-6,halfH=1e-6,halfDepth=1e-6;
  for(const corner of boxCorners(box)){
    const rel=corner.clone().sub(center);
    halfW=Math.max(halfW,Math.abs(rel.dot(basis.right)));
    halfH=Math.max(halfH,Math.abs(rel.dot(basis.up)));
    halfDepth=Math.max(halfDepth,Math.abs(rel.dot(dir)));
  }

  // 10% breathing room around the actual projected extents.
  halfW*=1.10; halfH*=1.10; halfDepth*=1.10;
  orbit.target.copy(center);

  if(camera.isPerspectiveCamera){
    const vfov=THREE.MathUtils.degToRad(camera.fov);
    const hfov=2*Math.atan(Math.tan(vfov/2)*aspect);
    const distV=halfH/Math.max(Math.tan(vfov/2),1e-6);
    const distH=halfW/Math.max(Math.tan(hfov/2),1e-6);
    const dist=Math.max(distV,distH)+halfDepth;
    camera.position.copy(center).add(dir.clone().multiplyScalar(Math.max(dist,radius*.25)));
    camera.near=Math.max((dist-halfDepth*2)/1000,1e-5);
    camera.far=Math.max(dist+halfDepth*20+radius*10,100);
  }else{
    const neededHalfH=Math.max(halfH,halfW/aspect,1e-6);
    camera.left=-neededHalfH*aspect;
    camera.right=neededHalfH*aspect;
    camera.top=neededHalfH;
    camera.bottom=-neededHalfH;
    camera.zoom=1;
    const dist=Math.max(radius*3,halfDepth*4,1);
    camera.position.copy(center).add(dir.clone().multiplyScalar(dist));
    camera.near=-Math.max(radius*20,1000);
    camera.far=Math.max(radius*20,1000);
  }
  camera.up.copy(basis.up);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  orbit.target.copy(center);
  orbit.update();
}
function frameCurrentView(){
  const box=framingBox();
  if(box)fitCameraToBox(box);
  else resetViewToOrigin();
}
function fitSelectedModel(){
  const box=framingBox();
  if(!box){setStatus(tr('noModelFit'));return}
  fitCameraToBox(box);
  setStatus(tr('modelFit'));
}

function switchCamera(useOrtho){
  const pos=camera.position.clone(),target=orbit.target.clone();orbit.dispose();transform.detach();
  camera=useOrtho?orthographicCamera:perspectiveCamera;camera.position.copy(pos);
  orbit=createOrbit(camera);orbit.target.copy(target);transform.camera=camera;
  if(selectedModel&&!selectedModel.root.userData.locked&&!cropMode)transform.attach(selectedModel.root);
  $('perspectiveButton').classList.toggle('active',!useOrtho);$('orthographicButton').classList.toggle('active',useOrtho);
  if(models.length) frameCurrentView();
  else resetViewToOrigin(useOrtho);
}
function setStandardView(name){
  if(!camera.isOrthographicCamera)switchCamera(true);
  const dir=directionVector(name),box=framingBox();if(!box)return;
  camera.up.set(0,1,0);
  if(name==='top')camera.up.set(0,0,-1);
  if(name==='bottom')camera.up.set(0,0,1);
  fitCameraToBox(box,dir);
  setStatus(tr('centered',{name}));
}

function basename(url){return decodeURIComponent(url.split(/[\\/]/).pop().split(/[?#]/)[0]).toLowerCase()}
function makeObjectUrlMap(files){
  const map=new Map();
  for(const f of files){const url=URL.createObjectURL(f);liveObjectUrls.add(url);map.set(f.name.toLowerCase(),url)}
  return map;
}
function managerFor(urls){const m=new THREE.LoadingManager();m.setURLModifier(url=>urls.get(basename(url))||url);return m}

async function loadFiles(fileList){
  const files=[...fileList];if(!files.length)return;
  const byName=new Map(files.map(f=>[f.name.toLowerCase(),f]));
  const urls=makeObjectUrlMap(files);
  const mains=files.filter(f=>/\.(glb|gltf|obj|ply)$/i.test(f.name));
  if(!mains.length){setStatus(tr('selectModelFile'));return}
  for(const f of mains){
    try{
      const ext=f.name.split('.').pop().toLowerCase(),manager=managerFor(urls);
      if(ext==='glb'||ext==='gltf'){
        const loader=new GLTFLoader(manager),data=ext==='gltf'?await f.text():await f.arrayBuffer();
        const gltf=await new Promise((res,rej)=>loader.parse(data,'',res,rej));
        addModel(gltf.scene,f.name);
      }else if(ext==='obj'){
        const txt=await f.text();let materials=null;
        const mtllib=[...txt.matchAll(/^\s*mtllib\s+(.+)$/gmi)][0]?.[1]?.trim();
        if(mtllib){
          const mf=byName.get(basename(mtllib));
          if(mf){materials=new MTLLoader(manager).parse(await mf.text(),'');materials.preload()}
        }
        const loader=new OBJLoader(manager);if(materials)loader.setMaterials(materials);
        addModel(loader.parse(txt),f.name);
      }else if(ext==='ply'){
        const g=new PLYLoader().parse(await f.arrayBuffer());
        let obj;
        if(g.index||g.attributes.normal){if(!g.attributes.normal)g.computeVertexNormals();obj=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:g.attributes.color?0xffffff:0xd0d0d0,vertexColors:Boolean(g.attributes.color),side:THREE.DoubleSide}))}
        else obj=new THREE.Points(g,new THREE.PointsMaterial({size:.01,vertexColors:Boolean(g.attributes.color)}));
        addModel(obj,f.name,{prepared:true});
      }
    }catch(err){console.error(err);setStatus(tr('fileError',{name:f.name,error:err.message||err}))}
  }
  fileInput.value='';
}

function newProject(){
  if((models.length||underlay)&&!confirm(tr('newProjectConfirm')))return;
  cancelCrop();clearMeasurement();transform.detach();models.forEach(m=>scene.remove(m.root));models.length=0;if(underlay){scene.remove(underlay);underlay.geometry.dispose();underlay.material.map?.dispose();underlay.material.dispose();underlay=null;underlayImageData=null;underlaySelected=false}selectedModel=null;modelNumber=1;releaseAllObjectUrls();
  savedViews=[];renderSavedViews();updateUnderlayUi();
  undoStack.length=0;redoStack.length=0;updateHistoryButtons();rebuildModelList();syncTransformFields();resetViewToOrigin();setStatus(tr('newEmpty'));
}

function updateCropButtons(){
  $('startCropButton').disabled=!selectedModel||selectedModel.root.userData.locked||cropMode;
  $('cancelCropButton').disabled=!cropMode;
  const ready=cropMode&&cropPoints.length>=3;
  $('cropInsideButton').disabled=!ready;$('cropOutsideButton').disabled=!ready;
}
function setCropTool(tool){
  cropTool=tool;cropPoints=[];cropDrawing=false;redrawCrop();
  $('freehandCropButton').classList.toggle('active',tool==='freehand');
  $('polygonCropButton').classList.toggle('active',tool==='polygon');
  $('freehandCropButton').setAttribute('aria-pressed',tool==='freehand');
  $('polygonCropButton').setAttribute('aria-pressed',tool==='polygon');
  setStatus(tr('toolSelected',{tool:tool==='freehand'?tr('freehand'):tr('polygon')}));
  updateCropButtons();
}
function startCrop(){
  if(!selectedEditable())return
  cropMode=true;cropPoints=[];cropDrawing=false;cropPointerId=null;transform.detach();
  orbit.enabled=false;orbit.enableRotate=false;orbit.enablePan=false;orbit.enableZoom=false;
  renderer.domElement.style.pointerEvents='none';
  cropInputLayer.classList.add('active');cropOverlay.classList.add('active');cropHint.classList.add('active');
  $('startCropButton').classList.add('active');
  cropHint.textContent=cropTool==='freehand'?'Frihånd aktiv: tegn i flere strøg. Løft pennen og fortsæt et nyt sted – mellemrummet forbindes med en lige linje.':'Polygon aktiv: tryk punkter langs kanten.';
  updateCropButtons();redrawCrop();setStatus(tr('cropActive'));
}
function cancelCrop(){
  cropMode=false;cropPoints=[];cropDrawing=false;cropPointerId=null;
  renderer.domElement.style.pointerEvents='';
  cropInputLayer.classList.remove('active');cropOverlay.classList.remove('active');cropHint.classList.remove('active');
  $('startCropButton').classList.remove('active');
  orbit.enabled=true;orbit.enableRotate=true;orbit.enablePan=true;orbit.enableZoom=true;
  if(selectedModel&&!selectedModel.root.userData.locked)transform.attach(selectedModel.root);
  redrawCrop();updateCropButtons();
}
function redrawCrop(){
  const pts=cropPoints.map(p=>`${p.x},${p.y}`).join(' ');
  const closedPts=cropPoints.length>=3?`${pts} ${cropPoints[0].x},${cropPoints[0].y}`:pts;
  cropLine.setAttribute('points',closedPts);cropPolygon.setAttribute('points',cropPoints.length>=3?pts:'');cropPointsGroup.innerHTML='';
  for(const p of cropPoints){const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('cx',p.x);c.setAttribute('cy',p.y);c.setAttribute('r',5);cropPointsGroup.appendChild(c)}
}
function pointFromEvent(e){const r=cropInputLayer.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function down(e){
  if(unwrapAreaMode){
    e.preventDefault();e.stopPropagation();
    const p=pointFromEvent(e);cropDrawing=true;cropPointerId=e.pointerId;unwrapAreaPoints=[p];cropPoints=unwrapAreaPoints;
    cropInputLayer.setPointerCapture?.(e.pointerId);redrawCrop();return;
  }
  if(!cropMode)return;e.preventDefault();e.stopPropagation();
  const p=pointFromEvent(e);
  if(cropTool==='polygon'){cropPoints.push(p);redrawCrop();updateCropButtons();return}
  cropDrawing=true;cropPointerId=e.pointerId;
  // Første strøg starter konturen. Senere strøg fortsætter den eksisterende
  // kontur; SVG-polylinjen laver automatisk en lige forbindelse til pennen.
  if(!cropPoints.length)cropPoints.push(p);else{
    const last=cropPoints[cropPoints.length-1];
    if(Math.hypot(p.x-last.x,p.y-last.y)>.5)cropPoints.push(p);
  }
  cropInputLayer.setPointerCapture?.(e.pointerId);redrawCrop();updateCropButtons();
}
function move(e){
  if(unwrapAreaMode){
    if(!cropDrawing||e.pointerId!==cropPointerId)return;e.preventDefault();
    const p=pointFromEvent(e),last=unwrapAreaPoints[unwrapAreaPoints.length-1];
    if(!last||Math.hypot(p.x-last.x,p.y-last.y)>=4){unwrapAreaPoints.push(p);cropPoints=unwrapAreaPoints;redrawCrop()}return;
  }
  if(!cropMode||cropTool!=='freehand'||!cropDrawing||e.pointerId!==cropPointerId)return;e.preventDefault();
  const p=pointFromEvent(e),last=cropPoints[cropPoints.length-1];
  if(!last||Math.hypot(p.x-last.x,p.y-last.y)>=4){cropPoints.push(p);redrawCrop();updateCropButtons()}
}
function up(e){
  if(unwrapAreaMode){
    if(!cropDrawing||e.pointerId!==cropPointerId)return;e.preventDefault();
    cropDrawing=false;cropInputLayer.releasePointerCapture?.(e.pointerId);cropPointerId=null;
    if(unwrapAreaPoints.length>=3){unwrapAreaMode=false;cropInputLayer.classList.remove('active');cropOverlay.classList.remove('active');cropHint.classList.remove('active');renderer.domElement.style.pointerEvents='';orbit.enabled=true;orbit.enableRotate=true;orbit.enablePan=true;orbit.enableZoom=true;setStatus(tr('unwrapAreaChosen'));if(selectedModel&&!selectedModel.root.userData.locked)transform.attach(selectedModel.root)}
    return;
  }
  if(!cropMode||cropTool!=='freehand'||!cropDrawing||e.pointerId!==cropPointerId)return;e.preventDefault();
  cropDrawing=false;cropInputLayer.releasePointerCapture?.(e.pointerId);cropPointerId=null;redrawCrop();updateCropButtons();
  if(cropPoints.length>=3)setStatus(tr('strokeSaved'));
}
function inPolygon(p,poly){
  let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||Number.EPSILON)+a.x))inside=!inside;
  }return inside;
}
function screenPoint(v){
  const r=renderer.domElement.getBoundingClientRect(),p=v.clone().project(camera);
  return{x:(p.x*.5+.5)*r.width,y:(-p.y*.5+.5)*r.height};
}

function cropScreenLine(a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  return {A:-dy,B:dx,C:dy*a.x-dx*a.y};
}
function cropVertexScreen(v,w,h){
  const c=v.clip,iw=Math.abs(c.w)>1e-12?1/c.w:0;
  return {x:(c.x*iw*.5+.5)*w,y:(-c.y*iw*.5+.5)*h};
}
function cropHomLine(v,line,w,h){
  const c=v.clip;
  const sx=(.5*c.x+.5*c.w)*w;
  const sy=(-.5*c.y+.5*c.w)*h;
  return line.A*sx+line.B*sy+line.C*c.w;
}
function cropLerpVertex(a,b,t){
  const attrs={};
  for(const name of Object.keys(a.attrs)){
    const av=a.attrs[name],bv=b.attrs[name],out=new Array(av.length);
    for(let i=0;i<av.length;i++)out[i]=av[i]+(bv[i]-av[i])*t;
    if(name==='normal'&&out.length>=3){
      const len=Math.hypot(out[0],out[1],out[2])||1;
      out[0]/=len;out[1]/=len;out[2]/=len;
    }else if(name==='tangent'&&out.length>=3){
      const len=Math.hypot(out[0],out[1],out[2])||1;
      out[0]/=len;out[1]/=len;out[2]/=len;
      if(out.length>3)out[3]=t<.5?av[3]:bv[3];
    }
    attrs[name]=out;
  }
  return {
    attrs,
    clip:new THREE.Vector4(
      a.clip.x+(b.clip.x-a.clip.x)*t,
      a.clip.y+(b.clip.y-a.clip.y)*t,
      a.clip.z+(b.clip.z-a.clip.z)*t,
      a.clip.w+(b.clip.w-a.clip.w)*t
    )
  };
}
function cropClipHalfPlane(poly,line,orient,keepInside,w,h){
  if(poly.length<3)return [];
  const out=[],eps=1e-7;
  let s=poly[poly.length-1],ds=orient*cropHomLine(s,line,w,h);
  for(const e of poly){
    const de=orient*cropHomLine(e,line,w,h);
    const sin=keepInside?ds>=-eps:ds<=eps;
    const ein=keepInside?de>=-eps:de<=eps;
    if(ein){
      if(!sin){
        const den=ds-de,t=Math.abs(den)<1e-20?.5:ds/den;
        out.push(cropLerpVertex(s,e,Math.max(0,Math.min(1,t))));
      }
      out.push(e);
    }else if(sin){
      const den=ds-de,t=Math.abs(den)<1e-20?.5:ds/den;
      out.push(cropLerpVertex(s,e,Math.max(0,Math.min(1,t))));
    }
    s=e;ds=de;
  }
  return out;
}
function cropIntersectConvex(poly,tri,w,h){
  let p=poly;
  for(const edge of tri.edges){
    p=cropClipHalfPlane(p,edge.line,tri.orient,true,w,h);
    if(p.length<3)return [];
  }
  return p;
}
function cropSubtractConvex(poly,tri,w,h){
  let candidate=poly;
  const outside=[];
  for(const edge of tri.edges){
    if(candidate.length<3)break;
    const out=cropClipHalfPlane(candidate,edge.line,tri.orient,false,w,h);
    if(out.length>=3)outside.push(out);
    candidate=cropClipHalfPlane(candidate,edge.line,tri.orient,true,w,h);
  }
  return outside;
}
function cropBboxOverlap(a,b){
  return !(a.maxX<b.minX||a.minX>b.maxX||a.maxY<b.minY||a.minY>b.maxY);
}

function cropPointLineDistance(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  if(l2<1e-12)return Math.hypot(p.x-a.x,p.y-a.y);
  let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2;
  t=Math.max(0,Math.min(1,t));
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}
function cropSimplifyRdp(points,tolerance){
  if(points.length<=2)return points.slice();
  let maxD=0,index=0;
  const a=points[0],b=points[points.length-1];
  for(let i=1;i<points.length-1;i++){
    const d=cropPointLineDistance(points[i],a,b);
    if(d>maxD){maxD=d;index=i}
  }
  if(maxD>tolerance){
    const left=cropSimplifyRdp(points.slice(0,index+1),tolerance);
    const right=cropSimplifyRdp(points.slice(index),tolerance);
    return left.slice(0,-1).concat(right);
  }
  return [a,b];
}
function cropPrepareContour(poly){
  if(!Array.isArray(poly)||poly.length<3)return null;

  // Remove almost identical neighbouring points first.
  const dedup=[];
  for(const p of poly){
    const q={x:+p.x,y:+p.y};
    const last=dedup[dedup.length-1];
    if(!last||Math.hypot(q.x-last.x,q.y-last.y)>=1.0)dedup.push(q);
  }
  if(dedup.length<3)return null;

  // Freehand drawing can contain hundreds/thousands of points. Simplify gently
  // before triangulation. 1.25 screen pixels is visually negligible.
  let clean=dedup.length>80?cropSimplifyRdp(dedup,1.25):dedup.slice();

  // Explicitly close the contour for display/logic, but triangulateShape wants
  // the final duplicate removed, so we normalise it back to one unique loop.
  if(clean.length<3)return null;
  const first=clean[0],last=clean[clean.length-1];
  if(Math.hypot(first.x-last.x,first.y-last.y)<0.75)clean.pop();

  // If simplification became too aggressive, fall back to deduplicated points.
  if(clean.length<3)clean=dedup.slice();
  return clean;
}

function makeCropClipSpec(poly){
  const clean=cropPrepareContour(poly);
  if(!clean||clean.length<3)return null;

  const contour=clean.map(p=>new THREE.Vector2(p.x,p.y));
  const faces=THREE.ShapeUtils.triangulateShape(contour,[]);
  if(!faces?.length)return null;

  const tris=[];
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of clean){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}
  for(const f of faces){
    const a=clean[f[0]],b=clean[f[1]],c=clean[f[2]];
    const area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    if(Math.abs(area)<1e-8)continue;
    const tri={
      orient:area>=0?1:-1,
      bbox:{minX:Math.min(a.x,b.x,c.x),minY:Math.min(a.y,b.y,c.y),maxX:Math.max(a.x,b.x,c.x),maxY:Math.max(a.y,b.y,c.y)},
      edges:[{line:cropScreenLine(a,b)},{line:cropScreenLine(b,c)},{line:cropScreenLine(c,a)}]
    };
    tris.push(tri);
  }
  if(!tris.length)return null;

  const cell=96,grid=new Map();
  for(let ti=0;ti<tris.length;ti++){
    const b=tris[ti].bbox;
    const x0=Math.floor(b.minX/cell),x1=Math.floor(b.maxX/cell),y0=Math.floor(b.minY/cell),y1=Math.floor(b.maxY/cell);
    for(let gy=y0;gy<=y1;gy++)for(let gx=x0;gx<=x1;gx++){
      const k=gx+','+gy;
      if(!grid.has(k))grid.set(k,[]);
      grid.get(k).push(ti);
    }
  }
  return {poly:clean,tris,global:{minX,minY,maxX,maxY},cell,grid};
}
function cropCandidateTris(spec,bbox){
  if(!cropBboxOverlap(spec.global,bbox))return [];
  const ids=new Set(),cell=spec.cell;
  const x0=Math.floor(bbox.minX/cell),x1=Math.floor(bbox.maxX/cell),y0=Math.floor(bbox.minY/cell),y1=Math.floor(bbox.maxY/cell);
  for(let gy=y0;gy<=y1;gy++)for(let gx=x0;gx<=x1;gx++){
    const arr=spec.grid.get(gx+','+gy);
    if(arr)for(const id of arr)if(cropBboxOverlap(spec.tris[id].bbox,bbox))ids.add(id);
  }
  return [...ids].map(i=>spec.tris[i]);
}
function cropAttrValue(attr,index){
  const out=[];
  if(attr.itemSize>0)out.push(attr.getX(index));
  if(attr.itemSize>1)out.push(attr.getY(index));
  if(attr.itemSize>2)out.push(attr.getZ(index));
  if(attr.itemSize>3)out.push(attr.getW(index));
  for(let i=4;i<attr.itemSize;i++)out.push(attr.array[index*attr.itemSize+i]);
  return out;
}
function cropTriangleMaterialIndex(g,indexOffset){
  for(const group of g.groups||[])if(indexOffset>=group.start&&indexOffset<group.start+group.count)return group.materialIndex||0;
  return 0;
}
function cropEmitPolygon(poly,bucket,attrNames){
  if(poly.length<3)return;
  for(let i=1;i+1<poly.length;i++){
    const vs=[poly[0],poly[i],poly[i+1]];
    for(const v of vs)for(const name of attrNames)bucket[name].push(...v.attrs[name]);
  }
}
function cropGeometry(mesh,spec,keepInside){
  const g=mesh.geometry,pos=g.attributes?.position;if(!pos||!spec)return false;
  const idx=g.index?Array.from(g.index.array):Array.from({length:pos.count},(_,i)=>i);
  const attrNames=Object.keys(g.attributes);
  if(!attrNames.includes('position'))return false;

  mesh.updateWorldMatrix(true,false);
  camera.updateMatrixWorld(true);
  const mvp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(mesh.matrixWorld);
  const rect=renderer.domElement.getBoundingClientRect(),w=rect.width,h=rect.height;
  const cache=new Map();

  function vertexAt(index){
    if(cache.has(index))return cache.get(index);
    const attrs={};
    for(const name of attrNames)attrs[name]=cropAttrValue(g.attributes[name],index);
    const p=attrs.position;
    const clip=new THREE.Vector4(p[0],p[1],p[2],1).applyMatrix4(mvp);
    const v={attrs,clip};cache.set(index,v);return v;
  }

  const buckets=new Map();
  function bucketFor(mi){
    if(!buckets.has(mi)){
      const b={};for(const name of attrNames)b[name]=[];
      buckets.set(mi,b);
    }
    return buckets.get(mi);
  }

  let produced=0;
  for(let io=0;io+2<idx.length;io+=3){
    const tri=[vertexAt(idx[io]),vertexAt(idx[io+1]),vertexAt(idx[io+2])];
    const sp=tri.map(v=>cropVertexScreen(v,w,h));
    const bbox={minX:Math.min(sp[0].x,sp[1].x,sp[2].x),minY:Math.min(sp[0].y,sp[1].y,sp[2].y),maxX:Math.max(sp[0].x,sp[1].x,sp[2].x),maxY:Math.max(sp[0].y,sp[1].y,sp[2].y)};
    const clips=cropCandidateTris(spec,bbox);
    const mi=cropTriangleMaterialIndex(g,io),bucket=bucketFor(mi);

    if(!clips.length){
      if(!keepInside){cropEmitPolygon(tri,bucket,attrNames);produced++}
      continue;
    }

    if(keepInside){
      for(const ct of clips){
        const p=cropIntersectConvex(tri,ct,w,h);
        if(p.length>=3){cropEmitPolygon(p,bucket,attrNames);produced++}
      }
    }else{
      let fragments=[tri];
      for(const ct of clips){
        const next=[];
        for(const frag of fragments)next.push(...cropSubtractConvex(frag,ct,w,h));
        fragments=next;
        if(!fragments.length)break;
      }
      for(const p of fragments)if(p.length>=3){cropEmitPolygon(p,bucket,attrNames);produced++}
    }
  }

  const newG=new THREE.BufferGeometry();
  const combined={};for(const name of attrNames)combined[name]=[];
  let start=0;
  for(const [mi,b] of buckets){
    const count=b.position.length/3;
    if(!count)continue;
    for(const name of attrNames)combined[name].push(...b[name]);
    newG.addGroup(start,count,mi);start+=count;
  }
  if(!start){
    for(const name of attrNames){
      const old=g.attributes[name];
      newG.setAttribute(name,new THREE.Float32BufferAttribute([],old.itemSize));
    }
  }else{
    for(const name of attrNames){
      const old=g.attributes[name];
      newG.setAttribute(name,new THREE.Float32BufferAttribute(combined[name],old.itemSize));
    }
  }
  newG.userData={...g.userData};
  newG.computeBoundingBox();newG.computeBoundingSphere();
  const oldGeo=mesh.geometry;mesh.geometry=newG;oldGeo.dispose();
  return true;
}
function applyCrop(keepInside){
  if(!selectedEditable()||cropPoints.length<3)return;
  const spec=makeCropClipSpec(cropPoints);
  if(!spec){setStatus(tr('preciseCropFallback'));return}
  setStatus(tr('preciseCropWorking'));
  const original=selectedModel,clone=original.root.clone(true);
  clone.traverse(o=>{if(o.isMesh&&o.geometry)o.geometry=o.geometry.clone()});
  clone.updateMatrixWorld(true);
  clone.traverse(o=>{if(o.isMesh)cropGeometry(o,spec,keepInside)});
  const originalWasVisible=original.root.visible;
  original.root.visible=false;
  const m=addModel(clone,`${original.name} – beskåret`,{prepared:true,cropped:true,frame:false});
  pushHistory({
    label:'beskæring',
    undo:()=>{
      scene.remove(m.root);
      const i=models.indexOf(m);if(i>=0)models.splice(i,1);
      original.root.visible=originalWasVisible;
      selectModel(original);rebuildModelList();
    },
    redo:()=>{
      if(!models.includes(m)){models.push(m);scene.add(m.root)}
      original.root.visible=false;
      selectModel(m);rebuildModelList();
    }
  });
  cancelCrop();selectModel(m);setStatus(tr('cropCreated'));
}

async function exportPng(){
  const w=Math.max(200,Math.min(10000,parseInt($('exportWidth').value)||3000)),h=Math.max(200,Math.min(10000,parseInt($('exportHeight').value)||2000));
  const old=new THREE.Vector2();renderer.getSize(old);const pr=renderer.getPixelRatio(),pa=perspectiveCamera.aspect,oo={l:orthographicCamera.left,r:orthographicCamera.right,t:orthographicCamera.top,b:orthographicCamera.bottom};
  renderer.setPixelRatio(1);renderer.setSize(w,h,false);
  if(camera.isPerspectiveCamera)camera.aspect=w/h;else{const cy=(camera.top+camera.bottom)/2,hh=(camera.top-camera.bottom)/2,cx=(camera.left+camera.right)/2,hw=hh*w/h;camera.left=cx-hw;camera.right=cx+hw;camera.top=cy+hh;camera.bottom=cy-hh}
  camera.updateProjectionMatrix();renderer.render(scene,camera);
  const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download='ArchaeoPlan-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.png';a.click();
  renderer.setPixelRatio(pr);renderer.setSize(old.x,old.y,false);perspectiveCamera.aspect=pa;Object.assign(orthographicCamera,{left:oo.l,right:oo.r,top:oo.t,bottom:oo.b});camera.updateProjectionMatrix();
}

function resize(){
  const r=viewport.getBoundingClientRect();
  const w=Math.max(Math.floor(r.width),1);
  const h=Math.max(Math.floor(r.height),1);

  renderer.setSize(w,h,false);
  renderer.domElement.style.width='100%';
  renderer.domElement.style.height='100%';

  perspectiveCamera.aspect=w/h;
  perspectiveCamera.updateProjectionMatrix();

  if(!models.length && !cropMode){
    resetViewToOrigin(camera.isOrthographicCamera);
  }

  cropOverlay.setAttribute('viewBox',`0 0 ${w} ${h}`);
  updateExportFrame();
  updateMeasureLabel();
  updateExportAnnotations();
}



// ---------- Saved views ----------
function snapshotView(){return {
  name:'',
  ortho:camera.isOrthographicCamera,
  position:camera.position.toArray(),
  quaternion:camera.quaternion.toArray(),
  up:camera.up.toArray(),
  target:orbit.target.toArray(),
  zoom:camera.zoom,
  fov:camera.isPerspectiveCamera?camera.fov:null,
  near:camera.near,
  far:camera.far,
  orthoBounds:camera.isOrthographicCamera?{left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom}:null,
  ratio:$('exportRatio').value,
  width:$('exportWidth').value,
  height:$('exportHeight').value
};}
function saveView(){const s=snapshotView(),suggested=`Visning ${savedViews.length+1}`;const n=prompt('Navn på visningen:',suggested);if(n===null)return;s.name=n.trim()||suggested;savedViews.push(s);renderSavedViews();setStatus(tr('viewSaved',{name:s.name}))}
function applyViewState(s){
  if(!s)return;
  if(camera.isOrthographicCamera!==s.ortho)switchCamera(s.ortho);
  camera.position.fromArray(s.position);
  camera.quaternion.fromArray(s.quaternion);
  camera.up.fromArray(s.up);
  orbit.target.fromArray(s.target);
  camera.zoom=s.zoom||1;
  if(camera.isPerspectiveCamera&&s.fov)camera.fov=s.fov;
  if(Number.isFinite(s.near))camera.near=s.near;
  if(Number.isFinite(s.far))camera.far=s.far;
  if(camera.isOrthographicCamera&&s.orthoBounds){
    camera.left=s.orthoBounds.left;
    camera.right=s.orthoBounds.right;
    camera.top=s.orthoBounds.top;
    camera.bottom=s.orthoBounds.bottom;
  }
  camera.updateProjectionMatrix();
  orbit.update();
  if(s.ratio!=null)$('exportRatio').value=s.ratio;
  if(s.width!=null)$('exportWidth').value=s.width;
  if(s.height!=null)$('exportHeight').value=s.height;
  updateExportFrame();
  updateExportAnnotations();
}
function restoreView(i){const s=savedViews[i];if(!s)return;applyViewState(s);setStatus(tr('viewRestored',{name:s.name}))}
function deleteView(i){savedViews.splice(i,1);renderSavedViews()}
function clearViews(){if(!savedViews.length)return;if(confirm(tr('clearViewsConfirm'))){savedViews=[];renderSavedViews();setStatus(tr('viewsCleared'))}}
function renderSavedViews(){const list=$('savedViewsList');if(!list)return;list.innerHTML='';if(!savedViews.length){list.innerHTML=`<p class="muted small">${tr('noSavedViews')}</p>`;return}savedViews.forEach((v,i)=>{const row=document.createElement('div');row.className='saved-view-row';const n=document.createElement('div');n.className='saved-view-name';n.textContent=v.name;const go=document.createElement('button');go.textContent='Hent';go.onclick=()=>restoreView(i);const del=document.createElement('button');del.textContent='×';del.onclick=()=>deleteView(i);row.append(n,go,del);list.append(row)})}

// ---------- Measurement ----------
const measureRaycaster=new THREE.Raycaster();
const measurePointer=new THREE.Vector2();

function visibleMeshes(){
  const arr=[];
  models.forEach(m=>{
    if(!m.root.visible)return;
    m.root.traverse(o=>{if(o.isMesh)arr.push(o)});
  });
  return arr;
}
function screenToNdc(event){
  const r=renderer.domElement.getBoundingClientRect();
  measurePointer.x=((event.clientX-r.left)/r.width)*2-1;
  measurePointer.y=-((event.clientY-r.top)/r.height)*2+1;
}
function clearMeasurement(){
  measurePoints=[];
  if(measureLine){scene.remove(measureLine);measureLine.geometry.dispose();measureLine.material.dispose();measureLine=null}
  measureDots.forEach(d=>{scene.remove(d);d.geometry.dispose();d.material.dispose()});measureDots=[];
  if(measureLabel){measureLabel.remove();measureLabel=null}
  if(measureResult)measureResult.textContent='Ingen måling.';
}
function toggleMeasure(){
  measureMode=!measureMode;
  $('measureButton').classList.toggle('active',measureMode);
  if(measureMode){
    cancelCrop();
    clearMeasurement();
    transform.detach();
    setStatus(tr('measureActive'));
  }else{
    if(selectedModel&&!selectedModel.root.userData.locked)transform.attach(selectedModel.root);
    setStatus(tr('measureEnded'));
  }
}
function addMeasurePoint(world){
  measurePoints.push(world.clone());

  const dot=new THREE.Mesh(
    new THREE.SphereGeometry(.02,12,12),
    new THREE.MeshBasicMaterial({color:0x1677b8,depthTest:false})
  );
  dot.position.copy(world);
  dot.renderOrder=999;
  scene.add(dot);
  measureDots.push(dot);

  if(measurePoints.length===2){
    const g=new THREE.BufferGeometry().setFromPoints(measurePoints);
    const m=new THREE.LineBasicMaterial({color:0x1677b8,depthTest:false});
    measureLine=new THREE.Line(g,m);measureLine.renderOrder=999;scene.add(measureLine);

    const dist=measurePoints[0].distanceTo(measurePoints[1]);
    const txt=dist>=1?`${dist.toFixed(3)} m`:`${(dist*100).toFixed(1)} cm`;
    if(measureResult)measureResult.textContent=`Afstand: ${txt}`;

    measureLabel=document.createElement('div');
    measureLabel.className='measure-label';
    measureLabel.textContent=txt;
    viewport.appendChild(measureLabel);
    updateMeasureLabel();

    measureMode=false;
    $('measureButton').classList.remove('active');
    if(selectedModel&&!selectedModel.root.userData.locked)transform.attach(selectedModel.root);
    setStatus(tr('measureValue',{value:txt}));
  }
}
function updateMeasureLabel(){
  if(!measureLabel||measurePoints.length<2)return;
  const mid=measurePoints[0].clone().add(measurePoints[1]).multiplyScalar(.5).project(camera);
  const r=renderer.domElement.getBoundingClientRect();
  measureLabel.style.left=`${(mid.x*.5+.5)*r.width}px`;
  measureLabel.style.top=`${(-mid.y*.5+.5)*r.height}px`;
  measureLabel.style.transform='translate(-50%,-50%)';
}
renderer.domElement.addEventListener('pointerdown',e=>{
  if(!unwrapPickMode||cropMode)return;
  e.preventDefault();screenToNdc(e);measureRaycaster.setFromCamera(measurePointer,camera);const roots=[];if(selectedModel?.root?.visible)selectedModel.root.traverse(o=>{if(o.isMesh)roots.push(o)});const hit=measureRaycaster.intersectObjects(roots,false)[0];if(hit)finishUnwrapPick(hit.point);
},{capture:true});

renderer.domElement.addEventListener('pointerdown',e=>{
  if(!measureMode||cropMode||unwrapPickMode)return;
  e.preventDefault();
  screenToNdc(e);
  measureRaycaster.setFromCamera(measurePointer,camera);
  const hit=measureRaycaster.intersectObjects(visibleMeshes(),false)[0];
  if(hit)addMeasurePoint(hit.point);
},{capture:true});

// ---------- Export frame ----------
function exportRatioValue(){
  const v=$('exportRatio').value;
  if(v==='screen'){
    const r=viewport.getBoundingClientRect();
    return r.width/Math.max(r.height,1);
  }
  if(v==='custom'){
    const w=Math.max(parseInt($('exportWidth').value)||1,1);
    const h=Math.max(parseInt($('exportHeight').value)||1,1);
    return w/h;
  }
  return parseFloat(v)||1.5;
}
function syncExportDimensions(source='ratio'){
  const ratio=exportRatioValue();
  const preset=$('exportPreset').value;

  if(preset==='screen'){
    const r=viewport.getBoundingClientRect();
    $('exportWidth').value=Math.round(r.width);
    $('exportHeight').value=Math.round(r.height);
  }else if(preset!=='custom'){
    const w=parseInt(preset);
    $('exportWidth').value=w;
    $('exportHeight').value=Math.round(w/ratio);
  }else if(source==='width' && $('exportRatio').value!=='custom'){
    const w=Math.max(parseInt($('exportWidth').value)||1,1);
    $('exportHeight').value=Math.round(w/ratio);
  }else if(source==='height' && $('exportRatio').value!=='custom'){
    const h=Math.max(parseInt($('exportHeight').value)||1,1);
    $('exportWidth').value=Math.round(h*ratio);
  }
  updateExportFrame();
}
function updateExportFrame(){
  if(!exportFrameVisible)return;
  const r=viewport.getBoundingClientRect();
  const ratio=exportRatioValue();
  const margin=28;
  const maxW=Math.max(r.width-margin*2,20),maxH=Math.max(r.height-margin*2,20);
  let w=maxW,h=w/ratio;
  if(h>maxH){h=maxH;w=h*ratio}
  exportFrame.style.width=`${w}px`;
  exportFrame.style.height=`${h}px`;
  exportFrame.style.left=`${(r.width-w)/2}px`;
  exportFrame.style.top=`${(r.height-h)/2}px`;
  updateExportAnnotations();
}
function toggleExportFrame(){
  exportFrameVisible=!exportFrameVisible;
  exportFrame.classList.toggle('active',exportFrameVisible);
  $('toggleExportFrameButton').textContent=exportFrameVisible?tr('hideExportFrame'):tr('showExportFrame');
  if(exportFrameVisible){syncExportDimensions();updateExportFrame()}
}
function fitToExportFrame(){
  if(!selectedModel){setStatus(tr('selectModel'));return}
  if(!exportFrameVisible){exportFrameVisible=true;exportFrame.classList.add('active')}
  updateExportFrame();
  // Reuse the stable model framing, then zoom out slightly for breathing room.
  frameCurrentView();
  if(camera.isPerspectiveCamera){
    const dir=camera.position.clone().sub(orbit.target);
    camera.position.copy(orbit.target).add(dir.multiplyScalar(1.12));
  }else{
    camera.zoom*=.90;
  }
  camera.updateProjectionMatrix();orbit.update();
  setStatus(tr('exportFit'));
}
function exportFrameRect(){
  const vr=viewport.getBoundingClientRect();
  if(!exportFrameVisible)return {x:0,y:0,w:vr.width,h:vr.height};
  const fr=exportFrame.getBoundingClientRect();
  return {x:fr.left-vr.left,y:fr.top-vr.top,w:fr.width,h:fr.height};
}
function placeOverlay(el,pos,frame,pad=22){
  const vr=viewport.getBoundingClientRect();
  el.style.left=el.style.right=el.style.top=el.style.bottom='auto';
  const fx=frame.left-vr.left,fy=frame.top-vr.top;
  if(pos.includes('left'))el.style.left=`${fx+pad}px`;else el.style.right=`${Math.max(vr.width-(fx+frame.width)+pad,pad)}px`;
  if(pos.includes('top'))el.style.top=`${fy+pad}px`;else el.style.bottom=`${Math.max(vr.height-(fy+frame.height)+pad,pad)}px`;
}
function orthoUnitsPerPixel(){
  const r=renderer.domElement.getBoundingClientRect();
  return ((camera.top-camera.bottom)/Math.max(camera.zoom,1e-9))/Math.max(r.height,1);
}
function niceScaleLength(){
  const raw=orthoUnitsPerPixel()*140,exp=Math.floor(Math.log10(Math.max(raw,1e-9)));let best=1,bestD=Infinity;
  for(let e=exp-1;e<=exp+1;e++)for(const p of [1,2,5]){const v=p*10**e,d=Math.abs(Math.log(v/raw));if(d<bestD){best=v;bestD=d}}
  return best;
}
function scaleText(v){if(v>=1)return `${Number(v.toFixed(2))} m`;if(v>=.01)return `${Number((v*100).toFixed(1))} cm`;return `${Number((v*1000).toFixed(0))} mm`}
function updateExportAnnotations(){
  if(!scaleBarOverlay||!northArrowOverlay)return;
  const frame=exportFrameVisible?exportFrame.getBoundingClientRect():viewport.getBoundingClientRect();
  if($('showScaleBar').checked&&camera.isOrthographicCamera){
    const length=$('scaleBarLength').value==='auto'?niceScaleLength():parseFloat($('scaleBarLength').value);
    scaleBarOverlay.innerHTML=`<span>${scaleText(length)}</span>`;scaleBarOverlay.style.width=`${Math.max(30,length/orthoUnitsPerPixel())}px`;scaleBarOverlay.classList.add('active');placeOverlay(scaleBarOverlay,$('scaleBarPosition').value,frame);
  }else scaleBarOverlay.classList.remove('active');
  if($('showNorthArrow').checked){northArrowOverlay.classList.add('active');northArrowOverlay.querySelector('.northArrowGlyph').style.transform=`rotate(${$('northAngle').value||0}deg)`;placeOverlay(northArrowOverlay,$('northPosition').value,frame)}else northArrowOverlay.classList.remove('active');
}
async function drawAnnotationsOnBlob(blob,outW,outH){
  if(!$('showScaleBar').checked&&!$('showNorthArrow').checked)return blob;
  const img=await createImageBitmap(blob),c=document.createElement('canvas');c.width=outW;c.height=outH;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,outW,outH);
  const factor=Math.min(outW/Math.max(exportFrameRect().w,1),outH/Math.max(exportFrameRect().h,1)),pad=28*factor;
  if($('showScaleBar').checked&&camera.isOrthographicCamera){
    const length=$('scaleBarLength').value==='auto'?niceScaleLength():parseFloat($('scaleBarLength').value),bar=(length/orthoUnitsPerPixel())*factor,pos=$('scaleBarPosition').value,x=pos.includes('left')?pad:outW-pad-bar,y=pos.includes('top')?pad+30*factor:outH-pad;
    ctx.save();ctx.strokeStyle=ctx.fillStyle='white';ctx.lineWidth=Math.max(3,4*factor);ctx.shadowColor='rgba(0,0,0,.85)';ctx.shadowBlur=4*factor;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+bar,y);ctx.stroke();ctx.lineWidth=Math.max(2,2*factor);for(const xx of [x,x+bar/2,x+bar]){ctx.beginPath();ctx.moveTo(xx,y-7*factor);ctx.lineTo(xx,y+7*factor);ctx.stroke()}ctx.font=`700 ${Math.max(18,18*factor)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(scaleText(length),x+bar/2,y-10*factor);ctx.restore();
  }
  if($('showNorthArrow').checked){const pos=$('northPosition').value,cx=pos.includes('left')?pad+35*factor:outW-pad-35*factor,cy=pos.includes('top')?pad+45*factor:outH-pad-45*factor,a=THREE.MathUtils.degToRad(parseFloat($('northAngle').value)||0),L=55*factor;ctx.save();ctx.translate(cx,cy);ctx.rotate(a);ctx.strokeStyle=ctx.fillStyle='white';ctx.lineWidth=Math.max(3,4*factor);ctx.shadowColor='rgba(0,0,0,.85)';ctx.shadowBlur=4*factor;ctx.beginPath();ctx.moveTo(0,L/2);ctx.lineTo(0,-L/2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-L/2-10*factor);ctx.lineTo(-10*factor,-L/2+8*factor);ctx.lineTo(10*factor,-L/2+8*factor);ctx.closePath();ctx.fill();ctx.rotate(-a);ctx.font=`800 ${Math.max(18,20*factor)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText('N',0,-L/2-16*factor);ctx.restore()}
  return await new Promise(resolve=>c.toBlob(resolve,'image/png'));
}


function rendererMaxTileSize(){
  const gl=renderer.getContext();
  const maxRb=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)||4096;
  const maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE)||4096;
  // Stay below the GPU ceiling for Safari/iPad stability.
  return Math.max(1024,Math.min(maxRb,maxTex,4096));
}

function setPerspectiveTile(camera,fullW,fullH,x,y,w,h){
  // Full-frame perspective frustum, then crop to this tile.
  const near=camera.near;
  const top=near*Math.tan(THREE.MathUtils.degToRad(camera.fov)*0.5)/camera.zoom;
  const height=2*top;
  const width=camera.aspect*height;
  const left=-0.5*width;

  const x0=x/fullW, x1=(x+w)/fullW;
  const y0=y/fullH, y1=(y+h)/fullH;

  const tileLeft=left + width*x0;
  const tileRight=left + width*x1;
  const tileTop=top - height*y0;
  const tileBottom=top - height*y1;

  camera.projectionMatrix.makePerspective(tileLeft,tileRight,tileTop,tileBottom,near,camera.far,renderer.coordinateSystem);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

function setOrthoTile(camera,fullW,fullH,x,y,w,h,fullBounds){
  const {left,right,top,bottom}=fullBounds;
  const width=right-left, height=top-bottom;

  const x0=x/fullW, x1=(x+w)/fullW;
  const y0=y/fullH, y1=(y+h)/fullH;

  camera.left=left+width*x0;
  camera.right=left+width*x1;
  camera.top=top-height*y0;
  camera.bottom=top-height*y1;
  camera.updateProjectionMatrix();
}

async function renderExportBlob(){
  // Respect exactly what the user typed. Keep only a practical hard ceiling
  // to avoid impossible multi-gigabyte canvases on mobile browsers.
  const outW=Math.max(200,Math.min(50000,parseInt($('exportWidth').value)||3000));
  const outH=Math.max(200,Math.min(50000,parseInt($('exportHeight').value)||2000));

  const finalCanvas=document.createElement('canvas');
  finalCanvas.width=outW;
  finalCanvas.height=outH;
  const ctx=finalCanvas.getContext('2d',{alpha:true});
  if(!ctx)throw new Error('Kunne ikke oprette eksportlærred.');

  const oldSize=new THREE.Vector2();renderer.getSize(oldSize);
  const oldPR=renderer.getPixelRatio();
  const oldAspect=perspectiveCamera.aspect;
  const oldPerspProjection=perspectiveCamera.projectionMatrix.clone();
  const oldPerspInverse=perspectiveCamera.projectionMatrixInverse.clone();
  const oldOrtho={
    left:orthographicCamera.left,right:orthographicCamera.right,
    top:orthographicCamera.top,bottom:orthographicCamera.bottom,
    zoom:orthographicCamera.zoom
  };
  const __underlayWasVisible=underlay?underlay.visible:null;
  if(underlay&&underlay.userData.includeInExport===false)underlay.visible=false;

  try{
    renderer.setPixelRatio(1);

    const tileMax=rendererMaxTileSize();
    const cols=Math.ceil(outW/tileMax);
    const rows=Math.ceil(outH/tileMax);
    const total=cols*rows;
    let done=0;

    // Establish the full-frame camera once.
    if(camera.isPerspectiveCamera){
      perspectiveCamera.aspect=outW/outH;
      perspectiveCamera.updateProjectionMatrix();
    }else{
      const cy=(camera.top+camera.bottom)/2;
      const hh=((camera.top-camera.bottom)/2)/Math.max(camera.zoom,1e-9);
      const cx=(camera.left+camera.right)/2;
      const hw=hh*(outW/outH);
      orthographicCamera.left=cx-hw;
      orthographicCamera.right=cx+hw;
      orthographicCamera.top=cy+hh;
      orthographicCamera.bottom=cy-hh;
      orthographicCamera.zoom=1;
      orthographicCamera.updateProjectionMatrix();
    }

    const fullOrtho=camera.isOrthographicCamera ? {
      left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom
    } : null;

    for(let row=0;row<rows;row++){
      for(let col=0;col<cols;col++){
        const x=col*tileMax;
        const y=row*tileMax;
        const w=Math.min(tileMax,outW-x);
        const h=Math.min(tileMax,outH-y);

        renderer.setSize(w,h,false);

        if(camera.isPerspectiveCamera){
          setPerspectiveTile(camera,outW,outH,x,y,w,h);
        }else{
          setOrthoTile(camera,outW,outH,x,y,w,h,fullOrtho);
        }

        renderer.render(scene,camera);

        // Copy the current WebGL tile into the final 2D canvas.
        ctx.drawImage(renderer.domElement,0,0,w,h,x,y,w,h);

        done++;
        setStatus(`Eksporterer høj opløsning: ${done}/${total} fliser…`);

        // Yield to Safari/iPad between tiles to reduce memory pressure.
        await new Promise(r=>setTimeout(r,0));
      }
    }

    const blob=await new Promise((resolve,reject)=>{
      finalCanvas.toBlob(b=>b?resolve(b):reject(new Error('PNG kunne ikke oprettes.')),'image/png');
    });

    if(underlay&&__underlayWasVisible!==null)underlay.visible=__underlayWasVisible;

    // Annotations are drawn after the full-resolution image is assembled.
    return await drawAnnotationsOnBlob(blob,outW,outH);

  }finally{
    renderer.setPixelRatio(oldPR);
    renderer.setSize(oldSize.x,oldSize.y,false);

    perspectiveCamera.aspect=oldAspect;
    perspectiveCamera.projectionMatrix.copy(oldPerspProjection);
    perspectiveCamera.projectionMatrixInverse.copy(oldPerspInverse);
    perspectiveCamera.updateProjectionMatrix();

    orthographicCamera.left=oldOrtho.left;
    orthographicCamera.right=oldOrtho.right;
    orthographicCamera.top=oldOrtho.top;
    orthographicCamera.bottom=oldOrtho.bottom;
    orthographicCamera.zoom=oldOrtho.zoom;
    orthographicCamera.updateProjectionMatrix();

    if(underlay&&__underlayWasVisible!==null)underlay.visible=__underlayWasVisible;
    orbit.update();
  }
}

async function savePng(){
  const blob=await renderExportBlob();
  if(!blob)return;
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`ArchaeoPlan-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.png`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  setStatus(tr('pngExported'));
}
async function shareImage(){
  const blob=await renderExportBlob();
  if(!blob)return;
  const file=new File([blob],'ArchaeoPlan.png',{type:'image/png'});
  if(navigator.canShare?.({files:[file]}) && navigator.share){
    try{
      await navigator.share({files:[file],title:'ArchaeoPlan'});
      setStatus(tr('imageShare'));
      return;
    }catch(err){
      if(err?.name==='AbortError')return;
    }
  }
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='ArchaeoPlan.png';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  setStatus(tr('imageFallback'));
}


// ---------- Project files (.archaeoplan) ----------
const PROJECT_FORMAT='ArchaeoPlanProject';
const PROJECT_FORMAT_VERSION=1;

function safeProjectName(name){
  return (name||'ArchaeoPlan-projekt')
    .replace(/\.archaeoplan$/i,'')
    .replace(/[\\/:*?"<>|]+/g,'-')
    .trim()||'ArchaeoPlan-projekt';
}
function cloneSerializableView(s){
  return JSON.parse(JSON.stringify(s));
}
function currentProjectSettings(){
  return {
    language:currentLanguage,
    gridVisible:grid.visible,
    selectedIndex:selectedModel?models.indexOf(selectedModel):-1,
    currentView:cloneSerializableView(snapshotView()),
    savedViews:savedViews.map(cloneSerializableView),
    export:{
      frameVisible:exportFrameVisible,
      ratio:$('exportRatio').value,
      preset:$('exportPreset').value,
      width:$('exportWidth').value,
      height:$('exportHeight').value,
      showScaleBar:$('showScaleBar').checked,
      scaleBarLength:$('scaleBarLength').value,
      scaleBarPosition:$('scaleBarPosition').value,
      showNorthArrow:$('showNorthArrow').checked,
      northAngle:$('northAngle').value,
      northPosition:$('northPosition').value
    },
    measurement:measurePoints.map(p=>p.toArray()),
    underlay:underlayMetadata(),
    unwrap:{axis:$('unwrapAxis').value,width:$('unwrapWidth').value,start:unwrapStartAngle,end:unwrapEndAngle,reverse:unwrapReverse,area:unwrapAreaPoints,bandTop:unwrapBandTop,bandBottom:unwrapBandBottom}
  };
}
function modelMetadata(m,index){
  return {
    file:`models/model-${String(index+1).padStart(3,'0')}.glb`,
    name:m.name,
    cropped:!!m.cropped,
    visible:m.root.visible,
    locked:!!m.root.userData.locked,
    position:m.root.position.toArray(),
    quaternion:m.root.quaternion.toArray(),
    scale:m.root.scale.toArray()
  };
}
function exportRootAsGlb(root){
  return new Promise((resolve,reject)=>{
    const clone=root.clone(true);
    clone.visible=true;
    clone.position.set(0,0,0);
    clone.quaternion.identity();
    clone.scale.set(1,1,1);
    clone.updateMatrixWorld(true);
    const exporter=new GLTFExporter();
    exporter.parse(
      clone,
      result=>resolve(result),
      error=>reject(error),
      {binary:true,onlyVisible:false}
    );
  });
}
async function saveProject(){
  if(!models.length&&!underlay){
    setStatus(tr('noModelsToSave'));
    return;
  }
  const defaultName=`ArchaeoPlan-${new Date().toISOString().slice(0,10)}`;
  const requested=window.prompt(tr('projectNamePrompt'),defaultName);
  if(requested===null)return;
  const filename=safeProjectName(requested)+'.archaeoplan';

  try{
    transform.detach();
    setStatus(tr('preparingProject'));
    const manifest={
      format:PROJECT_FORMAT,
      formatVersion:PROJECT_FORMAT_VERSION,
      appVersion:VERSION,
      created:new Date().toISOString(),
      models:[],
      settings:currentProjectSettings()
    };
    const archive={};

    for(let i=0;i<models.length;i++){
      const m=models[i];
      setStatus(tr('savingModel',{i:i+1,n:models.length}));
      const glb=await exportRootAsGlb(m.root);
      const meta=modelMetadata(m,i);
      manifest.models.push(meta);
      archive[meta.file]=new Uint8Array(glb);
      await new Promise(r=>setTimeout(r,0));
    }

    archive['project.json']=strToU8(JSON.stringify(manifest));
    setStatus(tr('packingProject'));
    const packed=zipSync(archive,{level:0});
    const blob=new Blob([packed],{type:'application/zip'});
    preparedProject={blob,filename};
    if(projectSaveDialog?.showModal)projectSaveDialog.showModal();
    else await savePreparedProject();
    if(selectedModel&&!selectedModel.root.userData.locked&&!cropMode&&!measureMode)transform.attach(selectedModel.root);
    setStatus(tr('projectPrepared'));
  }catch(err){
    console.error(err);
    if(selectedModel&&!selectedModel.root.userData.locked&&!cropMode&&!measureMode)transform.attach(selectedModel.root);
    setStatus(tr('saveError',{error:err.message||err}));
  }
}

async function savePreparedProject(){
  if(!preparedProject)return;
  const {blob,filename}=preparedProject;
  try{
    // Chromium/desktop: real Save As dialog when supported.
    if(window.showSaveFilePicker){
      const handle=await window.showSaveFilePicker({
        suggestedName:filename,
        types:[{description:'ArchaeoPlan project',accept:{'application/zip':['.archaeoplan']}}]
      });
      const writable=await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      projectSaveDialog?.close();
      preparedProject=null;
      setStatus(tr('projectSaved',{name:filename}));
      return;
    }

    // iPad/iPhone Safari: native share sheet; choose "Save to Files" and destination there.
    const file=new File([blob],filename,{type:'application/zip'});
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      await navigator.share({files:[file],title:'ArchaeoPlan'});
      projectSaveDialog?.close();
      preparedProject=null;
      setStatus(tr('savedToFiles'));
      return;
    }

    // Last-resort browser download.
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=filename;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    projectSaveDialog?.close();
    preparedProject=null;
    setStatus(tr('downloaded'));
  }catch(err){
    if(err?.name==='AbortError')return;
    console.error(err);
    setStatus(tr('saveError',{error:err.message||err}));
  }
}

function parseGlbBytes(bytes){
  return new Promise((resolve,reject)=>{
    const loader=new GLTFLoader();
    const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    loader.parse(buffer,'',gltf=>resolve(gltf.scene),reject);
  });
}
function clearProjectWorkspace(){
  cancelCrop();
  clearMeasurement();
  transform.detach();
  models.forEach(m=>scene.remove(m.root));
  models.length=0;
  if(underlay){scene.remove(underlay);underlay.geometry.dispose();underlay.material.map?.dispose();underlay.material.dispose();underlay=null;underlayImageData=null;underlaySelected=false}
  selectedModel=null;
  modelNumber=1;
  releaseAllObjectUrls();
  savedViews=[];
  undoStack.length=0;
  redoStack.length=0;
  updateHistoryButtons();
}
async function restoreProjectSettings(settings){
  if(!settings)return;
  if(settings.language&&I18N[settings.language])applyLanguage(settings.language);
  grid.visible=settings.gridVisible!==false;
  $('gridToggle').checked=grid.visible;

  savedViews=Array.isArray(settings.savedViews)?settings.savedViews:[];
  renderSavedViews();

  const ex=settings.export||{};
  if(ex.ratio!=null)$('exportRatio').value=ex.ratio;
  if(ex.preset!=null)$('exportPreset').value=ex.preset;
  if(ex.width!=null)$('exportWidth').value=ex.width;
  if(ex.height!=null)$('exportHeight').value=ex.height;
  $('showScaleBar').checked=!!ex.showScaleBar;
  if(ex.scaleBarLength!=null)$('scaleBarLength').value=ex.scaleBarLength;
  if(ex.scaleBarPosition!=null)$('scaleBarPosition').value=ex.scaleBarPosition;
  $('showNorthArrow').checked=!!ex.showNorthArrow;
  if(ex.northAngle!=null)$('northAngle').value=ex.northAngle;
  if(ex.northPosition!=null)$('northPosition').value=ex.northPosition;

  exportFrameVisible=!!ex.frameVisible;
  exportFrame.classList.toggle('active',exportFrameVisible);
  $('toggleExportFrameButton').textContent=exportFrameVisible?tr('hideExportFrame'):tr('showExportFrame');
  updateExportFrame();

  if(settings.currentView)applyViewState(settings.currentView);

  if(settings.underlay)await restoreUnderlay(settings.underlay);else updateUnderlayUi();
  if(settings.unwrap){$('unwrapAxis').value=settings.unwrap.axis||'y';$('unwrapWidth').value=settings.unwrap.width||'12000';unwrapStartAngle=Number.isFinite(settings.unwrap.start)?settings.unwrap.start:null;unwrapEndAngle=Number.isFinite(settings.unwrap.end)?settings.unwrap.end:null;unwrapReverse=!!settings.unwrap.reverse;
    unwrapAreaPoints=Array.isArray(settings.unwrap.area)?settings.unwrap.area:[];unwrapBandTop=Number.isFinite(settings.unwrap.bandTop)?settings.unwrap.bandTop:0;unwrapBandBottom=Number.isFinite(settings.unwrap.bandBottom)?settings.unwrap.bandBottom:1;updateUnwrapStatus();}

  const selectedIndex=Number.isInteger(settings.selectedIndex)?settings.selectedIndex:-1;
  selectModel(selectedIndex>=0&&selectedIndex<models.length?models[selectedIndex]:(models[0]||null));

  clearMeasurement();
  if(Array.isArray(settings.measurement)){
    for(const p of settings.measurement.slice(0,2)){
      if(Array.isArray(p)&&p.length>=3)addMeasurePoint(new THREE.Vector3(p[0],p[1],p[2]));
    }
  }
  updateExportAnnotations();
}
async function openProjectFile(file){
  if(!file)return;
  try{
    setStatus(tr('openingProject'));
    const bytes=new Uint8Array(await file.arrayBuffer());
    const archive=unzipSync(bytes);
    if(!archive['project.json'])throw new Error('project.json mangler i projektfilen.');
    const manifest=JSON.parse(strFromU8(archive['project.json']));
    if(manifest.format!==PROJECT_FORMAT)throw new Error('Filen er ikke et ArchaeoPlan-projekt.');
    if(manifest.formatVersion>PROJECT_FORMAT_VERSION)throw new Error('Projektfilen er lavet i en nyere ArchaeoPlan-version.');

    if(models.length&&!window.confirm(tr('replaceProjectConfirm'))){
      projectInput.value='';
      setStatus(tr('openingCancelled'));
      return;
    }

    // Parse all model data before replacing the current workspace.
    const prepared=[];
    for(let i=0;i<(manifest.models||[]).length;i++){
      const meta=manifest.models[i];
      const modelBytes=archive[meta.file];
      if(!modelBytes)throw new Error(`Modeldata mangler: ${meta.file}`);
      setStatus(tr('openingModel',{i:i+1,n:manifest.models.length}));
      const root=await parseGlbBytes(modelBytes);
      prepared.push({root,meta});
      await new Promise(r=>setTimeout(r,0));
    }

    clearProjectWorkspace();

    for(const item of prepared){
      const {root,meta}=item;
      const m=addModel(root,meta.name,{prepared:true,cropped:!!meta.cropped,frame:false});
      root.position.fromArray(meta.position||[0,0,0]);
      root.quaternion.fromArray(meta.quaternion||[0,0,0,1]);
      root.scale.fromArray(meta.scale||[1,1,1]);
      root.visible=meta.visible!==false;
      root.userData.locked=!!meta.locked;
      root.updateMatrixWorld(true);
      m.name=meta.name||m.name;
    }

    await restoreProjectSettings(manifest.settings||{});
    rebuildModelList();
    syncTransformFields();
    updateCropButtons();
    projectInput.value='';
    setStatus(tr('projectOpened',{name:file.name}));
  }catch(err){
    console.error(err);
    projectInput.value='';
    setStatus(tr('openError',{error:err.message||err}));
  }
}

// ---------- Undo / Redo ----------
const undoStack=[],redoStack=[];
let transformStartState=null;
function cloneTransformState(model){
  return model?{
    model,
    position:model.root.position.clone(),
    rotation:model.root.rotation.clone(),
    scale:model.root.scale.clone()
  }:null;
}
function applyTransformState(s){
  if(!s||!s.model||!models.includes(s.model))return;
  s.model.root.position.copy(s.position);
  s.model.root.rotation.copy(s.rotation);
  s.model.root.scale.copy(s.scale);
  s.model.root.updateMatrixWorld(true);
  if(selectedModel===s.model)syncTransformFields();
}
function sameTransform(a,b){
  return a&&b&&a.position.equals(b.position)&&
    a.rotation.x===b.rotation.x&&a.rotation.y===b.rotation.y&&a.rotation.z===b.rotation.z&&
    a.scale.equals(b.scale);
}
function updateHistoryButtons(){
  $('undoButton').disabled=!undoStack.length;
  $('redoButton').disabled=!redoStack.length;
}
function pushHistory(action){
  undoStack.push(action);
  if(undoStack.length>50)undoStack.shift();
  redoStack.length=0;
  updateHistoryButtons();
}
function undo(){
  const a=undoStack.pop();if(!a)return;
  a.undo();redoStack.push(a);updateHistoryButtons();setStatus(tr('undone',{label:a.label}));
}
function redo(){
  const a=redoStack.pop();if(!a)return;
  a.redo();undoStack.push(a);updateHistoryButtons();setStatus(tr('redone',{label:a.label}));
}


$('unwrapSelectAreaButton').onclick=beginUnwrapArea;
$('unwrapClearAreaButton').onclick=clearUnwrapArea;
$('unwrapPreviewButton').onclick=createUnwrapPreview;
$('unwrapPreviewCloseButton').onclick=()=>unwrapPreviewDialog.close();
$('unwrapExportBandButton').onclick=()=>exportUnwrapBand(false);
$('unwrapExportFullButton').onclick=()=>exportUnwrapBand(true);
attachBandHandle($('unwrapBandTopHandle'),true);
attachBandHandle($('unwrapBandBottomHandle'),false);

$('saveFriezePngButton').onclick=downloadPreparedFrieze;
$('shareFriezeButton').onclick=sharePreparedFrieze;
$('cancelFriezeSaveButton').onclick=()=>{friezeSaveDialog.close();preparedFrieze=null;};
$('unwrapStartButton').onclick=()=>beginUnwrapPick('start');
$('unwrapEndButton').onclick=()=>beginUnwrapPick('end');
$('unwrapFullButton').onclick=resetUnwrapFull;
$('unwrapReverseButton').onclick=reverseUnwrap;
$('unwrapAxis').onchange=()=>{unwrapStartAngle=null;unwrapEndAngle=null;updateUnwrapStatus();};

$('loadUnderlayButton').onclick=()=>underlayInput.click();
underlayInput.onchange=e=>loadUnderlayFile(e.target.files?.[0]);
$('removeUnderlayButton').onclick=removeUnderlay;
$('underlayMoveButton').onclick=()=>selectUnderlayForTransform('translate');
$('underlayRotateButton').onclick=()=>selectUnderlayForTransform('rotate');
$('underlayLockButton').onclick=toggleUnderlayLock;
$('underlayScale').onchange=setUnderlayScale;
$('underlayOpacity').oninput=setUnderlayOpacity;
$('underlayVisible').onchange=e=>{if(underlay)underlay.visible=e.target.checked};
$('underlayExport').onchange=e=>{if(underlay)underlay.userData.includeInExport=e.target.checked};

$('saveViewButton').onclick=saveView;$('clearViewsButton').onclick=clearViews;
['showScaleBar','scaleBarLength','scaleBarPosition','showNorthArrow','northPosition'].forEach(id=>$(id).addEventListener('change',()=>{if(id==='showScaleBar'&&$('showScaleBar').checked&&!camera.isOrthographicCamera)setStatus(tr('orthoScaleOnly'));updateExportAnnotations()}));$('northAngle').addEventListener('input',updateExportAnnotations);
$('measureButton').onclick=toggleMeasure;
$('clearMeasureButton').onclick=clearMeasurement;

$('toggleExportFrameButton').onclick=toggleExportFrame;
$('fitToExportFrameButton').onclick=fitToExportFrame;
$('exportPngButton').onclick=savePng;
$('shareImageButton').onclick=shareImage;

$('exportRatio').onchange=()=>syncExportDimensions('ratio');
$('exportPreset').onchange=()=>syncExportDimensions('preset');
$('exportWidth').onchange=()=>syncExportDimensions('width');
$('exportHeight').onchange=()=>syncExportDimensions('height');

$('newProjectButton').onclick=newProject;
$('saveProjectButton').onclick=saveProject;
languageSelect.onchange=e=>applyLanguage(e.target.value);
$('chooseProjectLocationButton').onclick=savePreparedProject;
$('cancelProjectSaveButton').onclick=()=>{projectSaveDialog.close();preparedProject=null;setStatus(tr('openingCancelled'));};
$('openProjectButton').onclick=()=>projectInput.click();
projectInput.onchange=e=>openProjectFile(e.target.files?.[0]);
$('undoButton').onclick=undo;$('redoButton').onclick=redo;$('fitModelButton').onclick=fitSelectedModel;$('addFileButton').onclick=()=>fileInput.click();fileInput.onchange=e=>loadFiles(e.target.files);
$('perspectiveButton').onclick=()=>switchCamera(false);$('orthographicButton').onclick=()=>switchCamera(true);$('gridToggle').onchange=e=>grid.visible=e.target.checked;
$('translateButton').onclick=()=>{transform.setMode('translate');$('translateButton').classList.add('active');$('rotateButton').classList.remove('active')};
$('rotateButton').onclick=()=>{transform.setMode('rotate');$('rotateButton').classList.add('active');$('translateButton').classList.remove('active')};
$('lockButton').onclick=()=>{if(selectedModel)setModelLock(selectedModel,!selectedModel.root.userData.locked)};
$('freehandCropButton').onclick=()=>setCropTool('freehand');$('polygonCropButton').onclick=()=>setCropTool('polygon');$('startCropButton').onclick=startCrop;$('cancelCropButton').onclick=cancelCrop;$('cropInsideButton').onclick=()=>applyCrop(true);$('cropOutsideButton').onclick=()=>applyCrop(false);
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setStandardView(b.dataset.view));

['dragenter','dragover'].forEach(n=>viewport.addEventListener(n,e=>{e.preventDefault();$('dropZone').classList.add('show')}));
['dragleave','drop'].forEach(n=>viewport.addEventListener(n,e=>{e.preventDefault();$('dropZone').classList.remove('show')}));
viewport.addEventListener('drop',e=>loadFiles(e.dataTransfer.files));

cropInputLayer.addEventListener('pointerdown',down,{passive:false,capture:true});
cropInputLayer.addEventListener('pointermove',move,{passive:false,capture:true});
cropInputLayer.addEventListener('pointerup',up,{passive:false,capture:true});
cropInputLayer.addEventListener('pointercancel',up,{passive:false,capture:true});
['touchstart','touchmove','touchend','gesturestart','gesturechange','gestureend'].forEach(n=>cropInputLayer.addEventListener(n,e=>{if(cropMode){e.preventDefault();e.stopPropagation()}},{passive:false,capture:true}));
cropInputLayer.addEventListener('contextmenu',e=>e.preventDefault());

window.addEventListener('resize',resize);resize();resetViewToOrigin(false);renderSavedViews();updateExportAnnotations();updateCropButtons();updateHistoryButtons();updateUnderlayUi();updateUnwrapStatus();
applyLanguage(currentLanguage);
setStatus(tr('ready',{version:VERSION}));
(function animate(){requestAnimationFrame(animate);orbit.update();updateMeasureLabel();renderer.render(scene,camera)})();
