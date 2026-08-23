import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

// ArchaeoPlan 0.2.12-clean
// Cleanup release based directly on the tested 0.2.11 behavior.

const VERSION='0.2.14';
const $=id=>document.getElementById(id);
const viewport=$('viewport'),status=$('status'),fileInput=$('fileInput'),modelList=$('modelList');
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

function setStatus(t){status.textContent=t}
function releaseAllObjectUrls(){for(const u of liveObjectUrls)URL.revokeObjectURL(u);liveObjectUrls.clear()}

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

function addModel(root,name,{prepared=false,cropped=false,frame=true}={}){
  root.name=name||`Model ${modelNumber}`;root.userData.locked=false;
  if(!prepared)prepareDocumentationMaterials(root);
  scene.add(root);
  const model={id:modelNumber++,name:root.name,root,cropped};
  models.push(model);selectModel(model);rebuildModelList();
  if(frame)frameCurrentView();
  setStatus(`Indlæst: ${model.name}`);
  return model;
}
function selectModel(m){
  selectedModel=m;transform.detach();
  if(m&&!m.root.userData.locked&&!cropMode)transform.attach(m.root);
  rebuildModelList();syncTransformFields();updateCropButtons();
}
function rebuildModelList(){
  modelList.innerHTML='';
  if(!models.length){modelList.innerHTML='<p class="muted">Ingen modeller åbnet.</p>';return}
  models.forEach(m=>{
    const row=document.createElement('div');row.className='model-row'+(m===selectedModel?' selected':'');
    const vis=document.createElement('input');vis.type='checkbox';vis.checked=m.root.visible;vis.onchange=()=>m.root.visible=vis.checked;
    const name=document.createElement('div');name.className='model-name';name.textContent=(m.cropped?'✂ ':'')+m.name;name.onclick=()=>selectModel(m);
    const lock=document.createElement('button');lock.className='model-lock'+(m.root.userData.locked?' locked':'');lock.textContent=m.root.userData.locked?'🔒':'🔓';lock.title=m.root.userData.locked?'Lås op':'Lås model';lock.onclick=e=>{e.stopPropagation();setModelLock(m,!m.root.userData.locked)};
    const del=document.createElement('button');del.className='model-delete';del.textContent='×';del.onclick=()=>{if(selectedModel===m)selectModel(null);scene.remove(m.root);models.splice(models.indexOf(m),1);rebuildModelList()};
    row.append(vis,name,lock,del);modelList.append(row);
  });
}

function setModelLock(m,locked){
  if(!m)return;
  m.root.userData.locked=!!locked;
  if(selectedModel===m){transform.detach();if(!locked&&!cropMode&&!measureMode)transform.attach(m.root)}
  rebuildModelList();syncTransformFields();updateCropButtons();setStatus(locked?'Modellen er låst.':'Modellen er låst op.');
}
function selectedEditable(){
  if(!selectedModel){setStatus('Vælg først en model.');return false}
  if(selectedModel.root.userData.locked){setStatus('Modellen er låst.');return false}
  return true;
}
function syncTransformFields(){
  ['posX','posY','posZ','rotX','rotY','rotZ'].forEach(id=>$(id).disabled=!selectedModel||selectedModel.root.userData.locked);
  if(!selectedModel){$('lockButton').textContent='Lås';return}
  const p=selectedModel.root.position,r=selectedModel.root.rotation;
  $('posX').value=p.x.toFixed(3);$('posY').value=p.y.toFixed(3);$('posZ').value=p.z.toFixed(3);
  $('rotX').value=THREE.MathUtils.radToDeg(r.x).toFixed(2);$('rotY').value=THREE.MathUtils.radToDeg(r.y).toFixed(2);$('rotZ').value=THREE.MathUtils.radToDeg(r.z).toFixed(2);
  $('lockButton').textContent=selectedModel.root.userData.locked?'Lås op':'Lås';
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
  if(!box){setStatus('Ingen model at tilpasse.');return}
  fitCameraToBox(box);
  setStatus('Valgt model tilpasset og centreret.');
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
  setStatus(`${name}: centreret`);
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
  if(!mains.length){setStatus('Vælg en model-fil.');return}
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
    }catch(err){console.error(err);setStatus(`Fejl ved ${f.name}: ${err.message||err}`)}
  }
  fileInput.value='';
}

