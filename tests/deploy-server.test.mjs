import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readlinkSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'wenjiang-deploy-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const deploy = join(root, 'frontend');
  const conf = join(root, 'nginx');
  const bin = join(root, 'bin');
  for (const path of [deploy, conf, bin, join(root, 'payload/assets')]) mkdirSync(path, { recursive: true });
  writeFileSync(join(root, 'payload/index.html'), '<html>new release</html>');
  writeFileSync(join(deploy, 'wenjiang-frontend.nginx.conf'), 'server { listen 80; }');
  assert.equal(spawnSync('tar', ['-czf', join(deploy, 'wenjiang-frontend.tar.gz'), '-C', join(root, 'payload'), '.']).status, 0);
  const script = readFileSync(new URL('../scripts/deploy.sh', import.meta.url), 'utf8')
    .replaceAll('/data/wenjiang/frontend', deploy).replaceAll('/etc/nginx/conf.d', conf);
  writeFileSync(join(root, 'deploy.sh'), script);
  const stubs = {
    id: '#!/bin/sh\necho 0\n',
    nginx: '#!/bin/sh\nexit "${NGINX_TEST_STATUS:-0}"\n',
    systemctl: '#!/bin/sh\nexit "${NGINX_RELOAD_STATUS:-0}"\n',
    // macOS 的 mv 不支持 GNU -T；用 rename 验证 Linux 原子切换的语义。
    mv: `#!${process.execPath}\nconst fs = require('node:fs'); const args = process.argv.slice(2); fs.renameSync(args[1], args[2]);\n`,
  };
  for (const [name, text] of Object.entries(stubs)) writeFileSync(join(bin, name), text, { mode: 0o755 });
  return { root, deploy, conf, run: (env = {}) => spawnSync('sh', [join(root, 'deploy.sh')], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ...env } }) };
}

test('首次部署安装配置并发布，更新保留上一版本且不覆盖已有 Nginx 配置', t => {
  const f = fixture(t);
  const first = f.run();
  assert.equal(first.status, 0, first.stderr);
  const old = readlinkSync(join(f.deploy, 'current'));
  assert.ok(existsSync(join(old, 'index.html')));
  writeFileSync(join(f.conf, 'wenjiang-frontend.conf'), 'custom configuration');
  const second = f.run();
  assert.equal(second.status, 0, second.stderr);
  assert.notEqual(readlinkSync(join(f.deploy, 'current')), old);
  assert.equal(readlinkSync(join(f.deploy, 'previous')), old);
  assert.equal(readFileSync(join(f.conf, 'wenjiang-frontend.conf'), 'utf8'), 'custom configuration');
});

test('Nginx 重载失败恢复上一版，首次失败撤销版本和新增配置', t => {
  const f = fixture(t);
  const failed = f.run({ NGINX_RELOAD_STATUS: '1' });
  assert.notEqual(failed.status, 0);
  assert.equal(existsSync(join(f.deploy, 'current')), false);
  assert.equal(existsSync(join(f.conf, 'wenjiang-frontend.conf')), false);
  assert.equal(f.run().status, 0);
  const old = readlinkSync(join(f.deploy, 'current'));
  assert.notEqual(f.run({ NGINX_RELOAD_STATUS: '1' }).status, 0);
  assert.equal(readlinkSync(join(f.deploy, 'current')), old);
});

test('配置检查失败不切换，已有实体 current 目录不覆盖', t => {
  const f = fixture(t);
  assert.notEqual(f.run({ NGINX_TEST_STATUS: '1' }).status, 0);
  assert.equal(existsSync(join(f.deploy, 'current')), false);
  mkdirSync(join(f.deploy, 'current'));
  writeFileSync(join(f.deploy, 'current/keep'), 'keep');
  assert.notEqual(f.run().status, 0);
  assert.equal(readFileSync(join(f.deploy, 'current/keep'), 'utf8'), 'keep');
});

test('包根目录缺少 index.html 时不替换线上版本', t => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const old = readlinkSync(join(f.deploy, 'current'));
  rmSync(join(f.root, 'payload/index.html'));
  assert.equal(spawnSync('tar', ['-czf', join(f.deploy, 'wenjiang-frontend.tar.gz'), '-C', join(f.root, 'payload'), '.']).status, 0);
  assert.notEqual(f.run().status, 0);
  assert.equal(readlinkSync(join(f.deploy, 'current')), old);
});
