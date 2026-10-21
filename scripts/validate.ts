import { release } from '../src/core/catalog';
import { validateGraph } from '../src/core/graph';
import { validateSearchProfiles, searchPolicy } from '../src/server/search-policy';
const errors = [...validateGraph(release), ...validateSearchProfiles(release), ...release.nodes.filter(n => n.type === 'subdomain' && !searchPolicy(n.id)).map(n => `专题无有效检索来源或查询：${n.id}`)];
if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
}
else
    console.log(`知识图结构检查通过：${release.nodes.length} 节点，${release.edges.length} 关系。草稿要求 ${release.requirements.filter(r => r.quality === 'draft').length} 条；结构通过不代表内容全面核验。`);
