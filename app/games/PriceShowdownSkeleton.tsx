import type {PriceGameDifficulty} from "../../core/domain/price-game";

export default function PriceShowdownSkeleton({difficulty}:{difficulty:PriceGameDifficulty}){
 return <div className={`price-game-round price-game-skeleton mode-${difficulty}`} aria-hidden="true">
  {Array.from({length:difficulty==="hard"?3:2},(_,index)=><div className="price-game-choice-skeleton" key={index}>
   <div className="price-game-name"><span className="detail-skeleton price-game-name-skeleton"/></div>
   <div className="price-game-art"><span className="price-game-image detail-skeleton"/></div>
   <span className="price-game-reveal"/>
  </div>)}
 </div>;
}
