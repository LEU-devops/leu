import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import app from './app';
import './types/express';
import { initDatabase } from './services/db';

const port = process.env.PORT || 3000;


initDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Server running on http://localhost:${port} in mode ${process.env.NODE_ENV || 'development'}`);
        console.log(`Started at ${new Date().toISOString()}`);
    });
}).catch(err => {
    console.error("Failed to initialize the database:", err);
    process.exit(1);
});