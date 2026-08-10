import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middlewares/authMiddleware";

export const managementRoutes = Router();

managementRoutes.use(authMiddleware);

function marketId(req: AuthenticatedRequest) {
  return req.user?.marketId || "";
}

managementRoutes.get("/categories", async (req: AuthenticatedRequest, res) => {
  const categories = await prisma.category.findMany({
    where: { marketId: marketId(req) },
    orderBy: { name: "asc" },
  });
  return res.json({ categories });
});

managementRoutes.post("/categories", async (req: AuthenticatedRequest, res) => {
  const name = String(req.body.name || "").trim();
  const color = String(req.body.color || "#3b82f6").trim();

  if (!name) {
    return res.status(400).json({ message: "Nome obrigatório." });
  }

  try {
    const category = await prisma.category.create({
      data: { marketId: marketId(req), name, color },
    });
    return res.status(201).json({ category });
  } catch {
    return res.status(409).json({ message: "Esta categoria já existe." });
  }
});

managementRoutes.delete(
  "/categories/:id",
  async (req: AuthenticatedRequest, res) => {
    const result = await prisma.category.deleteMany({
      where: { id: req.params.id, marketId: marketId(req) },
    });
    if (!result.count) {
      return res.status(404).json({ message: "Categoria não encontrada." });
    }
    return res.json({ message: "Categoria excluída." });
  }
);

managementRoutes.get("/customers", async (req: AuthenticatedRequest, res) => {
  const customers = await prisma.customer.findMany({
    where: { marketId: marketId(req) },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ customers });
});

managementRoutes.post("/customers", async (req: AuthenticatedRequest, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) {
    return res.status(400).json({ message: "Nome obrigatório." });
  }

  const customer = await prisma.customer.create({
    data: {
      marketId: marketId(req),
      name,
      phone: req.body.phone ? String(req.body.phone).trim() : null,
      email: req.body.email ? String(req.body.email).trim() : null,
      document: req.body.document ? String(req.body.document).trim() : null,
    },
  });
  return res.status(201).json({ customer });
});

managementRoutes.delete(
  "/customers/:id",
  async (req: AuthenticatedRequest, res) => {
    const result = await prisma.customer.deleteMany({
      where: { id: req.params.id, marketId: marketId(req) },
    });
    if (!result.count) {
      return res.status(404).json({ message: "Cliente não encontrado." });
    }
    return res.json({ message: "Cliente excluído." });
  }
);

managementRoutes.get("/employees", async (req: AuthenticatedRequest, res) => {
  const employees = await prisma.employee.findMany({
    where: { marketId: marketId(req) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return res.json({ employees });
});

managementRoutes.post("/employees", async (req: AuthenticatedRequest, res) => {
  const name = String(req.body.name || "").trim();
  const role = req.body.role === "MANAGER" ? "MANAGER" : "CASHIER";
  const pin = req.body.pin ? String(req.body.pin).trim() : null;

  if (!name) {
    return res.status(400).json({ message: "Nome obrigatório." });
  }

  if (pin && !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ message: "O PIN deve ter 4 dígitos." });
  }

  const employee = await prisma.employee.create({
    data: {
      marketId: marketId(req),
      name,
      role,
      pin: pin ? await bcrypt.hash(pin, 10) : null,
      isActive: req.body.isActive !== false,
    },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return res.status(201).json({ employee });
});

managementRoutes.patch(
  "/employees/:id/status",
  async (req: AuthenticatedRequest, res) => {
    const current = await prisma.employee.findFirst({
      where: { id: req.params.id, marketId: marketId(req) },
    });
    if (!current) {
      return res.status(404).json({ message: "Funcionário não encontrado." });
    }
    const employee = await prisma.employee.update({
      where: { id: current.id },
      data: { isActive: !current.isActive },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return res.json({ employee });
  }
);

managementRoutes.delete(
  "/employees/:id",
  async (req: AuthenticatedRequest, res) => {
    const result = await prisma.employee.deleteMany({
      where: { id: req.params.id, marketId: marketId(req) },
    });
    if (!result.count) {
      return res.status(404).json({ message: "Funcionário não encontrado." });
    }
    return res.json({ message: "Funcionário excluído." });
  }
);

const defaultPayments = ["CASH", "PIX", "CREDIT", "DEBIT"];

managementRoutes.get(
  "/payment-settings",
  async (req: AuthenticatedRequest, res) => {
    await Promise.all(
      defaultPayments.map((type) =>
        prisma.paymentSetting.upsert({
          where: {
            marketId_type: { marketId: marketId(req), type },
          },
          update: {},
          create: { marketId: marketId(req), type, isEnabled: true },
        })
      )
    );

    const paymentSettings = await prisma.paymentSetting.findMany({
      where: { marketId: marketId(req) },
      orderBy: { type: "asc" },
    });
    return res.json({ paymentSettings });
  }
);

managementRoutes.patch(
  "/payment-settings/:type",
  async (req: AuthenticatedRequest, res) => {
    const type = String(req.params.type || "").toUpperCase();
    if (!defaultPayments.includes(type)) {
      return res.status(400).json({ message: "Forma de pagamento inválida." });
    }

    const paymentSetting = await prisma.paymentSetting.upsert({
      where: {
        marketId_type: { marketId: marketId(req), type },
      },
      update: { isEnabled: Boolean(req.body.isEnabled) },
      create: {
        marketId: marketId(req),
        type,
        isEnabled: Boolean(req.body.isEnabled),
      },
    });
    return res.json({ paymentSetting });
  }
);

managementRoutes.get("/market", async (req: AuthenticatedRequest, res) => {
  const market = await prisma.market.findUnique({
    where: { id: marketId(req) },
    include: { owner: { select: { name: true, email: true } } },
  });
  return res.json({ market });
});

managementRoutes.put("/market", async (req: AuthenticatedRequest, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) {
    return res.status(400).json({ message: "Nome do mercado é obrigatório." });
  }

  const market = await prisma.market.update({
    where: { id: marketId(req) },
    data: {
      name,
      phone: req.body.phone ? String(req.body.phone).trim() : null,
      address: req.body.address ? String(req.body.address).trim() : null,
    },
  });

  if (req.body.ownerName) {
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { name: String(req.body.ownerName).trim() },
    });
  }

  return res.json({ market });
});

managementRoutes.patch(
  "/stock/:productId",
  async (req: AuthenticatedRequest, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.productId, marketId: marketId(req) },
    });
    if (!product) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }

    const adjustment = Number(req.body.adjustment);
    if (!Number.isInteger(adjustment)) {
      return res.status(400).json({ message: "Ajuste inválido." });
    }

    const updatedProduct = await prisma.product.update({
      where: { id: product.id },
      data: { stock: Math.max(0, product.stock + adjustment) },
    });
    return res.json({ product: updatedProduct });
  }
);
