const NAME = 'hi-sc-sign-in';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** The sign-in fields stored in `cookies` (`document.cookie`); none without the cookie. */
export const storedFields = (cookies: string): [string, string][] => {
  const cookie = cookies
    .split('; ')
    .find((entry) => entry.startsWith(`${NAME}=`));
  return cookie
    ? JSON.parse(decodeURIComponent(cookie.slice(NAME.length + 1)))
    : [];
};

/**
 * The cookie that stores the sign-in `fields` for a year, for the path of the
 * page only: other sites on the same host do not get it.
 */
export const fieldsCookie = (fields: FormData) =>
  `${NAME}=${encodeURIComponent(JSON.stringify([...fields]))}; max-age=${MAX_AGE_SECONDS}; SameSite=Strict`;
