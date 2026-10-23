import {expect,type Page} from '@playwright/test';

export async function expectAuctionMarketFooter(page:Page,contentSelector:string){
 const footer=page.getByRole('region',{name:'Market Snapshot Status',exact:true});
 await expect(footer).toHaveCount(1);
 await expect.poll(async()=>{
  const content=await page.locator(contentSelector).boundingBox(),status=await footer.boundingBox();
  return Boolean(content&&status&&status.y>=content.y+content.height-1);
 }).toBe(true);
}
