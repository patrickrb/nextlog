// Cloud storage service for handling file uploads
import { query } from './db';
import { decrypt } from './crypto';
import { logger } from './logger';
import { promises as fs } from 'fs';
import path from 'path';

interface StorageConfig {
  id: number;
  config_type: 'azure_blob' | 'aws_s3' | 'local_storage';
  account_name: string;
  account_key: string;
  container_name: string;
  endpoint_url?: string;
  is_enabled: boolean;
}

interface UploadResult {
  success: boolean;
  storage_path: string;
  storage_url?: string;
  storage_type: string;
  error?: string;
}

/**
 * Get the active storage configuration
 */
export async function getActiveStorageConfig(): Promise<StorageConfig | null> {
  try {
    const result = await query(
      'SELECT * FROM storage_config WHERE is_enabled = true LIMIT 1'
    );

    if (result.rows.length === 0) {
      return null;
    }

    const config = result.rows[0];

    // Decrypt the account key
    if (config.account_key) {
      config.account_key = decrypt(config.account_key);
    }

    return config;
  } catch (error) {
    logger.error('Error getting storage config', error);
    return null;
  }
}

/**
 * Check if storage is available for uploads
 */
export async function isStorageAvailable(): Promise<boolean> {
  const config = await getActiveStorageConfig();
  return config !== null;
}

/**
 * Generate a unique filename for uploaded files
 */
export function generateStorageFilename(originalFilename: string, contactId: number, imageType: 'front' | 'back'): string {
  const timestamp = Date.now();
  const extension = originalFilename.split('.').pop()?.toLowerCase() || 'jpg';
  return `qsl-cards/contact-${contactId}/${imageType}-${timestamp}.${extension}`;
}

/**
 * Upload file to Azure Blob Storage
 */
