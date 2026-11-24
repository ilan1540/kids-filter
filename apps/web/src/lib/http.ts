import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = () => new HttpError(401, "unauthorized");
export const notFound = () => new HttpError(404, "not_found");

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  return schema.parse(body);
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: turns HttpError and ZodError into JSON responses. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) return Response.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
      console.error(err);
      return Response.json({ error: "internal_error" }, { status: 500 });
    }
  };
}
