export const NOTIFICATION_DURATION_KEY='raw-signal-notification-duration';
export const NOTIFICATION_DURATIONS=[{value:'4',label:'4 Seconds'},{value:'8',label:'8 Seconds (Default)'},{value:'15',label:'15 Seconds'},{value:'0',label:'Until Dismissed'}] as const;
export type NotificationDuration=typeof NOTIFICATION_DURATIONS[number]['value'];
export const parseNotificationDuration=(value:string):NotificationDuration|null=>NOTIFICATION_DURATIONS.some(row=>row.value===value)?value as NotificationDuration:null;
export const notificationMilliseconds=(value:string|null)=>1000*Number(value&&parseNotificationDuration(value)||'8');
