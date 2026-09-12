"use client";

export default function FilterPanelHeader({onClose}:{onClose:()=>void}){
 return <div className="filter-panel-header"><strong>Filters</strong><button type="button" onClick={onClose} aria-label="Close filters">Close <span aria-hidden="true">×</span></button></div>;
}
