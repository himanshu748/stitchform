import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("starts the social draft with the required hackathon tag", () => {
  const post = readFileSync(
    new URL("../../SOCIAL_POST.md", import.meta.url),
    "utf8",
  );
  expect(post.startsWith("#KiroweenHackathon26")).toBe(true);
});

it("discloses the hackathon in the blog draft", () => {
  const blog = readFileSync(
    new URL("../../BLOG_DRAFT.md", import.meta.url),
    "utf8",
  );
  expect(blog).toContain("Kiroween 2026 hackathon");
});
