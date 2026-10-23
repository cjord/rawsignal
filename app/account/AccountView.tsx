"use client";
import TopBar from '../TopBar';
import SiteFooter from '../SiteFooter';
import {useAccount} from './context';
import AccountProfile from './AccountProfile';
import AccountProblem from './AccountProblem';
import LoginForm from './LoginForm';
import {usePreference,STRICTNESS_KEY,parseStrictness} from '../state/usePreference';

export default function AccountView({authError,emailFirst=false,linkHint=false}:{authError?:string;emailFirst?:boolean;linkHint?:boolean}){
 const account=useAccount(),[strictness,setStrictness]=usePreference(STRICTNESS_KEY,parseStrictness,'balanced');
 return <><TopBar strictness={strictness} onStrictness={setStrictness}/><main className="detail-content account-content"><header className="games-heading"><span className="games-eyebrow">Raw Signal</span><h1>{account.user?'Profile & Account':'Account'}</h1></header>
  {!account.enabled?<section className="detail-section"><p>Accounts are not enabled in this environment yet.</p></section>:account.loading?<p role="status">Loading Account…</p>:<>{authError&&<AccountProblem code={authError}/>}{account.user?<AccountProfile/>:<LoginForm emailFirst={emailFirst} linkHint={linkHint}/>}</>}
 </main><SiteFooter/></>;
}
