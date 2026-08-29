"use client";

// Lucide toolbar driven by the plugin registry (D-P2-04/05: functional icons +
// an immediate hover tooltip; pressed-state animation and the 300ms tooltip
// delay are deferred to Phase 5 and NOT built here). A click dispatches the
// plugin's run(state) through the live EditorView the Toolbar receives from
// EditorHost (index.ts contract: view.dispatch(plugin.run(view.state))).
//
// UI-SPEC group order: heading dropdown -> inline(4) -> list(3) -> block(3) ->
// insert(3). `plugins` (index.ts) is already registered in that flat 13-item
// order; GROUP_SIZES below carves it into the 4 flat groups rendered after the
// heading dropdown, each separated by a 1px divider.
import { Fragment } from "react";
import { CloudUpload } from "lucide-react";
import type { EditorView } from "@codemirror/view";
import { LayoutModeToggle } from "../layout/LayoutModeToggle";
import type { LayoutMode } from "../layout/EditorPreviewLayout";
import { HeadingDropdown } from "./HeadingDropdown";
import { plugins } from "./plugins";
import styles from "./Toolbar.module.css";

interface ToolbarProps {
  getView: () => EditorView | null;
  // EDIT-09 (05-01): image is the one button that no longer runs its plugin's run(state) —
  // it opens EditorPreviewLayout's hidden file input instead. Optional so any other Toolbar
  // caller (if one ever exists) keeps working without this prop.
  onImageButtonClick?: () => void;
  // R2 업로드 — 기존 이미지 버튼과 별개의 저장 경로다. 핸들러를 안 넘기면 버튼 자체가
  // 렌더되지 않으므로, R2를 안 쓰는 화면에는 아무 흔적도 남지 않는다.
  onCloudImageButtonClick?: () => void;
  // 보기 모드(분할/에디터만/미리보기만) 세그먼트 — 에디터+프리뷰를 합친 이 통합 툴바의
  // 우측 끝에 함께 둔다(기존엔 titleRow에 별도로 있었음). 둘 다 없으면 렌더하지 않는다.
  layoutMode?: LayoutMode;
  onLayoutModeChange?: (next: LayoutMode) => void;
}

const GROUP_SIZES = [4, 3, 3, 3];

// 기존 "이미지 삽입"과 구분되게 저장 위치를 라벨에 드러낸다. e2e가 이 문자열로 버튼을 잡는다.
const CLOUD_UPLOAD_LABEL = "클라우드에 이미지 업로드";

// 리디자인(README Assets — lucide 목록에서 서식 아이콘 대부분이 빠졌다) — 인라인/목록/블록
// 그룹(10개)은 Mono 타이포그래픽 글리프로, 삽입 그룹(링크/이미지/표)만 lucide 아이콘으로
// 남는다. 플러그인 파일(1기능 1파일)은 안 건드리고 이 파일에만 로컬 매핑을 둔다 — run()
// 순수함수·아이콘 메타는 플러그인 소유, 어떤 글리프로 "보이는지"는 Toolbar의 프레젠테이션.
const GLYPH: Partial<Record<string, { text: string; className?: string }>> = {
  bold: { text: "B" },
  italic: { text: "I", className: styles.glyphItalic },
  strikethrough: { text: "S", className: styles.glyphStrike },
  "inline-code": { text: "</>", className: styles.glyphSmall },
  "bullet-list": { text: "•" },
  "ordered-list": { text: "1.", className: styles.glyphSmall },
  "task-list": { text: "☑" },
  blockquote: { text: "❝", className: styles.glyphQuote },
  "code-block": { text: "{ }", className: styles.glyphSmall },
  hr: { text: "—" },
};

function buildGroups() {
  let offset = 0;
  return GROUP_SIZES.map((size) => {
    const group = plugins.slice(offset, offset + size);
    offset += size;
    return group;
  });
}

export function Toolbar({
  getView,
  onImageButtonClick,
  onCloudImageButtonClick,
  layoutMode,
  onLayoutModeChange,
}: ToolbarProps) {
  const groups = buildGroups();

  return (
    <div className={styles.bar}>
      <HeadingDropdown getView={getView} />
      <div className={styles.divider} />
      {groups.map((group, groupIndex) => (
        <div key={group[0]?.id ?? groupIndex} className={styles.group}>
          {group.map((plugin) => {
            const Icon = plugin.icon;
            const glyph = GLYPH[plugin.id];
            return (
              <Fragment key={plugin.id}>
              <div className={styles.buttonWrap}>
                <button
                  type="button"
                  className={styles.button}
                  aria-label={plugin.tooltip}
                  // Keep the editor focused: a plain button mousedown blurs the EditorView,
                  // and the blur→dispatch→focus round-trip lets the browser restore the pre-insert
                  // DOM selection, dropping the caret in FRONT of the just-inserted marker instead
                  // of the position the plugin's TransactionSpec set. preventDefault stops the blur.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    const view = getView();
                    if (!view) return;
                    if (plugin.id === "image") {
                      onImageButtonClick?.();
                      return;
                    }
                    view.dispatch(plugin.run(view.state));
                    view.focus();
                  }}
                >
                  {glyph ? (
                    <span className={`${styles.glyph} ${glyph.className ?? ""}`}>{glyph.text}</span>
                  ) : (
                    <Icon size={15} />
                  )}
                </button>
                <span className={styles.tooltip}>{plugin.tooltip}</span>
              </div>
              {/* 이미지 버튼 바로 오른쪽 — 같은 "삽입" 맥락이라 그룹을 새로 만들지 않고 옆에
                  붙인다. 기존 버튼은 서버 로컬 디스크로, 이쪽은 R2로 나간다. 툴팁이
                  .buttonWrap 기준으로 위치를 잡으므로 wrap을 따로 둔다. */}
              {plugin.id === "image" && onCloudImageButtonClick && (
                <div className={styles.buttonWrap}>
                  <button
                    type="button"
                    className={styles.button}
                    aria-label={CLOUD_UPLOAD_LABEL}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (!getView()) return;
                      onCloudImageButtonClick();
                    }}
                  >
                    <CloudUpload size={15} />
                  </button>
                  <span className={styles.tooltip}>{CLOUD_UPLOAD_LABEL}</span>
                </div>
              )}
              </Fragment>
            );
          })}
          {groupIndex < groups.length - 1 && <div className={styles.divider} />}
        </div>
      ))}
      {layoutMode && onLayoutModeChange && (
        <div className={styles.modeToggleWrap}>
          <LayoutModeToggle mode={layoutMode} onChange={onLayoutModeChange} />
        </div>
      )}
    </div>
  );
}
