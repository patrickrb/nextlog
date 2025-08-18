// SSTV Monitor Integration - Combines WebUSB radio control with SSTV decoding

import { RadioInterface, RadioConfig, SSTVDecodeResult as RadioDecodeResult } from './webusb-radio';
import { SSTVDecoder, createSSTVDecoder, SSTVDecodeResult, imageDataToBlob } from './decoder';

export interface SSTVMonitorConfig extends RadioConfig {
  autoSave: boolean;
  autoLink: boolean;
  qualityThreshold: number;
  stationId?: number;
}

export interface SSTVMonitorStatus {
  isActive: boolean;
  radioConnected: boolean;
  audioConnected: boolean;
  currentFrequency?: number;
  signalStrength?: number;
  decodingActive: boolean;
  lastDecodeTime?: Date;
  totalDecoded: number;
  sessionStart?: Date;
}

export interface DecodedImage {
  id: string;
  timestamp: Date;
  mode: string;
  quality: number;
  frequency?: number;
  signalStrength?: number;
  imageBlob: Blob;
  callsignDetected?: string;
  locationDetected?: string;
  autoLinked: boolean;
  contactId?: number;
}

export class SSTVMonitor {
  private radioInterface: RadioInterface;
  private decoder: SSTVDecoder;
  private config: SSTVMonitorConfig;
  private status: SSTVMonitorStatus = {
    isActive: false,
    radioConnected: false,
    audioConnected: false,
    decodingActive: false,
    totalDecoded: 0
  };
  
  private onStatusUpdateCallback?: (status: SSTVMonitorStatus) => void;
  private onImageDecodedCallback?: (image: DecodedImage) => void;
  private onErrorCallback?: (error: Error) => void;

  constructor(config: SSTVMonitorConfig) {
    this.config = config;
    this.radioInterface = new RadioInterface(config);
    this.decoder = createSSTVDecoder();
    
    // Setup decoder progress callback
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.decoder.setProgressCallback((_progress) => {
      this.status.decodingActive = true;
      this.updateStatus();
    });
  }

  async start(): Promise<void> {
    try {
      this.status.sessionStart = new Date();
      this.status.totalDecoded = 0;
      
      // Check WebUSB support
      if (!('usb' in navigator)) {
        throw new Error('WebUSB is not supported in this browser');
      }

      // Request USB permission and connect to radio
      const hasPermission = await this.radioInterface.requestUSBPermission();
      if (!hasPermission) {
        throw new Error('USB permission denied');
      }

      // Connect to radio
      const connection = await this.radioInterface.connect();
      this.status.radioConnected = connection.isConnected;
      this.status.currentFrequency = connection.frequency;
      this.status.signalStrength = connection.signalStrength;
      this.status.audioConnected = true; // Assume audio is connected when radio connects

      // Start monitoring for SSTV signals
      await this.radioInterface.startMonitoring(this.handleRadioDecodeResult.bind(this));
      
      this.status.isActive = true;
      this.updateStatus();
      
    } catch (error) {
      this.status.isActive = false;
      this.status.radioConnected = false;
      this.status.audioConnected = false;
      this.updateStatus();
      
      if (this.onErrorCallback) {
        this.onErrorCallback(error instanceof Error ? error : new Error('Unknown error'));
      }
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.radioInterface.stopMonitoring();
      this.decoder.stopDecoding();
      await this.radioInterface.disconnect();
      
      this.status.isActive = false;
      this.status.radioConnected = false;
      this.status.audioConnected = false;
      this.status.decodingActive = false;
      this.updateStatus();
      
    } catch (error) {
      if (this.onErrorCallback) {
        this.onErrorCallback(error instanceof Error ? error : new Error('Stop failed'));
      }
    }
  }

  async setFrequency(frequency: number): Promise<void> {
    if (!this.status.radioConnected) {
      throw new Error('Radio not connected');
    }
    
    await this.radioInterface.setFrequency(frequency);
    this.status.currentFrequency = frequency;
    this.updateStatus();
  }

  getStatus(): SSTVMonitorStatus {
    return { ...this.status };
  }

  setStatusUpdateCallback(callback: (status: SSTVMonitorStatus) => void): void {
    this.onStatusUpdateCallback = callback;
  }

  setImageDecodedCallback(callback: (image: DecodedImage) => void): void {
    this.onImageDecodedCallback = callback;
  }

