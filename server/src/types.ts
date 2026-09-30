export interface AuthUser {
  userId: string;
  workspaceId: string;
  role: "ADMIN";
  name: string;
  email: string;
  workspaceName: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
    requestId?: string;
  }
}

export function getAuthUser(request: import("express").Request): AuthUser {
  if (!request.user) {
    throw new Error("Authentication middleware did not attach a user");
  }
  return request.user;
}
