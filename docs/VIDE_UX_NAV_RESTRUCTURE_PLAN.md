# VIDE UX / Navigation Restructure Plan

작성일: 2026-03-27

이 문서는 현재 구현을 기준으로, 합의된 UX 개편 방향을 실제 구현용 계획으로 정리한 문서다.
기존 [VIDE_SIDEBAR_RESTRUCTURE_PLAN](/C:/Work/Projects/Hire/visual_ide/docs/archive/VIDE_SIDEBAR_RESTRUCTURE_PLAN.md)은 참고 자료로 남기되, 이번 문서가 최신 결정 기준이다.

## 1. 이번 개편의 핵심 목표

이번 개편은 기능 추가보다 다음 다섯 가지를 바로잡는 데 목적이 있다.

- 생성 진입점을 숨기지 않고 항상 보이게 한다.
- 브랜치 목록을 단순 정보가 아니라 실제 탐색 도구로 바꾼다.
- `staging` 중심의 구현 용어를 사용자 언어로 치환한다.
- 우클릭에 숨어 있는 고빈도 액션을 라벨형 버튼으로 끌어낸다.
- `설정`을 주 작업 탭이 아니라 보조 유틸리티 영역으로 재배치한다.

## 2. 최종 확정 사항

### 2.1 이미지 생성

- `이미지 생성`은 ActivityBar 탭에서 제거한다.
- 대신 사이드바 상단에 항상 보이는 1급 CTA로 배치한다.
- 어떤 탭을 보고 있든 생성 버튼은 같은 위치에서 찾을 수 있어야 한다.
- 빈 캔버스 상태에서도 사용자가 “무엇을 눌러야 하는지” 즉시 이해할 수 있어야 한다.

### 2.2 이미지 브릿지

- `이미지 브릿지`는 일단 유지한다.
- 이번 단계에서는 placeholder 상태를 유지해도 된다.
- 다만 “핵심 기능”처럼 오해되지 않도록 copy tone은 차분하게 유지한다.

### 2.3 브랜치

- 브랜치 행은 클릭 가능한 필터로 바꾼다.
- 필터 기본 구조는 `전체`, `미분류`, `각 브랜치`로 둔다.
- 필터 선택 상태가 시각적으로 분명해야 한다.
- 필터 적용 시 캔버스 노드와 엣지도 함께 좁혀진다.

### 2.4 검토함 용어 개편

- 사용자 노출 용어에서 `staging`, `tray`, `batch`, `candidate`를 줄인다.
- 내부 타입/스토어 이름은 이번 단계에서 유지해도 되지만, 사용자-facing copy는 전면 교체한다.
- 단, 현재 구조가 `client-local staging`인 만큼, 사용자가 “서버에 영구 저장됐다”고 오해하지 않도록 임시성 문구는 남긴다.

### 2.5 고급 액션

- 우클릭 메뉴만으로 제공하던 액션은 라벨형 버튼으로 재노출한다.
- 우선순위는 `변형 만들기`, `부모 변경`, `부모로 이동`, `보관` 순으로 둔다.
- 우클릭 메뉴는 보조 진입점으로 남겨도 된다.

### 2.6 설정

- `설정`은 ActivityBar 탭에서 제거한다.
- 사이드바 최하단의 유틸리티 버튼으로 이동한다.
- `전략`은 계속 작업 맥락 탭으로 남기고, `설정`은 메타/기본값/연결성 성격으로 분리한다.

## 3. 최종 검토 의견

이번 방향은 현재 앱의 가장 큰 UX 문제를 정확히 찌른다.

- 현재는 생성이 핵심 액션인데 탭 안에 숨어 있다.
- 브랜치는 가장 자주 보는 목록인데 실제 행동으로 이어지지 않는다.
- `staging`은 구현 관점에서는 정확하지만 사용자 언어로는 차갑고 낯설다.
- 설정은 아직 비어 있는데도 작업 탭과 같은 무게로 보인다.

따라서 이번 재배치는 “디자인 개선”이 아니라 “정보 구조의 정직화”에 가깝다.

다만 아래 두 가지는 구현 중 반드시 지켜야 한다.

### 3.1 필터 적용 시 선택 상태 처리

- 사용자가 선택한 노드가 현재 브랜치 필터 밖으로 밀려나면, 상세 패널은 닫거나 선택을 자동 해제해야 한다.
- 보이지 않는 노드의 상세가 계속 열려 있으면 사용자는 시스템 상태를 이해하기 어렵다.

### 3.2 검토함 용어의 임시성 보존

