import type { FastifyInstance } from "fastify";
import { CharacterController } from "../controllers/CharacterController.js";
import { CharacterModel } from "../models/CharacterModel.js";
import { CharacterService } from "../services/CharacterService.js";

export async function characterRoutes(app: FastifyInstance): Promise<void> {
  const model = new CharacterModel();
  const service = new CharacterService(model);
  const controller = new CharacterController(service);

  app.get("/characters", controller.list.bind(controller));
  app.post("/characters", controller.create.bind(controller));
}