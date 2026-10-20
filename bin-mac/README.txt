Bundled ffmpeg 8.0 (universal arm64 + x86_64), used by CS Trim only to extract audio.
License: LGPL v2.1+ (no GPL components enabled). Source: https://ffmpeg.org/releases/ffmpeg-8.0.tar.xz
Built with: --disable-autodetect --disable-doc --disable-ffplay --disable-ffprobe --disable-network --disable-devices
 --disable-hwaccels --disable-encoders --enable-encoder=pcm_s16le --disable-muxers --enable-muxer=wav
 --disable-protocols --enable-protocol=file --disable-filters --enable-filter=aresample,aformat,anull,abuffer,abuffersink
 --disable-debug --disable-iconv --disable-zlib --disable-bzlib --disable-lzma --disable-xlib --disable-sdl2
 -mmacosx-version-min=11.0 (one build per arch, merged with lipo)
