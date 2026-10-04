import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import impeccable from '../extensions/impeccable.ts';
import { commands, readPins } from '../lib/runtime.ts';

function harness(cwd) {
  const events = new Map(), registry = new Map(), tools = [], messages = [], requests = [], notices = [];
  let reloads = 0;
  registry.set('existing', {});
  impeccable({
    on: (name, handler) => events.set(name, handler),
    registerCommand: (name, value) => registry.set(name, value),
    getCommands: () => [...registry.keys()].map((name) => ({name})),
    registerTool: (tool) => tools.push(tool),
    sendMessage: (message, options) => messages.push({message, options}),
    sendUserMessage: (text, options) => requests.push({text, options}),
  });
  const ctx = {cwd, isIdle:()=>true, sessionManager:{getSessionId:()=> 'session.with.dots'}, ui:{notify:(...args)=>notices.push(args)}, reload:async()=>{reloads++;}};
  return {events,registry,tools,messages,requests,notices,ctx,get reloads(){return reloads;}};
}

test('原生命令包含全部设计动作，快捷命令持久化且不覆盖其他命令', async (t) => {
  const cwd = mkdtempSync(join(tmpdir(),'pi-impeccable-extension-'));
  t.after(() => rmSync(cwd, {recursive:true,force:true}));
  let h = harness(cwd);
  const command = h.registry.get('impeccable');
  assert.equal(h.tools[0].name, 'impeccable');
  assert.equal(command.getArgumentCompletions('').filter((item)=>Object.hasOwn(commands,item.value)).length,24);
  for (const name of Object.keys(commands)) {
    await command.handler(`${name} 目标页面`,h.ctx);
    assert.match(h.requests.at(-1).text, new RegExp(`用户请求：/impeccable ${name} 目标页面`));
    assert.match(h.requests.at(-1).text,/reference\/pi\.md/);
  }
  await command.handler('polish 首页', {...h.ctx,isIdle:()=>false});
  assert.equal(h.requests.at(-1).options.deliverAs,'followUp');
  const count = h.requests.length;
  await command.handler('help', h.ctx);
  assert.equal(h.requests.length,count);
  assert.match(h.messages.at(-1).message.content,/\/impeccable typeset/);
  await command.handler('pin audit',h.ctx);
  assert.equal(h.reloads,1); assert.deepEqual(readPins(cwd),['audit']);
  h = harness(cwd);
  await h.events.get('session_start')({},h.ctx);
  await h.registry.get('audit').handler('表单',h.ctx);
  assert.match(h.requests.at(-1).text,/用户请求：\/impeccable audit 表单/);
  h.registry.set('polish',{});
  await h.registry.get('impeccable').handler('pin polish',h.ctx);
  assert.equal(h.notices.at(-1)[1],'error');
  assert.deepEqual(readPins(cwd),['audit']);
  await h.registry.get('impeccable').handler('unpin audit',h.ctx);
  assert.deepEqual(readPins(cwd),[]);
  await h.registry.get('audit').handler('',h.ctx);
  assert.equal(h.notices.at(-1)[1],'warning');
});

test('编辑事件覆盖嵌套调用，深度检查只续调一次，并保留其他边界条目', {skip: process.platform==='win32'}, async (t) => {
  const cwd = mkdtempSync(join(tmpdir(),'pi-impeccable-hook-'));
  const previous = process.env.IMPECCABLE_BIN;
  const binary = join(cwd,'engine');
  writeFileSync(binary, `#!/usr/bin/env node
import fs from 'node:fs';
const argv=process.argv.slice(2);
if(argv[0]==='hook'){
 let input=''; for await (const part of process.stdin) input+=part;
 const event=JSON.parse(input);
 fs.appendFileSync('events.jsonl',JSON.stringify(event)+'\\n');
 if(fs.existsSync('broken'))process.stdout.write('bad-json');
 else process.stdout.write(JSON.stringify({hookSpecificOutput:{additionalContext:event.hook_event_name==='Stop'?'deep':'immediate'}}));
}else{process.stdout.write(JSON.stringify({argv,provider:process.env.IMPECCABLE_PROVIDER_ID,skill:process.env.IMPECCABLE_SKILL_DIR,session:process.env.IMPECCABLE_SESSION_ID}));if(argv[0]==='detect')process.exitCode=2;}
`);
  chmodSync(binary,0o755); process.env.IMPECCABLE_BIN=binary;
  t.after(()=>{
    if(previous===undefined)delete process.env.IMPECCABLE_BIN;else process.env.IMPECCABLE_BIN=previous;
    rmSync(cwd,{recursive:true,force:true});
  });
  const h=harness(cwd);
  const edit=h.events.get('tool_result');
  const event={toolName:'edit',toolCallId:'1',input:{path:'page.css'},isError:false,content:[{type:'text',text:'original'}],structuredContent:{preserve:true}};
  assert.equal(await edit({...event,isError:true},h.ctx),undefined);
  assert.equal(await edit({...event,toolName:'read'},h.ctx),undefined);
  assert.equal(h.messages.length,0);
  await Promise.all([edit(event,h.ctx),edit({...event,toolName:'functions.write',parentToolCallId:'outer'},h.ctx)]);
  assert.equal(h.messages.length,2);
  assert.deepEqual(event.structuredContent,{preserve:true});
  const existing={type:'custom',customType:'other',data:1};
  const boundary={outcome:'completed',entries:[existing],continue:false,context:{canContinue:true}};
  const first=await h.events.get('agent_before_settle')(boundary,h.ctx);
  assert.equal(first.continue,true);
  assert.deepEqual(first.entries[0],existing);
  assert.equal(first.entries[1].content,'deep');
  assert.equal(await h.events.get('agent_before_settle')(boundary,h.ctx),undefined);
  const log=readFileSync(join(cwd,'events.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(log.map((e)=>e.hook_event_name),['PostToolUse','PostToolUse','Stop']);
  assert.ok(log.every((e)=>/^pi-[a-f0-9]{32}$/.test(e.session_id)));
  await h.events.get('before_agent_start')({},h.ctx);
  assert.equal(await h.events.get('agent_before_settle')(boundary,h.ctx),undefined);
  const toolResult=await h.tools[0].execute('tool',{argv:['detect','a; bad command']},undefined,undefined,h.ctx);
  assert.equal(toolResult.isError,false);
  assert.equal(toolResult.details.code,2);
  const data=JSON.parse(toolResult.content[0].text);
  assert.deepEqual(data.argv,['detect','a; bad command']);
  assert.equal(data.provider,'pi'); assert.match(data.skill,/skills\/impeccable$/);
  writeFileSync(join(cwd,'broken'),'1');
  await edit(event,h.ctx);
  await edit(event,h.ctx);
  assert.equal(h.messages.filter(({message})=>message.content.includes('检查未完成')).length,1);
  await h.events.get('before_agent_start')({},h.ctx);
  const messagesBeforeSwitch=h.messages.length;
  const pending=edit(event,h.ctx);
  await h.events.get('session_start')({},h.ctx);
  await pending;
  assert.equal(h.messages.length,messagesBeforeSwitch,'会话切换后丢弃旧检查的迟到结果');
  await h.events.get('session_shutdown')({},h.ctx);
});
