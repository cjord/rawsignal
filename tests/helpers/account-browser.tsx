import {createRoot} from 'react-dom/client';
import AccountProvider,{useAccount} from '../../app/account/AccountProvider';
import AccountView from '../../app/account/AccountView';
import {getSavedItem,setSavedItem} from '../../app/account/storage';
function Probe(){const {user}=useAccount();return <section><button onClick={()=>setSavedItem('raw-signal-theme','light')}>Cloud Preference</button><button onClick={()=>setSavedItem('raw-signal-auction-sound','muted')}>Cloud Sound</button><output aria-label="Scoped Favorite">{getSavedItem('raw-signal-favorites')??'none'}</output><output aria-label="Account Owner">{user?.id??'guest'}</output><output aria-label="Account Name">{user?.name??'guest'}</output></section>}
const query=new URLSearchParams(location.search);
createRoot(document.getElementById('fixture')!).render(<AccountProvider enabled><AccountView authError={query.get('error')??undefined} emailFirst={query.get('method')==='email'} linkHint={query.get('link')==='1'}/><Probe/></AccountProvider>);
