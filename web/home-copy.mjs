export const BEGINNER_COPY = {
  ko: [
    "하는 일: 저장된 생산 기록을 위험점수 순으로 정렬합니다.",
    "사람의 역할: 근거를 확인하고 최종 판단합니다.",
    "현재 한계: 공개 데이터 실험이며 현장 효과는 미검증입니다.",
  ],
  en: [
    "What it does: ranks saved production records by risk score.",
    "Human role: reviews the evidence and makes the final decision.",
    "Current limit: a public-data experiment, not field validated.",
  ],
};

export const beginnerLines = language => BEGINNER_COPY[language === "en" ? "en" : "ko"];
