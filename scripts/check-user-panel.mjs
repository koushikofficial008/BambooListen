import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
assert.match(html,/class="console-open-btn"[^>]*>Console<\/button>/);
assert.match(html,/id="song-upload-form"/);
assert.match(html,/value="music"/);
assert.match(html,/value="phonk"/);
assert.match(html,/value="funk"/);
assert.match(html,/value="slowed"/);
assert.match(html,/10\*1000\*1000/);
assert.match(html,/1000\*1000/);
assert.match(html,/fetch\('\/api\/songs\?status=approved'/);
assert.doesNotMatch(html,/firebase|itunes|btn-google-login/i);
assert.doesNotMatch(html,/<div id="auth-screen"/i);
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());
assert.ok(scripts.length>0,"inline app script must exist");
for(const source of scripts){const result=spawnSync(process.execPath,["--check"],{input:source,encoding:"utf8"});assert.equal(result.status,0,result.stderr||"Inline JavaScript syntax check failed");}
console.log("User panel markup, requested upload limits, and inline JavaScript checks passed.");
