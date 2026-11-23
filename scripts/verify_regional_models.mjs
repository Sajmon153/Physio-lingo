import fs from 'node:fs';
import path from 'node:path';

const files = [
  { name: 'head_neck.glb', expectedMeshes: 240, side: 'midline' },
  { name: 'upper_limb_left.glb', expectedMeshes: 104, side: 'left' },
  { name: 'upper_limb_right.glb', expectedMeshes: 104, side: 'right' },
  { name: 'lower_limb_left.glb', expectedMeshes: 110, side: 'left' },
  { name: 'lower_limb_right.glb', expectedMeshes: 110, side: 'right' },
  { name: 'torso.glb', expectedMeshes: 158, side: 'midline' },
];

function parseGlb(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 28) {
    throw new Error(`GLB too small: ${filePath}`);
  }
  const magic = buf.toString('utf8', 0, 4);
  const version = buf.readUInt32LE(4);
  const totalLength = buf.readUInt32LE(8);
  const chunk0Length = buf.readUInt32LE(12);
  const chunk0Type = buf.toString('utf8', 16, 20);

  if (magic !== 'glTF' || version !== 2 || chunk0Type !== 'JSON') {
    throw new Error(`Invalid GLB header for ${filePath}`);
  }
  if (totalLength !== buf.length) {
    throw new Error(`GLB totalLength (${totalLength}) !== file length (${buf.length}) for ${filePath}`);
  }

  const binHeaderOffset = 20 + chunk0Length;
  if (binHeaderOffset + 8 > buf.length) {
    throw new Error(`Missing BIN chunk header in ${filePath}`);
  }
  const binLength = buf.readUInt32LE(binHeaderOffset);
  const binType = buf.toString('utf8', binHeaderOffset + 4, binHeaderOffset + 8);
  if (binType !== 'BIN\0') {
    throw new Error(`Invalid BIN chunk type (${JSON.stringify(binType)}) in ${filePath}`);
  }
  if (binHeaderOffset + 8 + binLength > buf.length) {
    throw new Error(`Truncated BIN chunk in ${filePath}`);
  }

  const gltf = JSON.parse(buf.toString('utf8', 20, 20 + chunk0Length));
  return { buf, totalLength, gltf };
}

function getMeshBounds(gltf, node) {
  const mesh = gltf.meshes?.[node.mesh];
  const prim = mesh?.primitives?.[0];
  const accIdx = prim?.attributes?.POSITION;
  const acc = accIdx !== undefined ? gltf.accessors?.[accIdx] : undefined;
  if (!acc || !Array.isArray(acc.min) || !Array.isArray(acc.max) || acc.min.length !== 3 || acc.max.length !== 3) {
    throw new Error(`Invalid POSITION accessor bounds on mesh node "${node.name}"`);
  }
  for (let i = 0; i < 3; i++) {
    if (!Number.isFinite(acc.min[i]) || !Number.isFinite(acc.max[i])) {
      throw new Error(`Non-finite bounds on mesh node "${node.name}"`);
    }
  }
  return {
    min: acc.min,
    max: acc.max,
    center: [
      (acc.min[0] + acc.max[0]) / 2,
      (acc.min[1] + acc.max[1]) / 2,
      (acc.min[2] + acc.max[2]) / 2,
    ],
  };
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`[FAIL] ${msg}`);
    process.exit(1);
  }
}

const bodyGlbPath = path.resolve('public/models/body.glb');
assert(fs.existsSync(bodyGlbPath), `Master body.glb not found at ${bodyGlbPath}`);
const { gltf: bodyGltf } = parseGlb(bodyGlbPath);
const bodyMeshNodeNames = new Set(
  bodyGltf.nodes.filter((n) => n.mesh !== undefined).map((n) => n.name)
);
assert(bodyMeshNodeNames.size === 826, `Expected 826 unique mesh node names in body.glb, got ${bodyMeshNodeNames.size}`);

let totalMeshes = 0;
const seenRegionalNames = new Set();
const regionData = {};

