# Glimpse

[English](../../README.md)

영어 단어의 한국어 뜻을 읽던 자리에서 확인하는 Chrome 확장입니다. 단어 위에 커서를 두고 **Alt+Shift+D**를 누르면 뜻이 나타납니다. 다시 보고 싶은 단어는 단어장에 저장할 수 있습니다.

51,109개 표제어를 기기에 포함해 오프라인으로 조회합니다. 없는 단어는 선택형 온라인 영영 사전으로 보충합니다. 화면 언어는 영어가 기본이며 한국어로 바꿀 수 있습니다.

## 설치

1. [Releases](https://github.com/kaleidooa/glimpse-dictionary/releases)에서 ZIP을 내려받아 압축을 풉니다.
2. `chrome://extensions`에서 **개발자 모드 → 압축해제된 확장 프로그램 로드**를 선택합니다.
3. `manifest.json`이 들어 있는 폴더를 선택합니다.
4. 영어 웹페이지에서 Glimpse 아이콘 → **Use on this tab**을 누릅니다. 팝업을 닫고 단어 위로 커서를 옮긴 뒤 **Alt+Shift+D**를 누르세요.

설치 폴더는 그대로 두세요. 새 버전으로 파일을 교체했다면 확장을 다시 로드하고 읽던 페이지도 새로고침해야 합니다. 단축키는 `chrome://extensions/shortcuts`에서 바꿉니다.

현재 GitHub에서 직접 설치하는 베타이며 Chrome Web Store에는 등록하지 않았습니다. Chrome 내부 페이지, PDF 뷰어, 이미지·캔버스 속 글자, 입력 영역은 지원하지 않습니다.

## 단어장과 설정

뜻에서 **Save word**를 누르면 기기 단어장에 저장됩니다. 검색, 익숙한 단어 표시, CSV 내보내기, JSON 백업·복원을 지원합니다. 조회만 한 단어는 저장하지 않습니다.

**Settings → Language → 한국어**에서 화면 언어를 바꿉니다. 온라인 사전과 사이트 접근 권한도 설정에서 관리합니다. 화면 언어와 관계없이 기기 사전의 뜻은 한국어입니다. 시선 추적은 별도 실험실에서 보정 후 사용할 수 있습니다.

## 개발

Node.js 24가 필요합니다.

```sh
npm ci
npm run dev
```

데모 주소는 `http://127.0.0.1:5173`입니다. 확장은 다음 명령으로 만듭니다.

```sh
npm test
npm run build:extension
npm run check:extension
```

Chrome에 `dist-extension`을 로드하세요. 패키징·벤치마크·시선 실험 방법은 [개발 문서](../DEVELOPMENT.md)에 있습니다. 버그나 PR에는 재현 방법과 실행한 검사를 적어 주세요. 사전 수정에는 재배포 가능한 출처가 필요합니다.

## 개인정보와 라이선스

계정이나 이용 통계를 수집하지 않습니다. 저장한 단어는 기기에 보관하며 온라인 사전은 기본으로 꺼져 있습니다. [개인정보 안내](PRIVACY.md) · [보안 문제 보고](../../SECURITY.md).

원본 코드는 [MIT](../../LICENSE)입니다. 사전 데이터·의존성·얼굴 모델에는 [별도 라이선스와 출처 조건](../../THIRD-PARTY-NOTICES.md)이 적용됩니다.
