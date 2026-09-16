import { Config } from "@remotion/cli/config";
import os from "os";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(100);
Config.setOverwriteOutput(true);
Config.setConcurrency(
  Math.min(16, os.availableParallelism?.() ?? os.cpus().length),
);
Config.setChromiumOpenGlRenderer("angle");
// 70% 物理内存会在 16GB 机器上把系统逼到 OOM（并发渲染时实测被系统杀进程）
// 封顶 4GB，且不超过 35% 物理内存
Config.setOffthreadVideoCacheSizeInBytes(
  Math.min(4 * 1024 ** 3, Math.round(os.totalmem() * 0.35)),
);
