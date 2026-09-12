"use client";
import {useState} from "react";
import useDismissibleDetails from "./useDismissibleDetails";

export default function useFilterDraft<T>(committed:T){
 const {root,close}=useDismissibleDetails(),[draft,setDraft]=useState(committed);
 const onToggle=()=>{if(root.current?.open)setDraft(committed)};
 return{root,draft,setDraft,onToggle,close};
}
