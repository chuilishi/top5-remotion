declare module 'mp4box' {
  interface VideoTrack {
    nb_samples: number;
    movie_duration: number;
    movie_timescale: number;
    timescale: number;
    duration: number;
    codec: string;
    width: number;
    height: number;
  }

  interface MP4Info {
    videoTracks: VideoTrack[];
    audioTracks: unknown[];
    duration: number;
    timescale: number;
    isFragmented: boolean;
  }

  interface MP4File {
    onReady: ((info: MP4Info) => void) | null;
    onError: ((e: string) => void) | null;
    appendBuffer(buf: ArrayBuffer & { fileStart: number }): void;
    flush(): void;
    seek(time: number, useRap?: boolean): { offset: number; time: number };
    start(): void;
    stop(): void;
  }

  export function createFile(): MP4File;
}
