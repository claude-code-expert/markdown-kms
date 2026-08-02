"use client";

// Uncontrolled CM6 mount (RESEARCH Pattern 3 / Pitfall 3): mounted exactly once
// via a useEffect with an empty dependency array. Content is only ever read OUT
// via updateListener — NEVER pushed back in as a controlled prop — which is what
// keeps Korean/CJK IME composition safe (a mid-composition dispatch would
// otherwise corrupt the in-progress composed characters).
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { editorKeymap } from "./plugins";
import styles from "./EditorHost.module.css";

export interface EditorHostHandle {
  getView: () => EditorView | null;
}

interface EditorHostProps {
  onChange: (content: string) => void;
}

export const EditorHost = forwardRef<EditorHostHandle, EditorHostProps>(function EditorHost(
  { onChange },
  ref
) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useImperativeHandle(ref, () => ({
    getView: () => viewRef.current,
  }));

  useEffect(() => {
    if (!parentRef.current) return;

    const state = EditorState.create({
      doc: "",
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        editorKeymap,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });

    const view = new EditorView({ state, parent: parentRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []); // mount once — never re-run (IME safety, RESEARCH Pitfall 3)

  return <div ref={parentRef} className={styles.host} />;
});
