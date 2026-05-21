import "dotenv/config";
import express from "express";
import cors from "cors";

import { authRoutes } from "./routes/auth.routes";
import { productsRoutes } from "./routes/products.routes";
import { salesRoutes } from "./routes/sales.routes";
import { dashboardRoutes } from "./routes/dashboard.routes";
import { publicRoutes } from "./routes/public.routes";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://tabacaria-web.vercel.app",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origem não permitida pelo CORS."));
    },
  })
);

app.use(express.json());

app.get("/", (_req, res) => {
  return res.json({
    message: "API PDV Fácil rodando!",
  });
});

app.use("/auth", authRoutes);
app.use("/products", productsRoutes);
app.use("/sales", salesRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/public", publicRoutes);

const port = Number(process.env.PORT) || 3333;

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});