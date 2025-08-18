// WebUSB interface for radio CAT control and audio streaming
// Provides abstraction layer for different radio models

import './webusb-types';

export interface RadioConnection {
  isConnected: boolean;
  radioModel: string;
  catInterface: string;
  audioSource: string;
  frequency?: number;
  mode?: string;
  signalStrength?: number;
}

export interface SSTVDecodeResult {
  imageData: Uint8Array;
  mode: string;
  quality: number;
  timestamp: Date;
  frequency?: number;
  signalStrength?: number;
  metadata?: Record<string, unknown>;
}

export interface RadioConfig {
  model: 'IC-7300' | 'Flex 6400' | 'IC-7610' | 'TS-590SG' | string;
  catInterface: 'USB' | 'CI-V' | 'CAT' | 'FlexControl' | 'Ethernet' | 'RS232';
  audioSource: 'USB Audio' | 'DAX Audio' | 'LINE OUT';
  baudRate?: number;
  port?: string;
  daxEnabled?: boolean;
}

export class RadioInterface {
  private device: USBDevice | null = null;
  private audioContext: AudioContext | null = null;
  private audioStream: MediaStream | null = null;
  private config: RadioConfig;
  private isMonitoring: boolean = false;
  private onDecodeCallback?: (result: SSTVDecodeResult) => void;
  
  constructor(config: RadioConfig) {
    this.config = config;
  }

  async requestUSBPermission(): Promise<boolean> {
    try {
      // Check if WebUSB is supported
      if (!('usb' in navigator)) {
        throw new Error('WebUSB is not supported in this browser');
      }

      // Request device based on radio model
      const filters = this.getUSBFilters();
      this.device = await navigator.usb!.requestDevice({ filters });
      
      return !!this.device;
    } catch (error) {
      console.error('USB permission request failed:', error);
      return false;
    }
  }