- `검토함` 같은 표현은 훨씬 자연스럽지만, 현재 결과가 브라우저 세션 기반 임시 상태라는 사실을 숨기면 안 된다.
- 따라서 확인/경고/설명 문구에는 “아직 캔버스에 반영되지 않음”, “현재 세션에만 임시 보관” 같은 보정 문구가 필요하다.

## 4. 개편 후 정보 구조

### 4.1 ActivityBar

개편 후 ActivityBar 탭은 아래만 남긴다.

1. `이미지 브릿지`
2. `브랜치`
3. `전략`
4. `기록`
5. `보관함`

제거:

- `이미지 생성`
- `설정`

### 4.2 Sidebar 상단

사이드바 상단에는 아래 요소를 고정한다.

1. `프로젝트 목록` 링크
2. `이미지 생성` CTA
3. 현재 탭 제목

원칙:

- 생성 CTA는 탭과 독립된 전역 액션으로 취급한다.
- 사용자는 “왼쪽 상단 = 생성 시작점”으로 학습하면 된다.

### 4.3 Sidebar 본문

- `이미지 브릿지`: placeholder 유지
- `브랜치`: 필터 리스트 + 브랜치 추가/보관
- `전략`: 프로젝트 전략 / 방향 전략
- `기록`: 최근 기록
- `보관함`: 복구 중심

### 4.4 Sidebar 하단

- `설정` 버튼 고정
- 필요 시 divider를 두어 작업 탭과 유틸리티를 분리

## 5. 브랜치 필터 동작 정의

### 5.1 필터 종류

- `전체`
- `미분류`
- `{브랜치 이름}`

### 5.2 필터 적용 규칙

- `전체`: 모든 활성 노드/엣지 표시
- `미분류`: `directionId === null` 노드만 표시
- `{브랜치}`: `directionId === selectedDirectionId` 노드만 표시

### 5.3 엣지 처리

- 화면에 보이는 두 노드 사이의 엣지만 렌더링한다.
- 필터 밖 노드와 연결된 엣지는 숨긴다.

### 5.4 선택/패널 처리

- 현재 선택 노드가 필터 결과에 없으면 선택 해제
- detail panel 자동 닫힘
- 필요 시 상태바 또는 브랜치 영역에 “필터 적용 중” 보조 표시 추가

### 5.5 시각 상태

- 선택된 필터는 배경색, 왼쪽 border, 텍스트 강조 중 최소 2개 이상으로 드러나야 한다.
- 현재의 숫자 count는 그대로 유지하되, 클릭 가능한 항목처럼 보여야 한다.

## 6. 사용자 언어 치환 가이드

### 6.1 권장 치환표

| 현재 노출 용어 | 변경 권장안 | 비고 |
| --- | --- | --- |
| staging | 검토 대기 / 검토함 | 맥락에 따라 분리 사용 |
| Staging Tray | 검토함 | 하단 패널 이름 |
| staging 결과 | 검토 대기 결과 | 아직 미채택 상태 강조 |
| batch | 결과 묶음 | 기술 용어 완화 |
| candidate | 후보 이미지 | 가장 자연스러움 |
| accept | 채택 | 유지 |
| discard batch | 묶음 제외 | `버리기`보다 부드러움 |
| discard selected | 선택 제외 | 일시 결과 정리 느낌 |
| open staging | 검토함 열기 | 상태바 버튼 |

### 6.2 문장 톤 원칙

- 기술 구조보다 사용자 상태를 설명한다.
- “무엇이 아직 안 됐는지”를 분명하게 말한다.
- 영구 보관처럼 들리는 표현은 피한다.

예:

- `결과 4개가 검토함에 올라왔습니다. 아직 캔버스에는 추가되지 않았습니다.`
- `검토 대기 후보 3장이 남아 있습니다.`
- `이 결과 묶음은 현재 세션에서만 임시로 유지됩니다.`

## 7. 고급 액션 노출 기준

### 7.1 현재 문제

- `상세 보기`, `변형 만들기`, `부모로 이동`, `부모 변경`, `보관`이 우클릭 메뉴에 많이 의존한다.
- 이 구조는 발견성이 낮고, 트랙패드/태블릿 사용자에게 특히 불친절하다.

### 7.2 이번 단계 권장안

빠른 작업 버튼은 detail panel 상단 액션 영역으로 옮긴다.

기본 노출:

- `변형 만들기`
- `부모 변경`
- `부모로 이동` (부모가 있을 때만)
- `보관`

보조 노출:

- 우클릭 메뉴 유지 가능

### 7.3 이번 단계에서 하지 않는 것

- 노드 카드 위 floating action clutter
- 캔버스 hover 툴바 대대적 도입

이유:

- 이번 단계는 발견성 개선이 목적이지, 캔버스 시각 잡음을 늘리는 단계가 아니다.

## 8. 설정 기능 범위 제안

