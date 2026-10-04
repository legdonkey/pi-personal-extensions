import { createHash } from 'node:crypto';
import { cpSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(process.argv[2] || '/tmp/pi-impeccable-upstream');
const commit = 'ac2ee4231132f39dbc916e527c3fd0ec5b38c6b5';
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim() !== commit) {
  throw new Error('上游提交不匹配。更新快照前必须确认版本和适配规则。');
}
const from = join(source, '.pi/skills/impeccable');
const to = join(root, 'skills/impeccable');
// 启动器由 Pi 运行时提供，同步设计资源时保留它们。
cpSync(from, to, { recursive: true, filter: (path) => ![join(from, 'scripts/impeccable'), join(from, 'scripts/impeccable.cmd')].includes(path) });
cpSync(join(source, 'LICENSE'), join(root, 'LICENSE'));
writeFileSync(join(root, 'NOTICE.md'), readFileSync(join(source, 'NOTICE.md'), 'utf8').replace('# Third-Party Notices\n', '# Third-Party Notices\n\n本包的设计技能与运行资源来自 Paul Bakaus 的 Impeccable。\n上游地址：https://github.com/pbakaus/impeccable。\nPi 适配修改了路径、启动器和宿主规则，保留 Apache-2.0 许可。\n'));
const notice = '<!-- Pi 适配：路径和宿主行为由 pi-impeccable 调整；原始设计指导来自 Paul Bakaus 的 Impeccable，Apache-2.0。 -->\n';
const files = {};
function adapt(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const sourcePath = join(dir, entry.name);
    if (entry.isDirectory()) { adapt(sourcePath); continue; }
    const relative = sourcePath.slice(from.length + 1).replaceAll('\\', '/');
    const path = join(to, relative);
    const original = readFileSync(sourcePath);
    files[relative] = createHash('sha256').update(original).digest('hex');
    if (!path.endsWith('.md')) continue;
    let text = original.toString().replaceAll('.pi/skills/impeccable/scripts', '<skill-base-dir>/scripts');
    if (relative === 'SKILL.md') {
      text = text.replace(/^description: .*$/m, 'description: 设计、重做或改善前端界面时使用。涵盖网站、落地页、仪表盘、产品界面、表单、设置、引导和空状态。支持 UX 评审、无障碍、响应式、性能、字体、配色、布局、动效、文案、设计系统和 Live 浏览器迭代。用户要求 audit、critique、polish、shape、distill、harden、adapt、optimize 等设计命令时使用。纯后端任务不使用。');
      text = text.replace(/^allowed-tools:\n(?:  .*\n)+/m, '');
      text = text.replace('The launcher runs a self-contained binary that ships next to it or is downloaded once on first run; no Node or other runtime is required.', 'The Pi launcher requires Node.js 22.19+ and runs the checksum-pinned official Impeccable engine, downloaded once on first use. Prefer the impeccable tool with argv ["context"] so Pi can report active automatic checks.');
      const end = text.indexOf('\n---', 4) + 4;
      text = text.slice(0, end) + '\n\n' + notice + '\n先阅读 [Pi 宿主规则](reference/pi.md)。它定义本包的命令、工具、浏览器和授权方式。\n' + text.slice(end);
      text = text.replace('**Pin / Unpin:**', '**Pin / Unpin:** Pi 中优先运行 `/impeccable pin <command>` 或 `/impeccable unpin <command>`。以下引擎形式也由本包适配：');
    } else {
      text = notice + '\n' + text;
    }
    writeFileSync(path, text.replace(/[ \t]+$/gm, '').trimEnd() + '\n');
  }
}
adapt(from);
writeFileSync(join(root, 'upstream.json'), JSON.stringify({
  repository: 'https://github.com/pbakaus/impeccable', commit,
  skillVersion: '4.5.0', npmVersion: '4.1.0', engineVersion: '0.1.11',
  source: '.pi/skills/impeccable', files,
}, null, 2) + '\n');
console.log(`已同步 ${Object.keys(files).length} 个上游文件：${commit}`);
