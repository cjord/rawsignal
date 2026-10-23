import {createRoot} from 'react-dom/client';
import {AccountContext,accountDefaults} from '../../app/account/context';
import CollectionsView from '../../app/collections/CollectionsView';
import NotificationHost from '../../app/notifications/NotificationHost';
const guest=new URLSearchParams(location.search).has('guest');
createRoot(document.getElementById('fixture')!).render(<><AccountContext.Provider value={{...accountDefaults,enabled:true,user:guest?null:{id:'collection-owner',name:'Collector',email:'collector@example.test',emailVerified:true},features:{recovery:false,audit:false,collections:true},updateName(){}}}><CollectionsView initialQuery={location.search.slice(1)}/></AccountContext.Provider><NotificationHost/></>);
