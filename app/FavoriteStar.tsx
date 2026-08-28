"use client";
import {useFavorites} from "./state/useFavorites";
import type {FavoriteEntry} from "./state/favorites";

// The star toggles membership in the device-local favorites list (audit Phase B), which
// feeds the Favorites filter and the /buylist page.
export default function FavoriteStar({entry,className=""}:{entry:FavoriteEntry;className?:string}){
 const favorites=useFavorites();
 const active=favorites.has(entry.key);
 return <button type="button" className={`favorite-star ${active?"active":""} ${className}`.trim()}
  aria-pressed={active} aria-label={active?`Remove ${entry.name} from favorites`:`Add ${entry.name} to favorites`}
  title={active?"Remove from favorites":"Add to favorites"}
  onClick={event=>{event.preventDefault();event.stopPropagation();favorites.toggle({...entry,addedAt:new Date().toISOString()})}}>
  <span aria-hidden="true">{active?"★":"☆"}</span>
 </button>;
}
