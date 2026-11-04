/**
 * Helpers for detecting a stale Server Action reference in the browser.
 *
 * Next.js derives Server Action ids at build time, so every deployment produces a new set of
 * ids. A tab that was opened before a deploy keeps posting the ids that were baked into its
 * HTML, and the new server answers `Failed to find Server Action "<id>"` (HTTP 404). The same
 * situation surfaces client-side as a rejected fetch with a generic body-parse error.
 *
 * Polling components hit this on every tick, so instead of flooding the server log and the
 * console, they detect it once and reload the page to pick up the current build.
 */

const STALE_ACTION_MARKERS = [
    // Server-side wording (Next.js 15/16).
    "Failed to find Server Action",
    // The error page URL slug, in case only the URL survives into the message.
    "failed-to-find-server-action",
    // Text of the server error itself.
    "older or newer deployment",
    // What the browser actually sees when the action POST comes back 404/non-RSC.
    "An unexpected response was received from the server",
];

const RELOAD_GUARD_KEY = "stale-server-action-reload-at";
const RELOAD_GUARD_WINDOW_MS = 60_000;

/** True when the given error looks like "this page belongs to a different deployment". */
export function isStaleServerActionError(error: unknown): boolean {
    const message =
        error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : typeof error === "object" && error !== null && "message" in error
                ? String((error as { message: unknown }).message ?? "")
                : "";

    if (!message) return false;
    return STALE_ACTION_MARKERS.some((marker) => message.includes(marker));
}

/**
 * Reloads the page when `error` is a stale-action error, and reports whether the caller should
 * stop its loop. A 60s guard stops a genuinely broken deployment from reloading in a loop.
 */
export function reloadOnceOnStaleServerAction(error: unknown): boolean {
    if (!isStaleServerActionError(error)) return false;
    if (typeof window === "undefined") return true;

    const now = Date.now();
    try {
        const lastReload = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
        if (Number.isFinite(lastReload) && now - lastReload < RELOAD_GUARD_WINDOW_MS) {
            // Reloaded less than a minute ago and the action is still unknown: the deployment
            // is genuinely broken, so keep the page as-is instead of looping.
            return true;
        }
        window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
    } catch {
        // sessionStorage can be unavailable (privacy mode, disabled storage). Reload anyway.
    }

    window.location.reload();
    return true;
}
