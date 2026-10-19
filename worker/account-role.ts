import type {AccountEnv} from './account-auth.ts';
export type AccountRole='member'|'admin';
// Roles come only from a verified server session and an operator-managed allowlist.
// Never accept roles, allowlists or email verification claims from client saves.
export function accountRole(user:{email:string;emailVerified:boolean},env:Pick<AccountEnv,'AUTH_ADMIN_EMAILS'>):AccountRole{
 const admins=(env.AUTH_ADMIN_EMAILS??'').split(',').map(email=>email.trim().toLowerCase()).filter(Boolean);
 return user.emailVerified&&admins.includes(user.email.trim().toLowerCase())?'admin':'member';
}