for (const item of files) {
  const filePath = path.resolve('public/models/regional', item.name);
  assert(fs.existsSync(filePath), `Missing file: ${filePath}`);

  const { totalLength, gltf } = parseGlb(filePath);
  const extUsed = gltf.extensionsUsed || [];
  const extReq = gltf.extensionsRequired || [];
  assert(extUsed.includes('KHR_draco_mesh_compression'), `${item.name}: missing KHR_draco_mesh_compression in extensionsUsed`);
  assert(extReq.includes('KHR_draco_mesh_compression'), `${item.name}: missing KHR_draco_mesh_compression in extensionsRequired`);

  const meshNodes = gltf.nodes.filter((n) => n.mesh !== undefined);
  assert(
    gltf.meshes.length === item.expectedMeshes && meshNodes.length === item.expectedMeshes,
    `${item.name}: mesh count ${gltf.meshes.length} / node count ${meshNodes.length} !== expected ${item.expectedMeshes}`
  );

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let negXCount = 0;
  let posXCount = 0;
  const entries = [];

  for (const node of meshNodes) {
    assert(bodyMeshNodeNames.has(node.name), `${item.name}: unexpected mesh node "${node.name}" not in body.glb`);
    assert(!seenRegionalNames.has(node.name), `${item.name}: duplicate mesh node "${node.name}" across regional GLBs`);
    seenRegionalNames.add(node.name);

    const bounds = getMeshBounds(gltf, node);
    const cx = bounds.center[0];
    if (bounds.min[0] < minX) minX = bounds.min[0];
    if (bounds.max[0] > maxX) maxX = bounds.max[0];
    if (bounds.min[1] < minY) minY = bounds.min[1];
    if (bounds.max[1] > maxY) maxY = bounds.max[1];

    if (cx < -0.01) negXCount++;
    else if (cx > 0.01) posXCount++;

    if (item.side === 'left') {
      assert(cx > 0.03, `${item.name}: mesh "${node.name}" has cx=${cx.toFixed(4)} <= 0.03 (anatomical LEFT must be +X)`);
    } else if (item.side === 'right') {
      assert(cx < -0.03, `${item.name}: mesh "${node.name}" has cx=${cx.toFixed(4)} >= -0.03 (anatomical RIGHT must be -X)`);
    }

    entries.push({ name: node.name, bounds, cx });
  }

  if (item.side === 'midline') {
    assert(
      negXCount === posXCount,
      `${item.name}: bilateral imbalance negX=${negXCount} !== posX=${posXCount}`
    );
  }

  regionData[item.name] = { entries, minX, maxX, minY, maxY, negXCount, posXCount };
  console.log(
    `[PASS] ${item.name.padEnd(20)}: ${String(gltf.meshes.length).padStart(3)} meshes (expected: ${item.expectedMeshes}), X=[${minX.toFixed(4)}..${maxX.toFixed(4)}], Y=[${minY.toFixed(4)}..${maxY.toFixed(4)}], bytes=${totalLength}`
  );
  totalMeshes += gltf.meshes.length;
}

// 1. 826/826 full partition parity with body.glb
assert(totalMeshes === 826, `Total meshes ${totalMeshes} !== 826`);
assert(seenRegionalNames.size === 826, `Seen unique regional meshes ${seenRegionalNames.size} !== 826`);
for (const bodyName of bodyMeshNodeNames) {
  assert(seenRegionalNames.has(bodyName), `Mesh "${bodyName}" from body.glb missing from regional GLBs`);
}

// 2. Spot-check anatomical L/R landmark pairs (+X = Left, -X = Right)
const findEntry = (fileName, exactName) =>
  regionData[fileName].entries.find((e) => e.name === exactName);

const humL = findEntry('upper_limb_left.glb', 'Humerus.002');
const humR = findEntry('upper_limb_right.glb', 'Humerus.003');
assert(humL && humL.cx > 0.15, `upper_limb_left.glb must contain Humerus.002 at cx > 0.15`);
assert(humR && humR.cx < -0.15, `upper_limb_right.glb must contain Humerus.003 at cx < -0.15`);

const femL = findEntry('lower_limb_left.glb', 'Femur.002');
const femR = findEntry('lower_limb_right.glb', 'Femur.003');
const gluL = findEntry('lower_limb_left.glb', 'Gluteus medius muscle.002');
const gluR = findEntry('lower_limb_right.glb', 'Gluteus medius muscle.005');
assert(femL && femL.cx > 0.08, `lower_limb_left.glb must contain Femur.002 at cx > 0.08`);
assert(femR && femR.cx < -0.08, `lower_limb_right.glb must contain Femur.003 at cx < -0.08`);
assert(gluL && gluL.cx > 0.08, `lower_limb_left.glb must contain Gluteus medius muscle.002 at cx > 0.08`);
assert(gluR && gluR.cx < -0.08, `lower_limb_right.glb must contain Gluteus medius muscle.005 at cx < -0.08`);

