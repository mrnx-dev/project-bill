/**
 * @jest-environment node
 *
 * The helper only touches `window.sessionStorage` and `window.location.reload`, so the tests use a
 * hand-rolled window. jsdom's `location.reload` is own/non-configurable and `window.location`
 * cannot be redefined, which makes the real reload path untestable there.
 */
import { isStaleServerActionError, reloadOnceOnStaleServerAction } from "@/lib/stale-server-action";

const GUARD_KEY = "stale-server-action-reload-at";
const STALE = () => new Error('Failed to find Server Action "40bdbe05fe5166690a490c63eb6a33cf427e3bade9"');

type FakeWindow = {
    sessionStorage: {
        getItem: (key: string) => string | null;
        setItem: (key: string, value: string) => void;
        removeItem: (key: string) => void;
        clear: () => void;
    };
    location: { reload: jest.Mock };
};

let store: Map<string, string>;

function installWindow(): FakeWindow {
    store = new Map<string, string>();
    const fake: FakeWindow = {
        sessionStorage: {
            getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
            setItem: (key, value) => void store.set(key, value),
            removeItem: (key) => void store.delete(key),
            clear: () => store.clear(),
        },
        location: { reload: jest.fn() },
    };
    (globalThis as unknown as { window?: FakeWindow }).window = fake;
    return fake;
}

afterEach(() => {
    delete (globalThis as unknown as { window?: FakeWindow }).window;
});

describe("isStaleServerActionError", () => {
    it("matches the server-side wording", () => {
        expect(isStaleServerActionError(STALE())).toBe(true);
    });

    it("matches the deployment hint and the error page slug", () => {
        expect(
            isStaleServerActionError(new Error("This request might be from an older or newer deployment.")),
        ).toBe(true);
        expect(
            isStaleServerActionError(new Error("https://nextjs.org/docs/messages/failed-to-find-server-action")),
        ).toBe(true);
    });

    it("matches what the browser sees for a 404 action POST", () => {
        expect(
            isStaleServerActionError(new Error("An unexpected response was received from the server.")),
        ).toBe(true);
    });

    it.each([
        ["redis down", new Error("connect ECONNREFUSED 127.0.0.1:6379")],
        ["network error", new TypeError("Failed to fetch")],
        ["unauthorized", new Error("Unauthorized")],
        ["empty object", {}],
        ["null", null],
        ["undefined", undefined],
        ["number", 42],
    ])("ignores %s", (_label: string, error: unknown) => {
        expect(isStaleServerActionError(error)).toBe(false);
    });

    it("accepts a plain string or an object carrying a message", () => {
        expect(isStaleServerActionError('Failed to find Server Action "abc"')).toBe(true);
        expect(isStaleServerActionError({ message: 'Failed to find Server Action "abc"' })).toBe(true);
    });
});

describe("reloadOnceOnStaleServerAction", () => {
    it("does not reload for unrelated errors", () => {
        const fake = installWindow();
        expect(reloadOnceOnStaleServerAction(new Error("Unauthorized"))).toBe(false);
        expect(fake.location.reload).not.toHaveBeenCalled();
    });

    it("reloads once and tells the caller to stop polling", () => {
        const fake = installWindow();
        expect(reloadOnceOnStaleServerAction(STALE())).toBe(true);
        expect(fake.location.reload).toHaveBeenCalledTimes(1);
        expect(store.has(GUARD_KEY)).toBe(true);
    });

    it("does not reload again inside the 60s guard window", () => {
        const fake = installWindow();
        reloadOnceOnStaleServerAction(STALE());
        expect(reloadOnceOnStaleServerAction(STALE())).toBe(true);
        expect(fake.location.reload).toHaveBeenCalledTimes(1);
    });

    it("reloads again once the guard window has passed", () => {
        const fake = installWindow();
        reloadOnceOnStaleServerAction(STALE());
        store.set(GUARD_KEY, String(Date.now() - 120_000));
        expect(reloadOnceOnStaleServerAction(STALE())).toBe(true);
        expect(fake.location.reload).toHaveBeenCalledTimes(2);
    });

    it("still reports 'stop polling' when there is no window (SSR)", () => {
        expect(typeof window).toBe("undefined");
        expect(reloadOnceOnStaleServerAction(STALE())).toBe(true);
        expect(reloadOnceOnStaleServerAction(new Error("Unauthorized"))).toBe(false);
    });
});
