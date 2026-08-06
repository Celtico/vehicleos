/**
 * @vehicleos/ai — conocimiento local de DTC y cliente del asistente.
 */
export {
  DTC_KNOWLEDGE,
  allKnowledge,
  type DtcKnowledgeEntry,
  type DtcSeverity,
} from "./knowledge";
export { explainDtc, type DtcExplanation } from "./explain";
export {
  AssistantClient,
  buildLocalAnswer,
  type AssistantAnswer,
  type AssistantClientOptions,
  type AssistantRequest,
} from "./assistant";
