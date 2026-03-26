# VIDE Phase 7 전략 컨텍스트 확장 계획서

작성일: 2026-03-26

현재 위치:
- 완료: `Phase 1. save honesty`
- 완료: `Phase 2. archive safety`
- 완료: `Phase 3. prompt provenance`
- 완료: `Phase 4. versioning redesign`
- 완료: `Phase 5. event model`
- 완료: `Phase 6. staging/comparison UX` 핵심 구현
- 다음 단계: `Phase 7. Direction/Project 전략 객체화`

기준 문서:
- [VIDE_PURPOSE_REVIEW.md](C:/Work/Projects/Hire/visual_ide/VIDE_PURPOSE_REVIEW.md)
- [VIDE_IMPLEMENTATION_PREP.md](C:/Work/Projects/Hire/visual_ide/VIDE_IMPLEMENTATION_PREP.md)
- [VIDE_PHASE6_STAGING_UX_PLAN.md](C:/Work/Projects/Hire/visual_ide/VIDE_PHASE6_STAGING_UX_PLAN.md)

## 1. 문서 목적

이 문서는 VIDE의 다음 단계인 `전략 컨텍스트 확장`을 구현하기 전에,

1. Project와 Direction을 단순 라벨이 아니라 전략 기억 객체로 승격하는 기준을 고정하고,
2. 어떤 정보를 어디에 저장할지,
3. 어떤 화면에서 어떤 깊이로 노출할지,
4. 기존 event 모델과 어떻게 연결할지,
5. 어떤 순서로 구현해야 스키마 충돌과 UX 충돌을 줄일 수 있는지

를 정리하기 위한 준비 문서다.

Phase 7의 핵심 질문은 이것이다.

> "브랜드 전략과 프로젝트 브리프가 실제 생성/수정/선택 순간에 어떤 제약으로 작동하는가?"

즉, 이 단계는 설명용 메모를 늘리는 것이 아니라,
`의사결정 컨텍스트를 작업 흐름 안에 다시 주입`하는 단계다.

## 2. 왜 지금 Phase 7인가

Phase 1부터 6까지를 통해 VIDE는 다음 기반을 확보했다.

1. 저장 정직성
2. archive/restore 안전성
3. prompt provenance 분리
4. node ordinal 기반 표시 체계
5. event timeline과 수동 feedback/decision 기록
6. staging -> comparison -> accept 흐름

이제 남은 핵심 결핍은 `전략 맥락의 부재`다.

현재 상태에서 Direction과 Project는 여전히 다음 수준에 머문다.

- Project: 이름, 설명, 썸네일 중심
- Direction: 색상 + 이름 중심
- Generate/Variation: 전략 맥락 없이 prompt와 태그 위주
- Settings: archive 도구는 있지만 전략 정보의 실질 입력면은 비어 있음

그래서 지금 VIDE는 `무엇을 만들었는가`와 `어떤 비교를 거쳤는가`는 점점 잘 남기지만,
`무엇을 목표로 삼았는가`, `무엇을 피해야 했는가`, `브랜드 톤이 어떤 제약으로 작동했는가`는 아직 약하다.

Phase 7은 이 공백을 메우는 단계다.

## 3. 이번 Phase의 목표

Phase 7에서 달성해야 할 목표는 아래 다섯 가지다.

1. Project가 브랜드/캠페인 상위 브리프를 담는 전략 컨테이너가 되게 한다.
2. Direction이 단순 분류가 아니라 방향성 가설과 적합 기준을 담는 전략 객체가 되게 한다.
3. 생성과 변형 시점에 이 전략 정보를 즉시 참조할 수 있게 한다.
4. 전략 정보 변경이 event timeline에 남도록 연결한다.
5. 1차 구현은 과도한 구조화보다 `입력 가능하고 읽히는 것`을 우선한다.

## 4. 이번 Phase에서 하지 않는 것

아래 항목은 의도적으로 Phase 7 범위에서 제외한다.

