"use client";
import {useAccount} from '../account/context';
export default function AddToCollectionButton({productId,kind,game,printing}:{productId:number;kind:string;game:string;printing:string}){
 const account=useAccount();if(!account.features?.collections||!['pokemon','riftbound','onepiece'].includes(game)||kind==='single'&&game==='onepiece')return null;
 const params=new URLSearchParams({add:String(productId),kind,game,printing});return <p className="collection-detail-action">
<a className="game-control account-primary" href={account.user?'/collections?'+params:'/account'}>{account.user?'Add to Collection':'Log In to Add to Collection'}</a>
</p>;
}
export function CollectionImportLink(){const account=useAccount();return account.user&&account.features?.collections?<p>
<a className="game-control account-primary" href="/collections?reviewImport=1">Save Reviewed Items to a Collection</a>
</p>:null}