function newProject(){
  if(models.length&&!confirm('Opret nyt projekt og fjern modellerne fra arbejdsfladen?'))return;
  cancelCrop();transform.detach();models.forEach(m=>scene.remove(m.root));models.length=0;selectedModel=null;modelNumber=1;releaseAllObjectUrls();
  undoStack.length=0;redoStack.length=0;updateHistoryButtons();rebuildModelList();syncTransformFields();resetViewToOrigin();setStatus('Nyt tomt projekt – centrum (0,0,0).');
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
  setStatus(`${tool==='freehand'?'Frihånd':'Polygon'} valgt.`);
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
  updateCropButtons();redrawCrop();setStatus('Beskæring aktiv.');
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
  cropLine.setAttribute('points',pts);cropPolygon.setAttribute('points',cropPoints.length>=3?pts:'');cropPointsGroup.innerHTML='';
  for(const p of cropPoints){const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('cx',p.x);c.setAttribute('cy',p.y);c.setAttribute('r',5);cropPointsGroup.appendChild(c)}
}
function pointFromEvent(e){const r=cropInputLayer.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function down(e){
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
  if(!cropMode||cropTool!=='freehand'||!cropDrawing||e.pointerId!==cropPointerId)return;e.preventDefault();
  const p=pointFromEvent(e),last=cropPoints[cropPoints.length-1];
  if(!last||Math.hypot(p.x-last.x,p.y-last.y)>=4){cropPoints.push(p);redrawCrop();updateCropButtons()}
}
function up(e){
  if(!cropMode||cropTool!=='freehand'||!cropDrawing||e.pointerId!==cropPointerId)return;e.preventDefault();
  cropDrawing=false;cropInputLayer.releasePointerCapture?.(e.pointerId);cropPointerId=null;redrawCrop();updateCropButtons();
  if(cropPoints.length>=3)setStatus('Strøg gemt. Fortsæt et andet sted, eller vælg Behold/Fjern.');
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
function cropGeometry(mesh,poly,keepInside){
  const g=mesh.geometry,pos=g.attributes?.position;if(!pos)return;
  const idx=g.index?Array.from(g.index.array):Array.from({length:pos.count},(_,i)=>i);
  mesh.updateWorldMatrix(true,false);
  const kept=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),cent=new THREE.Vector3();
  for(let i=0;i+2<idx.length;i+=3){
    a.fromBufferAttribute(pos,idx[i]).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(pos,idx[i+1]).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(pos,idx[i+2]).applyMatrix4(mesh.matrixWorld);
    cent.copy(a).add(b).add(c).multiplyScalar(1/3);
    const inside=inPolygon(screenPoint(cent),poly);
    if(keepInside?inside:!inside)kept.push(idx[i],idx[i+1],idx[i+2]);
  }
  g.setIndex(kept);g.computeBoundingBox();g.computeBoundingSphere();
}
function applyCrop(keepInside){
  if(!selectedEditable()||cropPoints.length<3)return;
  const original=selectedModel,clone=original.root.clone(true);
  clone.traverse(o=>{if(o.isMesh&&o.geometry)o.geometry=o.geometry.clone()});
  clone.traverse(o=>{if(o.isMesh)cropGeometry(o,cropPoints,keepInside)});
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
  cancelCrop();selectModel(m);setStatus('Beskåret kopi oprettet. Originalen er bevaret og skjult.');
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
function snapshotView(){return {name:'',ortho:camera.isOrthographicCamera,position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),up:camera.up.toArray(),target:orbit.target.toArray(),zoom:camera.zoom,fov:camera.isPerspectiveCamera?camera.fov:null,ratio:$('exportRatio').value,width:$('exportWidth').value,height:$('exportHeight').value};}
function saveView(){const s=snapshotView(),suggested=`Visning ${savedViews.length+1}`;const n=prompt('Navn på visningen:',suggested);if(n===null)return;s.name=n.trim()||suggested;savedViews.push(s);renderSavedViews();setStatus(`Visning "${s.name}" gemt.`)}
function restoreView(i){const s=savedViews[i];if(!s)return;if(camera.isOrthographicCamera!==s.ortho)switchCamera(s.ortho);camera.position.fromArray(s.position);camera.quaternion.fromArray(s.quaternion);camera.up.fromArray(s.up);orbit.target.fromArray(s.target);camera.zoom=s.zoom||1;if(camera.isPerspectiveCamera&&s.fov)camera.fov=s.fov;camera.updateProjectionMatrix();orbit.update();$('exportRatio').value=s.ratio;$('exportWidth').value=s.width;$('exportHeight').value=s.height;updateExportFrame();setStatus(`Visning "${s.name}" hentet.`)}
function deleteView(i){savedViews.splice(i,1);renderSavedViews()}
function clearViews(){if(!savedViews.length)return;if(confirm('Ryd alle gemte visninger?')){savedViews=[];renderSavedViews();setStatus('Gemte visninger ryddet.')}}
function renderSavedViews(){const list=$('savedViewsList');if(!list)return;list.innerHTML='';if(!savedViews.length){list.innerHTML='<p class="muted small">Ingen gemte visninger.</p>';return}savedViews.forEach((v,i)=>{const row=document.createElement('div');row.className='saved-view-row';const n=document.createElement('div');n.className='saved-view-name';n.textContent=v.name;const go=document.createElement('button');go.textContent='Hent';go.onclick=()=>restoreView(i);const del=document.createElement('button');del.textContent='×';del.onclick=()=>deleteView(i);row.append(n,go,del);list.append(row)})}

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
    setStatus('Måling aktiv: tryk to punkter på modellen.');
  }else{
    if(selectedModel&&!selectedModel.root.userData.locked)transform.attach(selectedModel.root);
    setStatus('Måling afsluttet.');
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
    setStatus(`Måling: ${txt}`);
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
  if(!measureMode||cropMode)return;
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
  $('toggleExportFrameButton').textContent=exportFrameVisible?'Skjul eksport-ramme':'Vis eksport-ramme';
  if(exportFrameVisible){syncExportDimensions();updateExportFrame()}
}
function fitToExportFrame(){
  if(!selectedModel){setStatus('Vælg først en model.');return}
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
  setStatus('Model tilpasset eksport-rammen.');
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

async function renderExportBlob(){
  const outW=Math.max(200,Math.min(12000,parseInt($('exportWidth').value)||3000));
  const outH=Math.max(200,Math.min(12000,parseInt($('exportHeight').value)||2000));
  const frame=exportFrameRect();

  const oldSize=new THREE.Vector2();renderer.getSize(oldSize);
  const oldPR=renderer.getPixelRatio();
  const oldAspect=perspectiveCamera.aspect;
  const oldOrtho={l:orthographicCamera.left,r:orthographicCamera.right,t:orthographicCamera.top,b:orthographicCamera.bottom};

  // Match output aspect to export frame without changing camera target.
  renderer.setPixelRatio(1);
  renderer.setSize(outW,outH,false);

  const ratio=outW/outH;
  if(camera.isPerspectiveCamera){
    perspectiveCamera.aspect=ratio;
  }else{
    const cy=(camera.top+camera.bottom)/2;
    const hh=(camera.top-camera.bottom)/2;
    const cx=(camera.left+camera.right)/2;
    const hw=hh*ratio;
    camera.left=cx-hw;camera.right=cx+hw;camera.top=cy+hh;camera.bottom=cy-hh;
  }
  camera.updateProjectionMatrix();

  const gridWasVisible=grid.visible;
  renderer.render(scene,camera);

  const blob=await new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/png'));

  renderer.setPixelRatio(oldPR);
  renderer.setSize(oldSize.x,oldSize.y,false);
  perspectiveCamera.aspect=oldAspect;
  Object.assign(orthographicCamera,{left:oldOrtho.l,right:oldOrtho.r,top:oldOrtho.t,bottom:oldOrtho.b});
  camera.updateProjectionMatrix();
  return await drawAnnotationsOnBlob(blob,outW,outH);
}
async function savePng(){
  const blob=await renderExportBlob();
  if(!blob)return;
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`ArchaeoPlan-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.png`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  setStatus('PNG eksporteret.');
}
async function shareImage(){
  const blob=await renderExportBlob();
  if(!blob)return;
  const file=new File([blob],'ArchaeoPlan.png',{type:'image/png'});
  if(navigator.canShare?.({files:[file]}) && navigator.share){
    try{
      await navigator.share({files:[file],title:'ArchaeoPlan'});
      setStatus('Billede sendt til iOS deleark.');
      return;
    }catch(err){
      if(err?.name==='AbortError')return;
    }
  }
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='ArchaeoPlan.png';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  setStatus('Deling understøttes ikke her – PNG blev gemt i stedet.');
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
  a.undo();redoStack.push(a);updateHistoryButtons();setStatus(`Fortrudt: ${a.label}`);
}
function redo(){
  const a=redoStack.pop();if(!a)return;
  a.redo();undoStack.push(a);updateHistoryButtons();setStatus(`Gentaget: ${a.label}`);
}


$('saveViewButton').onclick=saveView;$('clearViewsButton').onclick=clearViews;
['showScaleBar','scaleBarLength','scaleBarPosition','showNorthArrow','northPosition'].forEach(id=>$(id).addEventListener('change',()=>{if(id==='showScaleBar'&&$('showScaleBar').checked&&!camera.isOrthographicCamera)setStatus('Målestok er kun metrisk korrekt i ortografisk visning.');updateExportAnnotations()}));$('northAngle').addEventListener('input',updateExportAnnotations);
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

$('newProjectButton').onclick=newProject;$('undoButton').onclick=undo;$('redoButton').onclick=redo;$('fitModelButton').onclick=fitSelectedModel;$('addFileButton').onclick=()=>fileInput.click();fileInput.onchange=e=>loadFiles(e.target.files);
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

window.addEventListener('resize',resize);resize();resetViewToOrigin(false);renderSavedViews();updateExportAnnotations();updateCropButtons();updateHistoryButtons();setStatus(`ArchaeoPlan v${VERSION} klar.`);
(function animate(){requestAnimationFrame(animate);orbit.update();updateMeasureLabel();renderer.render(scene,camera)})();
