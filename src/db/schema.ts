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
// 먼저 지운 뒤 folder 행을 지워야 한다(Phase 4 RESEARCH Pitfall 4). pg_trgm GIN 인덱스(title/content)
// 는 Phase 6 custom SQL 마이그레이션이 담당 — 이 DSL에는 없다(documentTag 테이블 주석 참고).
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

// TRD §3 / §7 (FR-E10): draft 크래시 복구. document_id 자체가 PK — 문서당 1행 upsert 불변식을
// 서러게이트 키 없이 DB가 강제(onConflictDoUpdate target). 인덱스 불필요(PK 조회만).
export const documentDraft = pgTable("document_draft", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => document.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// TRD §3 (DOC-03): 문서 태그. (document_id, tag) 복합 PK가 자연히 완전동일 문자열 중복을 막는다
// (대소문자만 다른 중복은 애플리케이션 레이어 dedup, src/lib/documents.ts replaceTags). 최대 3개
// 제약은 저장 트랜잭션 COUNT 검증(REQUIREMENT §6) — 여기 DB 제약으로 넣지 않는다. pg_trgm GIN
// 인덱스(document.title/content)는 의도적으로 이 DSL에 없다 — custom SQL 마이그레이션 전용
// (drizzle-kit이 gin_trgm_ops 연산자 클래스를 누락하는 버그, 06-RESEARCH Pitfall 2).
export const documentTag = pgTable(
  "document_tag",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (table) => [primaryKey({ columns: [table.documentId, table.tag] })],
);

// TRD §3 (WS-03/WS-04): 워크스페이스 가입 신청. status는 PENDING/APPROVED/REJECTED만
// 허용(workspaceMember.role CHECK와 동일 관례). 중복 PENDING 방지는 애플리케이션 레벨 SELECT
// 가드(빠른 실패용)와 DB partial unique index(workspace_id, user_id) WHERE status='PENDING'
// 둘 다로 처리 — 후자가 실제 동시성 가드(WR-03, drizzle/0008_join_request_pending_unique.sql
// custom SQL 마이그레이션. pg_trgm 선례처럼 이 DSL에는 없음).
export const workspaceJoinRequest = pgTable(
  "workspace_join_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("PENDING"),
    decidedBy: uuid("decided_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "workspace_join_request_status_check",
      sql`${table.status} IN ('PENDING','APPROVED','REJECTED')`,
    ),
  ],
);

// TRD §3 / §9 (WS-05, NFR-3.3): 초대. 토큰 원문·mac은 저장하지 않는다 — id·expiresAt만
// 보관하고 서명은 검증 시점에 src/lib/invitation-token.ts가 재계산한다. createdBy는 TRD
// DDL 리터럴대로 onDelete 미지정(folder.parentId 선례처럼 cascade 없이 그대로 준수).
export const invitation = pgTable("invitation", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  inviteeId: uuid("invitee_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => user.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
