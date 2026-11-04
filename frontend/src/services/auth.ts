const TOKEN_KEY = "leu_token";

export interface AuthUser {
  email: string;
  nickname: string;
  full_name: string | null;
  profile_photo_url: string | null;
}

export interface UserProfile extends AuthUser {
  ra: string | null;
  cpf: string | null;
}

export function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return atob(padded);
}

export function getLoggedUser(): AuthUser | null {
  const token = getToken();
  if (!token) return null;

  try {
    const [, payloadPart] = token.split(".");
    if (!payloadPart) return null;

    const payload = JSON.parse(
      decodeBase64Url(payloadPart),
    ) as Partial<AuthUser>;
    if (
      typeof payload.email !== "string" ||
      typeof payload.nickname !== "string"
    )
      return null;

    return {
      email: payload.email,
      nickname: payload.nickname,
      full_name:
        typeof payload.full_name === "string" || payload.full_name === null
          ? payload.full_name
          : null,
      profile_photo_url:
        typeof payload.profile_photo_url === "string" ||
        payload.profile_photo_url === null
          ? payload.profile_photo_url
          : null,
    };
  } catch {
    return null;
  }
}

export function getDisplayName(
  user: Pick<AuthUser, "nickname" | "full_name">,
): string {
  return user.full_name?.trim() || user.nickname;
}

export async function getMyProfile(): Promise<UserProfile> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!response.ok) throw new Error("Não foi possível carregar o perfil.");
  return response.json();
}

export async function updateMyProfile(input: {
  nickname?: string;
  fullName?: string | null;
  ra?: string | null;
  cpf?: string | null;
}): Promise<UserProfile> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function uploadMyProfilePhoto(file: File): Promise<UserProfile> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/auth/me/photo`,
    {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        Authorization: `Bearer ${getToken()}`,
      },
      body: await file.arrayBuffer(),
    },
  );
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
