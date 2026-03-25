export function fromSession(session) {
    return {
        user: session.user,
        accessToken: session.tokens.accessToken,
        refreshToken: session.tokens.refreshToken
    };
}
