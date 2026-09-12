import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main
        style={{
          maxWidth: 580,
          margin: "15vh auto",
          padding: 24,
          fontFamily: "system-ui",
          lineHeight: 1.8,
        }}
      >
        <h1>화면을 열지 못했습니다.</h1>
        <p>
          페이지를 새로고침한 뒤 다시 시도해 주세요. 저장한 단어와 실험 기록은
          삭제하지 않습니다.
        </p>
        <button onClick={() => location.reload()}>새로고침</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