- AI가 brief를 자동 생성하거나 자동 요약하는 기능
- 방향 적합도 자동 점수화
- 클라이언트/브랜드별 템플릿 라이브러리
- 멀티 프로젝트 브리프 검색기
- 복잡한 taxonomy 기반 제약 관리
- 권한/승인 워크플로우
- 방향별 문서 첨부 관리 시스템

즉 이번 단계는 `전략 입력과 노출의 기반`을 만드는 것이지,
전략 시스템 전체를 완성하는 단계는 아니다.

## 5. 제품 원칙

### 5.1 자유 텍스트 우선, 구조화는 최소한으로

1차에서는 지나친 구조화를 피한다.
브랜드 에이전시의 실제 브리프는 프로젝트마다 다르고, 초기에 너무 많은 필드를 강제하면 입력 자체가 멈춘다.

권장 원칙:

- 핵심은 `짧은 구조 필드 + 자유 텍스트` 조합으로 간다.
- 리스트형 필드는 단순 줄바꿈 또는 textarea 기반으로 시작한다.
- AI가 재해석한 값이 아니라 사람이 입력한 원문을 우선 저장한다.

### 5.2 전략은 "읽히는 곳"에 있어야 한다

Settings에만 저장되면 다시 죽은 정보가 된다.
Phase 7의 성공은 저장 여부보다 `생성/변형/선택 순간에 실제로 보이는가`에 달려 있다.

### 5.3 Project와 Direction의 역할을 분리한다

- Project는 상위 브랜드/캠페인 문맥을 담는다.
- Direction은 그 문맥 아래에서 탐색하는 개별 방향 가설을 담는다.

즉 Direction은 Project를 대체하지 않고, Project 위에 얹히는 해석층이다.

### 5.4 전략 변경도 event로 남겨야 한다

Phase 5에서 이미 `brief-updated`, `direction-thesis-updated` 타입이 준비되어 있으므로,
Phase 7은 이 이벤트 타입을 실제로 사용하는 첫 단계가 된다.

## 6. 권장 데이터 모델

## 6.1 additive-first 권장안

1차 권장안은 별도 전략 테이블을 만들지 않고, Project와 Direction에 필드를 additive하게 추가하는 방식이다.

권장 필드:

### Project
- `brief`: 프로젝트 핵심 브리프
- `constraints`: 금지 요소, 필수 요소, 실행 제약
- `targetAudience`: 핵심 타깃
- `brandTone`: 브랜드 톤/무드

### Direction
- `thesis`: 이 방향의 핵심 가설
- `fitCriteria`: 이 방향이 잘 됐다고 판단하는 기준
- `antiGoal`: 피해야 할 느낌/요소
- `referenceNotes`: 참고 맥락 메모

이 접근의 장점:

- migration이 단순하다.
- 기존 Project/Direction fetch 흐름을 크게 깨지 않는다.
- Settings, GenerateDialog, VariationPanel, DetailPanel에서 바로 읽기 쉽다.
- Event payload와도 연결하기 쉽다.

## 6.2 왜 별도 Strategy 테이블을 지금 만들지 않는가

장기적으로는 `ProjectContext`, `DirectionContext`, `ConstraintItem`, `FitCriterion` 같은 구조화 테이블이 유용할 수 있다.
하지만 지금은 다음 이유로 비용이 크다.

- 입력 UX가 아직 충분히 검증되지 않았다.
- 어떤 필드가 실제로 자주 쓰이는지 아직 데이터가 없다.
- Phase 7의 목표는 전략 지식의 "정착"이지 완전한 정규화가 아니다.

따라서 1차는 additive-first가 안전하다.

## 7. 권장 UX 구조

## 7.1 Settings를 실제 전략 입력면으로 바꾼다

현재 Settings는 archive 중심이다.
Phase 7에서는 Settings가 실제 전략 패널이 되어야 한다.

권장 구성:

