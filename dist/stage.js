import * as THREE from './vendor/three.module.js';
import { CASE, HALF, HINGE, discGeometry, lidGeometry, trayGeometry } from './caseGeometry.js';
import {
  BACKDROP_FRAG,
  BACKDROP_VERT,
  BRIGHT_FRAG,
  COPY_FRAG,
  DISC_FRAG,
  DISC_VERT,
  FINAL_FRAG,
  ROD_FRAG,
  ROD_VERT,
  ROOM_BAKE_FRAG,
  SCREEN_VERT,
  SHEET_FRAG,
  SHEET_VERT,
  STREAK_FRAG,
} from './shaders.js';

const FOV = 28;
const IOR = 1.59;
const ABSORB = [0.0042, 0.003, 0.0026];
const DEPTH = 14;
const BACKDROP_Z = -70;
const LIGHT = new THREE.Vector3(-0.3, 0.48, 1).normalize();
const SPIN = THREE.MathUtils.degToRad(18);
const SPIN_EASE = 0.9;
const FIT = 0.6;
const DOCK_CLEAR = 84;
const MSAA = 4;
const ROOM_SIZE = 512;
const STARS = 0.48;
const STAR_THRESHOLD = 2.0;

const REST = 2.6;
const AGAIN = 5.5;
const OPEN_HOLD = 0.25;

