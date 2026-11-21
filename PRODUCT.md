# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Private tutors (repetitor)** running a handful of groups, often preparing students for exams. They build quizzes, assign homework, grade written answers and follow each student's progress. (Confirmed: primary.)
- **Tutoring centres** with several teachers and many groups, using the same tools at a larger scale. (Confirmed: primary.)
- **Students of mixed ages**, from primary school through university-entrance preparation, who take quizzes, open materials, join live lessons and check their results. (Confirmed: mixed ages.)
- **Parents**, who open a read-only progress link without an account. (From the product: parent links.)

Most use happens on **phones**, especially by students. Teachers also build quizzes and review results, which is heavier work. (Confirmed: phones mostly.)

## Product Purpose

math.az lets a tutor run their maths teaching in one place: groups, quizzes and homework with deadlines, learning materials, live-lesson links, grading, and per-student progress by topic. Students get one place to do their work and see how they are improving; parents can follow along. Success means tutors spend less time on admin and grading, and students and parents can see progress clearly.

## Positioning

Built for maths specifically: real formula rendering in questions and answers, numeric answers with tolerance, a question bank organised by topic and difficulty, per-student randomised variants, and printable quizzes with answer keys. It is in Azerbaijani first, with Russian and English. Exam practice in the Azerbaijani exam format is planned but not built yet (open decision, format not confirmed).

## Operating Context

- Tutors create groups (e.g. "9A"), add students by email or username, build quizzes (by hand or from the question bank), set due dates, and review submissions. Some still give tests on paper and print quizzes.
- Students work mostly on phones: open the quiz list, take timed quizzes, upload photos of written work, and get reminder emails before deadlines.
- Live lessons happen on external meeting links (e.g. Zoom/Meet); math.az schedules and links them.
- Languages: Azerbaijani (default), Russian, English, switchable in the interface.

## Capabilities and Constraints

- Roles: teacher and student; parents only through a read-only link. Any user can sign up as a teacher.
- Question types: multiple choice, multi-select, true/false, fill in the blank, numeric (with tolerance), open (teacher-graded), photo answer (teacher-graded).
- Formulas written in LaTeX between `$` signs, rendered with KaTeX.
- Stack: React + Vite + Tailwind + shadcn/ui components, Express API, Postgres and file storage on Supabase, hosted on Vercel. Hash-based routing.
- Every interface string exists in AZ, RU and EN; new copy must be added in all three.
- Not yet decided: exam-practice format; whether centres need a multi-teacher admin view.

## Brand Commitments

- The name **math.az**.
- Interface language order and default: Azerbaijani first.

## Evidence on Hand

- No testimonials, user counts, school partnerships, pricing or exam-success statistics exist. Future work must not invent any.
- No logo file beyond the text wordmark and app icon in the codebase.

## Product Principles

1. Phone first for students: every student task must be comfortable one-handed on a small screen.
2. Maths must look like maths: formulas, numbers and scores are the content and get the clearest typography.
3. Save the tutor's time: the most frequent teacher actions (assign, grade, check progress) are the shortest paths.
4. Progress over scores: show students and parents where to improve, not only a number.
5. Three languages are equal citizens: layouts must hold for the longest translation.