  async connect(): Promise<RadioConnection> {
    try {
      if (!this.device) {
        throw new Error('No USB device selected');
      }

      // Open device connection
      await this.device.open();
      
      // Configure device based on radio model
      await this.configureDevice();
      
      // Setup audio context for SSTV decoding
      await this.setupAudio();

      return {
        isConnected: true,
        radioModel: this.config.model,
        catInterface: this.config.catInterface,
        audioSource: this.config.audioSource,
        frequency: await this.getFrequency(),
        mode: await this.getMode(),
        signalStrength: await this.getSignalStrength()
      };
    } catch (error) {
      console.error('Radio connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.stopMonitoring();
      
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }
      
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }
      
      if (this.device) {
        await this.device.close();
        this.device = null;
      }
    } catch (error) {
      console.error('Radio disconnection failed:', error);
    }
  }

  async startMonitoring(onDecode: (result: SSTVDecodeResult) => void): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.onDecodeCallback = onDecode;
    this.isMonitoring = true;

    // Start audio monitoring for SSTV signals
    await this.startAudioMonitoring();
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    this.onDecodeCallback = undefined;
  }

  async getFrequency(): Promise<number | undefined> {
    try {
      if (!this.device) return undefined;
      
      // Send CAT command to get frequency
      const command = this.getFrequencyCommand();
      const response = await this.sendCATCommand(command);
      return this.parseFrequencyResponse(response);
    } catch (error) {
      console.error('Failed to get frequency:', error);
      return undefined;
    }
  }

  async setFrequency(frequency: number): Promise<void> {
    try {
      if (!this.device) throw new Error('No device connected');
      
      const command = this.getSetFrequencyCommand(frequency);
      await this.sendCATCommand(command);
    } catch (error) {
      console.error('Failed to set frequency:', error);
      throw error;
    }
  }

  async getMode(): Promise<string | undefined> {
    try {
      if (!this.device) return undefined;
      
      const command = this.getModeCommand();
      const response = await this.sendCATCommand(command);
      return this.parseModeResponse(response);
    } catch (error) {
      console.error('Failed to get mode:', error);
      return undefined;
    }
  }

  async getSignalStrength(): Promise<number | undefined> {
    try {
      if (!this.device) return undefined;
      
      const command = this.getSignalStrengthCommand();
      const response = await this.sendCATCommand(command);
      return this.parseSignalStrengthResponse(response);
    } catch (error) {
      console.error('Failed to get signal strength:', error);
      return undefined;
    }
  }

  private getUSBFilters(): USBDeviceFilter[] {
    // USB vendor/product IDs for supported radios
    switch (this.config.model) {
      case 'IC-7300':
        return [{ vendorId: 0x0c26, productId: 0x0020 }]; // Icom IC-7300
      case 'IC-7610':
        return [{ vendorId: 0x0c26, productId: 0x0024 }]; // Icom IC-7610
      case 'Flex 6400':
        return [{ vendorId: 0x1fc9, productId: 0x000c }]; // FlexRadio (example)
      case 'TS-590SG':
        return [{ vendorId: 0x0b05, productId: 0x000a }]; // Kenwood (example)
      default:
        // Generic USB Serial filters
        return [
          { classCode: 2 }, // Communications Device Class
          { classCode: 10 }, // CDC Data Interface Class
        ];
    }
  }

  private async configureDevice(): Promise<void> {
    if (!this.device) return;

    // Select configuration and claim interface
    await this.device.selectConfiguration(1);
    await this.device.claimInterface(0);

    // Radio-specific initialization
    switch (this.config.model) {
      case 'IC-7300':
      case 'IC-7610':
        await this.initializeIcom();
        break;
      case 'Flex 6400':
        await this.initializeFlex();
        break;
      case 'TS-590SG':
        await this.initializeKenwood();
        break;
    }
  }

  private async setupAudio(): Promise<void> {
    try {
      // Create audio context for SSTV processing
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Request microphone access for audio input
      // In a real implementation, this would be DAX audio or line input
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 1
        }
      });
    } catch (error) {
      console.error('Audio setup failed:', error);
      throw error;
    }
  }

  private async startAudioMonitoring(): Promise<void> {
    if (!this.audioContext || !this.audioStream) {
      throw new Error('Audio not initialized');
    }

    try {
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      
      // Create analyzer for SSTV signal detection
      const analyzer = this.audioContext.createAnalyser();
      analyzer.fftSize = 2048;
      source.connect(analyzer);

      // Start monitoring loop
      this.monitorAudioForSSTV(analyzer);
    } catch (error) {
      console.error('Audio monitoring failed:', error);
      throw error;
    }
  }

  private monitorAudioForSSTV(analyzer: AnalyserNode): void {
    if (!this.isMonitoring) return;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const processAudio = () => {
      if (!this.isMonitoring) return;
      
      analyzer.getByteFrequencyData(dataArray);
      
      // Detect SSTV sync signals (1200Hz and 1900Hz tones)
      const sstvSignal = this.detectSSTVSignal(dataArray);
      
      if (sstvSignal.detected) {
        this.startSSTVDecode(sstvSignal);
      }
      
      // Continue monitoring
      requestAnimationFrame(processAudio);
    };
    
    processAudio();
  }

  private detectSSTVSignal(frequencyData: Uint8Array): { detected: boolean; mode?: string } {
    // Simplified SSTV signal detection
    // Real implementation would analyze frequency bins for SSTV sync patterns
    
    // Look for 1200Hz sync tone
    const syncBin = Math.floor(1200 * frequencyData.length / (this.audioContext?.sampleRate || 48000));
    const syncLevel = frequencyData[syncBin];
    
    // Basic threshold detection
    if (syncLevel > 128) {
      return { detected: true, mode: 'Scottie1' }; // Simplified mode detection
    }
    
    return { detected: false };
  }

  private async startSSTVDecode(signal: { mode?: string }): Promise<void> {
    if (!this.onDecodeCallback) return;

    try {
      // Simulate SSTV decode process
      // Real implementation would use actual SSTV decoder
      const mockImageData = new Uint8Array(320 * 240 * 4); // Mock RGB data
      
      const result: SSTVDecodeResult = {
        imageData: mockImageData,
        mode: signal.mode || 'SSTV',
        quality: 0.85,
        timestamp: new Date(),
        frequency: await this.getFrequency(),
        signalStrength: await this.getSignalStrength(),
        metadata: {
          decoder: 'WebSSTV',
          sampleRate: this.audioContext?.sampleRate
        }
      };
      
      this.onDecodeCallback(result);
    } catch (error) {
      console.error('SSTV decode failed:', error);
    }
  }

  private async sendCATCommand(command: Uint8Array): Promise<Uint8Array> {
    if (!this.device) {
      throw new Error('No device connected');
    }

    try {
      // Send command via USB
      await this.device.transferOut(2, command);
      
      // Read response
      const result = await this.device.transferIn(1, 64);
      return result.data ? new Uint8Array(result.data.buffer) : new Uint8Array();
    } catch (error) {
      console.error('CAT command failed:', error);
      throw error;
    }
  }

  // Radio-specific command implementations
  private getFrequencyCommand(): Uint8Array {
    switch (this.config.model) {
      case 'IC-7300':
      case 'IC-7610':
        return new Uint8Array([0xFE, 0xFE, 0x94, 0xE0, 0x03, 0xFD]); // Icom get frequency
      case 'TS-590SG':
        return new TextEncoder().encode('FA;'); // Kenwood get frequency
      default:
        return new Uint8Array();
    }
  }

  private getModeCommand(): Uint8Array {
    switch (this.config.model) {
      case 'IC-7300':
      case 'IC-7610':
        return new Uint8Array([0xFE, 0xFE, 0x94, 0xE0, 0x04, 0xFD]); // Icom get mode
      case 'TS-590SG':
        return new TextEncoder().encode('MD;'); // Kenwood get mode
      default:
        return new Uint8Array();
    }
  }

  private getSignalStrengthCommand(): Uint8Array {
    switch (this.config.model) {
      case 'IC-7300':
      case 'IC-7610':
        return new Uint8Array([0xFE, 0xFE, 0x94, 0xE0, 0x15, 0x02, 0xFD]); // Icom get S-meter
      case 'TS-590SG':
        return new TextEncoder().encode('SM;'); // Kenwood get S-meter
      default:
        return new Uint8Array();
    }
  }

  private getSetFrequencyCommand(frequency: number): Uint8Array {
    switch (this.config.model) {
      case 'IC-7300':
      case 'IC-7610':
        // Convert frequency to Icom BCD format
        const freqBCD = this.toBCD(frequency);
        return new Uint8Array([0xFE, 0xFE, 0x94, 0xE0, 0x05, ...freqBCD, 0xFD]);
      case 'TS-590SG':
        // Kenwood ASCII format
        const freqStr = frequency.toString().padStart(11, '0');
        return new TextEncoder().encode(`FA${freqStr};`);
      default:
        return new Uint8Array();
    }
  }

  // Parser methods for radio responses
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private parseFrequencyResponse(_response: Uint8Array): number | undefined {
    // Implementation would parse radio-specific response format
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private parseModeResponse(_response: Uint8Array): string | undefined {
    // Implementation would parse radio-specific response format
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private parseSignalStrengthResponse(_response: Uint8Array): number | undefined {
    // Implementation would parse radio-specific response format
    return undefined;
  }

  // Utility methods
  private toBCD(value: number): number[] {
    // Convert number to BCD format for Icom radios
    const bcd: number[] = [];
    const str = value.toString();
    for (let i = str.length - 1; i >= 0; i -= 2) {
      const high = i > 0 ? parseInt(str[i - 1]) : 0;
      const low = parseInt(str[i]);
      bcd.unshift((high << 4) | low);
    }
    return bcd;
  }

  private async initializeIcom(): Promise<void> {
    // Icom-specific initialization
    // Send CI-V initialization commands
  }

  private async initializeFlex(): Promise<void> {
    // FlexRadio-specific initialization
    // Setup DAX audio and CAT control
  }

  private async initializeKenwood(): Promise<void> {
    // Kenwood-specific initialization
    // Send CAT initialization commands
  }
}

// Utility functions
export async function checkWebUSBSupport(): Promise<boolean> {
  return 'usb' in navigator;
}

export async function getAvailableRadios(): Promise<USBDevice[]> {
  if (!('usb' in navigator)) {
    return [];
  }
  
  return await navigator.usb!.getDevices();
}

export function createRadioInterface(config: RadioConfig): RadioInterface {
  return new RadioInterface(config);
}