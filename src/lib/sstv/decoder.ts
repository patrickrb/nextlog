// SSTV Decoder - Simulated SSTV decoding for demonstration
// In a real implementation, this would use a proper SSTV decoder library

export interface SSTVMode {
  name: string;
  lineTime: number; // milliseconds per line
  syncTime: number; // milliseconds for sync pulse
  pixelsPerLine: number;
  totalLines: number;
  colorFormat: 'RGB' | 'YUV';
}

export const SSTV_MODES: Record<string, SSTVMode> = {
  'Scottie1': {
    name: 'Scottie 1',
    lineTime: 138.24,
    syncTime: 9,
    pixelsPerLine: 320,
    totalLines: 256,
    colorFormat: 'RGB'
  },
  'Scottie2': {
    name: 'Scottie 2',
    lineTime: 88.064,
    syncTime: 9,
    pixelsPerLine: 320,
    totalLines: 256,
    colorFormat: 'RGB'
  },
  'Martin1': {
    name: 'Martin 1',
    lineTime: 146.432,
    syncTime: 4.862,
    pixelsPerLine: 320,
    totalLines: 256,
    colorFormat: 'RGB'
  },
  'Martin2': {
    name: 'Martin 2',
    lineTime: 73.216,
    syncTime: 4.862,
    pixelsPerLine: 320,
    totalLines: 256,
    colorFormat: 'RGB'
  },
  'Robot36': {
    name: 'Robot 36',
    lineTime: 88,
    syncTime: 9,
    pixelsPerLine: 320,
    totalLines: 240,
    colorFormat: 'YUV'
  },
  'PD120': {
    name: 'PD 120',
    lineTime: 126.432,
    syncTime: 20,
    pixelsPerLine: 640,
    totalLines: 496,
    colorFormat: 'YUV'
  },
  'PD180': {
    name: 'PD 180',
    lineTime: 183.040,
    syncTime: 20,
    pixelsPerLine: 640,
    totalLines: 496,
    colorFormat: 'YUV'
  }
};

export interface SSTVDecodeOptions {
  mode?: string;
  sampleRate: number;
  noiseReduction: boolean;
  autoSync: boolean;
  qualityThreshold: number;
}

export interface SSTVDecodeProgress {
  linesDecoded: number;
  totalLines: number;
  quality: number;
  timeRemaining: number; // seconds
  currentFrequency: number;
}

export interface SSTVDecodeResult {
  success: boolean;
  imageData: ImageData | null;
  mode: string;
  quality: number;
  duration: number; // seconds
  metadata: {
    frequency?: number;
    signalStrength?: number;
    startTime: Date;
    endTime: Date;
    callsignDetected?: string;
    locationText?: string;
  };
  error?: string;
}

export class SSTVDecoder {
  private audioContext: AudioContext;
  private isDecoding: boolean = false;
  private currentProgress?: SSTVDecodeProgress;
  private onProgressCallback?: (progress: SSTVDecodeProgress) => void;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  async decodeFromAudioBuffer(
    audioBuffer: AudioBuffer,
    options: Partial<SSTVDecodeOptions> = {}
  ): Promise<SSTVDecodeResult> {
    const opts: SSTVDecodeOptions = {
      sampleRate: audioBuffer.sampleRate,
      noiseReduction: true,
      autoSync: true,
      qualityThreshold: 0.5,
      ...options
    };

    const startTime = new Date();
    this.isDecoding = true;

    try {
      // Detect SSTV mode if not specified
      const detectedMode = opts.mode || await this.detectMode(audioBuffer);
      const mode = SSTV_MODES[detectedMode];
      
      if (!mode) {
        throw new Error(`Unsupported SSTV mode: ${detectedMode}`);
      }

      // Simulate progressive decoding
      const result = await this.simulateDecoding(audioBuffer, mode, opts);
      
      return {
        success: true,
        imageData: result.imageData,
        mode: detectedMode,
        quality: result.quality,
        duration: (new Date().getTime() - startTime.getTime()) / 1000,
        metadata: {
          startTime,
          endTime: new Date(),
          frequency: this.detectCarrierFrequency(audioBuffer),
          signalStrength: this.calculateSignalStrength(audioBuffer),
          callsignDetected: result.callsign,
          locationText: result.location
        }
      };
    } catch (error) {
      return {
        success: false,
        imageData: null,
        mode: opts.mode || 'Unknown',
        quality: 0,
        duration: (new Date().getTime() - startTime.getTime()) / 1000,
        metadata: {
          startTime,
          endTime: new Date()
        },
        error: error instanceof Error ? error.message : 'Decode failed'
      };
    } finally {
      this.isDecoding = false;
    }
  }