설정은 `작업 맥락`이 아니라 `운영 기본값`을 다루는 영역으로 좁혀야 한다.

### 8.1 1차 권장 범위

- 프로젝트 이름 / 설명
- 프로젝트 대표 썸네일 지정
- 생성 기본값
  - 기본 모델
  - 기본 비율
  - 기본 생성 수량
- 향후 연결 기능 placeholder
  - 이미지 브릿지 연결
  - 외부 스토리지/워크플로 연동

### 8.2 전략 탭과 분리해야 하는 것

아래 항목은 계속 `전략` 탭에 남긴다.

- 프로젝트 브리프
- 브랜드 톤
- 타깃 오디언스
- 제약 조건
- 방향 가설 / 적합 기준 / 안티골 / 참고 메모

원칙:

- 전략은 “무엇을 만들 것인가”
- 설정은 “도구를 어떻게 쓸 것인가”

## 9. 구현 범위와 영향 파일

### 9.1 직접 수정 대상

- [uiStore.ts](/C:/Work/Projects/Hire/visual_ide/src/stores/uiStore.ts)
- [ActivityBar.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/layout/ActivityBar.tsx)
- [Sidebar.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/layout/Sidebar.tsx)
- [NodeGraph.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/graph/NodeGraph.tsx)
- [DetailPanel.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/detail/DetailPanel.tsx)

### 9.2 copy 변경 대상

- [GenerateDialog.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/layout/GenerateDialog.tsx)
- [VariationPanel.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/detail/VariationPanel.tsx)
- [StatusBar.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/layout/StatusBar.tsx)
- [StagingTray.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/staging/StagingTray.tsx)
- [StagingBatchPreview.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/staging/StagingBatchPreview.tsx)
- [StagingNavigationGuard.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/staging/StagingNavigationGuard.tsx)

### 9.3 기능 재사용 가능 파일

- [StrategySettingsPanel.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/layout/StrategySettingsPanel.tsx)
- [ArchiveSettingsPanel.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/layout/ArchiveSettingsPanel.tsx)
- [ActivityTimeline.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/activity/ActivityTimeline.tsx)

## 10. 구현 순서

### Phase A. 정보 구조

1. `SidebarTab`에서 `image-generation`, `settings` 제거
2. ActivityBar 아이콘 정리
3. Sidebar 상단 CTA / 하단 설정 버튼 배치

### Phase B. 브랜치 필터

1. UI store에 브랜치 필터 상태 추가
2. 브랜치 리스트 선택 UI 추가
3. NodeGraph에서 노드/엣지 필터 적용
4. 필터 시 selection cleanup 처리

### Phase C. 사용자 언어 일괄 교체

1. 검토함 용어표 기준으로 copy 수정
2. 경고/설명 문구에 임시성 보완
3. 한국어/영어 혼용 제거

### Phase D. 고급 액션 재노출

1. detail panel 상단 빠른 작업 영역 추가
2. 우클릭 메뉴와 역할 중복 정리

### Phase E. 설정 범위 정리

1. 하단 설정 버튼 동작 정리
2. 1차 기능 범위에 맞는 panel 설계

## 11. 비범위

이번 문서 기준 1차 구현에서 하지 않는 것:

- 이미지 브릿지 실제 import/export 기능
- 브랜치 데이터 모델 개편
- 서버 영속 검토함 테이블 도입
- 캔버스 비교 모드 대개편
- hover 기반 floating action 체계

## 12. 완료 기준

아래 조건을 만족하면 1차 구현 완료로 본다.

- ActivityBar에서 `이미지 생성`, `설정` 탭이 사라진다.
- 사이드바 상단에 `이미지 생성` CTA가 항상 보인다.
- 브랜치 클릭 시 캔버스가 필터링된다.
- 선택된 브랜치 필터가 명확히 보인다.
- `staging` 사용자 노출 문구가 `검토함/검토 대기` 계열로 정리된다.
- 고빈도 액션이 라벨형 버튼으로 노출된다.
- 설정 버튼이 사이드바 하단 유틸리티 영역으로 이동한다.
- `npm run build`가 통과한다.

## 13. 최종 판단

이번 개편은 현재 VIDE가 가진 가장 큰 UX 부조화를 바로잡는, 우선순위가 매우 높은 작업이다.

특히 아래 세 가지 효과가 크다.

- 사용자가 첫 행동을 더 빨리 이해한다.
- 브랜치가 실제 탐색 도구로 승격된다.
- 제품 언어가 구현 언어보다 사용자 언어에 가까워진다.

구현 난이도 대비 효과가 크므로, 다음 실제 작업은 이 문서를 기준으로 바로 진행해도 무리가 없다.
