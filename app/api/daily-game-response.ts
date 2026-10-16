import {NextResponse} from 'next/server';
import {utcGameDate,validGameDate} from '../../core/domain/daily-game.ts';

export async function dailyGameResponse(request:Request,load:(date?:string)=>Promise<{date:string}|null>){
 const requested=new URL(request.url).searchParams.get('date')??undefined,today=utcGameDate(Date.now());
 if(requested!==undefined&&(!validGameDate(requested)||requested>today))return NextResponse.json({error:'Invalid challenge date'},{status:400,headers:{'Cache-Control':'no-store'}});
 try{
  const manifest=await load(requested);if(!manifest)return NextResponse.json({error:'This daily snapshot is unavailable'},{status:404,headers:{'Cache-Control':'no-store'}});
  const seconds=manifest.date<today?600:Math.max(0,Math.min(300,Math.floor((Date.parse(`${manifest.date}T00:00:00Z`)+86400000-Date.now())/1000)));
  return NextResponse.json(manifest,{headers:{'Cache-Control':`public, max-age=${seconds}, s-maxage=${seconds}`}});
 }catch{return NextResponse.json({error:'The daily challenge is not available yet. Please try again later.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
