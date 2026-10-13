// 招待の生トークンを保存せず、発行・承諾の両方で同じSHA-256表現を使って照合する。
export async function hashInvitation(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("");
}
