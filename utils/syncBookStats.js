// backend/utils/syncBookStats.js
const { connect } = require('../mongoClient');
const { poolPromise, sql } = require('../db');
const { ObjectId } = require('mongodb');

async function syncBookStats(bookId) {
  const db = await connect();
  const oid = new ObjectId(bookId);

  // 1. Recalculate rating
  const [ratingAgg] = await db.collection('reviews').aggregate([
    { $match: { bookId: oid } },
    { $group: { _id: null, avg: { $avg: '$rating' }, cnt: { $sum: 1 } } }
  ]).toArray();

  const averageRating = ratingAgg?.avg?.toFixed(2) ?? 0;
  const totalReviews   = ratingAgg?.cnt ?? 0;

  // 2. Count favorites
  const totalFavorites = await db.collection('favorites')
    .countDocuments({ bookId: oid });

  // 3. Count shares
  const totalShares = await db.collection('shares')
    .countDocuments({ bookId: oid });

  // 4. Update SQL
  const pool = await poolPromise;
  await pool.request()
    .input('LibroID',       sql.Int,      Number(bookId))
    .input('AverageRating', sql.Decimal(3,2), averageRating)
    .input('TotalReviews',  sql.Int,      totalReviews)
    .input('TotalFavorites',sql.Int,      totalFavorites)
    .input('TotalShares',   sql.Int,      totalShares)
    .query(`
      UPDATE Libros
         SET AverageRating = @AverageRating,
             TotalReviews   = @TotalReviews,
             TotalFavorites = @TotalFavorites,
             TotalShares    = @TotalShares
       WHERE LibroID       = @LibroID;
    `);
}

module.exports = { syncBookStats };
