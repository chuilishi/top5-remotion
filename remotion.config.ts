import { Config } from "@remotion/cli/config";
import os from "os";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setConcurrency(16);
Config.setChromiumOpenGlRenderer("angle");
Config.setOffthreadVideoCacheSizeInBytes(
  Math.round(os.totalmem() * 0.7),
);
