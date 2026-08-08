// Shared Korean NFC/NFD fixture strings for search tests -- Hangul syllable "gak" as a single
// precomposed NFC codepoint (U+AC01) vs the same grapheme decomposed into 3 NFD jamo codepoints
// (choseong g + jungseong a + jongseong g: U+1100 U+1161 U+11A8). Centralized so
// nfc-normalize.test.ts's two directions (NFD query -> NFC stored, and the reverse) share one
// source of truth instead of re-deriving the codepoints inline (DOC-04, 06-RESEARCH Pitfall 1).
//
// NOTE: both constants below render identically in any editor/terminal (fonts compose adjacent
// jamo visually the same way NFC does) -- they are NOT the same string at the codepoint level.
// Built from explicit \u escapes (not pasted literal characters) so no editor/tool
// auto-normalization on save can silently collapse the two forms into the same bytes.
export const NFC_GAK = "각"; // precomposed syllable, 1 codepoint / 3 UTF-8 bytes
export const NFD_GAK = "각"; // decomposed jamo, 3 codepoints / 9 UTF-8 bytes
