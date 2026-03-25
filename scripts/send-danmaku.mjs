#!/usr/bin/env node
// 向B站视频指定时间点发送弹幕
// 用法: node scripts/send-danmaku.mjs <BV号>
// 弹幕列表在脚本底部 DANMAKU_LIST 中编辑

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIES_PATH = path.resolve(__dirname, "..", "bili_cookies.txt");

const SESSDATA = "d4aaec09%2C1789969049%2C8d5a4%2A31CjATnOvhi8yaxXPdeivWpMHJk6DnWPHZMW55XNxRqf8Nv8Ev8F5Vshjf_yjo1Omh37ISVld2YkJKVUYwdWZDR0c3amxFUEdWU2VwOXc1aTZUVF93aVFtbGdEZnVvYURBN0FUS1prNHYzVlBYMjVoS3FsWGszaXhidE92RVhWVFRkcFJJTjA4Z2ZBIIEC";
const BILI_JCT = "8b086ed59fe65c4a0fddb9a0db4181e3";

const COOKIE = `SESSDATA=${SESSDATA}; bili_jct=${BILI_JCT}`;

// ==================== 弹幕列表 ====================
// time: 秒数（视频进度），msg: 弹幕内容
// color: 可选，默认白色(16777215)。常用：红=16711680, 蓝=255, 绿=65280, 黄=16776960
// mode: 1=滚动(默认), 4=底部, 5=顶部
const DANMAKU_LIST = [
  { time: 1, msg: "来了来了" },
  { time: 5, msg: "前排" },
  { time: 12, msg: "这个排行有意思" },
  { time: 22, msg: "第五名是什么？" },
  { time: 30, msg: "三国杀！确实经典" },
  { time: 38, msg: "影之诗画风真的好看" },
  { time: 50, msg: "万智牌 TCG始祖" },
  { time: 60, msg: "游戏王猜到了" },
  { time: 70, msg: "第一名应该没悬念了吧" },
  { time: 78, msg: "炉石！" },
  { time: 82, msg: "6.5亿 好恐怖" },
  { time: 85, msg: "一键三连！" },
];
// ==================================================

async function getBvInfo(bvid) {
  const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
  const res = await fetch(url, { headers: { Cookie: COOKIE, "User-Agent": "Mozilla/5.0" } });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`获取视频信息失败: ${json.message}`);
  return { aid: json.data.aid, cid: json.data.cid, title: json.data.title };
}

async function sendDanmaku(oid, progress, msg, color = 16777215, mode = 1) {
  const url = "https://api.bilibili.com/x/v2/dm/post";
  const body = new URLSearchParams({
    type: "1",
    oid: String(oid),
    msg,
    progress: String(Math.round(progress * 1000)),
    color: String(color),
    fontsize: "25",
    pool: "0",
    mode: String(mode),
    rnd: String(Date.now() * 1000),
    csrf: BILI_JCT,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Cookie: COOKIE,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://www.bilibili.com",
    },
    body: body.toString(),
  });
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const bvid = process.argv[2];
  if (!bvid) {
    console.error("用法: node scripts/send-danmaku.mjs BV1VMQkBzErh");
    process.exit(1);
  }

  const bv = bvid.startsWith("BV") ? bvid : `BV${bvid}`;
  console.log(`获取视频信息: ${bv}`);
  const { cid, title } = await getBvInfo(bv);
  console.log(`标题: ${title} | cid: ${cid}`);
  console.log(`共 ${DANMAKU_LIST.length} 条弹幕待发送\n`);

  for (let i = 0; i < DANMAKU_LIST.length; i++) {
    const { time, msg, color, mode } = DANMAKU_LIST[i];
    const result = await sendDanmaku(cid, time, msg, color, mode);
    const status = result.code === 0 ? "✓" : `✗ ${result.message}`;
    console.log(`[${i + 1}/${DANMAKU_LIST.length}] ${status}  ${time}s  "${msg}"`);

    if (i < DANMAKU_LIST.length - 1) {
      const delay = 8000 + Math.random() * 4000;
      await sleep(delay);
    }
  }

  console.log("\n完成");
}

main().catch(console.error);
