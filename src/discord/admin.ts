/** The admin token is kept for the tab only: closing the tab signs out. */
const TOKEN_STORAGE_KEY = "warga.admin";

export function adminToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeAdminToken(token: string | null) {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Without storage the token still works until the panel closes.
  }
}
