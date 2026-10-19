import type {AnchorHTMLAttributes} from 'react';
// The isolated account fixture exercises auth UI, not vinext's navigation runtime.
export default function FixtureLink({children,...props}:AnchorHTMLAttributes<HTMLAnchorElement>){return <a {...props}>{children}</a>}
