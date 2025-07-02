<template>
  <div class="convert-container">
    <h2>飞天鼠视频格式转换</h2>

    <!-- 输入文件选择 -->
    <div class="input-group">
      <label>输入文件:</label>
      <input
        type="file"
        @change="handleInputFileChange"
        accept="video/*"
        ref="fileInput"
      />
      <span v-if="inputFile">{{ inputFile.name }}</span>
    </div>

    <!-- 输出格式选择 -->
    <div class="input-group">
      <label>输出格式:</label>
      <select v-model="outputFormat">
        <option value="mp4">MP4</option>
        <option value="avi">AVI</option>
        <option value="mov">MOV</option>
      </select>
    </div>

    <!-- 转换按钮 -->
    <button @click="startConversion" :disabled="!inputFile || isConverting">
      {{ isConverting ? '转换中...' : '开始转换' }}
    </button>

    <!-- 进度条 -->
    <div v-if="isConverting" class="progress-container">
      <div class="progress-bar" :style="{ width: progress + '%' }"></div>
      <span>{{ progress }}%</span>
    </div>

    <!-- 转换结果 -->
    <div v-if="conversionStatus" class="status" :class="{ success: isSuccess, error: !isSuccess }">
      {{ conversionStatus }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

// 状态管理
const inputFile = ref<File | null>(null)
const outputFormat = ref('mp4')
const isConverting = ref(false)
const progress = ref(0)
const conversionStatus = ref('')
const isSuccess = ref(false)

// 处理文件选择
const handleInputFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    inputFile.value = target.files[0]
  }
}

// 开始转换
const startConversion = async () => {
  if (!inputFile.value) return

  isConverting.value = true
  progress.value = 0
  conversionStatus.value = ''
  isSuccess.value = false

  // 1. 监听进度事件
  const progressListener = (_event: Electron.IpcRendererEvent, progressData: { currentTime: number; totalDuration: number}) => {
  // const progressListener = (_event: Electron.IpcRendererEvent, currentTime: string) => {
    // 这里可以解析 currentTime 计算进度百分比（简化示例，假设进度）
      const { currentTime, totalDuration } = progressData; // 单独解构

      const progressPercent = (currentTime / totalDuration) * 100;
      console.log(`进度: ${progressPercent.toFixed(2)}% (${currentTime.toFixed(2)}s / ${totalDuration.toFixed(2)}s)`);
      
      window.ipcRenderer.send('log-to-terminal', `[DEBUG] 当前: ${progressPercent}`);
      progress.value = progressPercent // 模拟进度

      // const progressBar = document.getElementById('progressBar') as HTMLProgressElement;
      // if (progressBar) {
      //   progressBar.value = progressPercent;
      // }
      // 这里可以解析 currentTime 计算进度百分比（简化示例，假设进度）
      // progress.value = Math.min(100, progress.value + 10) // 模拟进度
  }
  try {
    window.ipcRenderer.on('conversion-progress', progressListener)

    // 2. 调用主进程转换
    const outputPath = `${inputFile.value.path}.${outputFormat.value}`
    const result = await window.ipcRenderer.invoke('convert-video', {
      inputPath: inputFile.value.path,
      outputPath,
      outputFormat: outputFormat.value,
    })

    // 3. 处理结果
    if (result.success) {
      conversionStatus.value = '转换成功！'
      isSuccess.value = true
    } else {
      conversionStatus.value = `转换失败: ${result.message || '未知错误'}`
    }
  } catch (error) {
    console.error('转换错误:', error)
    conversionStatus.value = `转换过程中发生错误: ${error instanceof Error ? error.message : String(error)}`
  } finally {
    isConverting.value = false
    window.ipcRenderer.off('conversion-progress', progressListener)
    progress.value = 0
  }
}
</script>

<style scoped>
.convert-container {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.input-group {
  margin-bottom: 15px;
}

.input-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.input-group input[type='file'],
.input-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  background-color: #4caf50;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.progress-container {
  margin-top: 15px;
  width: 100%;
  background-color: #f1f1f1;
  border-radius: 4px;
  position: relative;
}

.progress-bar {
  height: 24px;
  background-color: #4caf50;
  border-radius: 4px;
  transition: width 0.3s;
}

.progress-container span {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-weight: bold;
}

.status {
  margin-top: 15px;
  padding: 10px;
  border-radius: 4px;
}

.status.success {
  background-color: #dff0d8;
  color: #3c763d;
}

.status.error {
  background-color: #f2dede;
  color: #a94442;
}
</style>