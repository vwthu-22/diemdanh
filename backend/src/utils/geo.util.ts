/**
 * Haversine formula - tính khoảng cách (mét) giữa 2 tọa độ GPS
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(dLambda / 2) *
      Math.sin(dLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Lấy giờ hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
 */
export function getVietnamNow(): Date {
  const now = new Date();
  // Convert to Vietnam timezone
  const vnTimeString = now.toLocaleString('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  return new Date(vnTimeString);
}

/**
 * Lấy ngày hiện tại dạng YYYY-MM-DD theo múi giờ VN
 */
export function getTodayVN(): string {
  const now = getVietnamNow();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Lấy giờ hiện tại dạng HH:mm theo múi giờ VN
 */
export function getCurrentTimeVN(): string {
  const now = getVietnamNow();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * So sánh 2 chuỗi thời gian HH:mm
 */
export function compareTime(t1: string, t2: string): number {
  const [h1, m1] = t1.split(':').map(Number);
  const [h2, m2] = t2.split(':').map(Number);
  return h1 * 60 + m1 - (h2 * 60 + m2);
}
