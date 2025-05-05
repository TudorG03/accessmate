// Utility for storing and retrieving the access token without causing circular dependencies

let accessToken: string | null = null;

export function getAccessToken() {
    return accessToken;
}

export function setAccessToken(token: string | null) {
    accessToken = token;
}
