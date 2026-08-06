/** Endpoints del asistente de diagnóstico. */
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AiAnswer, AiService } from "./ai.service";
import { AskDto } from "./dto/ask.dto";
import { ExplainDtcDto } from "./dto/explain-dtc.dto";

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** POST /ai/dtc — explica un código de avería. */
  @Post("dtc")
  @HttpCode(HttpStatus.OK)
  explainDtc(@Body() dto: ExplainDtcDto): Promise<AiAnswer> {
    return this.ai.explainDtc(dto);
  }

  /** POST /ai/ask — pregunta libre al mecánico virtual. */
  @Post("ask")
  @HttpCode(HttpStatus.OK)
  ask(@Body() dto: AskDto): Promise<AiAnswer> {
    return this.ai.ask(dto);
  }
}
