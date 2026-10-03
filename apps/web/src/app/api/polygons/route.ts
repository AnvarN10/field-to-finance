import { RequestError } from "@/lib/errors";
import { uploadPolygon } from "@/lib/polygons";
import { getStore } from "@/lib/server/context";

export const dynamic = "force-dynamic";
const MAX_BYTES = 256 * 1024;

export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > MAX_BYTES) return Response.json({ error: "GeoJSON is larger than 256 KB" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "body is not JSON" }, { status: 400 });
  }
  try {
    return Response.json(await uploadPolygon(getStore(), body));
  } catch (e) {
    if (e instanceof RequestError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
