export const BEGINNER_COPY = {
  ko: [
    "공장에서 매일 나오는 수많은 생산 기록 중, 어떤 걸 먼저 확인해야 할지 AI가 순서를 정해줍니다.",
    "AI는 순서만 제안하고, 실제 판단은 항상 사람인 엔지니어가 합니다.",
    "지금은 실험 단계이고, 실제 공장에 적용된 검증은 아직 안 됐습니다.",
  ],
  en: [
    "AI orders the many production records generated each day so engineers know what to inspect first.",
    "AI only suggests the order; an engineer always makes the actual decision.",
    "This is an experimental prototype and has not yet been validated in a real factory.",
  ],
};

export const beginnerLines = language => BEGINNER_COPY[language === "en" ? "en" : "ko"];
