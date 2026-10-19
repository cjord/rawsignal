import assert from 'node:assert/strict';
import test from 'node:test';
import {notificationMilliseconds,parseNotificationDuration,NOTIFICATION_DURATION_KEY} from '../core/domain/notifications.ts';
import {validAccountValue} from '../core/domain/account-data.ts';
import {notify,dismissNotification,clearNotifications,notificationSnapshot,notificationServerSnapshot} from '../app/notifications/store.ts';
test('notification duration is bounded, account-syncable and supports explicit dismissal',()=>{
 for(const value of ['4','8','15','0']){assert.equal(parseNotificationDuration(value),value);assert.equal(validAccountValue(NOTIFICATION_DURATION_KEY,value),true)}
 assert.equal(notificationMilliseconds(null),8000);assert.equal(notificationMilliseconds('0'),0);assert.equal(notificationMilliseconds('999'),8000);assert.equal(parseNotificationDuration('-1'),null);
});
test('notification store is ephemeral, deduplicated and limited to three notices',()=>{
 globalThis.window={};try{
  for(let i=0;i<5;i++)notify('Notice '+i,{id:String(i),duration:0});
  assert.equal(notificationSnapshot().length,3);notify('Updated',{id:'4'});assert.equal(notificationSnapshot().length,3);assert.equal(notificationSnapshot().at(-1).message,'Updated');
  dismissNotification('4');assert.equal(notificationSnapshot().length,2);assert.equal(notificationServerSnapshot().length,0);
 }finally{clearNotifications();delete globalThis.window}
 notify('Server rendering must not notify');assert.equal(notificationSnapshot().length,0);
});
