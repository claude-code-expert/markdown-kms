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
import type { EditorView } from "@codemirror/view";
import { HeadingDropdown } from "./HeadingDropdown";
import { plugins } from "./plugins";
import styles from "./Toolbar.module.css";

interface ToolbarProps {
  getView: () => EditorView | null;
}

const GROUP_SIZES = [4, 3, 3, 3];

function buildGroups() {
  let offset = 0;
  return GROUP_SIZES.map((size) => {
    const group = plugins.slice(offset, offset + size);
    offset += size;
    return group;
  });
}

export function Toolbar({ getView }: ToolbarProps) {
  const groups = buildGroups();

  return (
    <div className={styles.bar}>
      <HeadingDropdown getView={getView} />
      <div className={styles.divider} />
      {groups.map((group, groupIndex) => (
        <div key={group[0]?.id ?? groupIndex} className={styles.group}>
          {group.map((plugin) => {
            const Icon = plugin.icon;
            return (
              <div key={plugin.id} className={styles.buttonWrap}>
                <button
                  type="button"
                  className={styles.button}
                  aria-label={plugin.tooltip}
                  onClick={() => {
                    const view = getView();
                    if (!view) return;
                    view.dispatch(plugin.run(view.state));
                    view.focus();
                  }}
                >
                  <Icon size={16} />
                </button>
                <span className={styles.tooltip}>{plugin.tooltip}</span>
              </div>
            );
          })}
          {groupIndex < groups.length - 1 && <div className={styles.divider} />}
        </div>
      ))}
    </div>
  );
}
