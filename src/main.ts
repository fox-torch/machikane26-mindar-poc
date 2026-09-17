import * as THREE from 'three';
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';
import './style.css';

type LogRow = { t: number; event: string; target: number; x?: number; y?: number; z?: number; distance?: number; estimatedMm?: number };
const targetNames = ['reference-1', 'reference-2', 'reference-3', 'reference-4'];
const container = document.querySelector<HTMLElement>('#ar-container')!;
const statusEl = document.querySelector<HTMLElement>('#status')!;
const poseEl = document.querySelector<HTMLElement>('#pose')!;
const targetsEl = document.querySelector<HTMLElement>('#targets')!;
const startButton = document.querySelector<HTMLButtonElement>('#start')!;
const stopButton = document.querySelector<HTMLButtonElement>('#stop')!;
const downloadButton = document.querySelector<HTMLButtonElement>('#download')!;
const widthInput = document.querySelector<HTMLInputElement>('#marker-width')!;

const logs: LogRow[] = [];
const foundAt = new Map<number, number>();
const counts = targetNames.map(() => ({ found: 0, lost: 0 }));
const chips = targetNames.map((name, i) => {
  const el = document.createElement('span');
  el.className = 'chip';
  el.textContent = `${i}: ${name}`;
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
const anchors = targetNames.map((_, i) => mindar.addAnchor(i));

anchors.forEach((anchor, i) => {
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
    statusEl.textContent = `検出: ${i} ${targetNames[i]}`;
    logs.push({ t: Date.now(), event: 'found', target: i });
  };
  anchor.onTargetLost = () => {
    counts[i].lost++;
    foundAt.delete(i);
    chips[i].classList.remove('active');
    statusEl.textContent = `消失: ${i} ${targetNames[i]}`;
    logs.push({ t: Date.now(), event: 'lost', target: i });
  };
});

const markerWorld = new THREE.Vector3();
const cameraWorld = new THREE.Vector3();
const relative = new THREE.Matrix4();
const relativePos = new THREE.Vector3();
const relativeQuat = new THREE.Quaternion();
const relativeScale = new THREE.Vector3();
const euler = new THREE.Euler();

function updateDiagnostics() {
  const activeIndex = anchors.findIndex((anchor) => anchor.group.visible);
  if (activeIndex < 0) {
    poseEl.textContent = targetNames.map((n, i) => `${i} ${n}: found=${counts[i].found} lost=${counts[i].lost}`).join('\n');
    return;
  }
  const anchor = anchors[activeIndex];
  anchor.group.updateWorldMatrix(true, false);
  camera.updateWorldMatrix(true, false);
  anchor.group.getWorldPosition(markerWorld);
  camera.getWorldPosition(cameraWorld);
  const distance = markerWorld.distanceTo(cameraWorld);
  relative.copy(camera.matrixWorld).invert().multiply(anchor.group.matrixWorld);
  relative.decompose(relativePos, relativeQuat, relativeScale);
  euler.setFromQuaternion(relativeQuat, 'YXZ');

  const markerWidthMm = Number(widthInput.value);
  const estimatedMm = Number.isFinite(markerWidthMm) && markerWidthMm > 0 ? distance * markerWidthMm : undefined;
  const lockMs = foundAt.has(activeIndex) ? performance.now() - foundAt.get(activeIndex)! : 0;
  poseEl.textContent = [
    `target: ${activeIndex} ${targetNames[activeIndex]}`,
    `relative xyz: ${relativePos.x.toFixed(3)}, ${relativePos.y.toFixed(3)}, ${relativePos.z.toFixed(3)}`,
    `distance: ${distance.toFixed(3)} target-width`,
    estimatedMm ? `distance approx: ${estimatedMm.toFixed(0)} mm` : 'distance approx: marker width未入力',
    `rotation deg Y/X/Z: ${THREE.MathUtils.radToDeg(euler.y).toFixed(1)}, ${THREE.MathUtils.radToDeg(euler.x).toFixed(1)}, ${THREE.MathUtils.radToDeg(euler.z).toFixed(1)}`,
    `continuous lock: ${(lockMs / 1000).toFixed(1)} s`,
    `found/lost: ${counts[activeIndex].found}/${counts[activeIndex].lost}`,
  ].join('\n');

  if (logs.length === 0 || performance.now() % 500 < 20) {
    logs.push({ t: Date.now(), event: 'sample', target: activeIndex, x: relativePos.x, y: relativePos.y, z: relativePos.z, distance, estimatedMm });
  }
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
  const header = 'timestamp,event,target,x,y,z,distance_target_width,estimated_mm\n';
  const rows = logs.map(r => [
    r.t, r.event, r.target, r.x ?? '', r.y ?? '', r.z ?? '', r.distance ?? '', r.estimatedMm ?? ''
  ].join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([header + rows], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `mindar-log-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});