const express       = require('express');
const bcrypt        = require('bcryptjs');
const jwt           = require('jsonwebtoken');
const { poolPromise, sql } = require('../db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);

    const pool = await poolPromise;
    await pool.request()
      .input('NombreUsuario', sql.VarChar(50),  nombre)
      .input('Email',         sql.VarChar(100), email)
      .input('Contrasena',    sql.VarChar(200), hash)
      .input('RolID', sql.Int, 2) // Rol de usuario normal
      // Puedes cambiar el RolID según tu lógica de roles
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

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = await poolPromise;
    const { recordset } = await pool.request()
      .input('Email', sql.VarChar(100), email)
      .query(`SELECT 
        UsuarioID,
         NombreUsuario,
         Email,
         Contrasena  AS PassHash, 
         RolID
       FROM Usuarios
       WHERE Email = @Email`);

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
// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const pool   = await poolPromise;
    const { recordset } = await pool.request()
      .input('UsuarioID', sql.Int, userId)
      .query(`
        SELECT UsuarioID, NombreUsuario, Email, RolID
          FROM Usuarios
         WHERE UsuarioID = @UsuarioID
      `);
    if (!recordset.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const user = recordset[0];
    res.json({
      id:   user.UsuarioID,
      nombre: user.NombreUsuario,
      email:  user.Email,
      rol:    user.RolID
    });
  } catch (err) {
    console.error('Error en /api/auth/me:', err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

module.exports = router;
