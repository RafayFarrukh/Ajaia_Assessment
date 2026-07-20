import type { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 4 does not forward rejected promises to the error middleware;
// every async route is wrapped so thrown errors become clean 500s (or their
// declared status) instead of hanging the request.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
