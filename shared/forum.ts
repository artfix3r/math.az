// Q&A forum: what a question or answer may contain, shared by the form and the API.
import { z } from "zod";

export const FORUM_TOPICS = [
  "arithmetic", "fractions", "algebra", "equations", "geometry", "functions",
  "trigonometry", "probability", "calculus", "other",
] as const;

/** A compressed photo, as produced by compressImage() in the browser. */
export const MAX_FORUM_IMAGE_CHARS = 1_500_000;
const IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export function isForumImage(x: string): boolean {
  return x.length <= MAX_FORUM_IMAGE_CHARS && IMAGE_RE.test(x);
}

const image = z.string().max(MAX_FORUM_IMAGE_CHARS).refine((s) => s === "" || isForumImage(s), "Invalid image").default("");

export const forumQuestionInput = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(160),
  body: z.string().trim().max(5000).default(""),
  image,
  topic: z.enum(FORUM_TOPICS).default("other"),
});
export type ForumQuestionInput = z.infer<typeof forumQuestionInput>;

export const forumAnswerInput = z.object({
  body: z.string().trim().max(5000).default(""),
  image,
}).refine((a) => a.body.length > 0 || a.image.length > 0, { message: "Write an answer or add a photo", path: ["body"] });

/** What other users see of an author: first name and initial, never the email. */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
