import { createHash } from 'node:crypto';
import { openDatabase } from '../src/db/client';
import { release } from '../src/core/catalog';
import { validateGraph } from '../src/core/graph';
import { migrate } from '../src/db/migrate';
const command = process.argv[2];
if (!['migrate', 'seed', 'demo'].includes(command))
    throw new Error('需要 migrate、seed 或 demo。');
const demo = command === 'demo';
const db = openDatabase(demo ? 'data/demo.db' : undefined, command === 'migrate' || demo);
try {
    if (command === 'migrate' || demo) {
        migrate(db);
        console.log('迁移完成。');
    }
    if (command === 'seed' || demo) {
        const errors = validateGraph(release);
        if (errors.length)
            throw new Error(errors.join('\n'));
        const body = JSON.stringify(release), hash = createHash('sha256').update(body).digest('hex'), now = new Date().toISOString();
        db.transaction(() => {
            const old = db.prepare('SELECT hash FROM knowledge_releases WHERE id=?').get(release.id) as {
                hash: string;
            } | undefined;
            if (old && old.hash !== hash)
                throw new Error('已发布版本不可改写；请创建新的 release ID。');
            if (old)
                return;
            db.prepare('INSERT INTO knowledge_releases VALUES (?,?,?,?,?)').run(release.id, hash, body, now, now);
            const n = db.prepare('INSERT INTO nodes VALUES (?,?,?,?,?,?)');
            for (const node of release.nodes)
                n.run(release.id, node.id, node.type, JSON.stringify(node), now, now);
            const e = db.prepare('INSERT INTO edges VALUES (?,?,?,?,?,?,?,?)');
            for (const edge of release.edges)
                e.run(release.id, edge.id, edge.from, edge.to, edge.type, JSON.stringify(edge), now, now);
        })();
        console.log('知识库同步完成；个人资料保持不变。');
    }
    if (demo) {
        db.transaction(() => { db.prepare('DELETE FROM profiles').run(); })();
        console.log('仅重置 data/demo.db；演示身份由浏览器单独创建。');
    }
}
finally {
    db.close();
}
