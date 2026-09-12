# glimpse.

**읽던 자리에서, 바로 이해하기.**

영어 단어에 커서를 두고 **Alt + Shift + D**를 누르세요. 단어 옆에서 한국어 뜻을 확인하고, 기억하고 싶은 단어만 내 단어장에 저장합니다.

A local-first English-to-Korean cursor dictionary for Chrome. Point, press a shortcut, read the meaning. Save only the words you choose.

[설치 파일 다운로드](https://github.com/kaleidooa/glimpse-dictionary/releases/tag/v0.4.0) · [설치 안내](EXTENSION.md) · [개인정보](PRIVACY.md) · [문제 제보](https://github.com/kaleidooa/glimpse-dictionary/issues/new/choose)

## 무료 공개 베타 · 0.4

- **기기 영한 사전:** 공개 DB 51,109개 표제어와 기본 교정 뜻. 계정·API 키 없이 사용합니다.
- **원형과 여러 뜻:** `went → go`, `children → child`, 품사와 출처를 함께 표시합니다.
- **내 단어장:** 직접 저장, 검색, 학습 상태 표시, CSV 내보내기, JSON 백업·복원. 일반 조회 이력·원문 문장·방문 주소는 자동 저장하지 않습니다.
- **고르는 사이트 권한:** 이번 탭에서 먼저 써 보고, 자주 쓰는 사이트만 자동 사용을 켤 수 있습니다.
- **선택형 보조 영영 사전:** 기기 사전의 누락 단어 하나만 외부 사전에 보냅니다. 기본으로 꺼져 있습니다.
- **시선 추적 실험실 BETA:** 별도 화면에서 웹캠 보정·학습·평가를 진행합니다. 기본 커서 사전에는 카메라가 필요하지 않습니다.

핵심 기능은 무료·오픈소스입니다. 현재 결제·계정·광고·자동 동기화는 없습니다. 향후 유료 부가 서비스는 실제 수요를 확인한 뒤 별도로 설계합니다. [제품 방향과 수익화 가설](docs/LAUNCH-PLAN.md)을 참고하세요.

## 바로 설치

1. [Releases](https://github.com/kaleidooa/glimpse-dictionary/releases/tag/v0.4.0)에서 `Glimpse-0.4.0.zip`을 내려받아 **압축을 풉니다**.
2. Chrome에서 `chrome://extensions`를 열고 **개발자 모드 → 압축해제된 확장 프로그램 로드**를 선택합니다.
3. `manifest.json`이 들어 있는 폴더를 선택합니다. 처음 사용 안내가 열립니다.
4. 영어 웹페이지에서 확장 아이콘 → **이번 탭에서 사용** → 창을 닫고 단어 위에서 **Alt+Shift+D**.
5. 뜻의 **단어장에 저장**을 누르면 확장 아이콘의 **단어장**에서 다시 볼 수 있습니다.

현재 Chrome Web Store에는 게시하지 않은 직접 설치용 공개 베타입니다. 업데이트는 확장 관리 화면의 **↻ → 읽던 페이지 F5** 순서로 적용하세요. 다운로드한 확장 폴더를 삭제·이동하면 Chrome에서 사용할 수 없습니다.

Chrome 내부 화면, 웹 스토어, PDF 뷰어, 이미지·캔버스 속 글자, 닫힌 Shadow DOM, 편집 가능한 영역과 일부 특수 렌더러는 지원하지 않습니다. 단축키는 `chrome://extensions/shortcuts`에서 변경합니다.

## 개발

Node.js 24와 npm을 사용합니다.

```sh
npm ci
npm run dev
```

기본 읽기 데모는 `http://127.0.0.1:5173`, 처음 사용·단어장·설정은 `/dashboard.html`입니다. 웹 데모와 설치된 확장의 단어장은 서로 분리되어 있습니다. Chrome 사이트 권한 설정은 설치된 확장에서만 작동합니다.

```sh
npm test
npm run build
npm run build:extension
npm run check:extension
```

Windows에서 `npm run package:extension`, PowerShell 7이 있는 다른 환경에서는 `pwsh -File scripts/package-extension.ps1`로 ZIP을 만듭니다. GitHub Actions도 동일한 검사와 패키징을 수행합니다. 카메라 모델 다운로드에 실패하면 `npm run assets`로 다시 준비하세요. 기본 사전 조회에는 모델이 필요하지 않습니다.

## 데이터와 검증

공개 사전은 한국어 위키낱말사전과 Kengdic, 활용형은 WordNet 예외 목록과 규칙을 사용합니다. **조회 가능한 표제어 수는 번역 정확도나 실제 독해 커버리지의 보증이 아닙니다.** 전문 용어·뜻의 누락과 원본 데이터 오류가 남아 있을 수 있습니다. 현재 문맥에 맞는 뜻 하나를 자동 선택하지 않습니다.

- [사전 설계·DB와 LLM 비교](DICTIONARY-DESIGN.md)
- [검증 범위와 알려진 한계](EXTENSION-VALIDATION.md)
- [시선 실험실과 기존 실험 방식](docs/EYE-LAB.md)
- [기여 가이드](CONTRIBUTING.md) · [보안 보고](SECURITY.md)

## 라이선스

원본 Glimpse 코드와 문서는 [MIT](LICENSE)입니다. **사전 데이터·의존성·모델에는 각각 별도의 라이선스가 적용됩니다.** 한국어 위키낱말사전 데이터는 CC BY-SA 4.0, Kengdic 데이터는 MPL 2.0을 선택해 별도 파일로 제공합니다. 출처·변환 코드와 이용 조건을 보존해 주세요. [전체 안내](THIRD-PARTY-NOTICES.md).