async function uploadToAzureBlob(
  config: StorageConfig,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<UploadResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BlobServiceClient } = require('@azure/storage-blob');

    // Create connection string for Azure Blob Storage
    const connectionString = `DefaultEndpointsProtocol=https;AccountName=${config.account_name};AccountKey=${config.account_key};EndpointSuffix=core.windows.net`;

    // Create BlobServiceClient
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

    // Get container client
    const containerClient = blobServiceClient.getContainerClient(config.container_name);

    // Ensure container exists
    await containerClient.createIfNotExists({
      access: 'blob' // Public read access for images
    });

    // Get blob name (just the filename part)
    const blobName = filename.split('/').pop() || 'upload.jpg';

    // Get block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload the file
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
        blobCacheControl: 'public, max-age=31536000' // Cache for 1 year
      }
    });

    const storage_path = filename;
    const storage_url = blockBlobClient.url;

    logger.info('File uploaded to Azure Blob Storage', { storage_url });

    return {
      success: true,
      storage_path,
      storage_url,
      storage_type: 'azure_blob'
    };
  } catch (error) {
    logger.error('Azure Blob upload failed', error);
    return {
      success: false,
      storage_path: '',
      storage_type: 'azure_blob',
      error: `Failed to upload to Azure Blob Storage: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Upload file to AWS S3
 * NOTE: AWS S3 storage is not yet implemented
 */
async function uploadToS3(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config: StorageConfig,
  filename: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _buffer: Buffer,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _mimeType: string
): Promise<UploadResult> {
  // AWS S3 is not yet implemented
  logger.warn('AWS S3 storage is not implemented', { filename });
  return {
    success: false,
    storage_path: '',
    storage_type: 'aws_s3',
    error: 'AWS S3 storage is not yet implemented. Please configure Azure Blob or Local Storage instead.'
  };
}

/**
 * Upload file to local storage
 */
async function uploadToLocalStorage(
  config: StorageConfig,
  filename: string,
  buffer: Buffer,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _mimeType: string
): Promise<UploadResult> {
  try {
    // Use container_name as the base directory for local storage
    const baseDir = config.container_name || 'uploads';
    const uploadsDir = path.join(process.cwd(), 'public', baseDir);
    const filePath = path.join(uploadsDir, filename);
    const fileDir = path.dirname(filePath);

    // Ensure the directory exists
    await fs.mkdir(fileDir, { recursive: true });

    // Write the file
    await fs.writeFile(filePath, buffer);

    const storage_path = filename;
    const storage_url = `/${baseDir}/${filename}`;

    logger.info('File uploaded to local storage', { storage_url });

    return {
      success: true,
      storage_path,
      storage_url,
      storage_type: 'local_storage'
    };
  } catch (error) {
    logger.error('Local storage upload failed', error);
    return {
      success: false,
      storage_path: '',
      storage_type: 'local_storage',
      error: `Failed to upload to local storage: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Upload file to configured cloud storage
 */
export async function uploadFile(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string,
  contactId: number,
  imageType: 'front' | 'back'
): Promise<UploadResult> {
  const config = await getActiveStorageConfig();

  if (!config) {
    return {
      success: false,
      storage_path: '',
      storage_type: 'none',
      error: 'No storage configuration available'
    };
  }

  const filename = generateStorageFilename(originalFilename, contactId, imageType);

  switch (config.config_type) {
    case 'azure_blob':
      return uploadToAzureBlob(config, filename, buffer, mimeType);
    case 'aws_s3':
      return uploadToS3(config, filename, buffer, mimeType);
    case 'local_storage':
      return uploadToLocalStorage(config, filename, buffer, mimeType);
    default:
      return {
        success: false,
        storage_path: '',
        storage_type: config.config_type,
        error: 'Unsupported storage type'
      };
  }
}

/**
 * Delete file from Azure Blob Storage
 */
async function deleteFromAzureBlob(config: StorageConfig, storagePath: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BlobServiceClient } = require('@azure/storage-blob');

    // Create connection string for Azure Blob Storage
    const connectionString = `DefaultEndpointsProtocol=https;AccountName=${config.account_name};AccountKey=${config.account_key};EndpointSuffix=core.windows.net`;

    // Create BlobServiceClient
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

    // Get container client
    const containerClient = blobServiceClient.getContainerClient(config.container_name);

    // Get blob name (just the filename part)
    const blobName = storagePath.split('/').pop() || '';

    // Get block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Delete the file
    await blockBlobClient.deleteIfExists();

    logger.info('File deleted from Azure Blob Storage', { blobName });
    return true;
  } catch (error) {
    logger.error('Azure Blob delete failed', error);
    return false;
  }
}

/**
 * Delete file from local storage
 */
async function deleteFromLocalStorage(config: StorageConfig, storagePath: string): Promise<boolean> {
  try {
    const baseDir = config.container_name || 'uploads';
    const filePath = path.join(process.cwd(), 'public', baseDir, storagePath);

    // Check if file exists before trying to delete
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      logger.info('File deleted from local storage', { storagePath });
      return true;
    } catch (error) {
      // File doesn't exist, consider it successfully deleted
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('File not found, considering it deleted', { storagePath });
        return true;
      }
      throw error;
    }
  } catch (error) {
    logger.error('Local storage delete failed', error);
    return false;
  }
}

/**
 * Delete file from cloud storage
 */
export async function deleteFile(storagePath: string, storageType: string): Promise<boolean> {
  const config = await getActiveStorageConfig();

  if (!config || config.config_type !== storageType) {
    return false;
  }

  try {
    switch (storageType) {
      case 'azure_blob':
        return await deleteFromAzureBlob(config, storagePath);
      case 'aws_s3':
        // TODO: Implement AWS S3 deletion
        logger.warn('AWS S3 deletion not implemented', { storagePath });
        return false;
      case 'local_storage':
        return await deleteFromLocalStorage(config, storagePath);
      default:
        logger.warn('Unknown storage type', { storageType });
        return false;
    }
  } catch (error) {
    logger.error('Error deleting file', error);
    return false;
  }
}