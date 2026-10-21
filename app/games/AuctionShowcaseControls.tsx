import type {AuctionSave} from '../../core/domain/auction-types';
import AuctionLink from './AuctionLink';
export default function AuctionShowcaseControls({save,error,editing,loaded,toggle,share}:{save:AuctionSave;error:string|null;editing:boolean;loaded:boolean;toggle:()=>void;share:()=>void}){
 return <><div className="auction-actions"><button className="game-control game-control-primary" type="button" disabled={Boolean(save.auction)} onClick={toggle}>{editing?'Done Editing':'Edit Showcase'}</button><button className="game-control game-control-secondary" type="button" disabled={!loaded} onClick={share}>Share Showcase</button><AuctionLink className="game-control game-control-secondary" href="/games/riftbound-auction/profile">Profile Preview &amp; Appearance</AuctionLink></div>{save.auction&&<p className="games-note">Finish your active auction before editing. Its timer keeps running while you are here.</p>}{error&&<p role="alert">{error}</p>}</>;
}