1. Project Brief 섹션
2. Brand Tone / Target Audience 섹션
3. Constraints 섹션
4. Direction Strategy 섹션
5. Archive 섹션은 하단 유지

즉 archive는 유지하되, Settings의 1급 목적을 `전략 관리`로 전환한다.

## 7.2 GenerateDialog에 상위 전략 컨텍스트를 노출한다

초기 생성은 Project 레벨 문맥이 가장 중요하다.
GenerateDialog에는 최소한 아래 정보가 보여야 한다.

- project brief 요약
- brand tone
- target audience
- constraints 요약

노출 원칙:

- 기본은 compact card
- 길면 접기/펼치기
- prompt 입력 바로 위 또는 상단에 위치

## 7.3 VariationPanel에는 Project + Direction + Parent 맥락을 함께 준다

변형 생성은 상위 브리프보다 `지금 이 방향에서 무엇을 살리고 무엇을 버릴지`가 더 중요하다.
VariationPanel에는 아래 조합이 적합하다.

- parent prompt
- current direction thesis
- fit criteria
- anti-goal
- project constraints 요약

즉 VariationPanel은 단순 태그 선택기가 아니라,
`현재 방향의 전략적 의도 아래에서 변형하는 공간`이 되어야 한다.

## 7.4 DetailPanel은 읽기 중심으로 간다

1차에서는 DetailPanel에 전략 정보를 편집하기보다,
현재 노드가 속한 Direction의 전략 요약을 읽는 정도로 충분하다.

권장 노출:

- direction thesis 한 줄
- fit criteria 요약
- anti-goal 요약

이유:

- 편집면을 너무 분산하면 저장 정직성 관리가 어려워진다.
- Settings를 전략 편집의 단일 진입점으로 유지하는 편이 안정적이다.

## 8. 이벤트 모델 연결

Phase 7에서는 기존 event 모델을 아래처럼 실제 연결한다.

### Project 전략 저장
- kind: `brief-updated`
- payload 예시:
  - `projectId`
  - `fieldsChanged`
  - `brief`
  - `constraints`
  - `targetAudience`
  - `brandTone`

### Direction 전략 저장
- kind: `direction-thesis-updated`
- payload 예시:
  - `directionId`
  - `directionName`
  - `fieldsChanged`
  - `thesis`
  - `fitCriteria`
  - `antiGoal`
  - `referenceNotes`

권장 원칙:

- state write와 event write는 같은 서버 트랜잭션 안에서 수행한다.
- "누가 언제 바꿨는가"는 추후 actor 확장 여지를 남기되, 1차는 `system` 또는 현재 사용자 라벨 수준으로 간다.

## 9. PR 분할 권장안

### PR A. schema + types + API write path

범위:
- Prisma schema에 Project/Direction 전략 필드 추가
- migration 작성
- mapper/type 확장
- project/direction update route에 전략 필드 허용
- `brief-updated`, `direction-thesis-updated` 이벤트 write 연결

목표:
- 전략 정보를 저장하고 읽을 수 있는 최소 백엔드 기반 확보

### PR B. Settings 전략 편집 UI

범위:
- Settings에 project 전략 폼 추가
- direction 전략 폼 추가
- draft/save honesty 패턴 적용
- 저장 성공/실패 피드백 연결

목표:
- 전략을 실제로 입력할 수 있게 만들기

### PR C. Generate/Variation context surface

범위:
- GenerateDialog에 project context 카드 추가
- VariationPanel에 direction/project context 카드 추가
- 필요 시 compact summary 컴포넌트 분리

목표:
- 저장된 전략이 작업 순간에 보이게 만들기

### PR D. polish + smoke verification

범위:
- copy 다듬기
- 정보 밀도 조정
- 긴 텍스트 collapse/expand
- 수동 smoke test
- 필요 시 timeline summary 정리

목표:
- 실제 디자이너가 읽고 사용할 수 있는 밀도로 조정하기

## 10. 충돌 위험 파일

