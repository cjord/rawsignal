"use client";
/* eslint-disable react-hooks/set-state-in-effect -- wall-clock deadlines refresh only while an account countdown is active. */
import {useEffect,useState} from 'react';
export function useDeadline(deadline:number){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{setNow(Date.now());if(!deadline)return;const timer=window.setInterval(()=>{const time=Date.now();setNow(time);if(time>=deadline)clearInterval(timer)},1000);return()=>clearInterval(timer)},[deadline]);
 return Math.max(0,Math.ceil((deadline-now)/1000));
}
