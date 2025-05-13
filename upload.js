// upload.js
const { BlobServiceClient } = require('@azure/storage-blob');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Debes definir esta variable en tu .env:
// AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=...;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

async function subirImagen(localFilePath) {
  // 1) Conectamos al Blob Service
  const blobServiceClient = BlobServiceClient
    .fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);

  // 2) Seleccionamos el container (crea 'portadas-gitbook' en el Portal)
  const containerClient = blobServiceClient.getContainerClient('portadas-gitbook');
  await containerClient.createIfNotExists({ access: 'container' });

  // 3) Generamos un nombre único para el blob
  const blobName = uuidv4() + path.extname(localFilePath);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // 4) Subimos el archivo desde disco
  await blockBlobClient.uploadFile(localFilePath);

  // 5) Devolvemos la URL pública
  return blockBlobClient.url;
}

module.exports = { subirImagen };