// 3. Mirror symmetry of base names between Left and Right limbs
const stripSuffix = (n) => n.replace(/\.\d+$/, '');
const checkMirror = (leftFile, rightFile) => {
  const leftBases = regionData[leftFile].entries.map((e) => stripSuffix(e.name)).sort();
  const rightBases = regionData[rightFile].entries.map((e) => stripSuffix(e.name)).sort();
  assert(leftBases.length === rightBases.length, `${leftFile} vs ${rightFile} length mismatch`);
  for (let i = 0; i < leftBases.length; i++) {
    assert(leftBases[i] === rightBases[i], `Mirror mismatch between ${leftFile} and ${rightFile}: ${leftBases[i]} !== ${rightBases[i]}`);
  }
};
checkMirror('upper_limb_left.glb', 'upper_limb_right.glb');
checkMirror('lower_limb_left.glb', 'lower_limb_right.glb');

// 4. Regional anatomical sanity invariants
for (const sideFile of ['upper_limb_left.glb', 'upper_limb_right.glb']) {
  const { entries, minY } = regionData[sideFile];
  assert(minY > 0.65, `${sideFile}: minY=${minY.toFixed(4)} <= 0.65`);
  assert(!entries.some((e) => /finger of foot|tarsus/i.test(e.name)), `${sideFile} contains toe phalanx or tarsus`);
  assert(entries.some((e) => /^Subacromial bursa/i.test(e.name)), `${sideFile} missing Subacromial bursa`);
  assert(entries.some((e) => /^Intertubercular tendon sheath/i.test(e.name)), `${sideFile} missing Intertubercular tendon sheath`);
}

for (const sideFile of ['lower_limb_left.glb', 'lower_limb_right.glb']) {
  const { entries, maxY } = regionData[sideFile];
  assert(maxY < 1.0, `${sideFile}: maxY=${maxY.toFixed(4)} >= 1.0`);
  assert(!entries.some((e) => /(?:superior|inferior)\s+tarsus/i.test(e.name)), `${sideFile} contains eyelid tarsus`);
  const toeCount = entries.filter((e) => /finger of foot/i.test(e.name)).length;
  assert(toeCount === 14, `${sideFile}: expected 14 toe phalanges, got ${toeCount}`);
}

{
  const { entries } = regionData['head_neck.glb'];
  const eyelidTarsi = entries.filter((e) => /^(Superior|Inferior) tarsus/i.test(e.name)).length;
  assert(eyelidTarsi === 4, `head_neck.glb: expected 4 eyelid tarsi, got ${eyelidTarsi}`);
  const teethCount = entries.filter((e) => /(incisor|canine|premolar|molar)/i.test(e.name)).length;
  assert(teethCount === 28, `head_neck.glb: expected 28 teeth, got ${teethCount}`);
  const nasalCount = entries.filter((e) =>
    /^(Nasal bone|Major alar cartilage|Lateral process of nasal septal cartilage|Nasal septal cartilage|Inferior nasal concha bone|Vomer|Ethmoid bone|Nasalis|Depressor septi nasi|Procerus|Levator nasolabialis)/i.test(e.name)
  ).length;
  assert(nasalCount === 19, `head_neck.glb: expected 19 nasal/ethmoid meshes, got ${nasalCount}`);
  assert(entries.some((e) => e.name === 'Atlas (C1)'), `head_neck.glb missing Atlas (C1)`);
  assert(entries.some((e) => e.name === 'Vertebra C7'), `head_neck.glb missing Vertebra C7`);
  assert(!entries.some((e) => /\b(femur|tibia|humerus|finger of foot)\b/i.test(e.name)), `head_neck.glb contains limb mesh`);
}

{
  const { entries } = regionData['torso.glb'];
  assert(entries.some((e) => e.name === 'Vertebra T1'), `torso.glb missing Vertebra T1`);
  assert(entries.some((e) => e.name === 'Vertebra T12'), `torso.glb missing Vertebra T12`);
  assert(entries.some((e) => e.name === 'Vertebra L1'), `torso.glb missing Vertebra L1`);
  assert(entries.some((e) => e.name === 'Vertebra L5'), `torso.glb missing Vertebra L5`);
  assert(entries.some((e) => e.name === 'Sacrum'), `torso.glb missing Sacrum`);
  assert(entries.some((e) => e.name === 'Coccyx'), `torso.glb missing Coccyx`);
  assert(entries.some((e) => e.name === 'Hip bone.002') && entries.some((e) => e.name === 'Hip bone.003'), `torso.glb missing Hip bones`);
  const pecMajorCount = entries.filter((e) => /pectoralis major/i.test(e.name)).length;
  assert(pecMajorCount === 6, `torso.glb: expected 6 pectoralis major head meshes, got ${pecMajorCount}`);
  assert(!entries.some((e) => /subacromial|intertubercular/i.test(e.name)), `torso.glb contains shoulder bursa/sheath`);
}

console.log('\nAll 6 regional models verified! 826/826 body.glb parity, L/R (+X=Left, -X=Right), symmetry, and anatomical invariants PASS.');
