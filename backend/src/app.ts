import express from 'express';
import cors from "cors";
import { config } from 'dotenv'
import { version } from '../package.json'

import authRoutes from './modules/auth/routes'
import modalitiesRoutes from './modules/modalities/routes'
import eventsRoutes from './modules/events/routes'
import matchesRoutes from './modules/matches/routes'
import teamsRoutes from './modules/teams/routes'
import venuesRoutes from './modules/venues/routes'
import timeSlotsRoutes from './modules/time-slots/routes'
import standingsRoutes from './modules/standings/routes'

import { errorMiddleware } from './middlewares/error.middleware';
config({ quiet: true })

const app = express();

app.use(cors({

    credentials: true,
}));

// Vercel routes /api/* to this service. The vercel.json transform should strip the prefix,
// but strip it here too so the app answers either way. Locally the Vite proxy already strips it.
app.use((req, _res, next) => {
    if (req.url === '/api' || req.url.startsWith('/api/') || req.url.startsWith('/api?'))
        req.url = req.url.slice('/api'.length) || '/';
    next();
});

app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
})

app.use(express.json());

app.get("/", (_, res) => {
    res.send(`LEU v${version}`);
});

app.use('/auth', authRoutes)
app.use('/modalities', modalitiesRoutes)
app.use('/modalities', eventsRoutes) // atletismo, natação: registrations and internal events
app.use('/matches', matchesRoutes)
app.use('/teams', teamsRoutes)
app.use('/venues', venuesRoutes)
app.use('/time-slots', timeSlotsRoutes)
app.use('/standings', standingsRoutes)

app.use(errorMiddleware)

export default app;