Phase 7에서 충돌 가능성이 높은 파일은 아래와 같다.

- [schema.prisma](C:/Work/Projects/Hire/visual_ide/prisma/schema.prisma)
- [types.ts](C:/Work/Projects/Hire/visual_ide/src/lib/types.ts)
- [mappers.ts](C:/Work/Projects/Hire/visual_ide/src/lib/mappers.ts)
- [projects/[id]/route.ts](C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/route.ts)
- [directions/[dirId]/route.ts](C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/directions/[dirId]/route.ts)
- [Sidebar.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/Sidebar.tsx)
- [GenerateDialog.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/GenerateDialog.tsx)
- [VariationPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/VariationPanel.tsx)
- [DetailPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/DetailPanel.tsx)
- [activityEvents.ts](C:/Work/Projects/Hire/visual_ide/src/lib/activityEvents.ts)

권장 원칙:

- PR A에서 schema/API까지만 건드리고 UI는 최소화한다.
- PR B에서 Settings 편집면을 붙인다.
- PR C에서 Generate/Variation에 읽기 컨텍스트를 붙인다.
- 한 PR 안에서 schema와 여러 화면을 동시에 크게 바꾸지 않는다.

## 11. 수동 검증 체크리스트

### 저장
- Project brief를 수정하면 저장 중/성공/실패가 보인다.
- Direction thesis를 수정하면 저장 중/성공/실패가 보인다.
- 새로고침 후 값이 유지된다.

### 이벤트
- Project 전략 수정 후 `brief-updated` 이벤트가 생긴다.
- Direction 전략 수정 후 `direction-thesis-updated` 이벤트가 생긴다.
- timeline summary가 사람이 읽을 수 있다.

### 생성
- GenerateDialog를 열면 project context가 보인다.
- brief가 비어 있으면 과도한 빈 공간 없이 자연스럽게 접힌다.
- constraints가 길어도 입력면을 가리지 않는다.

### 변형
- VariationPanel을 열면 현재 direction thesis와 anti-goal을 볼 수 있다.
- parent prompt와 전략 정보가 함께 보이더라도 과밀하지 않다.

### 전체
- `npm run lint`
- `npm run build`
- 필요 시 수동 UI smoke test

## 12. 완료 기준

Phase 7은 아래 조건을 만족하면 완료로 본다.

1. Project와 Direction에 전략 필드를 저장/조회할 수 있다.
2. Settings에서 전략 정보를 실제로 편집할 수 있다.
3. 전략 변경이 event timeline에 남는다.
4. GenerateDialog와 VariationPanel에서 전략 정보가 보인다.
5. 전략 정보가 단순 저장이 아니라 작업 의사결정에 개입한다.

## 13. 권장 결정

Phase 7에 들어가기 전에 아래 결정을 고정하는 것을 권장한다.

1. 1차는 additive schema로 간다.
2. Project/Direction 전략 입력은 자유 텍스트 중심으로 시작한다.
3. 전략 편집의 단일 진입점은 Settings로 둔다.
4. Generate/Variation은 편집면이 아니라 전략 컨텍스트 소비면으로 본다.
5. 이벤트는 기존 `brief-updated`, `direction-thesis-updated`를 재사용한다.

## 14. 다음 착수 권장안

가장 자연스러운 다음 단계는 이 문서 기준의 `PR A: schema + types + API write path`다.

즉 다음 구현 순서는 아래가 가장 안전하다.

1. Project/Direction 전략 필드를 schema에 추가
2. migration + mapper + type 반영
3. project/direction update route에서 전략 필드 저장 허용
4. 전략 변경 이벤트 write 연결
5. 그다음 PR에서 Settings UI를 붙이기

이 순서가 좋은 이유는,
전략 입력면을 먼저 만들기 전에 `저장 의미와 이벤트 기록`을 먼저 고정해야
이후 UX가 기록의 정직성을 훼손하지 않기 때문이다.
