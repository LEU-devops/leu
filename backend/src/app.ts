import express from 'express';
import cors from "cors";
import { config } from 'dotenv'
import { version } from '../package.json'

import authRoutes from './modules/auth/routes'
import modalitiesRoutes from './modules/modalities/routes'
import teamsRoutes from './modules/teams/routes'
import venuesRoutes from './modules/venues/routes'

import { errorMiddleware } from './middlewares/error.middleware';
config({ quiet: true })

const app = express();

app.use(cors({

    credentials: true,
}));

app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
})

app.use(express.json());

app.get("/", (_, res) => {
    res.send(`LEU Bet v${version}`);
});

app.use('/auth', authRoutes)
app.use('/modalities', modalitiesRoutes)
app.use('/teams', teamsRoutes)
app.use('/venues', venuesRoutes)

app.use(errorMiddleware)

export default app;