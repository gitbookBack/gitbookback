// routes/usuarios.js
const express       = require('express');
const multer        = require('multer');
const path          = require('path');
const fs            = require('fs/promises');
const { poolPromise, sql } = require('../db');
const { subirImagen }      = require('../upload');
const router        = express.Router();

// Helper para obtener el userID (o 1 por defecto)
function getUserId(req) {
  return req.user?.id || 1;
}

// Usamos un tmp local antes de subir a Azure
const upload = multer({ dest: path.join(__dirname, '../tmp') });

// GET /api/usuarios/me
router.get('/me', async (req, res) => {
  try {
    const usuarioID = getUserId(req);
    const pool      = await poolPromise;
    const { recordset } = await pool.request()
      .input('UsuarioID', sql.Int, usuarioID)
      .query(`
        SELECT UsuarioID, NombreUsuario, Email, AvatarURL, BannerURL
          FROM dbo.Usuarios
         WHERE UsuarioID = @UsuarioID
      `);

    if (!recordset.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/usuarios/me
// Espera form-data con campos:
//   - NombreUsuario, Email
//   - avatar (file), banner (file)
router.put(
  '/me',
  upload.fields([{ name: 'avatar' }, { name: 'banner' }]),
  async (req, res) => {
    const usuarioID = getUserId(req);
    const { NombreUsuario, Email } = req.body;
    let avatarURL, bannerURL;

    try {
      // Si hay avatar, lo subimos al contenedor "avatar"
      if (req.files.avatar?.[0]) {
        const file = req.files.avatar[0];
        avatarURL = await subirImagen('avatar', file.path);
        await fs.unlink(file.path);
      }

      // Si hay banner, lo subimos al contenedor "banner"
      if (req.files.banner?.[0]) {
        const file = req.files.banner[0];
        bannerURL = await subirImagen('banner', file.path);
        await fs.unlink(file.path);
      }

      // Actualizamos la tabla Usuarios
      const pool = await poolPromise;
      await pool.request()
        .input('UsuarioID',     sql.Int,     usuarioID)
        .input('NombreUsuario', sql.NVarChar(100), NombreUsuario)
        .input('Email',         sql.NVarChar(150), Email)
        .input('AvatarURL',     sql.NVarChar(255), avatarURL || null)
        .input('BannerURL',     sql.NVarChar(255), bannerURL || null)
        .query(`
          UPDATE dbo.Usuarios
             SET NombreUsuario = @NombreUsuario,
                 Email         = @Email,
                 AvatarURL     = COALESCE(@AvatarURL, AvatarURL),
                 BannerURL     = COALESCE(@BannerURL, BannerURL),
                 UpdatedAt     = GETDATE()
           WHERE UsuarioID    = @UsuarioID;
        `);

      res.json({ message: 'Perfil actualizado correctamente' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
