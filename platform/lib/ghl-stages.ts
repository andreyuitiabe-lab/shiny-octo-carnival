// Mapping between OUR funnel (lib/types.ts::Stage) and the SwiftScale/GHL
// "SMS Marketing Pipeline" opportunity stages. One-way: we are the source of
// truth (wiki ADR 0001); moving a lead in our platform pushes the matching
// stage to GHL so the SwiftScale pipeline mirrors us. We never read GHL's stage
// back as truth. Our funnel is finer than GHL's 9 stages, so several of ours
// intentionally collapse onto one GHL stage.
//
// Stage IDs pulled live from GHL on 22 jul 2026 (pipeline jQWf2caQofZTJ9NDEwij).
// If the pipeline is edited in SwiftScale these can go stale — re-pull with
// GET /opportunities/pipelines?locationId=<loc>.

import type { Stage } from "./types";

export const GHL_PIPELINE_ID = "jQWf2caQofZTJ9NDEwij";

const GHL_STAGE = {
  responded: "406eb009-a4a7-4420-b133-440822cbb559",
  hotLead: "389563a1-330b-4ffb-ab14-6262a51cebd4",
  offerGiven: "563b9ce0-0605-41b5-8cb3-c452bea2e13b",
  sendContract: "7cb26787-cedf-418d-b782-cbef42b2bbb2",
  underContract: "2f00bc3c-c851-4475-82e3-ab971fc7a130",
  closed: "57a30858-141c-4a38-8f08-9a2f1832b6a5",
  followUp: "be176e48-ca3a-4ff8-86fc-520b72fc3786",
  cancelled: "8c41227f-84fb-4bd7-9687-8295d3de3c13",
  doNotContact: "26c64fae-6c5a-45ee-b612-bdff03bd8cde",
} as const;

const STAGE_TO_GHL: Record<Stage, string> = {
  New: GHL_STAGE.responded,
  "Needs Triage": GHL_STAGE.responded,
  Engaging: GHL_STAGE.responded,
  Qualifying: GHL_STAGE.hotLead,
  Negotiating: GHL_STAGE.hotLead,
  "Ready for Research": GHL_STAGE.hotLead,
  "Proposal Ready": GHL_STAGE.hotLead, // offer not sent yet
  "Proposal Sent": GHL_STAGE.offerGiven,
  "Under Contract": GHL_STAGE.underContract,
  Closed: GHL_STAGE.closed,
  Discarded: GHL_STAGE.cancelled,
  "Do Not Contact": GHL_STAGE.doNotContact,
};

/** The GHL pipeline-stage id our stage should push the opportunity to. */
export function ghlStageId(stage: Stage): string {
  return STAGE_TO_GHL[stage];
}
