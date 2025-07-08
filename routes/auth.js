// routes/auth.js

const express         = require('express');
const bcrypt          = require('bcryptjs');
const jwt             = require('jsonwebtoken');
const path            = require('path');
const fs              = require('fs');
const multer          = require('multer');
const { poolPromise, sql } = require('../db');
const authMiddleware  = require('../middleware/auth');
const { subirImagen } = require('../upload');

const router = express.Router();

// Multer: guarda temporalmente en /temp
const upload = multer({ dest: path.join(__dirname, '../temp') });

// ─── REGISTER ─────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);

    const pool = await poolPromise;
    await pool.request()
      .input('NombreUsuario', sql.VarChar(50),  nombre)
      .input('Email',         sql.VarChar(100), email)
      .input('Contrasena',    sql.VarChar(200), hash)
      .input('RolID',         sql.Int,          2) // usuario normal
      .query(`
        INSERT INTO Usuarios (NombreUsuario, Email, Contrasena, RolID)
        VALUES (@NombreUsuario, @Email, @Contrasena, @RolID);
      `);

    res.status(201).json({ message: 'Usuario registrado con éxito' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el registro' });
  }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = await poolPromise;
    const { recordset } = await pool.request()
      .input('Email', sql.VarChar(100), email)
      .query(`
        SELECT 
          UsuarioID,
          NombreUsuario,
          Email,
          Contrasena AS PassHash,
          RolID
        FROM Usuarios
        WHERE Email = @Email
      `);

    const user = recordset[0];
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const valid = await bcrypt.compare(password, user.PassHash);
    if (!valid) return res.status(401).json({ error: 'Contraseña inválida' });

    const token = jwt.sign(
      { id: user.UsuarioID, rol: user.RolID },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el login' });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const pool   = await poolPromise;
    const { recordset } = await pool.request()
      .input('UsuarioID', sql.Int, userId)
      .query(`
        SELECT 
          UsuarioID, 
          NombreUsuario, 
          Email, 
          RolID,
          AvatarUrl,
          BannerUrl
        FROM Usuarios
        WHERE UsuarioID = @UsuarioID
      `);

    if (!recordset.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = recordset[0];
    res.json({
      id:        user.UsuarioID,
      nombre:    user.NombreUsuario,
      email:     user.Email,
      rol:       user.RolID,
      avatarUrl: user.AvatarUrl,
      bannerUrl: user.BannerUrl
    });
  } catch (err) {
    console.error('Error en /api/auth/me:', err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// ─── PATCH /api/auth/avatar ───────────────────────────────────────────────
// sube a Azure, guarda URL en AvatarUrl
router.patch(
  '/avatar',
  authMiddleware,
  upload.single('file'),
  async (req, res) => {
    try {
      const userId   = req.user.id;
      const localPth = req.file.path;
      // sube a contenedor "avatars"
      const imageUrl = await subirImagen('avatars', localPth);

      const pool = await poolPromise;
      await pool.request()
        .input('UsuarioID', sql.Int,          userId)
        .input('AvatarUrl', sql.NVarChar(200), imageUrl)
        .query(`
          UPDATE Usuarios
             SET AvatarUrl = @AvatarUrl,
                 UpdatedAt = GETDATE()
           WHERE UsuarioID = @UsuarioID
        `);

      // limpia temporal
      fs.unlinkSync(localPth);
      res.json({ imageUrl });
    } catch (err) {
      console.error('Error subiendo avatar:', err);
      res.status(500).json({ error: 'No se pudo subir avatar' });
    }
  }
);

// ─── PATCH /api/auth/banner ───────────────────────────────────────────────
// sube a Azure, guarda URL en BannerUrl
router.patch(
  '/banner',
  authMiddleware,
  upload.single('file'),
  async (req, res) => {
    try {
      const userId   = req.user.id;
      const localPth = req.file.path;
      // sube a contenedor "banners"
      const imageUrl = await subirImagen('banners', localPth);

      const pool = await poolPromise;
      await pool.request()
        .input('UsuarioID', sql.Int,           userId)
        .input('BannerUrl', sql.NVarChar(200), imageUrl)
        .query(`
          UPDATE Usuarios
             SET BannerUrl = @BannerUrl,
                 UpdatedAt = GETDATE()
           WHERE UsuarioID = @UsuarioID
        `);

      fs.unlinkSync(localPth);
      res.json({ imageUrl });
    } catch (err) {
      console.error('Error subiendo banner:', err);
      res.status(500).json({ error: 'No se pudo subir banner' });
    }
  }
);

module.exports = router;
