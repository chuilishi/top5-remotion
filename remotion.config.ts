import { Config } from "@remotion/cli/config";
import os from "os";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(100);
Config.setOverwriteOutput(true);
Config.setConcurrency(
  Math.min(16, os.availableParallelism?.() ?? os.cpus().length),
);
Config.setChromiumOpenGlRenderer("angle");

// 以下四项此前散落在 render.ps1 / render-top5.ps1 / package.json 的 build 脚本里，
// 三处取值并不一致（bitrate 8M vs 10M、sample-rate 有的有有的没有、
// 硬件加速只有两个 .ps1 开了）。集中到这里，所有入口都会加载本文件。
Config.setCodec("h264");
Config.setVideoBitrate("8M");
Config.setSampleRate(48000);
// required 而非 if-possible：NVENC 失效时硬报错，避免静默退回 libx264 而没人察觉
Config.setHardwareAcceleration("required");
// 不设置 OffthreadVideo 缓存上限：上游默认值是「渲染启动时可用内存的一半」，
// 会随内存压力自适应。曾手写成 totalmem * 0.7，在 16GB 机器上实测触发 OOM——
// 问题出在拿总内存当基准（看不见 Chrome/系统已占用的部分），不是系数不够小。
