import { clearToken, getToken } from "./auth";

export function request(url: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${getToken()}`,
  };

  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const isBinaryBody =
    options.body instanceof ArrayBuffer || options.body instanceof Blob;

  if (hasBody && !isFormData && !isBinaryBody && !headers["Content-Type"])
    headers["Content-Type"] = "application/json";

  options.headers = headers;

  return fetch(`${import.meta.env.VITE_API_URL}${url}`, options).then(
    async (response) => {
      if (!response.ok) {
        if (response.status === 401) {
          clearToken();
          window.location.href = "/login";
        }
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`,
        );
      }
      if (response.status === 204) return null;
      return response.json();
    },
  );
}
