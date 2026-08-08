import {
  AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const user = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // nullable — OAuth-only accounts in R3
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspace = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false), // D-15 개정: 소프트 삭제 (TRD §3)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMember = pgTable(
  "workspace_member",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    check("workspace_member_role_check", sql`${table.role} IN ('OWNER','ADMIN','EDITOR','VIEWER')`),
  ],
);

// TRD §3: 폴더 트리. parent_id는 NULL = 워크스페이스 루트 직속 (워크스페이스 자체를 표현하는
// folder 행은 없음). 형제 이름 유일성 제약은 의도적으로 없음(CONTEXT.md 잠금).
export const folder = pgTable(
  "folder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // self-FK: 순환 타입 참조를 피하려 리턴 타입을 AnyPgColumn으로 명시
    parentId: uuid("parent_id").references((): AnyPgColumn => folder.id),
    name: text("name").notNull(),
    isDeleted: boolean("is_deleted").notNull().default(false),
    isTrashRoot: boolean("is_trash_root").notNull().default(false), // 직접 삭제 항목만 true (PRD §2-2)
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // NFR-2.2: 활성 조회 부분 인덱스 (TRD §3)
    index("folder_active_idx")
      .on(table.workspaceId, table.parentId)
      .where(sql`${table.isDeleted} = false`),
  ],
);

// 폴더 계층 Closure Table. self-reference(depth=0) 포함 (REQUIREMENT §6, TRD §3)
export const folderClosure = pgTable(
  "folder_closure",
  {
    ancestorId: uuid("ancestor_id")
      .notNull()
      .references(() => folder.id, { onDelete: "cascade" }),
    descendantId: uuid("descendant_id")
      .notNull()
      .references(() => folder.id, { onDelete: "cascade" }),
    depth: integer("depth").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ancestorId, table.descendantId] }),
    index("folder_closure_descendant_idx").on(table.descendantId),
  ],
);

// TRD §3: 문서. folder_id는 ON DELETE CASCADE가 없다(NO ACTION) — 완전삭제는 document 행을
// 먼저 지운 뒤 folder 행을 지워야 한다(Phase 4 RESEARCH Pitfall 4). document_tag/document_draft/
// trigram(gin) 인덱스는 각각 Phase 6/5 — 이 phase는 의도적으로 만들지 않는다(CLAUDE.md 불변식).
export const document = pgTable(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => folder.id),
    title: text("title").notNull().default("제목 없음"),
    content: text("content").notNull().default(""),
    savedSeq: bigint("saved_seq", { mode: "number" }).notNull().default(0), // TRD §7 자동 저장 순서 가드
    isDeleted: boolean("is_deleted").notNull().default(false),
    isTrashRoot: boolean("is_trash_root").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // NFR-2.2: 활성 조회 부분 인덱스 (TRD §3)
    index("document_active_idx")
      .on(table.workspaceId, table.folderId)
      .where(sql`${table.isDeleted} = false`),
  ],
);
