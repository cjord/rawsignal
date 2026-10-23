"use client";
import {useFavorites} from "./state/useFavorites";
import type {FavoriteEntry} from "./state/favorites";
import {useAccount} from './account/context';

// The star toggles membership in the device-local favorites list (audit Phase B), which
// feeds the Favorites filter and the /buylist page.
export default function FavoriteStar({entry,className=""}:{entry:FavoriteEntry;className?:string}){
 const favorites=useFavorites();
 const account=useAccount();
 const active=favorites.has(entry.key);
 return <button type="button" disabled={account.loading||!!account.error} className={`favorite-star ${active?"active":""} ${className}`.trim()}
  aria-pressed={active} aria-label={active?`Remove ${entry.name} from favorites`:`Add ${entry.name} to favorites`}
  title={active?"Remove from favorites":"Add to favorites"}
  onClick={event=>{event.preventDefault();event.stopPropagation();favorites.toggle({...entry,addedAt:new Date().toISOString()})}}>
  <span aria-hidden="true">{active?"★":"☆"}</span>
 </button>;
}
