import type { HTMLAttributes } from "react";
import styles from "./Card.module.css";

// Ported from docs/ui-kit.html id:'card' (#5) surface tokens — generalized as a plain
// container (border/radius/padding), since ui-kit's own markup is product-card specific
// and this phase's cards (auth surface, workspace grid) have no image/price fields.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const classes = [styles.card, className].filter(Boolean).join(" ");
  return <div className={classes} {...props} />;
}
