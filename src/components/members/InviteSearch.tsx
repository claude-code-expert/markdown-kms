"use client";

// Task 1 stub — MembersView needs this import to typecheck before Task 2 implements the real
// search+invite flow (SearchBox's useSearchResults debounce/race-guard, POST invitations).
interface InviteSearchProps {
  wsId: string;
}

export function InviteSearch(props: InviteSearchProps) {
  void props;
  return null;
}
