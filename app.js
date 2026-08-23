import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

const VERSION='0.2.8';
const $=id=>document.getElementById(id);
const viewport=$('viewport'),status=$('status'),fileInput=$('fileInput'),modelList=$('modelList');
const cropInputLayer=$('cropInputLayer'),cropOverlay=$('cropOverlay'),cropLine=$('cropLine'),cropPolygon=$('cropPolygon'),cropPointsGroup=$('cropPoints'),cropHint=$('cropHint');

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xd6d9dc);

const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NoToneMapping;
viewport.prepend(renderer.domElement);

const perspectiveCamera=new THREE.PerspectiveCamera(45,1,.001,1e7);
perspectiveCamera.position.set(5,5,5);
const orthographicCamera=new THREE.OrthographicCamera(-5,5,5,-5,-1e7,1e7);
orthographicCamera.position.set(5,5,5);
let camera=perspectiveCamera;

function createOrbit(cam){
  const o=new OrbitControls(cam,renderer.domElement);
  o.enableDamping=true;o.dampingFactor=.08;o.screenSpacePanning=true;o.enablePan=true;
  o.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
  return o;
}
let orbit=createOrbit(camera);

const transform=new TransformControls(camera,renderer.domElement);
transform.setMode('translate');
transform.addEventListener('dragging-changed',e=>{
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

function addModel(root,name,{prepared=false,cropped=false}={}){
  root.name=name||`Model ${modelNumber}`;root.userData.locked=false;
  if(!prepared)prepareDocumentationMaterials(root);
  scene.add(root);
  const model={id:modelNumber++,name:root.name,root,cropped};
  models.push(model);selectModel(model);rebuildModelList();
  frameCurrentView();
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
    const del=document.createElement('button');del.className='model-delete';del.textContent='×';del.onclick=()=>{if(selectedModel===m)selectModel(null);scene.remove(m.root);models.splice(models.indexOf(m),1);rebuildModelList()};
    row.append(vis,name,del);modelList.append(row);
  });
}

function syncTransformFields(){
  ['posX','posY','posZ','rotX','rotY','rotZ'].forEach(id=>$(id).disabled=!selectedModel);
  if(!selectedModel){$('lockButton').textContent='Lås';return}
  const p=selectedModel.root.position,r=selectedModel.root.rotation;
  $('posX').value=p.x.toFixed(3);$('posY').value=p.y.toFixed(3);$('posZ').value=p.z.toFixed(3);
  $('rotX').value=THREE.MathUtils.radToDeg(r.x).toFixed(2);$('rotY').value=THREE.MathUtils.radToDeg(r.y).toFixed(2);$('rotZ').value=THREE.MathUtils.radToDeg(r.z).toFixed(2);
  $('lockButton').textContent=selectedModel.root.userData.locked?'Lås op':'Lås';
}
function applyTransformFields(){
  if(!selectedModel)return;const n=id=>parseFloat($(id).value)||0;
  selectedModel.root.position.set(n('posX'),n('posY'),n('posZ'));
  selectedModel.root.rotation.set(THREE.MathUtils.degToRad(n('rotX')),THREE.MathUtils.degToRad(n('rotY')),THREE.MathUtils.degToRad(n('rotZ')));
}
['posX','posY','posZ','rotX','rotY','rotZ'].forEach(id=>$(id).addEventListener('change',()=>{
  if(!selectedModel)return;
  const before=cloneTransformState(selectedModel);
  applyTransformFields();
  const after=cloneTransformState(selectedModel);
  if(!sameTransform(before,after))pushHistory({
    label:'ændr model',
    undo:()=>applyTransformState(before),
    redo:()=>applyTransformState(after)
  });
}));


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
  frameCurrentView();
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
  undoStack.length=0;redoStack.length=0;updateHistoryButtons();rebuildModelList();syncTransformFields();setStatus('Nyt tomt projekt.');
}

function updateCropButtons(){
  $('startCropButton').disabled=!selectedModel||cropMode;
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
  if(!selectedModel){setStatus('Vælg først en model.');return}
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
  if(!selectedModel||cropPoints.length<3)return;
  const original=selectedModel,clone=original.root.clone(true);
  clone.traverse(o=>{if(o.isMesh&&o.geometry)o.geometry=o.geometry.clone()});
  clone.traverse(o=>{if(o.isMesh)cropGeometry(o,cropPoints,keepInside)});
  const originalWasVisible=original.root.visible;
  original.root.visible=false;
  const m=addModel(clone,`${original.name} – beskåret`,{prepared:true,cropped:true});
  pushHistory({
    label:'beskæring',
    undo:()=>{
      scene.remove(m.root);
      const i=models.indexOf(m);if(i>=0)models.splice(i,1);
      original.root.visible=originalWasVisible;
      selectModel(original);rebuildModelList();frameCurrentView();
    },
    redo:()=>{
      if(!models.includes(m)){models.push(m);scene.add(m.root)}
      original.root.visible=false;
      selectModel(m);rebuildModelList();frameCurrentView();
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
  const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h,false);perspectiveCamera.aspect=w/Math.max(h,1);perspectiveCamera.updateProjectionMatrix();
  cropOverlay.setAttribute('viewBox',`0 0 ${w} ${h}`);
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

$('newProjectButton').onclick=newProject;$('undoButton').onclick=undo;$('redoButton').onclick=redo;$('fitModelButton').onclick=fitSelectedModel;$('addFileButton').onclick=()=>fileInput.click();fileInput.onchange=e=>loadFiles(e.target.files);$('exportButton').onclick=exportPng;
$('perspectiveButton').onclick=()=>switchCamera(false);$('orthographicButton').onclick=()=>switchCamera(true);$('gridToggle').onchange=e=>grid.visible=e.target.checked;
$('translateButton').onclick=()=>{transform.setMode('translate');$('translateButton').classList.add('active');$('rotateButton').classList.remove('active')};
$('rotateButton').onclick=()=>{transform.setMode('rotate');$('rotateButton').classList.add('active');$('translateButton').classList.remove('active')};
$('lockButton').onclick=()=>{if(!selectedModel)return;selectedModel.root.userData.locked=!selectedModel.root.userData.locked;transform.detach();if(!selectedModel.root.userData.locked&&!cropMode)transform.attach(selectedModel.root);syncTransformFields()};
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

window.addEventListener('resize',resize);resize();updateCropButtons();updateHistoryButtons();setStatus(`ArchaeoPlan v${VERSION} klar.`);
(function animate(){requestAnimationFrame(animate);orbit.update();renderer.render(scene,camera)})();
