const TOKEN_KEY = 'leubet_token'

export function storeToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token)
}

export function getToken() {
    return localStorage.getItem(TOKEN_KEY)
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY)
}
