---
version: 1
slug: "client-src-pages-dashboard-tsx"
primary_target: "client/src/pages/dashboard.tsx"
related_targets: ["client/src/pages/shell.tsx","client/src/pages/quizzes.tsx","client/src/pages/take-quiz.tsx","client/src/pages/quiz-results.tsx","client/src/components/progress-report.tsx","client/src/pages/quiz-builder.tsx","client/src/pages/landing.tsx"]
---

# App shell and student/teacher work screens

Scope: the signed-in app (shell, dashboard, quiz list, take-quiz, results, progress, builder) and the public landing page. Visitor mode: Operate for the app screens; the landing page is Persuade within the same world.

Audience and job: private tutors and tutoring centres (build quizzes, assign homework, grade, follow progress, mostly on a laptop) and students of mixed ages (do quizzes and check results, mostly on phones). Constraints: AZ/RU/EN strings, every existing feature and route keeps working, standard controls only.

Memorable moment: a finished quiz comes back marked like a teacher's red pen — the score circled in red handwriting, ticks and crosses beside answers.

Unresolved: exam-practice surfaces (format not confirmed); a centre-level admin view.

## Direction contract

THESIS: math.az is a maths exercise book that grades itself. It refuses the category default of purple gradient cards and pastel icon tiles; the work reads as pages of an exercise book, and judgement arrives as a teacher's red pen.

OWN-WORLD: White exercise-book paper on a pale blue-grey ground; ink-blue (#2340A0) for actions, links and selection; a deep ink-blue cover (#1B2F73) for the desktop navigation rail; graphite text (#1C2433); teacher red (#D92D2D) reserved for marks, overdue and wrong answers; green (#1E8A53) for correct; amber (#B7791F) for due soon. Onest for all interface text with tabular figures, Caveat only for red-pen marks. Squared 5 mm grid appears only where writing happens (question sheets, landing). Flat paper surfaces with hairline borders, small radii (6px), no gradients, no shadows beyond a 1px paper lift.

STORY: A student opens the app on a phone, sees what is due next and how far away, opens a quiz that looks like a clean worksheet page, submits, and gets it back marked in red pen with the score circled; their progress page says which topics need practice. A tutor sees which homework is open, who has not submitted, and what to grade, and can build or print a quiz without hunting.

FIRST VIEWPORT: Student dashboard on a 390px phone: compact top bar (wordmark left, language right); a "Next up" block listing the nearest-due homework with due time and a primary ink-blue "Start" button; below it the latest marked result as a small paper slip with the red circled score; a fixed bottom tab bar (Home, Quizzes, Progress, Materials, More) with ink-blue active state. Desktop teacher: ink-blue cover rail on the left, work area on paper ground with "To grade" and "Due this week" first.

FORM: grounded candidate 1 of 7 (squared exercise book), chosen by the user as the pick over the dealt Baku Metro direction; seed:96afde8559b0f6ff
Signature interaction: marking — results, grades and teacher feedback appear as red-pen marks (circled score, tick/cross, short handwritten remark) with a single draw-on stroke when a result first appears; reduced motion shows them static.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
