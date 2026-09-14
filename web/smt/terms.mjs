// Presentation copy only. Simulation values and exported records are unchanged.
export const STATION_TERMS=[
 ['기판 투입','Loader','전자기판을 조립 라인에 넣어요.'],
 ['납 바르기','Screen Printer','부품을 붙일 자리에 반죽 형태의 납 재료(솔더 페이스트)를 발라요.'],
 ['납 도포량 측정','SPI · Solder Paste Inspection','납이 얼마나 발렸는지 확인해요. 이 데모의 허용 범위는 80–120%예요.'],
 ['칩 부품 올리기','Chip Mounter','작은 칩 부품을 기판의 정해진 자리에 올려요. 위치 오차는 계산하지 않아요.'],
 ['다른 부품 올리기','Component Mounter','모양이 다른 부품을 기판에 올리는 단계예요. 공정 흐름만 보여줘요.'],
 ['눈으로 확인하기','Visual Inspection · Work Table','중간 상태를 사람이 살펴보는 자리예요. 작업자의 판단은 재현하지 않아요.'],
 ['납땜 가열','Reflow Soldering','열로 납을 녹여 부품을 연결하는 단계예요. 데모 범위 235–250°C는 실제 장비 설정 지침이 아니에요.'],
 ['기판 식히기','Cooling Conveyor','가열한 기판을 식히는 단계예요. 냉각 속도나 열전달은 계산하지 않아요.'],
 ['마지막 외관 확인','AOI · Automated Optical Inspection','실제 장비는 영상으로 외관을 검사해요. 이 화면은 영상 분석 없이 가상 규칙으로 결과를 만들어요.'],
 ['검사 뒤 대기','NG Buffer','검사를 마친 기판이 잠시 기다리는 자리예요. 실제 불량 분기 장치는 재현하지 않아요.'],
 ['기판 꺼내기','Unloader','조립 라인을 지난 기판을 꺼내요. 이번 실행은 12장까지 진행해요.']
].map(([plain,formal,explanation])=>({plain,formal,explanation}));
export function plainCopy(text){return text.replaceAll('가상 AOI','가상 최종 검사(AOI)').replaceAll('SPI','납 검사(SPI)').replaceAll('리플로우','납땜 가열(리플로우)').replaceAll('NG','불량 표시(NG)').replaceAll('OK','통과 표시(OK)');}
