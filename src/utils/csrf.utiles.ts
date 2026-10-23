
import { doubleCsrf} from 'csrf-csrf';

const isProd = process.env.NODE_ENV === 'production';

export const {
  generateCsrfToken,
  validateRequest,
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'your-super-strong-csrf-secret-key',
  getSessionIdentifier: (req: any) => String(req.user?.id ?? ''), // 
  cookieName: isProd ? '__Host-csrf' : 'csrfToken',
  cookieOptions: {
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    httpOnly: true, // 
    path: '/',
  },
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'], // 
});