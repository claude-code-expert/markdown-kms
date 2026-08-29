// 배포 직전 마이그레이션을 적용한다. package.json의 `vercel-build`가 `next build` 앞에서 부른다.
//
// 왜 필요한가: git push → Vercel 자동 배포는 코드만 옮긴다. 마이그레이션이 수동 단계로 남아
// 있으면 "새 컬럼을 읽는 코드"가 "그 컬럼이 없는 DB"보다 먼저 프로덕션에 도착할 수 있다.
// 2026-08-29에 실제로 그렇게 터졌다 — 0009 미적용 상태로 배포되어 가입이 전부
// `column "email_verified" does not exist`(42703)로 500이 났다.
//
// MIGRATE_DATABASE_URL이 없으면 **아무것도 하지 않고 통과**한다. 이 변수를 설정하지 않은
// 환경(로컬, preview, 다른 개발자)의 빌드는 이 스크립트가 있기 전과 완전히 동일하게 동작한다.
// 자동화를 켜는 스위치가 곧 그 변수다.
import { spawnSync } from "node:child_process";

const url = process.env.MIGRATE_DATABASE_URL;

if (!url) {
  console.log("[migrate-on-build] MIGRATE_DATABASE_URL 미설정 — 마이그레이션을 건너뜁니다.");
  process.exit(0);
}

console.log("[migrate-on-build] 마이그레이션 적용 중…");

// drizzle.config.ts는 DATABASE_URL을 읽는다. 여기에 별도 변수를 쓰는 이유는 런타임용
// DATABASE_URL이 **pooled**(PgBouncer) 엔드포인트이기 때문이다 — DDL은 unpooled로 가야 한다
// (docs/connect.md 1단계). 그래서 unpooled 문자열을 담은 변수를 따로 두고 여기서만 주입한다.
const result = spawnSync("pnpm", ["exec", "drizzle-kit", "migrate"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});

if (result.status !== 0) {
  // 여기서 빌드를 세우는 것이 핵심이다. 마이그레이션이 실패했는데 배포가 계속되면 방금 그
  // 사고가 그대로 재현된다 — 스키마를 앞서가는 코드가 프로덕션에 올라간다.
  console.error("[migrate-on-build] 마이그레이션 실패 — 빌드를 중단합니다.");
  process.exit(result.status ?? 1);
}

console.log("[migrate-on-build] 완료.");
