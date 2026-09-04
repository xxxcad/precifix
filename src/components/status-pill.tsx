import type { MarginClassificationRule } from "@/domain/pricing/types";

export function StatusPill({ classification }: { classification: MarginClassificationRule }) {
  return <span className={`status-pill ${classification.tone}`}>{classification.label}</span>;
}
