import { beforeEach, describe, expect, it } from "vitest";
import { runLint } from "@/lib/lint";
import { getStore } from "@/lib/store";
import { ENGINE_VERSION } from "@/lib/version";
import { DELETE, GET, PATCH } from "./route";

async function createReport() {
  const { report, snapshot, durationMs } = await runLint({
    mode: "paste",
    snapshot: {
      serverInfo: { name: "route-test" },
      tools: [{ name: "search_items", description: "Search items by query." }]
    }
  });
  const created = await getStore().create({
    report,
    snapshot,
    ingestMethod: "paste",
    durationMs,
    engineVersion: ENGINE_VERSION
  });
  return { ...created, report };
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function ownerRequest(
  url: string,
  method: "PATCH" | "DELETE",
  id: string,
  token: string,
  body?: unknown
) {
  return new Request(url, {
    method,
    headers: {
      cookie: `mcplint_owner_${id}=${token}`,
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

describe("/api/report/[id]", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("returns an unlisted report without granting ownership to other visitors", async () => {
    const created = await createReport();
    const response = await GET(
      new Request(`http://localhost/api/report/${created.id}`),
      params(created.id)
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: created.id,
      visibility: "unlisted",
      isOwner: false,
      report: { server: { name: "route-test" } }
    });
  });

  it("requires the owner token to change visibility", async () => {
    const created = await createReport();
    const denied = await PATCH(
      new Request(`http://localhost/api/report/${created.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visibility: "public" })
      }),
      params(created.id)
    );
    expect(denied.status).toBe(403);

    const allowed = await PATCH(
      ownerRequest(
        `http://localhost/api/report/${created.id}`,
        "PATCH",
        created.id,
        created.deleteToken,
        { visibility: "public" }
      ),
      params(created.id)
    );
    expect(allowed.status).toBe(200);
    await expect(getStore().get(created.id)).resolves.toMatchObject({ visibility: "public" });
  });

  it("lets only the owner delete the report", async () => {
    const created = await createReport();
    const response = await DELETE(
      ownerRequest(
        `http://localhost/api/report/${created.id}`,
        "DELETE",
        created.id,
        created.deleteToken
      ),
      params(created.id)
    );
    expect(response.status).toBe(200);
    await expect(getStore().get(created.id)).resolves.toBeNull();
  });
});