const GRAB_RATE = 0.008;
const GRAB_YAW = 0.9;
const GRAB_TILT = 0.45;
const GRAB_K = 16;
const GRAB_C = 5.5;
const TAP_SLOP = 6;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const clamp01 = (x) => clamp(x, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function curve(frames) {
  const n = frames.length;
  const ts = frames.map((f) => f[0]);
  const vs = frames.map((f) => f[1]);
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((vs[i + 1] - vs[i]) / (ts[i + 1] - ts[i]));
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return (t) => {
    if (t <= ts[0]) return vs[0];
    if (t >= ts[n - 1]) return vs[n - 1];
    let i = 0;
    while (t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i];
    const u = (t - ts[i]) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    return (
      (2 * u3 - 3 * u2 + 1) * vs[i] +
      (u3 - 2 * u2 + u) * h * m[i] +
      (-2 * u3 + 3 * u2) * vs[i + 1] +
      (u3 - u2) * h * m[i + 1]
    );
  };
}

const OPEN_ANGLE = 3.05;
const OPEN_T = 2.3;
const OPEN = {
  yaw: curve([
    [0, 0],
    [0.55, 0.3],
    [1.0, 0.85],
    [1.2, 2.0],
    [1.41, 3.4],
    [1.63, 4.9],
    [1.85, 6.05],
    [2.05, 6.36],
    [2.3, 2 * Math.PI],
  ]),
  lid: curve([
    [0, 0],
    [0.97, 0],
    [1.2, 0.45],
    [1.41, 1.35],
    [1.63, 2.3],
    [1.85, 2.92],
    [2.05, 3.12],
    [2.3, OPEN_ANGLE],
  ]),
  spread: curve([
    [0, 0],
    [1.12, 0],
    [1.9, 0.9],
    [2.3, 1],
  ]),
  pitch: curve([
    [0, 0],
    [1.35, 0],
    [2.3, -0.1],
  ]),
};

const CLOSE_T = 1.95;
const CLOSE = {
  lid: curve([
    [0, OPEN_ANGLE],
    [0.22, 1.75],
    [0.48, 1.55],
    [1.05, 1.08],
    [1.42, 0.6],
    [1.6, 0.26],
    [1.7, 0],
    [1.78, 0.07],
    [1.88, 0],
  ]),
  spread: curve([
    [0, 1],
    [0.3, 0.92],
    [1.2, 0.55],
    [1.72, 0],
  ]),
  yaw: curve([
    [0, 0],
    [0.5, 0.2],
    [1.3, 0.12],
    [1.88, 0],
  ]),
  pitch: curve([
    [0, -0.1],
    [1.6, -0.05],
    [1.7, 0.035],
    [1.82, -0.01],
    [1.95, 0],
  ]),
  roll: curve([
    [0, 0],
    [0.8, -0.05],
    [1.95, 0],
  ]),
};

function sway(t, motion) {
  return {
    y: 1.8 * Math.sin(t * 1.1) * motion,
    yaw: -0.2 + (0.1 * Math.sin(t * 0.9) + 0.03 * Math.sin(t * 2.1)) * motion,
    pitch: -0.12 + 0.045 * Math.sin(t * 0.7) * motion,
    roll: 0.03 + 0.018 * Math.sin(t * 0.5) * motion,
    lid: 0,
    spread: 0,
  };
}

export function createStage(container, disc, { getPaused, getSpin, onOpen, onReady, onFail }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = reduced ? 0.35 : 1;

  const canvas = document.createElement('canvas');
  canvas.className = 'cd-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    'A clear CD jewel case with its disc spinning inside. Tap the case to open it, or drag it to turn it.',
  );
  container.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    canvas.remove();
    onFail?.();
    return null;
  }
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 2), 2.5));
  renderer.autoClear = false;
  renderer.setClearColor(0xffffff, 0);
  const hdr =
    renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const target = (samples) =>
    new THREE.WebGLRenderTarget(1, 1, {
      type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
      samples,
      depthBuffer: samples > 0,
      stencilBuffer: false,
      resolveDepthBuffer: false,
    });
  const rtPage = target(MSAA);
  const rt = [target(MSAA), target(MSAA)];
  const rtBright = target(0);
  const rtStarA = target(0);
  const rtStarB = target(0);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 4000);
  const opaque = new THREE.Scene();
  const glass = new THREE.Scene();
  const hits = new THREE.Scene();

  const disposables = [];
  const track = (d) => {
    disposables.push(d);
    return d;
  };

  const screenCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const screenQuad = track(new THREE.PlaneGeometry(2, 2));
  const pass = (frag, uniforms) => {
    const material = track(
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: SCREEN_VERT,
        fragmentShader: frag,
        depthTest: false,
        depthWrite: false,
      }),
    );
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(screenQuad, material));
    return { scene, material };
  };
  const copyMat = track(
    new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null } },
      vertexShader: SCREEN_VERT,
      fragmentShader: COPY_FRAG,
      depthTest: false,
      depthWrite: false,
    }),
  );
  const copyQuad = new THREE.Mesh(screenQuad, copyMat);
  copyQuad.frustumCulled = false;
  copyQuad.renderOrder = -10;
  const picked = {
    uTex: { value: rtPage.texture },
    uTexInside: { value: rtPage.texture },
    uRect: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
  const bright = pass(BRIGHT_FRAG, {
    ...picked,
    uTexel: { value: new THREE.Vector2() },
    uThreshold: { value: STAR_THRESHOLD },
  });
  const streak = pass(STREAK_FRAG, {
    uTex: { value: null },
    uStep: { value: new THREE.Vector2() },
    uFalloff: { value: 0.7 },
  });
  const final = pass(FINAL_FRAG, {
    ...picked,
    uStarA: { value: rtStarA.texture },
    uStarB: { value: rtStarB.texture },
    uStars: { value: STARS },
    uPixel: { value: new THREE.Vector2() },
  });

  const roomRT = new THREE.WebGLCubeRenderTarget(ROOM_SIZE, {
    type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  const bake = pass(ROOM_BAKE_FRAG, { uFace: { value: 0 }, uSize: { value: ROOM_SIZE } });
  const bakeRoom = () => {
    for (let face = 0; face < 6; face++) {
      bake.material.uniforms.uFace.value = face;
      renderer.setRenderTarget(roomRT, face);
      renderer.render(bake.scene, screenCam);
    }
    renderer.setRenderTarget(null);
  };
  bakeRoom();

  const shadowOf = {
    uVideo: {value:null}, uVideoOpacity:{value:0}, uViewport:{value:new THREE.Vector2(1,1)},
    uLight: { value: LIGHT.clone() },
    uTrayInv: { value: new THREE.Matrix4() },
    uLidInv: { value: new THREE.Matrix4() },
    uScale: { value: 1 },
  };
  const backdrop = new THREE.Mesh(
    track(new THREE.PlaneGeometry(8000, 8000)),
    track(new THREE.ShaderMaterial({ uniforms: shadowOf, vertexShader: BACKDROP_VERT, fragmentShader: BACKDROP_FRAG })),
  );
  backdrop.position.z = BACKDROP_Z;
  opaque.add(backdrop);
  const depthOnly = track(new THREE.MeshBasicMaterial({ colorWrite: false }));
  glass.add(copyQuad);

  const samples = 2;

  const rodMaterial = () =>
    track(
      new THREE.ShaderMaterial({
        uniforms: {
          uBehind: { value: null },
          uRoom: { value: roomRT.texture },
          uRoomSize: { value: ROOM_SIZE },
          uProj: { value: camera.projectionMatrix },
          uDepth: { value: DEPTH },
          uIor: { value: IOR },
          uSamples: { value: samples },
          uAbsorb: { value: new THREE.Vector3(...ABSORB) },
        },
        vertexShader: ROD_VERT,
        fragmentShader: ROD_FRAG,
      }),
    );
  const sheetMaterial = () =>
    track(
      new THREE.ShaderMaterial({
        uniforms: {
          uIor: { value: IOR },
          uAbsorb: { value: new THREE.Vector3(...ABSORB) },
        },
        vertexShader: SHEET_VERT,
        fragmentShader: SHEET_FRAG,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 4,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.ZeroFactor,
        blendDstAlpha: THREE.OneFactor,
      }),
    );

  const fixed = (mesh, scene) => {
    mesh.matrixAutoUpdate = false;
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  };

  const hitPlane = track(new THREE.PlaneGeometry(CASE, CASE));
  const hitMat = track(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));

  function makeShards(material){
    const shards=[];const count=16;
    const point=(r,i)=>{const a=i/count*Math.PI*2;return new THREE.Vector2(r*Math.cos(a),r*Math.sin(a));};
    for(let band=0;band<3;band++)for(let i=0;i<count;i++){
      const inner=15+band*15,outer=inner+15;
      const poly=[point(inner,i),point(outer,i),point(outer,i+.5),point(outer,i+1),point(inner,i+1)];
      const center=poly.reduce((v,p)=>v.add(new THREE.Vector3(p.x,p.y,0)),new THREE.Vector3()).multiplyScalar(1/poly.length);
      const positions=[],normals=[],faces=[];
      const add=(v,z,n,f)=>{positions.push(v.x,v.y,z);normals.push(...n);faces.push(f);};
      for(const tri of THREE.ShapeUtils.triangulateShape(poly,[]))for(const v of tri)add(poly[v],-1.2,[0,0,1],0);
      for(const tri of THREE.ShapeUtils.triangulateShape(poly,[]))for(const v of [...tri].reverse())add(poly[v],-2.4,[0,0,-1],1);
      for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],n=new THREE.Vector2(b.y-a.y,a.x-b.x).normalize();for(const [v,z]of [[a,-1.2],[a,-2.4],[b,-1.2],[b,-1.2],[a,-2.4],[b,-2.4]])add(v,z,[n.x,n.y,0],2);}
      const g=track(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('aFace',new THREE.Float32BufferAttribute(faces,1));g.computeBoundingSphere();
      const mesh=fixed(new THREE.Mesh(g,material),opaque);mesh.frustumCulled=false;
      const seed=Math.sin((i+band*17)*12.9898)*43758.5453;const r=seed-Math.floor(seed);
      shards.push({mesh,center,axis:new THREE.Vector3(Math.cos(i*2),Math.sin(i*3),.5).normalize(),angle:(r-.5)*5,offset:new THREE.Vector3(center.x*(.7+r),center.y*(.7+r),(r-.5)*110)});
    }return shards;
  }
  function buildCase(art) {
    const tray = trayGeometry();
    const lid = lidGeometry();
    const discGeo = discGeometry();
    for (const g of [tray.rods, tray.sheets, lid.rods, lid.sheets, discGeo]) track(g);

    const trayRodMat = rodMaterial();
    const lidRodMat = rodMaterial();
    const discMat = track(
      new THREE.ShaderMaterial({
        uniforms: {
          uArt: { value: art }, uArtZoom:{value:1},
          uArtIn: { value: disc.artIn },
          uPrintOut: { value: disc.printOut },
        },
        vertexShader: DISC_VERT,
        fragmentShader: DISC_FRAG,
      }),
    );

    const jacketMat = track(new THREE.MeshBasicMaterial({map:art, side:THREE.DoubleSide}));
    const jacket = fixed(new THREE.Mesh(track(new THREE.PlaneGeometry(124,124)),jacketMat),opaque);
    const item = {
      jacket, jacketMat, showJacket:false,
      shards:makeShards(discMat),
      trayRods: fixed(new THREE.Mesh(tray.rods, trayRodMat), glass),
      traySheets: fixed(new THREE.Mesh(tray.sheets, sheetMaterial()), glass),
      lidRods: fixed(new THREE.Mesh(lid.rods, lidRodMat), glass),
      lidSheets: fixed(new THREE.Mesh(lid.sheets, sheetMaterial()), glass),
      discMesh: fixed(new THREE.Mesh(discGeo, discMat), opaque),
      discDepth: fixed(new THREE.Mesh(discGeo, depthOnly), glass),
      hitTray: fixed(new THREE.Mesh(hitPlane, hitMat), hits),
      hitLid: fixed(new THREE.Mesh(hitPlane, hitMat), hits),
      trayRodMat,
      lidRodMat,
      mCase: new THREE.Matrix4(),
      mLid: new THREE.Matrix4(),
      depthTray: 0,
      depthLid: 0,
    };
    item.traySheets.renderOrder = 1;
    item.lidSheets.renderOrder = 1;
    item.discDepth.renderOrder = -5;
    return item;
  }

  const pointer = { x: 0, y: 0, over: false };
  const lean = { x: 0, y: 0 };
  const grab = {
    active: false,
    start: null,
    last: null,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    flick: { x: 0, y: 0 },
    moved: 0,
    dist: 0,
  };
  const st = {
    t: 0,
    clock: 0,
    rest: REST,
    phase: 'rest',
    phaseAt: 0,
    auto: false,
    closeAfter: false,
    spin: 0,
    spinRate: 0,
    open: false,
  };
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let item = null;
  let userTurned=false;
  let artRequest=0;
  let broken=false,breakProgress=0,discOnly=false,active=true;
  let disposed = false;
  let raf = 0;
  let last = 0;
  let view = { w: 1, h: 1, openScale: 1 };

  const setOpenFlag = (on) => {
    if (st.open === on) return;
    st.open = on;
    onOpen?.(on);
  };

  function startOpen(auto) {
    if (st.phase !== 'rest') return;
    st.phase = 'opening';
    st.phaseAt = st.t;
    st.auto = auto;
    setOpenFlag(true);
  }
  function startClose() {
    if (st.phase === 'opening') {
      st.auto = true;
      st.closeAfter = true;
      return;
    }
    if (st.phase !== 'open') return;
    st.phase = 'closing';
    st.phaseAt = st.t;
    setOpenFlag(false);
  }
  function toggleOpen(on = !(st.phase === 'opening' || st.phase === 'open')) {
    if (!item) return;
    if (on) startOpen(false);
    else startClose();
  }

  function showPose(t) {
    const p = sway(t, motion);
    const since = t - st.phaseAt;
    if (st.phase === 'opening') {
      const q = Math.min(since, OPEN_T);
      p.yaw = lerp(p.yaw, 0, clamp01(q / 1.0)) + OPEN.yaw(q);
      p.lid = OPEN.lid(q);
      p.spread = OPEN.spread(q);
      p.pitch = lerp(p.pitch, OPEN.pitch(q), clamp01(q / 1.45));
      p.roll *= 1 - clamp01(q / 1.45);
    } else if (st.phase === 'open') {
      p.yaw = 0.06 * Math.sin(t * 0.6) * motion;
      p.pitch = -0.1 + 0.02 * Math.sin(t * 0.8) * motion;
      p.roll = 0;
      p.lid = OPEN_ANGLE + 0.025 * Math.sin(t * 1.3) * motion;
      p.spread = 1;
    } else if (st.phase === 'closing') {
      const q = Math.min(since, CLOSE_T);
      const back = clamp01((q - 0.9) / (CLOSE_T - 0.9));
      const rest = easeInOut(back);
      p.yaw = lerp(CLOSE.yaw(q), p.yaw, rest);
      p.pitch = lerp(CLOSE.pitch(q), p.pitch, rest);
      p.roll = lerp(CLOSE.roll(q), p.roll, rest);
      p.lid = CLOSE.lid(q);
      p.spread = CLOSE.spread(q);
    }
    return p;
  }

  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler(0, 0, 0, 'XYZ');
  const _v = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _h = new THREE.Matrix4();
  const _hi = new THREE.Matrix4();
  function place(p) {
    const s = lerp(1, view.openScale, p.spread);
    _e.set(p.pitch + lean.x + grab.x, p.yaw + lean.y + grab.y, p.roll);
    _q.setFromEuler(_e);
    _v.set(HALF * s * p.spread * 0.92, p.y, 0);
    item.mCase.compose(_v, _q, _s.setScalar(s));
    _h.makeTranslation(HINGE.x, 0, HINGE.z);
    _hi.makeTranslation(-HINGE.x, 0, -HINGE.z);
    _m.makeRotationY(-p.lid);
    item.mLid.copy(item.mCase).multiply(_h).multiply(_m).multiply(_hi);

    item.trayRods.matrix.copy(item.mCase);
    item.traySheets.matrix.copy(item.mCase);
    item.lidRods.matrix.copy(item.mLid);
    item.lidSheets.matrix.copy(item.mLid);
    item.jacket.matrix.copy(item.mLid).multiply(new THREE.Matrix4().makeTranslation(0,0,2.8));
    item.jacket.matrixWorld.copy(item.jacket.matrix);
    item.jacket.visible=item.showJacket;
    item.discMesh.matrix.copy(item.mCase).multiply(_m.makeRotationZ(-st.spin));
    item.discDepth.matrix.copy(item.discMesh.matrix);
    item.hitTray.matrix.copy(item.mCase);
    item.hitLid.matrix.copy(item.mLid).multiply(_m.makeTranslation(0, 0, 4));
    for (const o of [
      item.trayRods,
      item.traySheets,
      item.lidRods,
      item.lidSheets,
      item.discMesh,
      item.discDepth,
      item.hitTray,
      item.hitLid,
    ]) {
      o.matrixWorld.copy(o.matrix);
      o.visible = true;
    }
    _v.set(0, 0, -2).applyMatrix4(item.mCase).applyMatrix4(camera.matrixWorldInverse);
    item.depthTray = _v.z;
    _v.set(0, 0, 4).applyMatrix4(item.mLid).applyMatrix4(camera.matrixWorldInverse);
    item.depthLid = _v.z;

    shadowOf.uTrayInv.value.copy(item.mCase).invert();
    shadowOf.uLidInv.value.copy(item.mLid).invert();
    shadowOf.uScale.value = s;
  }

  const caseAt = (x, y) => {
    if (!item) return false;
    ndc.set(x, y);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects([item.hitTray, item.hitLid], false).length > 0;
  };
  const hovering = () => pointer.over && !grab.active && caseAt(pointer.x, pointer.y);

  function frame(dt, elapsed = dt) {
    st.t += elapsed;
    const { t } = st;
    breakProgress += ((broken?1:0)-breakProgress)*(1-Math.exp(-dt*5));

    const want = getSpin() && !getPaused() ? SPIN : 0;
    st.spinRate += (want - st.spinRate) * (1 - Math.exp(-dt * SPIN_EASE * 3));
    st.spin += st.spinRate * dt;

    const hover = pointer.over && !grab.active;
    const ax = hover ? pointer.y * 0.22 : 0;
    const ay = hover ? -pointer.x * 0.35 : 0;
    const k = 1 - Math.exp(-dt * 4);
    lean.x += (ax - lean.x) * k;
    lean.y += (ay - lean.y) * k;
    if (!grab.active) {
      grab.vx *= Math.exp(-8 * dt);
      grab.vy *= Math.exp(-8 * dt);
      grab.x += grab.vx * dt;
      grab.y += grab.vy * dt;
    }

    const since = t - st.phaseAt;
    if (st.phase === 'opening' && since >= OPEN_T) {
      st.phase = 'open';
      st.phaseAt = t;
    } else if (st.phase === 'closing' && since >= CLOSE_T) {
      st.phase = 'rest';
      st.phaseAt = t;
      st.clock = 0;
      st.rest = AGAIN;
    }

    const held = grab.active || hovering() || (st.phase === 'open' && !st.auto);
    const showing = !getPaused() && !held;
    if (st.phase === 'open' && (st.closeAfter || (st.auto && showing && t - st.phaseAt >= OPEN_HOLD))) {
      st.closeAfter = false;
      startClose();
    }
    if (showing) {
      st.clock += dt;
      // Open only in response to a tap or the open button.
    }

    place(showPose(t));
    const exploding=breakProgress>.001;
    item.discMesh.visible=!exploding;
    item.discDepth.visible=!exploding&&!discOnly;
    for(const shard of item.shards){shard.mesh.visible=exploding;if(exploding){const c=shard.center;const q=new THREE.Quaternion().setFromAxisAngle(shard.axis,shard.angle*breakProgress);const m=new THREE.Matrix4().compose(c.clone().addScaledVector(shard.offset,breakProgress),q,new THREE.Vector3(1,1,1));m.multiply(new THREE.Matrix4().makeTranslation(-c.x,-c.y,0));shard.mesh.matrix.copy(item.discMesh.matrix).multiply(m);shard.mesh.matrixWorld.copy(shard.mesh.matrix);}}
    if(exploding||discOnly){item.jacket.visible=false;shadowOf.uScale.value=0.0001;}
    draw();
  }

  const _c = new THREE.Vector3();
  function caseRect(w, h) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const m of [item.mCase, item.mLid]) {
      for (let i = 0; i < 8; i++) {
        _c.set(i & 1 ? HALF + 3 : -HALF - 3, i & 2 ? HALF + 3 : -HALF - 3, i & 4 ? 7 : -7);
        _c.applyMatrix4(m).project(camera);
        x0 = Math.min(x0, _c.x);
        x1 = Math.max(x1, _c.x);
        y0 = Math.min(y0, _c.y);
        y1 = Math.max(y1, _c.y);
      }
    }
    const pad = 0.04 * Math.max(x1 - x0, y1 - y0) + 0.02;
    const px = (v) => Math.round(((v + 1) / 2) * w);
    const py = (v) => Math.round(((v + 1) / 2) * h);
    const r = {
      x: clamp(px(x0 - pad), 0, w),
      y: clamp(py(y0 - pad), 0, h),
      x1: clamp(px(x1 + pad), 0, w),
      y1: clamp(py(y1 + pad), 0, h),
    };
    return r.x1 > r.x && r.y1 > r.y ? r : null;
  }

  const groups = [];
  function draw() {
    renderer.setRenderTarget(rtPage);
    renderer.clear();
    renderer.render(opaque, camera);

    groups.length = 0;
    groups.push({ depth: item.depthTray, rods: item.trayRods, sheets: item.traySheets, mat: item.trayRodMat });
    groups.push({ depth: item.depthLid, rods: item.lidRods, sheets: item.lidSheets, mat: item.lidRodMat });
    if(discOnly||breakProgress>.001)groups.length=0;
    groups.sort((a, b) => a.depth - b.depth);
    const glassMeshes = [item.trayRods, item.traySheets, item.lidRods, item.lidSheets];
    const w = rtPage.width;
    const h = rtPage.height;
    const rect = caseRect(w, h);
    let from = rtPage;
    if (rect) {
      for (const r of rt) {
        r.scissor.set(rect.x, rect.y, rect.x1 - rect.x, rect.y1 - rect.y);
        r.scissorTest = true;
      }
      groups.forEach((g, i) => {
        const into = rt[i % 2];
        renderer.setRenderTarget(into);
        renderer.clear();
        copyMat.uniforms.uTex.value = from.texture;
        for (const m of glassMeshes) m.visible = m === g.rods || m === g.sheets;
        g.mat.uniforms.uBehind.value = from.texture;
        renderer.render(glass, camera);
        from = into;
      });
      for (const r of rt) r.scissorTest = false;
    }
    for (const m of glassMeshes) m.visible = true;
    picked.uTexInside.value = from.texture;
    if (rect) picked.uRect.value.set(rect.x / w, rect.y / h, rect.x1 / w, rect.y1 / h);
    else picked.uRect.value.set(0, 0, 0, 0);

    bright.material.uniforms.uTexel.value.set(1 / rtBright.width, 1 / rtBright.height);
    renderer.setRenderTarget(rtBright);
    renderer.render(bright.scene, screenCam);
    streak.material.uniforms.uTex.value = rtBright.texture;
    streak.material.uniforms.uStep.value.set(1.5 / rtBright.width, 0);
    renderer.setRenderTarget(rtStarA);
    renderer.render(streak.scene, screenCam);
    streak.material.uniforms.uStep.value.set(0, 1.5 / rtBright.height);
    renderer.setRenderTarget(rtStarB);
    renderer.render(streak.scene, screenCam);

    renderer.setRenderTarget(null);
    renderer.render(final.scene, screenCam);
  }

  function layout() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    rtPage.setSize(size.x, size.y);
    shadowOf.uViewport.value.copy(size);
    final.material.uniforms.uPixel.value.set(1/size.x,1/size.y);
    for (const r of rt) r.setSize(size.x, size.y);
    const hw = Math.max(1, Math.round(size.x / 2));
    const hh = Math.max(1, Math.round(size.y / 2));
    rtBright.setSize(hw, hh);
    rtStarA.setSize(hw, hh);
    rtStarB.setSize(hw, hh);
    camera.aspect = w / h;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const fitH = CASE / FIT / 2 / tanHalf;
    const fitW = (CASE * 1.3) / 2 / (tanHalf * camera.aspect);
    const dist = Math.max(fitH, fitW);
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.setViewOffset(w, h, 0, DOCK_CLEAR / 2, w, h);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const across = 2 * dist * tanHalf * camera.aspect;
    view = { w, h, openScale: Math.min(1.04, across / (CASE * 2.25)) };
  }

  const ro = new ResizeObserver(() => layout());
  ro.observe(container);
  canvas.addEventListener('webglcontextrestored', bakeRoom);

  const toNdc = (e) => {
    const r = container.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2];
  };
  const onMove = (e) => {
    [pointer.x, pointer.y] = toNdc(e);
    pointer.over = true;
    if (grab.active) {
      const dx = e.clientX - grab.last.x;
      const dy = e.clientY - grab.last.y;
      grab.last = { x: e.clientX, y: e.clientY };
      grab.dist = Math.max(grab.dist, Math.hypot(e.clientX - grab.start.x, e.clientY - grab.start.y));
      grab.y += dx * GRAB_RATE;
      if(grab.dist>TAP_SLOP)userTurned=true;
      grab.x += dy * GRAB_RATE;
      grab.flick = { x: dy * GRAB_RATE * 60, y: dx * GRAB_RATE * 60 };
      grab.moved = performance.now();
    } else {
      container.style.cursor = caseAt(pointer.x, pointer.y) ? 'pointer' : '';
    }
  };
  const onLeave = () => {
    pointer.over = false;
  };
  const onDown = (e) => {
    if (!item || e.button !== 0) return;
    const [x, y] = toNdc(e);
    if (!caseAt(x, y)) return;
    grab.active = true;
    grab.start = { x: e.clientX, y: e.clientY };
    grab.last = { x: e.clientX, y: e.clientY };
    grab.dist = 0;
    grab.flick = { x: 0, y: 0 };
    container.setPointerCapture(e.pointerId);
    container.style.cursor = 'grabbing';
  };
  const onUp = (e) => {
    if (!grab.active) return;
    grab.active = false;
    const still = performance.now() - grab.moved > 90;
    grab.vx = still ? 0 : grab.flick.x;
    grab.vy = still ? 0 : grab.flick.y;
    if (container.hasPointerCapture(e.pointerId)) container.releasePointerCapture(e.pointerId);
    container.style.cursor = '';
    if (e.type === 'pointerup' && grab.dist < TAP_SLOP) toggleOpen();
  };
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerleave', onLeave);
  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointerup', onUp);
  container.addEventListener('pointercancel', onUp);

  const gaps = [];
  let probing = false;
  const probe = (gap) => {
    if (!probing || document.hidden || gap > 0.1) return;
    gaps.push(gap);
    if (gaps.length < 120) return;
    gaps.sort((a, b) => a - b);
    const typical = gaps[gaps.length >> 1];
    gaps.length = 0;
    const ratio = renderer.getPixelRatio();
    if (typical < 1 / 40 || ratio <= 1) {
      probing = false;
      return;
    }
    renderer.setPixelRatio(
      Math.max(1, Math.min(ratio - 0.25, Math.round(ratio * Math.sqrt(1 / 45 / typical) * 4) / 4)),
    );
    layout();
  };
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    const gap = last ? (now - last) / 1000 : 1 / 60;
    last = now;
    if (!item||!active||document.hidden) return;
    frame(Math.min(gap, 1 / 20), Math.min(gap, 0.25));
    probe(gap);
  };

  new THREE.TextureLoader()
    .loadAsync(disc.art)
    .then((tex) => {
      if (disposed) {
        tex.dispose();
        return;
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      item = buildCase(track(tex));
      layout();
      onReady?.();
      raf = requestAnimationFrame(tick);
    })
    .catch((err) => {
      console.error(err);
      if (!disposed) onFail?.();
    });

  layout();

  const artCache=new Map();
  function cachedArt(url){if(!artCache.has(url)){const job=new THREE.TextureLoader().loadAsync(url).then(tex=>{tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();track(tex);renderer.initTexture(tex);return tex;}).catch(e=>{artCache.delete(url);throw e;});artCache.set(url,job);}return artCache.get(url);}
  return {
    preloadArt: cachedArt,
    setBackgroundVideo(video){shadowOf.uVideo.value=track(new THREE.VideoTexture(video));},
    setVideoOpacity(value){shadowOf.uVideoOpacity.value=value;},
    setActive(on){active=on;},
    setOpen: (on) => toggleOpen(on),
    setBroken(on){broken=on;userTurned=true;},
    setDiscOnly(on){discOnly=on;userTurned=true;},
    resetView(){grab.x=grab.y=grab.vx=grab.vy=0;userTurned=false;},
    setArt(url, target='disc', printed=true, zoom=1) {
      const request=++artRequest;
      return cachedArt(url).then(tex=>{
        if(disposed||request!==artRequest)return;
        tex.colorSpace=THREE.SRGBColorSpace;
        tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
        if(target==='disc'||target==='both') {item.discMesh.material.uniforms.uArt.value=tex;item.discMesh.material.uniforms.uArtZoom.value=zoom;item.discMesh.material.uniforms.uPrintOut.value=printed?59.1:0;}
        if(target==='jacket'||target==='both'){item.jacketMat.map=tex;item.jacketMat.needsUpdate=true;item.showJacket=printed;}
      });
    },
    clearArt(){if(item){item.showJacket=false;item.discMesh.material.uniforms.uPrintOut.value=0;}},
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('webglcontextrestored', bakeRoom);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', onLeave);
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onUp);
      for (const d of disposables) d.dispose();
      for (const r of [rtPage, ...rt, rtBright, rtStarA, rtStarB, roomRT]) r.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

