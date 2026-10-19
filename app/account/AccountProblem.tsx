"use client";
import {accountProblem} from '../../core/domain/account-errors';
import {useAccount} from './context';
export default function AccountProblem({code}:{code:string}){
 const {user}=useAccount(),problem=accountProblem(code);
 return <section className="detail-section account-panel account-problem" aria-labelledby="account-problem-title"><h2 id="account-problem-title">{problem.title}</h2><p>{problem.message}</p>{problem.linking&&<ol><li>Sign in with email or a method you already connected.</li><li>Open <strong>Sign-In Methods</strong> on your account page.</li><li>Select Link Google or Link Discord, then approve the connection.</li></ol>}<div className="account-social">{user?<a className="game-control" href="/account#sign-in-methods">Manage Sign-In Methods</a>:<a className="game-control account-primary" href="/account?method=email&link=1">Sign In with Email Code</a>}<a className="game-control" href="/account">Back to Sign In</a></div></section>;
}
