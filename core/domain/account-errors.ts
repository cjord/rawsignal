export type AccountProblem={title:string;message:string;linking:boolean};
const linking:AccountProblem={title:'Connect This Sign-In Method',message:'This sign-in method is not linked to your account yet. Sign in using an existing method, then connect it under Settings → Profile & Account. Your saved progress will stay unchanged.',linking:true};
const problems:Record<string,AccountProblem>={
 staging_admin_only:{title:'Staging Is for Administrators',message:'Your account can sign in on rawsignal.cards. Staging account access is limited to approved administrators; your production saves are unchanged.',linking:false},
 account_not_linked:linking,
 email_does_not_match:{title:'Choose the Matching Account',message:'The sign-in email does not match this Raw Signal account. Try the matching provider account. Accounts with different emails are not linked automatically.',linking:true},
 account_already_linked_to_different_user:{title:'This Sign-In Is Already Connected',message:'This provider identity belongs to another Raw Signal account. No accounts or saved progress were merged. Sign in to the account you want to use before trying again.',linking:true},
 access_denied:{title:'Sign-In Was Cancelled',message:'Permission was not granted. You can try again or choose another sign-in method. Your saved progress has not changed.',linking:false},
};
const expired:AccountProblem={title:'Start Sign-In Again',message:'This sign-in attempt expired or could not be verified. Return to sign-in and start a fresh attempt in this browser.',linking:false};
export function accountProblem(code:string):AccountProblem{
 const key=code.toLowerCase();return (Object.hasOwn(problems,key)?problems[key]:undefined)??(['state_mismatch','state_not_found','state_expired','invalid_state','session_expired'].includes(key)?expired:{title:'Sign-In Could Not Be Completed',message:'Please return to sign-in and try again. If you already have an account, use an existing sign-in method. Your saved progress has not changed.',linking:false});
}
const requestMessages:Record<string,string>={
 STAGING_ADMIN_ONLY:'Staging sign-in is limited to administrators. Use rawsignal.cards for your account.',
 IDENTITY_READ_ONLY:'Manage shared sign-in methods and account security on rawsignal.cards. Staging saves stay separate.',
 INVALID_OTP:'That code is not correct. Check the newest email and try again.',
 OTP_EXPIRED:'That code has expired. Request a new code and use the newest email.',
 TOO_MANY_ATTEMPTS:'Too many incorrect attempts. Request a new code when the resend timer finishes.',
 SESSION_NOT_FRESH:'Please sign in again before making this security change.',
 SESSION_EXPIRED:'Your session expired. Sign in again to continue.',
 UNAUTHORIZED:'Please sign in again to continue.',
};
export function accountRequestMessage(status:number,code?:string){return (Object.hasOwn(requestMessages,code??'')?requestMessages[code!]:undefined)??(status===429?'Too many requests. Wait for the timer before trying again.':status>=500?'The account service is temporarily unavailable. Please try again shortly.':status===401?'Please sign in again to continue.':'That account request could not be completed. Please try again.');}
