// The 27-cell capacity ground: three axes (mode, domain, object), each an
// integer in {0,1,2}. Index 2 on every axis is the emergent (sqrt(2)) value,
// not a midpoint — see docs/eo-substrate-complete-design.md Part 1, "The object".

const AXES = ['mode', 'domain', 'object'];

// A face drops exactly one axis. Which axis is dropped is tracked explicitly
// (faceOf/recover never let it go silent) per Part 1, "The projective constraint".
const FACES = {
  act: { axes: ['mode', 'domain'], drop: 'object' },
  site: { axes: ['domain', 'object'], drop: 'mode' },
  resolution: { axes: ['mode', 'object'], drop: 'domain' },
};

function isAxisValue(v) {
  return Number.isInteger(v) && v >= 0 && v <= 2;
}

export function makeAddress(mode, domain, object) {
  const values = { mode, domain, object };
  for (const axis of AXES) {
    if (!isAxisValue(values[axis])) {
      throw new RangeError(`address.${axis} must be an integer in {0,1,2}, got ${values[axis]}`);
    }
  }
  return Object.freeze({ mode, domain, object });
}

export function isLegalAddress(address) {
  if (!address || typeof address !== 'object') return false;
  return AXES.every((axis) => isAxisValue(address[axis]));
}

// Controlled reduction: returns the 2D face coordinate plus a note recording
// which axis was parked. The dropped axis's value is deliberately not
// returned here — that's the asymmetry between projection (lossy but tracked)
// and compression (lossy and untracked) that Part 1 describes.
export function faceOf(address, face) {
  if (!isLegalAddress(address)) {
    throw new RangeError('faceOf requires a legal address');
  }
  const spec = FACES[face];
  if (!spec) {
    throw new RangeError(`unknown face: ${face}. Expected one of act, site, resolution`);
  }
  const [axisA, axisB] = spec.axes;
  return Object.freeze({
    face,
    a: address[axisA],
    b: address[axisB],
    droppedAxis: spec.drop,
  });
}

// Lossless reconstruction, given the face coordinate and the value of the
// axis that was dropped (supplied by whoever tracked it — recover never
// invents it).
export function recover(faceCoord, thirdAxisValue) {
  if (!faceCoord || typeof faceCoord !== 'object') {
    throw new RangeError('recover requires a faceCoord produced by faceOf');
  }
  const spec = FACES[faceCoord.face];
  if (!spec) {
    throw new RangeError(`unknown face: ${faceCoord.face}`);
  }
  const [axisA, axisB] = spec.axes;
  const full = {
    [axisA]: faceCoord.a,
    [axisB]: faceCoord.b,
    [spec.drop]: thirdAxisValue,
  };
  return makeAddress(full.mode, full.domain, full.object);
}

export const FACE_NAMES = Object.freeze(Object.keys(FACES));
