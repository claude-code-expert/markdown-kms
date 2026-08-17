"use client";

// UI-SPEC "Tag Meta Bar Contract" — chip list + bare input, mounted between titleRow and body
// (DocumentWorkspace.tsx). Follows the same "immediate local update + background save" pattern
// as handleTitleChange (title input) rather than the tree's "server-confirmed only" convention
// — a tag operation is a replace-all PUT on an already-confirmed document, so an optimistic
// local update with revert-on-failure is safe and simpler (06-UI-SPEC rationale).
import { useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";
import { Tag, X } from "lucide-react";
import styles from "./TagBar.module.css";

const DUPLICATE_ERROR = "이미 추가된 태그예요";
const SAVE_ERROR = "태그를 저장하지 못했어요. 다시 시도해 주세요.";
const LIMIT_PLACEHOLDER = "최대 3개까지 추가할 수 있어요";
const DEFAULT_PLACEHOLDER = "태그 추가 (Enter로 추가)";
const TAG_LIMIT = 3;

interface TagBarProps {
  documentId: string;
  initialTags: string[];
  // 우측 50% — 저장/수정/삭제 버튼(DocumentWorkspace가 소유한 핸들러 그대로 넘겨받아 렌더만
  // 담당, TagBar는 문서 액션을 모른다).
  actions?: ReactNode;
}

// Pure fetch-result extraction (discardDraft/downloadExport convention) — never throws, a
// network failure resolves to false same as a non-ok response.
async function saveTags(documentId: string, tags: string[]): Promise<boolean> {
  try {
    const res = await fetch(`/api/documents/${documentId}/tags`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function TagBar({ documentId, initialTags, actions }: TagBarProps) {
  const [tags, setTags] = useState(initialTags);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const atLimit = tags.length >= TAG_LIMIT;

  async function addTag() {
    const value = input.trim();
    if (!value || atLimit) return;

    const isDuplicate = tags.some((t) => t.toLowerCase() === value.toLowerCase());
    if (isDuplicate) {
      // UI-SPEC "duplicate-rejected": no chip is created, input just clears — the error clears
      // itself on the next keystroke (handleChange), no timer.
      setInput("");
      setError(DUPLICATE_ERROR);
      return;
    }

    const previous = tags;
    const next = [...tags, value];
    setTags(next);
    setInput("");
    setError(null);
    if (!(await saveTags(documentId, next))) {
      setTags(previous);
      setError(SAVE_ERROR);
    }
  }

  async function removeTag(tag: string) {
    const previous = tags;
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    setError(null);
    if (!(await saveTags(documentId, next))) {
      setTags(previous);
      setError(SAVE_ERROR);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      void addTag();
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setInput(event.target.value);
    if (error) setError(null);
  }

  return (
    <div>
      <div className={styles.bar}>
        <div className={styles.left}>
          <Tag size={14} className={styles.icon} aria-hidden="true" />
          <div className={styles.chips}>
            {tags.map((tag) => (
              <span key={tag} className={styles.chip}>
                <span className={styles.chipText} title={tag}>
                  {tag}
                </span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => void removeTag(tag)}
                  aria-label={`${tag} 태그 삭제`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              className={styles.input}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={atLimit}
              placeholder={atLimit ? LIMIT_PLACEHOLDER : DEFAULT_PLACEHOLDER}
              aria-label="태그 입력"
            />
          </div>
        </div>
        {actions && <div className={styles.right}>{actions}</div>}
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
