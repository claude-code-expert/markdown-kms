// UI-SPEC Export Menu Contract "클릭 동작" — fetch -> blob -> hidden <a download> synthetic
// click, browser's own download chrome handles progress (no app-level loading UI, per spec).
// Mirrors DocumentWorkspace.tsx's discardDraft: a pure fetch-result-to-boolean function exported
// so the failure/rejection path is unit-testable without rendering a component. Never throws.
export async function downloadExport(url: string, fallbackFilename: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fallbackFilename;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  } catch {
    return false;
  }
}
