import {createRoot} from 'react-dom/client';
import NotificationHost from '../../app/notifications/NotificationHost';
import NotificationSettings from '../../app/notifications/NotificationSettings';
import {notify} from '../../app/notifications/store';
import {useAuctionSave} from '../../app/games/useAuctionSave';
function Fixture(){const {save,error}=useAuctionSave();return <><main><h1>Notification Fixture</h1><NotificationSettings/><button onClick={()=>notify('Test notification',{id:'test'})}>Notify</button><output>{save?.revision}</output>{error&&<p role="alert">{error}</p>}</main><NotificationHost/></>}
createRoot(document.getElementById('fixture')!).render(<Fixture/>);
