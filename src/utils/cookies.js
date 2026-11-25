import env from "../config/env.js";

const baseOpts = () => {
  const sameSite = env.COOKIE_SAMESITE || "lax";
  return {
    httpOnly: true,
    secure: sameSite === "none" ? true : env.COOKIE_SECURE,
    sameSite,
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
};

/**
 * Set the access + refresh cookies on a response. Names are stable so the
 * Next.js middleware can rely on them.
 */
export function setAuthCookies(res, { accessToken, refreshToken }) {
  if (accessToken) {
    res.cookie("access_token", accessToken, {
      ...baseOpts(),
      maxAge: env.JWT_ACCESS_TTL_MS,
    });
  }
  if (refreshToken) {
    res.cookie("refresh_token", refreshToken, {
      ...baseOpts(),
      maxAge: env.JWT_REFRESH_TTL_MS,
    });
  }
}

export function clearAuthCookies(res) {
  res.cookie("access_token", "", { ...baseOpts(), maxAge: 0 });
  res.cookie("refresh_token", "", { ...baseOpts(), maxAge: 0 });
}