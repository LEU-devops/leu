import { clearToken, getToken } from "./auth";

export function request(url: string, options: RequestInit = {}): Promise<any> {
    options.headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
    };

    return fetch(`${import.meta.env.VITE_API_URL}${url}`, options)
        .then(async (response) => {
            if (!response.ok) {
                if (response.status === 401) {
                    clearToken();
                    window.location.href = '/login';
                }
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            if (response.status === 204) return null;
            return response.json();
        });
}