import { app, ready } from "./index";

// Vercel serverless entry. `ready` resolves once the DB schema is ensured and
// all Express routes + the error handler are registered, so every cold start
// awaits full initialization before handing the request to Express.
export default async function handler(req: any, res: any) {
  await ready;
  return app(req, res);
}
