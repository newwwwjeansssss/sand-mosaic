// Display numbering is independent from globally unique disk IDs.
const ownCollections=['ours','competitor2','competitor2other'];
export function collectionOf(level,catalog){return ownCollections.includes(level.editorMeta?.collection)?level.editorMeta.collection:catalog.order.includes(level.id)?'competitor':'other';}
export function collectionLabel(kind){return {ours:'我们',competitor:'竞品1',other:'竞品1其他',competitor2:'竞品2',competitor2other:'竞品2其他'}[kind]||'其他';}
export function sequenceOf(level,catalog){return ownCollections.includes(collectionOf(level,catalog))?level.editorMeta.sequence:catalog.order.indexOf(level.id)+1||null;}
export function filterLevels(records,catalog,collection='ours',search='',order='main'){
 const query=search.trim().toLowerCase();
 return records.filter(r=>collectionOf(r.data,catalog)===collection).filter(r=>!query||[sequenceOf(r.data,catalog)??'',r.data.id,r.data.m_Name,r.data.editorMeta?.sourceName||''].join(' ').toLowerCase().includes(query)).sort((a,b)=>order==='id'?a.data.id-b.data.id:(sequenceOf(a.data,catalog)??a.data.id)-(sequenceOf(b.data,catalog)??b.data.id)||a.data.id-b.data.id);
}
export function counterpart(level,records,catalog,reference='competitor'){
 const collection=collectionOf(level,catalog),n=sequenceOf(level,catalog);if(!n||['other','competitor2other'].includes(collection))return null;
 const target=collection==='ours'?reference:'ours';return records.find(r=>collectionOf(r.data,catalog)===target&&sequenceOf(r.data,catalog)===n)||null;
}
export function nextLevel(level,records,catalog){const rows=filterLevels(records,catalog,collectionOf(level,catalog));return rows[rows.findIndex(r=>r.data.id===level.id)+1]||null;}
export function assignOurMetadata(level,records){const previous=level.editorMeta;level.editorMeta={collection:'ours',sequence:1+Math.max(0,...records.filter(r=>r.data.editorMeta?.collection==='ours').map(r=>r.data.editorMeta.sequence||0)),intent:'自建关卡 · 请试玩验证'};if(previous?.palette){level.editorMeta.palette=structuredClone(previous.palette);level.editorMeta.paletteName=previous.paletteName;}}
