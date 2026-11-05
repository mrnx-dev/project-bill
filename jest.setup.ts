import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// jsdom has no `Request`/`Response`. API-route tests hand handlers plain stub objects, but
// the route module (and next/server internals) still need the globals to exist at import time.
class MinimalResponse {
  status = 200;
  headers = new Map<string, string>();
  body: string | null;
  _body: string | null;
  static json(body: unknown, init?: { status?: number }) {
    // next/server's NextResponse.json does `new NextResponse(response.body, response)`:
    // expose the payload as .body (a BodyInit string) so the wrapper can hand it back.
    return new MinimalResponse(JSON.stringify(body ?? null), init);
  }
  constructor(body?: string | null, init?: { status?: number; headers?: Record<string, string> }) {
    this.status = init?.status ?? 200;
    this.headers = new Map(Object.entries(init?.headers ?? {}));
    this.body = body ?? null;
    this._body = body ?? null;
  }
  async json() {
    return this._body === null || this._body === undefined ? null : JSON.parse(this._body);
  }
}
if (typeof Response === "undefined") {
  // jest's jsdom env may not expose Response at all — install the stand-in.
  (globalThis as unknown as { Response: unknown }).Response = MinimalResponse;
  (globalThis as unknown as { Request: unknown }).Request = class {};
} else if (typeof (Response as unknown as { json?: unknown }).json !== "function") {
  // jsdom's Response lacks the static json(); next/server's NextResponse.json calls
  // Response.json under the hood, so add it.
  (Response as unknown as { json: unknown }).json = MinimalResponse.json;
}
