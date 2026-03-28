$mutex = [System.Threading.Mutex]::new($false, "Global\ytdlp_queue")
try {
    try {
        $mutex.WaitOne() | Out-Null
    } catch [System.Threading.AbandonedMutexException] {
        # Previous holder was killed — mutex is now ours, proceed normally
    }
    & yt-dlp @args
    exit $LASTEXITCODE
} finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
