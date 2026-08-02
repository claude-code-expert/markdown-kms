// Re-exports rehype-sanitize's UNMODIFIED defaultSchema.
//
// RESEARCH conflict #1 (verified this phase): hast-util-sanitize@5.0.2's defaultSchema
// — the literal dependency of rehype-sanitize@6.0.0 — already permits `del`,
// `input[type=checkbox][disabled]`, `table`+subelements, `align`, and
// `code[className=/^language-./]`. No custom schema merge is needed to satisfy
// EDIT-08's task-checkbox/del/table rendering requirement; a merge is added later
// ONLY if a specific sanitize test proves a real gap (Common Pitfalls #1). This
// supersedes the ROADMAP wording "sanitize schema explicitly extended" — see
// 02-01-SUMMARY.md and 02-03-SUMMARY.md for the amendment record.
export { defaultSchema as schema } from "rehype-sanitize";
