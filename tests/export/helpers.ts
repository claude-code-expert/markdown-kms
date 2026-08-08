// Shared Request/ctx builders for export route tests — both export routes are single-param GET
// routes with no body, so this is a thin shim (documents/[id]/route.ts test files build their
// own PUT/DELETE request helpers inline since those have bodies; GET-only export routes don't
// need that).
export function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

export function exportRequest(id: string, kind: "documents" | "folders") {
  return new Request(`http://localhost/api/${kind}/${id}/export`);
}
