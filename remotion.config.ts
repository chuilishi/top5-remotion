import { Config } from "@remotion/cli/config";
import os from "os";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(100);
Config.setOverwriteOutput(true);
Config.setConcurrency(
  Math.min(16, os.availableParallelism?.() ?? os.cpus().length),
);
Config.setChromiumOpenGlRenderer("angle");
// 不设置 OffthreadVideo 缓存上限：上游默认值是「渲染启动时可用内存的一半」，
// 会随内存压力自适应。曾手写成 totalmem * 0.7，在 16GB 机器上实测触发 OOM——
// 问题出在拿总内存当基准（看不见 Chrome/系统已占用的部分），不是系数不够小。
