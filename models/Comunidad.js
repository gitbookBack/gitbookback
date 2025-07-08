// models/Comunidad.js (con Mongoose, pero podrías usar el driver nativo igual)
/** 
 * Colección de publicaciones
 */
const mongoose = require('mongoose');
const { Schema, model, Types } = mongoose;

const PublicacionSchema = new Schema({
  usuarioId:    { type: Types.ObjectId, ref: 'Usuario', required: true }, 
  texto:        { type: String, maxlength: 1000 },
  imagenUrl:    { type: String },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now }
});

const ComentarioSchema = new Schema({
  publicacionId: { type: Types.ObjectId, ref: 'Publicacion', required: true },
  usuarioId:     { type: Types.ObjectId, ref: 'Usuario', required: true },
  texto:         { type: String, maxlength: 1000 },
  createdAt:     { type: Date, default: Date.now }
});

const ReaccionSchema = new Schema({
  publicacionId: { type: Types.ObjectId, ref: 'Publicacion', required: true },
  usuarioId:     { type: Types.ObjectId, ref: 'Usuario', required: true },
  tipo:          { type: String, enum: ['like','dislike','love'], required: true },
  createdAt:     { type: Date, default: Date.now }
});

module.exports = {
  Publicacion: model('Publicacion', PublicacionSchema),
  Comentario:  model('Comentario',  ComentarioSchema),
  Reaccion:    model('Reaccion',    ReaccionSchema)
};
