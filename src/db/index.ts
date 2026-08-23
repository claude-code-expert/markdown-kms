import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// 값이 없으면 postgres.js 는 에러 대신 기본값(localhost:5432)으로 접속을 시도한다. 배포 환경에서
// 이건 ECONNREFUSED 로만 드러나 원인 파악이 어려우므로, AUTH_SECRET 처럼 즉시 throw 시킨다.
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// prepare: false — pooled 엔드포인트(PgBouncer transaction mode)는 prepared statement 를
// 보장하지 않는다. 플랜 캐싱만 포기하면 되므로 direct 연결에서도 안전한 기본값이다.
const client = postgres(url, { prepare: false });
export const db = drizzle(client);
