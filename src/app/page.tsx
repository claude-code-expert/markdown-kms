import { redirect } from "next/navigation";
import { auth } from "@/auth";

// 루트 진입점: 로그인 상태면 대시보드로, 아니면 로그인 화면으로 보낸다.
// (앱 화면은 /login · /signup · /dashboard · /w/[wsId] 에 있고, "/" 자체는 렌더하지 않는다.)
export default async function Home() {
  const session = await auth();
  redirect(session?.user?.id ? "/dashboard" : "/login");
}
