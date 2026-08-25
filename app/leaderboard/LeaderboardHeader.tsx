import type {ReactNode} from "react";

export default function LeaderboardHeader({className,kicker,kickerClassName,title,description,summary,aside}:{className:string;kicker:string;kickerClassName?:string;title:string;description?:string;summary:ReactNode;aside?:ReactNode}){
 return <div className={className}><div><p className={kickerClassName}>{kicker}</p><h2>{title}</h2>{description&&<p>{description}</p>}{summary}</div>{aside}</div>;
}
