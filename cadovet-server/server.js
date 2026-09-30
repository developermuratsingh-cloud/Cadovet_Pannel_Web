const app = require('./src/app');
const db = require('./src/database');

const PORT = process.env.PORT || 5001;

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    try {
        const res = await db.query('SELECT NOW()');
        console.log('Database connected successfully:', res.rows[0].now);
    } catch (err) {
        console.error('Database connection failed:', err.message);
    }
});
