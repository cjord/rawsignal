import {createRoot} from 'react-dom/client';
import AccountProvider,{useAccount} from '../../app/account/AccountProvider';
import AccountView from '../../app/account/AccountView';
import AdminView from '../../app/admin/AdminView';
import {getSavedItem,setSavedItem} from '../../app/account/storage';
function Probe(){const {user}=useAccount();return <section><button onClick={()=>setSavedItem('raw-signal-theme','light')}>Cloud Preference</button><button onClick={()=>setSavedItem('raw-signal-auction-sound','muted')}>Cloud Sound</button>{[1,2].map(id=><button key={id} onClick={()=>setSavedItem('raw-signal-favorites',JSON.stringify([{productId:id,key:'single:'+id,kind:'single'}]))}>Favorite {id}</button>)}<output aria-label="Scoped Favorite">{getSavedItem('raw-signal-favorites')??'none'}</output><output aria-label="Account Owner">{user?.id??'guest'}</output><output aria-label="Account Name">{user?.name??'guest'}</output></section>}
const query=new URLSearchParams(location.search);
const admin=query.get('adminTab'),view=admin==='overview'||admin==='audit'||admin==='data'||admin==='accounts'||admin==='quality'||admin==='jobs'||admin==='community'?<AdminView tab={admin}/>:<AccountView authError={query.get('error')??undefined} emailFirst={query.get('method')==='email'} linkHint={query.get('link')==='1'}/>;
createRoot(document.getElementById('fixture')!).render(<AccountProvider enabled>{view}<Probe/></AccountProvider>);
