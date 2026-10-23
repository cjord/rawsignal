import {expect,type Locator} from '@playwright/test';

export async function expectAuctionPagination(nav:Locator){
 const bounds=await nav.boundingBox(),left=await nav.getByRole('button').first().boundingBox(),right=await nav.getByRole('button').last().boundingBox(),center=await nav.getByRole('status').boundingBox();
 expect(Math.abs(left!.x-bounds!.x)).toBeLessThan(1);
 expect(Math.abs(right!.x+right!.width-bounds!.x-bounds!.width)).toBeLessThan(1);
 expect(Math.abs(center!.x+center!.width/2-bounds!.x-bounds!.width/2)).toBeLessThan(1);
 expect(left!.height).toBeGreaterThanOrEqual(44);expect(right!.height).toBeGreaterThanOrEqual(44);
}
