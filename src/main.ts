import * as THREE from 'three';
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';
import './style.css';

type LogRow = {
  t: number;
  event: string;
  target: number;
  filter?: string;
  x?: number;
  y?: number;
  z?: number;
  distance?: number;
  estimatedMm?: number;
};

type TargetDefinition = { name: string; demoRole: string; filter: string | null };
const targets: TargetDefinition[] = [
  { name: 'reference-1', demoRole: 'FILTER BLUE (demo)', filter: 'BLUE' },
  { name: 'reference-2', demoRole: 'FILTER RED (demo)', filter: 'RED' },
  { name: 'reference-3', demoRole: 'FILTER GREEN (demo)', filter: 'GREEN' },
  { name: 'reference-4', demoRole: 'OBSERVATION SAMPLE', filter: null },
];

const container = document.querySelector<HTMLElement>('#ar-container')!;
const statusEl = document.querySelector<HTMLElement>('#status')!;
const poseEl = document.querySelector<HTMLElement>('#pose')!;
const targetsEl = document.querySelector<HTMLElement>('#targets')!;
const filterEl = document.querySelector<HTMLElement>('#current-filter')!;
const startButton = document.querySelector<HTMLButtonElement>('#start')!;
const stopButton = document.querySelector<HTMLButtonElement>('#stop')!;
const downloadButton = document.querySelector<HTMLButtonElement>('#download')!;
const clearFilterButton = document.querySelector<HTMLButtonElement>('#clear-filter')!;
const widthInput = document.querySelector<HTMLInputElement>('#marker-width')!;

const logs: LogRow[] = [];
const foundAt = new Map<number, number>();
const counts = targets.map(() => ({ found: 0, lost: 0 }));
let currentFilter: string | null = null;

const chips = targets.map((target, i) => {
  const el = document.createElement('span');
  el.className = 'chip';
  el.textContent = `${i}: ${target.demoRole}`;
  targetsEl.appendChild(el);
  return el;
});

const mindar = new MindARThree({
  container,
  imageTargetSrc: '/reference/ar-images.mind',
  maxTrack: 4,
  uiLoading: 'yes',
  uiScanning: 'yes',
  uiError: 'yes',
});
const { renderer, scene, camera } = mindar;
const anchors = targets.map((_, i) => mindar.addAnchor(i));

anchors.forEach((anchor, i) => {
  const target = targets[i];
  const color = new THREE.Color().setHSL(i / anchors.length, 0.8, 0.55);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 }),
  );
  plane.position.set(0, -0.62, 0.02);
  anchor.group.add(plane);

  anchor.onTargetFound = () => {
    counts[i].found++;
    foundAt.set(i, performance.now());
    chips[i].classList.add('active');
    statusEl.textContent = `検出: ${i} ${target.demoRole}`;
    if (target.filter) {
      currentFilter = target.filter;
      filterEl.textContent = `currentFilter: ${currentFilter}`;
      logs.push({ t: Date.now(), event: 'filter_changed', target: i, filter: currentFilter });
    }
    logs.push({ t: Date.now(), event: 'found', target: i, filter: currentFilter ?? undefined });
  };

  anchor.onTargetLost = () => {
    counts[i].lost++;
    foundAt.delete(i);
    chips[i].classList.remove('active');
    statusEl.textContent = `消失: ${i} ${target.demoRole}`;
    logs.push({ t: Date.now(), event: 'lost', target: i, filter: currentFilter ?? undefined });
  };
});

clearFilterButton.addEventListener('click', () => {
  currentFilter = null;
  filterEl.textContent = 'currentFilter: null';
  logs.push({ t: Date.now(), event: 'filter_cleared', target: -1 });
});

const markerWorld = new THREE.Vector3();
const cameraWorld = new THREE.Vector3();
const relative = new THREE.Matrix4();
const relativePos = new THREE.Vector3();
const relativeQuat = new THREE.Quaternion();
const relativeScale = new THREE.Vector3();
const euler = new THREE.Euler();
let lastSampleAt = 0;

