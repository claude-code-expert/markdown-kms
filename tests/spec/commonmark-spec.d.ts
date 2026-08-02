// commonmark-spec ships no type declarations and no @types package exists.
// Minimal ambient shape for the one export this suite consumes.
declare module "commonmark-spec" {
  export interface CommonMarkExample {
    markdown: string;
    html: string;
    section: string;
    number: number;
  }
  export const tests: CommonMarkExample[];
}
