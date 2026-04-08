import type { JwtPayload } from '../utils/jwt';

declare global {
  namespace Express {
    // Extend Express.User with JwtPayload fields so req.user works for both:
    // - Our JWT middleware (sets req.user = JwtPayload)
    // - Passport OAuth callbacks (sets req.user = Express.User)
    interface User extends JwtPayload {}
    // Keep the explicit override so the type is JwtPayload-compatible throughout
    interface Request {
      user?: JwtPayload;
    }
  }
}
