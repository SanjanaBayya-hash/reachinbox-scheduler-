export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export {};
