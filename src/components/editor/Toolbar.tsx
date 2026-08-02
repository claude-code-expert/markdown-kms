"use client";

// Lucide toolbar driven by the plugin registry (D-P2-04/05: functional icons +
// an immediate hover tooltip; pressed-state animation and the 300ms tooltip
// delay are deferred to Phase 5 and NOT built here). A click dispatches the
// plugin's run(state) through the live EditorView the Toolbar receives from
// EditorHost (index.ts contract: view.dispatch(plugin.run(view.state))).
import type { EditorView } from "@codemirror/view";
import { plugins } from "./plugins";
import styles from "./Toolbar.module.css";

interface ToolbarProps {
  getView: () => EditorView | null;
}

export function Toolbar({ getView }: ToolbarProps) {
  return (
    <div className={styles.bar}>
      {plugins.map((plugin) => {
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
    </div>
  );
}
