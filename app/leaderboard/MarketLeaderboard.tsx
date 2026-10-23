"use client";
import {NumberedPagination} from "../MarketUI";
import type {MarketLeaderboardProps} from "./types";
import MarketLoadingRows from './MarketLoadingRows';

export default function MarketLeaderboard({className,id,historyStatus,header,beforeControls,controls,sortSurface,rowsClassName,rowsRole,state,loadingLabel,skeletonCount,errorMessage,emptyMessage,onRetry,rows,pagination,paginationAside,footer}:MarketLeaderboardProps){
 const displayState=state==="empty"&&(historyStatus==="loading"||historyStatus==="partial")?"loading":state;
 const content=displayState==="loading"?<MarketLoadingRows rowsClassName={rowsClassName} label={loadingLabel} count={skeletonCount}/>:displayState==="error"?<div className="market-data-state" role="alert"><b>{errorMessage}</b><button type="button" onClick={onRetry}>Try again</button></div>:displayState==="empty"?<div className="market-data-state"><b>{emptyMessage}</b></div>:rows;
 return <section className={className} id={id} data-history-status={historyStatus}>{header}{beforeControls}{controls}{sortSurface}<div className={rowsClassName} role={rowsRole}>{content}</div>{displayState==="ready"&&pagination&&<div className="pagination-row"><NumberedPagination {...pagination}/>{paginationAside}</div>} {footer}</section>;
}