function updateDiagnostics() {
  const activeIndexes = anchors
    .map((anchor, index) => (anchor.group.visible ? index : -1))
    .filter((index) => index >= 0);

  if (activeIndexes.length === 0) {
    poseEl.textContent = [
      `currentFilter: ${currentFilter ?? 'null'}`,
      ...targets.map((n, i) => `${i} ${n.name}: found=${counts[i].found} lost=${counts[i].lost}`),
    ].join('\n');
    return;
  }

  camera.updateWorldMatrix(true, false);
  const markerWidthMm = Number(widthInput.value);
  const now = performance.now();
  const shouldSample = now - lastSampleAt >= 500;
  const poses: Array<{
    index: number;
    x: number;
    y: number;
    z: number;
    distance: number;
    estimatedMm?: number;
    rotationY: number;
    rotationX: number;
    rotationZ: number;
    hasTargetScale: boolean;
  }> = [];

  for (const index of activeIndexes) {
    const anchor = anchors[index];
    anchor.group.updateWorldMatrix(true, false);
    anchor.group.getWorldPosition(markerWorld);
    camera.getWorldPosition(cameraWorld);
    const rawDistance = markerWorld.distanceTo(cameraWorld);

    relative.copy(camera.matrixWorld).invert().multiply(anchor.group.matrixWorld);
    relative.decompose(relativePos, relativeQuat, relativeScale);
    euler.setFromQuaternion(relativeQuat, 'YXZ');

    const targetDimensions = (mindar as any).controller?.markerDimensions?.[index] as
      | [number, number]
      | undefined;
    const targetPixelWidth = targetDimensions?.[0];
    const hasTargetScale = Number.isFinite(targetPixelWidth) && targetPixelWidth! > 0;
    const x = hasTargetScale ? relativePos.x / targetPixelWidth! : relativePos.x;
    const y = hasTargetScale ? relativePos.y / targetPixelWidth! : relativePos.y;
    const z = hasTargetScale ? relativePos.z / targetPixelWidth! : relativePos.z;
    const distance = hasTargetScale ? rawDistance / targetPixelWidth! : rawDistance;
    const estimatedMm =
      hasTargetScale && Number.isFinite(markerWidthMm) && markerWidthMm > 0
        ? distance * markerWidthMm
        : undefined;

    poses.push({
      index,
      x,
      y,
      z,
      distance,
      estimatedMm,
      rotationY: THREE.MathUtils.radToDeg(euler.y),
      rotationX: THREE.MathUtils.radToDeg(euler.x),
      rotationZ: THREE.MathUtils.radToDeg(euler.z),
      hasTargetScale,
    });

    if (shouldSample) {
      logs.push({
        t: Date.now(),
        event: 'sample',
        target: index,
        filter: currentFilter ?? undefined,
        x,
        y,
        z,
        distance,
        estimatedMm,
      });
    }
  }

  if (shouldSample) lastSampleAt = now;

  const primary = poses[0];
  const lockMs = foundAt.has(primary.index)
    ? performance.now() - foundAt.get(primary.index)!
    : 0;

  poseEl.textContent = [
    `visible targets: ${activeIndexes.join(', ')}`,
    `target: ${primary.index} ${targets[primary.index].name}`,
    `role: ${targets[primary.index].demoRole}`,
    `currentFilter: ${currentFilter ?? 'null'}`,
    `relative xyz: ${primary.x.toFixed(3)}, ${primary.y.toFixed(3)}, ${primary.z.toFixed(3)} ${primary.hasTargetScale ? 'target-width' : 'raw'}`,
    `distance: ${primary.distance.toFixed(3)} ${primary.hasTargetScale ? 'target-width' : 'raw'}`,
    primary.estimatedMm
      ? `distance approx: ${primary.estimatedMm.toFixed(0)} mm`
      : 'distance approx: marker width未入力 / scale未取得',
    `rotation deg Y/X/Z: ${primary.rotationY.toFixed(1)}, ${primary.rotationX.toFixed(1)}, ${primary.rotationZ.toFixed(1)}`,
    `continuous lock: ${(lockMs / 1000).toFixed(1)} s`,
    `found/lost: ${counts[primary.index].found}/${counts[primary.index].lost}`,
  ].join('\n');
}

let running = false;
startButton.addEventListener('click', async () => {
  if (running) return;
  statusEl.textContent = 'カメラ起動中...';
  try {
    await mindar.start();
    running = true;
    startButton.disabled = true;
    stopButton.disabled = false;
    renderer.setAnimationLoop(() => {
      updateDiagnostics();
      renderer.render(scene, camera);
    });
    statusEl.textContent = 'スキャン中';
  } catch (error) {
    console.error(error);
    statusEl.textContent = `起動失敗: ${error instanceof Error ? error.message : String(error)}`;
  }
});

stopButton.addEventListener('click', () => {
  if (!running) return;
  mindar.stop();
  renderer.setAnimationLoop(null);
  running = false;
  startButton.disabled = false;
  stopButton.disabled = true;
  statusEl.textContent = '停止';
});

downloadButton.addEventListener('click', () => {
  const header = 'timestamp,event,target,current_filter,x,y,z,distance_target_width,estimated_mm\n';
  const rows = logs.map((r) => [
    r.t, r.event, r.target, r.filter ?? '', r.x ?? '', r.y ?? '', r.z ?? '', r.distance ?? '', r.estimatedMm ?? '',
  ].join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([header + rows], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `mindar-log-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});
