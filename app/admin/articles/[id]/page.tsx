import ArticlesAdmin from '../ArticlesAdmin';
export const metadata={title:'Article Editor — Raw Signal',robots:{index:false,follow:false}};
export default async function EditArticlePage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ArticlesAdmin id={id}/>}