  async decodeFromStream(
    stream: MediaStream,
    options: Partial<SSTVDecodeOptions> = {}
  ): Promise<SSTVDecodeResult> {
    // Create a recorder to capture audio data
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks: Blob[] = [];

    return new Promise((resolve, reject) => {
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          
          const result = await this.decodeFromAudioBuffer(audioBuffer, options);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      // Start recording and auto-stop after detecting SSTV transmission
      mediaRecorder.start();
      
      // Auto-stop after typical SSTV transmission time (2-4 minutes)
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 240000); // 4 minutes max
    });
  }

  setProgressCallback(callback: (progress: SSTVDecodeProgress) => void): void {
    this.onProgressCallback = callback;
  }

  stopDecoding(): void {
    this.isDecoding = false;
  }

  private async detectMode(audioBuffer: AudioBuffer): Promise<string> {
    // Analyze audio for SSTV mode identification
    // This is a simplified implementation
    
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Look for sync pulse characteristics
    const syncDurations = this.findSyncPulses(channelData, sampleRate);
    
    // Match sync durations to known modes
    for (const [modeName, mode] of Object.entries(SSTV_MODES)) {
      if (this.matchesSyncPattern(syncDurations, mode.syncTime)) {
        return modeName;
      }
    }
    
    // Default to Scottie1 if no match
    return 'Scottie1';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private findSyncPulses(_data: Float32Array, _sampleRate: number): number[] {
    // Simplified sync pulse detection
    // Real implementation would use proper DSP techniques
    
    // This is a placeholder - real implementation would:
    // 1. Apply bandpass filter around 1200Hz
    // 2. Detect signal level drops
    // 3. Measure pulse durations
    // 4. Return array of detected sync pulse durations
    
    return [9, 9, 9]; // Placeholder sync durations
  }

  private matchesSyncPattern(detected: number[], expected: number): boolean {
    // Check if detected sync durations match expected mode
    const tolerance = 2; // ms tolerance
    return detected.some(duration => Math.abs(duration - expected) < tolerance);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async simulateDecoding(
    audioBuffer: AudioBuffer,
    mode: SSTVMode,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: SSTVDecodeOptions
  ): Promise<{
    imageData: ImageData;
    quality: number;
    callsign?: string;
    location?: string;
  }> {
    // Simulate the decoding process with progress updates
    const canvas = new OffscreenCanvas(mode.pixelsPerLine, mode.totalLines);
    const ctx = canvas.getContext('2d')!;
    
    // Generate sample SSTV image (for demonstration)
    const imageData = ctx.createImageData(mode.pixelsPerLine, mode.totalLines);
    
    // Simulate decoding line by line
    for (let line = 0; line < mode.totalLines; line++) {
      if (!this.isDecoding) break;
      
      // Simulate line decoding time
      await this.delay(10);
      
      // Generate mock image data for this line
      this.generateMockLine(imageData, line, mode);
      
      // Update progress
      const progress: SSTVDecodeProgress = {
        linesDecoded: line + 1,
        totalLines: mode.totalLines,
        quality: Math.min(0.9, 0.3 + (line / mode.totalLines) * 0.6),
        timeRemaining: ((mode.totalLines - line - 1) * mode.lineTime) / 1000,
        currentFrequency: 1500 + Math.sin(line * 0.1) * 100
      };
      
      this.currentProgress = progress;
      if (this.onProgressCallback) {
        this.onProgressCallback(progress);
      }
    }
    
    // Simulate text detection in the image
    const textAnalysis = this.analyzeImageForText(imageData);
    
    return {
      imageData,
      quality: this.currentProgress?.quality || 0.8,
      callsign: textAnalysis.callsign,
      location: textAnalysis.location
    };
  }

  private generateMockLine(imageData: ImageData, line: number, mode: SSTVMode): void {
    // Generate a mock SSTV image line (colorful test pattern)
    const width = mode.pixelsPerLine;
    const data = imageData.data;
    
    for (let x = 0; x < width; x++) {
      const index = (line * width + x) * 4;
      
      // Create a test pattern with gradients and colors
      const r = Math.floor(128 + 127 * Math.sin(x * 0.02));
      const g = Math.floor(128 + 127 * Math.sin(line * 0.02));
      const b = Math.floor(128 + 127 * Math.sin((x + line) * 0.01));
      
      data[index] = r;     // Red
      data[index + 1] = g; // Green
      data[index + 2] = b; // Blue
      data[index + 3] = 255; // Alpha
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private analyzeImageForText(_imageData: ImageData): { callsign?: string; location?: string } {
    // Simulate OCR text detection in SSTV image
    // Real implementation would use OCR library
    
    // Mock detected text
    const mockCallsigns = ['W1AW', 'VK3ABC', 'JA1XYZ', 'G0DEF', 'VE7GHI'];
    const mockLocations = ['FN31pr', 'QF22kx', 'PM95td', 'IO91vr', 'CN87ts'];
    
    const randomCallsign = Math.random() > 0.7 ? 
      mockCallsigns[Math.floor(Math.random() * mockCallsigns.length)] : 
      undefined;
      
    const randomLocation = Math.random() > 0.8 ? 
      mockLocations[Math.floor(Math.random() * mockLocations.length)] : 
      undefined;
    
    return {
      callsign: randomCallsign,
      location: randomLocation
    };
  }

  private detectCarrierFrequency(audioBuffer: AudioBuffer): number {
    // Detect the SSTV carrier frequency (typically around 1500-1900 Hz)
    // Real implementation would use FFT analysis
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _samples = audioBuffer.getChannelData(0);
    return 1500 + Math.random() * 400; // Mock frequency detection
  }

  private calculateSignalStrength(audioBuffer: AudioBuffer): number {
    // Calculate signal strength in dBm
    const channelData = audioBuffer.getChannelData(0);
    let sum = 0;
    
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    
    const rms = Math.sqrt(sum / channelData.length);
    const dBm = 20 * Math.log10(rms) - 60; // Approximate conversion
    
    return Math.max(-120, Math.min(0, dBm));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Utility functions
export function createSSTVDecoder(audioContext?: AudioContext): SSTVDecoder {
  const ctx = audioContext || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return new SSTVDecoder(ctx);
}

export function imageDataToBlob(imageData: ImageData): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    
    canvas.convertToBlob({ type: 'image/png' }).then(resolve);
  });
}

export function validateSSTVMode(mode: string): boolean {
  return mode in SSTV_MODES;
}

export function getSSTVModeInfo(mode: string): SSTVMode | null {
  return SSTV_MODES[mode] || null;
}