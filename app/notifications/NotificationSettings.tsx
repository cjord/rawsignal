"use client";
import {usePreference} from '../state/usePreference';
import {NOTIFICATION_DURATION_KEY,NOTIFICATION_DURATIONS,parseNotificationDuration} from '../../core/domain/notifications';
export default function NotificationSettings(){
 const [duration,setDuration]=usePreference(NOTIFICATION_DURATION_KEY,parseNotificationDuration,'8');
 return <label className="notification-settings">Notification Duration<select aria-label="Notification Duration" value={duration} onChange={event=>{const next=parseNotificationDuration(event.target.value);if(next)setDuration(next)}}>{NOTIFICATION_DURATIONS.map(row=><option key={row.value} value={row.value}>{row.label}</option>)}</select><small>Messages pause while hovered, focused, or in a hidden tab. Important save errors stay visible on the page.</small></label>;
}