  setErrorCallback(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  private async handleRadioDecodeResult(result: RadioDecodeResult): Promise<void> {
    this.status.decodingActive = true;
    this.updateStatus();

    try {
      // Convert radio audio data to AudioBuffer for decoding
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Create a mock audio buffer from the result
      // In real implementation, this would be actual audio data from the radio
      const audioBuffer = await this.createMockAudioBuffer(audioContext, result);
      
      // Decode SSTV image
      const decodeResult = await this.decoder.decodeFromAudioBuffer(audioBuffer, {
        mode: result.mode,
        noiseReduction: true,
        autoSync: true,
        qualityThreshold: this.config.qualityThreshold
      });

      if (decodeResult.success && decodeResult.imageData) {
        await this.processDecodedImage(decodeResult);
      }
      
    } catch (error) {
      console.error('SSTV decode error:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error instanceof Error ? error : new Error('Decode failed'));
      }
    } finally {
      this.status.decodingActive = false;
      this.updateStatus();
    }
  }

  private async processDecodedImage(result: SSTVDecodeResult): Promise<void> {
    if (!result.imageData) return;

    // Convert ImageData to Blob
    const imageBlob = await imageDataToBlob(result.imageData);
    
    // Create decoded image record
    const decodedImage: DecodedImage = {
      id: this.generateImageId(),
      timestamp: new Date(),
      mode: result.mode,
      quality: result.quality,
      frequency: result.metadata.frequency,
      signalStrength: result.metadata.signalStrength,
      imageBlob,
      callsignDetected: result.metadata.callsignDetected,
      locationDetected: result.metadata.locationText,
      autoLinked: false
    };

    // Auto-link to QSO if enabled and callsign detected
    if (this.config.autoLink && decodedImage.callsignDetected) {
      try {
        const contactId = await this.findMatchingContact(decodedImage);
        if (contactId) {
          decodedImage.contactId = contactId;
          decodedImage.autoLinked = true;
        }
      } catch (error) {
        console.error('Auto-link failed:', error);
      }
    }

    // Auto-save if enabled
    if (this.config.autoSave && result.quality >= this.config.qualityThreshold) {
      try {
        await this.saveDecodedImage(decodedImage);
        this.status.totalDecoded++;
        this.status.lastDecodeTime = new Date();
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }

    // Notify callback
    if (this.onImageDecodedCallback) {
      this.onImageDecodedCallback(decodedImage);
    }

    this.updateStatus();
  }

  private async saveDecodedImage(image: DecodedImage): Promise<void> {
    // Upload image to storage
    const formData = new FormData();
    formData.append('image', image.imageBlob, `sstv_${image.id}.png`);
    
    // First upload the image file
    const uploadResponse = await fetch('/api/sstv-images/upload', {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error('Image upload failed');
    }

    const uploadResult = await uploadResponse.json();

    // Create SSTV image record
    const recordData = {
      contact_id: image.contactId,
      station_id: this.config.stationId,
      frequency_mhz: image.frequency,
      mode: 'SSTV',
      sstv_mode: image.mode,
      signal_strength: image.signalStrength,
      filename: uploadResult.filename,
      file_size: image.imageBlob.size,
      mime_type: 'image/png',
      storage_path: uploadResult.storage_path,
      storage_url: uploadResult.storage_url,
      width: 320, // Default SSTV width
      height: 240, // Default SSTV height
      quality_score: image.quality,
      radio_model: this.config.model,
      cat_interface: this.config.catInterface,
      audio_source: this.config.audioSource,
      callsign_detected: image.callsignDetected,
      location_detected: image.locationDetected,
      auto_linked: image.autoLinked,
      manual_review: image.quality < this.config.qualityThreshold
    };

    const recordResponse = await fetch('/api/sstv-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(recordData)
    });

    if (!recordResponse.ok) {
      throw new Error('Failed to create SSTV image record');
    }
  }

  private async findMatchingContact(image: DecodedImage): Promise<number | null> {
    if (!image.callsignDetected || !image.frequency) {
      return null;
    }

    try {
      // Search for recent contacts matching callsign and frequency
      const searchParams = new URLSearchParams({
        callsign: image.callsignDetected,
        frequency_min: (image.frequency - 0.01).toString(),
        frequency_max: (image.frequency + 0.01).toString(),
        hours_ago: '24', // Look for contacts in last 24 hours
        limit: '1'
      });

      const response = await fetch(`/api/contacts/search?${searchParams}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data.contacts && data.contacts.length > 0) {
        return data.contacts[0].id;
      }

      return null;
    } catch (error) {
      console.error('Contact search failed:', error);
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async createMockAudioBuffer(
    audioContext: AudioContext, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _result: RadioDecodeResult
  ): Promise<AudioBuffer> {
    // Create a mock audio buffer for demonstration
    // In real implementation, this would be actual audio data from radio
    const sampleRate = 48000;
    const duration = 2; // 2 seconds of mock SSTV signal
    const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    
    const data = buffer.getChannelData(0);
    
    // Generate mock SSTV-like audio signal
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Mix of frequencies typical in SSTV
      data[i] = 0.3 * Math.sin(2 * Math.PI * 1200 * t) + // Sync
                0.5 * Math.sin(2 * Math.PI * 1500 * t) + // Video carrier
                0.2 * Math.sin(2 * Math.PI * 1900 * t);  // Color subcarrier
    }
    
    return buffer;
  }

  private generateImageId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private updateStatus(): void {
    if (this.onStatusUpdateCallback) {
      this.onStatusUpdateCallback(this.getStatus());
    }
  }
}

// Utility functions
export function createSSTVMonitor(config: SSTVMonitorConfig): SSTVMonitor {
  return new SSTVMonitor(config);
}

export async function checkSSTVMonitorSupport(): Promise<{
  webusb: boolean;
  webaudio: boolean;
  mediastream: boolean;
}> {
  return {
    webusb: 'usb' in navigator,
    webaudio: 'AudioContext' in window || 'webkitAudioContext' in window,
    mediastream: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices
  };
}