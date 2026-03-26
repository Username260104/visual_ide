# VIDE Sidebar Restructure Plan

작성일: 2026-03-26

## 목적

기존 사이드바는 `Directions`와 `Settings` 두 탭만 있어,
`전략`, `기록`, `보관함`이 모두 Settings 안에 몰려 있었다.

이번 작업의 목적은:

- 탭을 작업 흐름 기준으로 다시 분리하고
- 기존 기능 의미는 유지하면서
- 정보 구조만 더 명확하게 만드는 것이다.

## 확정된 탭 순서

사이드바 탭은 아래 순서로 고정한다.

1. `이미지 생성`
2. `이미지 브릿지`
3. `브랜치`
4. `전략`
5. `기록`
6. `보관함`
7. `설정`

## 탭별 역할

### 1. 이미지 생성
- 이미지 생성 진입점
- 현재는 기존 `이미지 생성` 액션을 여기로 이동
- 생성 결과가 staging tray로 먼저 간다는 설명 포함

### 2. 이미지 브릿지
- 들여오기 / 내보내기 영역의 자리만 확보
- 1차 구현에서는 placeholder만 제공
- 실제 import/export 기능은 만들지 않음

### 3. 브랜치
- 기존 `Directions` 탭의 의미를 한국어로 치환
- direction 목록, 미분류 개수, 브랜치 추가/보관 유지
- 생성 버튼은 여기서 제거하고 `이미지 생성`으로 이동

### 4. 전략
- 기존 `StrategySettingsPanel`을 단독 탭으로 분리
- 프로젝트 전략 + 방향 전략 편집 기능 유지

### 5. 기록
- 기존 `ActivityTimeline`을 단독 탭으로 분리
- 제목과 설명은 기록 맥락에 맞게 조정

### 6. 보관함
- 기존 `ArchiveSettingsPanel`을 단독 탭으로 분리
- 복구 기능 포함

### 7. 설정
- 이번 1차에서는 placeholder만 제공
- 프로젝트 메타 / 환경 / 연결성 옵션이 들어올 자리를 확보

## 구현 원칙

- 이번 작업은 `정보 구조 재배치`가 핵심이다.
- 기존 store, API, mutation 의미는 바꾸지 않는다.
- 기능 추가보다 `탭 분리와 명명 정리`를 우선한다.
- placeholder가 필요한 탭은 명확하게 “준비 중”으로 표시한다.

## 변경 범위

주요 변경 파일:

- [uiStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/uiStore.ts)
- [ActivityBar.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/ActivityBar.tsx)
- [Sidebar.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/Sidebar.tsx)

재사용 패널:

- [StrategySettingsPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/StrategySettingsPanel.tsx)
- [ArchiveSettingsPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/ArchiveSettingsPanel.tsx)
- [ActivityTimeline.tsx](C:/Work/Projects/Hire/visual_ide/src/components/activity/ActivityTimeline.tsx)

## 비범위

이번 작업에서 하지 않는 것:

- 이미지 브릿지 실제 기능 구현
- 설정 탭의 세부 기능 설계
- 브랜치 개념의 데이터 모델 변경
- 생성/변형/기록 로직 변경

## 완료 기준

아래 조건을 만족하면 완료로 본다.

- ActivityBar에 7개 탭이 순서대로 보인다
- `브랜치`, `전략`, `기록`, `보관함`이 각각 독립 탭으로 분리된다
- `이미지 생성` 탭에서 생성 액션 진입이 가능하다
- `이미지 브릿지`, `설정` 탭은 placeholder 상태로 보인다
- `npm run lint`, `npm run build`가 통과한다
