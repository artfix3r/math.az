// Vercel serverless entry. The real handler is bundled by `npm run build`
// (script/build.ts) into dist/server/vercel-handler.mjs; Vercel traces this
// import and ships that bundle with the function.
export { default } from "../dist/server/vercel-handler.mjs";
