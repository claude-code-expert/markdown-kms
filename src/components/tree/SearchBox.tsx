"use client";

// UI-SPEC "Search Contract" (DOC-04) -- sidebar-top search input + results list. Both live in
// this one file (input row `SearchBox`, results panel `SearchResultsList`, and the
// debounce/race-guard state `useSearchResults`) because FolderTree.tsx places them in two
// non-adjacent DOM slots (searchBox -> header -> tree-or-searchResults) -- the shared state has
// to be lifted to FolderTree either way, so it's exported from here instead of duplicated.
//
// Race guard mirrors autosave-controller.ts's sentSeq comparison (06-PATTERNS): no
// AbortController, no cancellation -- a stale response is discarded purely by comparing its
// sequence number against the latest-fired one.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import styles from "./SearchBox.module.css";

export interface SearchResultItem {
  id: string;
  title: string;
  snippet: string;
  tags: string[];
}

export type SearchStatus = "idle" | "loading" | "results" | "no-results" | "error";

const DEBOUNCE_MS = 300;
const PLACEHOLDER = "문서 검색";
const ERROR_COPY = "검색하지 못했어요.";
const RETRY_COPY = "다시 시도";

function noResultsCopy(query: string) {
  return `'${query}'에 대한 검색 결과가 없어요`;
}

// "idle" covers both "쿼리 없음" and "typing(디바운스 대기 중)" -- status is only ever touched
// once the debounced fetch actually fires, so the tree stays rendered for the whole debounce
// window with zero extra state (UI-SPEC: "이전 상태 유지" during typing).
export function useSearchResults(workspaceId: string) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const seqRef = useRef(0);
  const queryRef = useRef(query);
  queryRef.current = query;

  function runSearch() {
    const trimmed = queryRef.current.trim();
    if (!trimmed) return;
    const seq = (seqRef.current += 1);
    setStatus("loading");
    fetch(`/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(trimmed)}`)
      .then(async (res) => {
        if (seq !== seqRef.current) return; // 늦은 응답 -- 가장 최근 요청만 반영
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const body: { results: SearchResultItem[] } = await res.json();
        if (seq !== seqRef.current) return;
        setResults(body.results);
        setStatus(body.results.length > 0 ? "results" : "no-results");
      })
      .catch(() => {
        if (seq !== seqRef.current) return;
        setStatus("error");
      });
  }

  useEffect(() => {
    if (!query.trim()) {
      seqRef.current += 1; // in-flight 요청 무효화 -- 지우면 즉시 idle/.tree 복귀
      setStatus("idle");
      setResults([]);
      return;
    }
    const timer = setTimeout(runSearch, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, workspaceId]);

  return {
    query,
    setQuery,
    status,
    results,
    retry: runSearch,
    clear: () => setQuery(""),
  };
}

interface SearchBoxProps {
  query: string;
  onQueryChange: (value: string) => void;
  onClear: () => void;
  loading: boolean;
}

export function SearchBox({ query, onQueryChange, onClear, loading }: SearchBoxProps) {
  return (
    <div className={styles.wrapper}>
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        <Search size={16} className={styles.icon} aria-hidden="true" />
      )}
      <input
        className={styles.input}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={PLACEHOLDER}
        aria-label={PLACEHOLDER}
      />
      {query && (
        <button type="button" className={styles.clearButton} aria-label="검색어 지우기" onClick={onClear}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}

interface SearchResultsListProps {
  workspaceId: string;
  status: SearchStatus;
  query: string;
  results: SearchResultItem[];
  onRetry: () => void;
}

export function SearchResultsList({ workspaceId, status, query, results, onRetry }: SearchResultsListProps) {
  if (status === "no-results") {
    return <p className={styles.empty}>{noResultsCopy(query.trim())}</p>;
  }
  if (status === "error") {
    return (
      <p className={styles.error}>
        {ERROR_COPY}
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          {RETRY_COPY}
        </button>
      </p>
    );
  }
  return (
    <div className={styles.searchResults}>
      {results.map((result) => (
        <Link key={result.id} href={`/w/${workspaceId}/d/${result.id}`} className={styles.resultRow}>
          <span className={styles.resultTitle}>{result.title || "제목 없음"}</span>
          <span className={styles.resultSnippet}>{result.snippet}</span>
          {result.tags.length > 0 && (
            <span className={styles.resultTags}>
              {result.tags.map((tag) => (
                <span key={tag} className={styles.resultTag}>
                  {tag}
                </span>
              ))}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
