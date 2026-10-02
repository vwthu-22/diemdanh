/**
 * face-api.js loader utility
 * - Loads TinyFaceDetector + FaceLandmark68TinyNet + FaceRecognitionNet
 * - Models are served from /models/ in the public folder
 * - Module is lazily imported (client-only)
 */

let faceApiLoaded = false;
let modelsLoaded = false;

export async function loadFaceApi() {
  if (faceApiLoaded && modelsLoaded) return;

  if (!faceApiLoaded) {
    const faceapi = await import('face-api.js');
    faceApiLoaded = true;

    if (!modelsLoaded) {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
    }
  }
}

export async function getFaceApi() {
  await loadFaceApi();
  const faceapi = await import('face-api.js');
  return faceapi;
}

/**
 * Tính khoảng cách Euclidean giữa 2 descriptor (mảng 128 số).
 * Ngưỡng nhận dạng: < 0.5 = cùng người, > 0.6 = khác người.
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * Tìm sinh viên khớp với descriptor từ camera
 */
export function findBestMatch(
  queryDescriptor: number[],
  students: Array<{ id: number; name: string; faceDescriptor: string | null | undefined }>,
  threshold = 0.5,
): { student: { id: number; name: string } | null; distance: number } {
  let best: { id: number; name: string } | null = null;
  let bestDist = Infinity;

  for (const s of students) {
    if (!s.faceDescriptor) continue;
    try {
      const stored: number[] = JSON.parse(s.faceDescriptor);
      const dist = euclideanDistance(queryDescriptor, stored);
      if (dist < bestDist) {
        bestDist = dist;
        best = { id: s.id, name: s.name };
      }
    } catch {
      continue;
    }
  }

  if (bestDist > threshold) {
    return { student: null, distance: bestDist };
  }
  return { student: best, distance: bestDist };
}
