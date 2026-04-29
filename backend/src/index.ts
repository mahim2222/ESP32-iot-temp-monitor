import "dotenv/config";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { connectDatabase } from "./config/database";
import authRouter from "./routers/auth.router";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

const frontendOrigin = process.env.FRONTEND_URL ?? "http://localhost:3000";

app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.send("Hello, Express server is running!");
});

app.use("/api/auth", authRouter);

async function bootstrap(): Promise<void> {
  if (!process.env.JWT_SECRET) {
    console.error("FATAL: Set JWT_SECRET in your environment (see .env.example)");
    process.exit(1);
  }

  await connectDatabase();
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
