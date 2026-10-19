import {getSavedItem} from '../account/storage.ts';
import {NOTIFICATION_DURATION_KEY,notificationMilliseconds} from '../../core/domain/notifications.ts';
export type SiteNotification={id:string;message:string;tone:'info'|'success'|'warning';duration:number;createdAt:number};
const empty:SiteNotification[]=[];
let notifications:SiteNotification[]=empty;
const listeners=new Set<()=>void>();
export const notificationSnapshot=()=>notifications;
export const notificationServerSnapshot=()=>empty;
export const subscribeNotifications=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}};
const emit=()=>{for(const listener of listeners)listener()};
export function notify(message:string,options:{id?:string;tone?:SiteNotification['tone'];duration?:number}={}){
 if(typeof window==='undefined')return;
 let stored:null|string=null;try{stored=getSavedItem(NOTIFICATION_DURATION_KEY)}catch{/* Use the accessible default when storage is unavailable. */}
 const id=options.id??crypto.randomUUID(),duration=options.duration??notificationMilliseconds(stored);
 notifications=[...notifications.filter(row=>row.id!==id),{id,message:message.slice(0,500),tone:options.tone??'info',duration,createdAt:Date.now()}].slice(-3);emit();
}
export function dismissNotification(id:string){notifications=notifications.filter(row=>row.id!==id);emit()}
export function clearNotifications(){notifications=empty;emit()}
