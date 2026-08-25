import type {ReactNode} from "react";
import type {CatalogStatus} from "../data/useCatalogPage";
import type {ViewOption} from "../MarketUI";

export type ActiveFilterItem={key:string;label:string;clear:()=>void};
export type SortOption<T extends string>={label:string;key:T};
export type LeaderboardModeModel<View extends string,Sort extends string>={views:ViewOption<View>[];sorts:SortOption<Sort>[];viewLabel:string;paginationLabel:string};
export type ResultState="loading"|"error"|"empty"|"ready";

export const resultState=(status:CatalogStatus,isEmpty:boolean):ResultState=>status==="loading"||status==="idle"?"loading":status==="error"?"error":isEmpty?"empty":"ready";

export type PaginationModel={page:number;pages:number;onChange:(page:number)=>void;label:string};
export type MarketLeaderboardProps={className:string;id:string;historyStatus?:string;marketStrip?:ReactNode;marketStripPlacement?:"before"|"inside";header:ReactNode;beforeControls?:ReactNode;controls:ReactNode;sortSurface:ReactNode;rowsClassName:string;rowsRole?:"rowgroup";state:ResultState;loadingLabel:string;skeletonCount:number;errorMessage:string;emptyMessage:string;onRetry:()=>void;rows:ReactNode;pagination?:PaginationModel;footer?:ReactNode};
