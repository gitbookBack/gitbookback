// upload.js
const { BlobServiceClient } = require('@azure/storage-blob');
const path                 = require('path');
const { v4: uuidv4 }       = require('uuid');

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

/**
 * Súbe un archivo local a Azure Blob Storage en el contenedor indicado.
 *
 * @param {string} containerName  Nombre del contenedor (e.g. 'avatar', 'banner', 'portadas-gitbook')
 * @param {string} localFilePath  Ruta local al archivo (desde multer)
 * @returns {Promise<string>}     URL pública del blob subido
 */
async function subirImagen(containerName, localFilePath) {
  const blobServiceClient = BlobServiceClient
    .fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);

  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists({ access: 'container' });

  const blobName = uuidv4() + path.extname(localFilePath);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadFile(localFilePath);
  return blockBlobClient.url;
}

module.exports = { subirImagen };
