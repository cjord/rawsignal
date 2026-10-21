// Builds a narrow, reviewable identity import. Never imports sessions, provider tokens,
// verification codes, recovery keys or game saves. Input/output files must stay private.
const literal=value=>value===null?'NULL':`'${String(value).replaceAll("'","''")}'`;
const safeId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
export function accountIdentityImport({users,accounts},allowedEmails){
 const allowed=new Set(allowedEmails.map(email=>email.trim().toLowerCase()));
 if(!Array.isArray(users)||!Array.isArray(accounts)||!allowed.size)throw new Error('Verified identity import requires an explicit allowlist');
 const ids=new Set(),emails=new Set(),links=new Set();
 const statements=[];
 for(const user of users){
  const email=typeof user.email==='string'?user.email.trim().toLowerCase():'';
  if(!safeId(user.id)||!allowed.has(email)||![true,1].includes(user.emailVerified)||ids.has(user.id)||emails.has(email)||typeof user.name!=='string'||!Number.isFinite(Date.parse(user.createdAt))||!Number.isFinite(Date.parse(user.updatedAt)))throw new Error('Invalid, duplicate or unapproved identity');
  ids.add(user.id);emails.add(email);
  const values=[user.id,user.name,email,1,user.image??null,user.createdAt,user.updatedAt];
  statements.push(`INSERT INTO auth_user(id,name,email,emailVerified,image,createdAt,updatedAt) VALUES(${values.map(literal).join(',')}) ON CONFLICT(id) DO NOTHING;`);
 }
 for(const account of accounts){
  const link=JSON.stringify([account.providerId,account.accountId]);
  if(!safeId(account.id)||!ids.has(account.userId)||!['google','discord','credential'].includes(account.providerId)||typeof account.accountId!=='string'||!account.accountId||account.accountId.length>512||links.has(link)||!Number.isFinite(Date.parse(account.createdAt))||!Number.isFinite(Date.parse(account.updatedAt)))throw new Error('Invalid or duplicate provider link');
  links.add(link);
  // Explicit field projection is intentional: token-like properties are ignored.
  const values=[account.id,account.accountId,account.providerId,account.userId,account.createdAt,account.updatedAt];
  statements.push(`INSERT INTO auth_account(id,accountId,providerId,userId,createdAt,updatedAt) VALUES(${values.map(literal).join(',')}) ON CONFLICT(id) DO NOTHING;`);
 }
 return {sql:statements.join('\n')+'\n',users:ids.size,links:links.size};
}
