import express from "express";
import cors from "cors";
import path from "node:path";
import { config } from "dotenv";
import { version } from "../package.json";

import authRoutes from "./modules/auth/routes";
import modalitiesRoutes from "./modules/modalities/routes";
import eventsRoutes from "./modules/events/routes";
import matchesRoutes from "./modules/matches/routes";
import teamsRoutes from "./modules/teams/routes";
import organizationsRoutes from "./modules/organizations/routes";
import venuesRoutes from "./modules/venues/routes";
import timeSlotsRoutes from "./modules/time-slots/routes";
import standingsRoutes from "./modules/standings/routes";
import sportsTeamsRoutes from "./modules/sports-teams/routes";
import awardsRoutes from "./modules/awards/routes";
import usersRoutes from "./modules/users/routes";

import { errorMiddleware } from "./middlewares/error.middleware";
config({ quiet: true });

const app = express();

app.use(
  cors({
    credentials: true,
  }),
);

// Vercel routes /api/* to this service. The vercel.json transform should strip the prefix,
// but strip it here too so the app answers either way. Locally the Vite proxy already strips it.
app.use((req, _res, next) => {
  if (
    req.url === "/api" ||
    req.url.startsWith("/api/") ||
    req.url.startsWith("/api?")
  )
    req.url = req.url.slice("/api".length) || "/";
  next();
});

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

app.use(express.json());
app.use(
  "/uploads",
  express.static(path.resolve(process.cwd(), "public", "uploads")),
);

app.get("/", (_, res) => {
  res.send(`LEU v${version}`);
});

app.use("/auth", authRoutes);
app.use("/modalities", modalitiesRoutes);
app.use("/modalities", eventsRoutes); // atletismo, natação: registrations and internal events
app.use("/matches", matchesRoutes);
app.use("/teams", teamsRoutes);
app.use("/organizations", organizationsRoutes);
app.use("/venues", venuesRoutes);
app.use("/time-slots", timeSlotsRoutes);
app.use("/standings", standingsRoutes);
app.use("/sports-teams", sportsTeamsRoutes);
app.use("/awards", awardsRoutes);
app.use("/users", usersRoutes);

app.use(errorMiddleware);

export default app;
