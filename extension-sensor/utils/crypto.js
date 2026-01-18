import { getOrCreateInstallId } from './installIdManager.js';

export async function generateReportHash(sessionId, ts) {
	const installId = await getOrCreateInstallId();
	const randomSalt = Math.random().toString(36).substring(2, 10);
	
	const rawString = `${installId}:${sessionId}:${ts}:${randomSalt}`;

	const msgBuffer = new TextEncoder().encode(rawString);
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);

	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

	//앞 32글자만 사용
	return hashHex.slice(0, 32);
}

// salt 없이 항상 같은 입력 -> 같은 해시 (incidentId/scriptId용)
export async function stableHash32(rawString) {
  const msgBuffer = new TextEncoder().encode(String(rawString || ""));
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex.slice(0, 32);
}