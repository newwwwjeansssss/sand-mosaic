// 关卡发现规则。不要在这里维护固定文件数组；WebView 会扫描 level/ 目录。
export const LEVEL_FILE_PATTERN = /^level-\d+\.json$/i;

export function sortLevelFiles(names = []) {
  return [...names].filter(name => LEVEL_FILE_PATTERN.test(name)).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
}

// Competitor paths stay compatible with the original viewer; authored levels are separate.
export const LEVEL_DIRECTORIES=['level','our-level','competitor2-level'];
export async function scanLevelFiles(list){
 const groups=await Promise.all(LEVEL_DIRECTORIES.map(async directory=>{
  const listing=await list(directory);
  return sortLevelFiles(listing.entries.filter(e=>e.type==='file').map(e=>e.name)).map(name=>({name,path:directory+'/'+name,type:'file'}));
 }));
 return groups.flat();
}
