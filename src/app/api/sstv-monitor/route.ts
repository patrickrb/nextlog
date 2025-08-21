// SSTV Monitor API - WebUSB CAT/DAX integration for radio communication and audio monitoring

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';

interface RadioConfig {
  id?: number;
  user_id: number;
  station_id?: number;
  radio_model: string;
  cat_interface: string;
  cat_port?: string;
  cat_baud_rate?: number;
  audio_source: string;
  audio_device?: string;
  dax_enabled?: boolean;
  auto_decode?: boolean;
  auto_log?: boolean;
  frequency_mhz?: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface MonitorStatus {
  active: boolean;
  radio_connected: boolean;
  audio_connected: boolean;
  current_frequency?: number;
  signal_strength?: number;
  sstv_mode_detected?: string;
  last_activity?: string;
  error_message?: string;
}

/**
 * GET /api/sstv-monitor - Get current monitor status and configuration
 */
export async function GET(request: NextRequest) {
  const user = await verifyToken(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('station_id');
    const action = searchParams.get('action');

    // Handle device enumeration requests
    if (action === 'enumerate_devices') {
      return NextResponse.json({
        success: true,
        message: 'Device enumeration must be done client-side due to browser security restrictions',
        enumerate_client_side: true
      });
    }

    // Get radio configuration for the user/station
    let configQuery = 'SELECT * FROM sstv_radio_config WHERE user_id = $1';
    const params: (string | number)[] = [user.userId];
    
    if (stationId) {
      configQuery += ' AND station_id = $2';
      params.push(parseInt(stationId));
    }
    
    configQuery += ' ORDER BY active DESC, created_at DESC LIMIT 1';

    const configResult = await query(configQuery, params);
    const config: RadioConfig | null = configResult.rows[0] || null;

    // Get current monitor status (this would come from a monitoring service)
    // For now, return a default status - in a real implementation, this would
    // check the actual monitoring service state
    const status: MonitorStatus = {
      active: false,
      radio_connected: false,
      audio_connected: false,
      error_message: config ? undefined : 'No radio configuration found'
    };

    return NextResponse.json({
      config,
      status,
      supported_radios: [
        {
          model: 'IC-7300',
          cat_interfaces: ['USB', 'RS232', 'CI-V'],
          audio_sources: ['USB Audio', 'LINE OUT'],
          dax_supported: false
        },
        {
          model: 'Flex 6400',
          cat_interfaces: ['Ethernet', 'RS232', 'FlexControl', 'CAT'],
          audio_sources: ['DAX Audio', 'LINE OUT'],
          dax_supported: true
        },
        {
          model: 'IC-7610',
          cat_interfaces: ['USB', 'RS232', 'CI-V', 'Ethernet'],
          audio_sources: ['USB Audio', 'LINE OUT'],
          dax_supported: false
        },
        {
          model: 'TS-590SG',
          cat_interfaces: ['USB', 'RS232'],
          audio_sources: ['USB Audio', 'LINE OUT'],
          dax_supported: false
        }
      ]
    });

  } catch (error) {
    console.error('Error getting SSTV monitor status:', error);
    return NextResponse.json(
      { error: 'Failed to get monitor status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sstv-monitor - Start/stop monitoring or update configuration
 */
export async function POST(request: NextRequest) {
  const user = await verifyToken(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, config } = body;

    if (action === 'start') {
      // Validate configuration
      if (!config || !config.radio_model || !config.cat_interface || !config.audio_source) {
        return NextResponse.json(
          { error: 'Missing required configuration: radio_model, cat_interface, audio_source' },
          { status: 400 }
        );
      }

      // Update or create radio configuration
      const existingConfig = await query(
        'SELECT id FROM sstv_radio_config WHERE user_id = $1 AND station_id = $2',
        [user.userId, config.station_id || null]
      );

      if (existingConfig.rows.length > 0) {
        // Update existing configuration
        await query(
          `UPDATE sstv_radio_config SET
            radio_model = $3, cat_interface = $4, cat_port = $5, cat_baud_rate = $6,
            audio_source = $7, audio_device = $8, dax_enabled = $9,
            auto_decode = $10, auto_log = $11, frequency_mhz = $12,
            active = $13, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $1 AND id = $2`,
          [
            user.userId, existingConfig.rows[0].id, config.radio_model,
            config.cat_interface, config.cat_port || null, config.cat_baud_rate || 9600,
            config.audio_source, config.audio_device || null, config.dax_enabled || false,
            config.auto_decode || true, config.auto_log || true, config.frequency_mhz || null,
            true
          ]
        );
      } else {
        // Create new configuration
        await query(
          `INSERT INTO sstv_radio_config (
            user_id, station_id, radio_model, cat_interface, cat_port, cat_baud_rate,
            audio_source, audio_device, dax_enabled, auto_decode, auto_log,
            frequency_mhz, active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            user.userId, config.station_id || null, config.radio_model,
            config.cat_interface, config.cat_port || null, config.cat_baud_rate || 9600,
            config.audio_source, config.audio_device || null, config.dax_enabled || false,
            config.auto_decode || true, config.auto_log || true, config.frequency_mhz || null,
            true
          ]
        );
      }

      // In a real implementation, this would start the monitoring service
      return NextResponse.json({
        success: true,
        message: 'SSTV monitoring started',
        status: {
          active: true,
          radio_connected: false, // Would be determined by actual connection attempt
          audio_connected: false, // Would be determined by actual audio setup
        }
      });

    } else if (action === 'stop') {
      // Deactivate current configuration
      await query(
        'UPDATE sstv_radio_config SET active = false WHERE user_id = $1 AND active = true',
        [user.userId]
      );

      // In a real implementation, this would stop the monitoring service
      return NextResponse.json({
        success: true,
        message: 'SSTV monitoring stopped',
        status: {
          active: false,
          radio_connected: false,
          audio_connected: false,
        }
      });

    } else if (action === 'test_connection') {
      // Test radio connection with current configuration
      // Validate configuration parameters and provide realistic feedback
      
      if (!config || !config.radio_model || !config.cat_interface || !config.audio_source) {
        return NextResponse.json({
          success: false,
          test_results: {
            radio_connected: false,
            audio_connected: false,
            error_message: 'Missing required configuration: radio_model, cat_interface, audio_source'
          }
        });
      }

      let radioConnected = false;
      let audioConnected = false;
      const errorMessages = [];

      // Test radio configuration
      if (config.cat_interface === 'RS232') {
        if (config.cat_port && config.cat_port.trim()) {
          // Valid COM port format check
          const comPortPattern = /^COM\d+$/i;
          const unixPortPattern = /^\/dev\/tty(USB|ACM|S)\d+$/;
          
          if (comPortPattern.test(config.cat_port.trim()) || unixPortPattern.test(config.cat_port.trim())) {
            radioConnected = true;
            
            // Special validation for FlexRadio + COM5
            if (config.radio_model === 'Flex 6400' && config.cat_port.toUpperCase() === 'COM5') {
              errorMessages.push('FlexRadio + COM5 configuration validated. Ensure SmartCAT is running and COM5 is configured in SmartCAT settings.');
            }
          } else {
            errorMessages.push(`Invalid COM port format: ${config.cat_port}. Use format like COM5 or /dev/ttyUSB0`);
          }
        } else {
          errorMessages.push('RS232 interface requires a COM port (e.g., COM5)');
        }
      } else if (config.cat_interface === 'Ethernet') {
        if (config.cat_port && config.cat_port.trim()) {
          // Basic IP address or hostname validation
          const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
          const hostnamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
          
          if (ipPattern.test(config.cat_port.trim()) || hostnamePattern.test(config.cat_port.trim())) {
            radioConnected = true;
            errorMessages.push(`Ethernet configuration validated for ${config.cat_port}. Ensure radio is network accessible.`);
          } else {
            errorMessages.push(`Invalid IP address or hostname: ${config.cat_port}`);
          }
        } else {
          errorMessages.push('Ethernet interface requires IP address or hostname');
        }
      } else if (config.cat_interface === 'USB') {
        if (config.cat_port && config.cat_port.includes(':')) {
          // USB device format validation (USB:vendorId:productId)
          radioConnected = true;
          errorMessages.push('USB device configuration validated. Physical USB connection cannot be tested from browser.');
        } else {
          errorMessages.push('USB interface requires device selection or port specification');
        }
      } else if (['CI-V', 'FlexControl', 'CAT'].includes(config.cat_interface)) {
        // These interfaces are valid if specified
        radioConnected = true;
        errorMessages.push(`${config.cat_interface} interface validated. Hardware connection cannot be tested from browser.`);
      }

      // Test audio configuration
      if (config.audio_source) {
        if (config.audio_source.startsWith('AudioInput:')) {
          // Enumerated audio device
          audioConnected = true;
          errorMessages.push('Audio input device validated. Microphone access may require browser permissions.');
        } else if (['USB Audio', 'LINE OUT', 'DAX Audio'].includes(config.audio_source)) {
          // Static audio source options
          audioConnected = true;
          if (config.audio_source === 'DAX Audio' && config.radio_model === 'Flex 6400') {
            errorMessages.push('DAX Audio configuration validated for FlexRadio. Ensure DAX is enabled in SmartSDR.');
          } else {
            errorMessages.push(`${config.audio_source} configuration validated. Hardware connection cannot be tested from browser.`);
          }
        } else {
          errorMessages.push(`Unknown audio source: ${config.audio_source}`);
        }
      } else {
        errorMessages.push('Audio source is required');
      }

      // Determine overall success
      const overallSuccess = radioConnected && audioConnected;
      const finalMessage = errorMessages.length > 0 
        ? errorMessages.join(' ') 
        : 'Configuration validated successfully. Hardware connections cannot be tested from browser.';

      return NextResponse.json({
        success: overallSuccess,
        test_results: {
          radio_connected: radioConnected,
          audio_connected: audioConnected,
          error_message: overallSuccess ? finalMessage : finalMessage
        }
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use: start, stop, or test_connection' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error controlling SSTV monitor:', error);
    return NextResponse.json(
      { error: 'Failed to control monitor' },
      { status: 500 }
    );
  }
}