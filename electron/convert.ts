// electron/convert.ts
import { ipcMain } from 'electron'
import { execFile, ExecFileException } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

 
function getFFmpegPath() : string{
    if (app.isPackaged) {
        // 打包后：ffmpeg.exe 在 resources/ 目录
        return path.join(process.resourcesPath, 'ffmpeg.exe')
    } else {
        // 开发环境：ffmpeg.exe 在项目根目录的 resources/ 下
        return path.join(__dirname, '../resources/ffmpeg.exe')
    }
}


// 获取 ffprobe 路径（根据平台选择）
const getFFprobePath = () => {
    const platform = process.platform;
    const resourcesPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'ffprobe') // 打包后路径
      : path.join(__dirname, '../resources', 'ffprobe'); // 开发时路径
   
    return platform === 'win32' 
      ? `${resourcesPath}.exe` 
      : resourcesPath;
  };

// 调用 ffprobe 获取视频时长
async function getVideoDuration(filePath: string): Promise<number> {
    const ffprobePath = getFFprobePath();
    
    return new Promise((resolve, reject) => {
      execFile(
        ffprobePath,
        [
          '-v', 'error',          // 只显示错误信息
          '-show_entries', 'format=duration', // 只获取 duration
          '-of', 'default=noprint_wrappers=1:nokey=1', // 简化输出
          filePath
        ],
        (error, stdout) => {
          if (error) {
            console.error('ffprobe 错误:', error);
            return reject(error);
          }
          const duration = parseFloat(stdout.toString().trim());
          resolve(duration);
        }
      );
    });
  }

 
// 解析 FFmpeg 的 `time=` 输出（格式：HH:MM:SS.xx）并转换为秒
function parseFFmpegTime(timeStr: string): number {
    const [hours, minutes, seconds] = timeStr.split(':').map(parseFloat)
    return hours * 3600 + minutes * 60 + seconds
  }

export function setupConvertHandlers() {
  ipcMain.handle('convert-video', async (event, { inputPath, outputPath, outputFormat }) => {
    try {
      // 确保 ffmpeg 路径正确（根据你的实际路径调整）
    //   const ffmpegPath = path.join(__dirname, '../resources/ffmpeg.exe') // Windows
      // const ffmpegPath = path.join(__dirname, '../../resources/ffmpeg') // macOS/Linux
      const ffmpegPath = getFFmpegPath() // Windows

      let totalDuration = 0
 
      // 1. 先获取视频总时长（秒）
      try {
        totalDuration = await getVideoDuration(inputPath)
        console.log(totalDuration)
      } catch (err) {
        console.error('获取视频时长失败:', err)
        return { success: false, message: '无法获取视频时长' }
      }

      // 构建 ffmpeg 命令
      // 无损转换参数（根据格式调整）
      const args = [
        '-i', inputPath,
        '-y', // 覆盖输出文件
        '-c:v', 'libx264', // 视频编码器（H.264 无损）
        // '-crf', '0', // 恒定质量（0 = 无损）
        // '-preset', 'veryslow', // 最慢压缩速度（最高压缩率）
        '-strict', '-2',
        '-c:a', 'copy', // 直接复制音频流（无损）
        '-f', outputFormat,
        outputPath,
      ];
      // ffmpeg -i 10-11.rmvb -c:v libx264 -strict -2 10-11-a.mp4

    //   // 如果是 MOV 格式，改用 ProRes 无损编码
    //   if (outputFormat === 'mov') {
    //     args.splice(2, 5, '-c:v', 'prores_ks', '-profile:v', '4444', '-c:a', 'pcm_s16le');
    //   }
 
    //   // 如果是 MKV 格式，改用 FFv1 无损编码
    //   if (outputFormat === 'mkv') {
    //     args.splice(2, 5, '-c:v', 'ffv1', '-level', '3', '-c:a', 'copy');
    //   }
 
      // 使用 Promise 包装 execFile，以便获取进度
      return await new Promise((resolve) => {
        const ffmpegProcess = execFile(ffmpegPath, args, (
                error: ExecFileException | null,  // 更精确的类型
                _stdout: string,
                stderr: string
            ) => {
          if (error) {
            console.error('转换错误:', error)
            resolve({ success: false, message: stderr || error.message })
          } else {
            resolve({ success: true })
          }
        })


        // 监听 stderr 获取进度（ffmpeg 输出进度信息到 stderr）
        ffmpegProcess.stderr?.on('data', (chunk) => {
          const data = chunk.toString()
          // 解析 ffmpeg 进度（例如：`frame= 123 fps=30 q=28.0 size= 1024kB time=00:00:04.00 bitrate=2097.2kbits/s speed=1.2x`）
          const progressMatch = data.match(/time=(\d+:\d+:\d+\.\d+)/)
          if (progressMatch) {
            const currentTime = parseFFmpegTime(progressMatch[1]) // 转换为秒
            // const currentTime = progressMatch[1] // 转换为秒
            console.log(currentTime)
            event.sender.send('conversion-progress', {
                currentTime: currentTime,
                totalDuration: totalDuration,
            }) // 发送进度到渲染进程
            event.sender.send('conversion-progress', currentTime) // 发送进度到渲染进程
          }
        })
      })
    } catch (error) {
      console.error('转换过程中发生错误:', error)
      return { success: false, message: String(error) }
    }
  })
}