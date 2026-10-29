# CD Atelier 복원 안내

2026-10-29에 Sites에서 실제 배포 성공한 버전 19의 소스 커밋 `38e7247e73f1f40c80d7489e3ae700f19724f060`을 직접 내려받았습니다.

## 지금의 Sites와 같은 버전으로 GitHub Pages 배포

1. 이 저장소의 Actions → Deploy CD Atelier to GitHub Pages → Run workflow를 엽니다.
2. branch는 `main`, source는 **`sites-v19`**를 선택하고 실행합니다.
3. 배포 성공 후 https://hanzizon.github.io/rondo-cd-atelier/ 에서 확인합니다.

이 선택은 `snapshots/sites-v19/dist/`를 그대로 게시합니다. 기본 커버 17개, 원래 앨범 순서, 원래 음량, 원래 3D 및 뮤비 로직을 사용합니다. ChatGPT나 Sites 연결 없이 동작하며 빌드나 npm 설치가 필요 없습니다.

GitHub에서 나중에 추가한 ARCANA·FAKE OFF 등까지 포함한 버전은 source=`current`입니다. main에 push하면 종전과 같이 `dist/`가 배포됩니다. Sites 복원본 배포 후 main에 다시 push하면 current로 바뀌므로, 계속 Sites 버전을 운영하려면 workflow의 기본 업로드 경로와 push 정책을 함께 변경하십시오.

다른 정적 호스팅에서도 `snapshots/sites-v19/dist/` 내부를 사이트 루트로 업로드하면 됩니다. GitHub 저장소 Settings → Pages의 Build and deployment는 GitHub Actions여야 합니다. 새 저장소에서는 Pages와 workflow 실행 권한을 별도로 활성화해야 합니다.

## 백업 무결성 확인

저장소를 내려받은 뒤 Node.js로 `node backup/verify.cjs`를 실행합니다. `sites-v19-manifest.json`의 42개 파일 크기와 SHA-256이 모두 같아야 통과합니다. 커버·음원·모듈 경로 누락도 검사합니다. `.openai/hosting.json`도 원형으로 보존하지만 GitHub Pages에는 필요하지 않습니다.

## 포함 범위와 한계

- Sites의 추적된 소스 42개를 수정 없이 전부 보존했습니다. 모든 원본 음원·영상·이미지 파일을 포함합니다.
- 기존 GitHub `dist/`는 유지했습니다. 서로 다른 `app.js`, `covers.json`, `music.js`도 양쪽 원본을 모두 보존합니다.
- 앱은 정적 사이트이며 실행에 서버 API, 비밀키, 외부 CDN이나 별도 데이터베이스가 필요하지 않습니다.
- Sites의 ChatGPT 로그인 게이트·접근 권한·원래 도메인은 호스팅 서비스 기능입니다. 공개 GitHub Pages에서 같은 접근 제어를 복원하지는 않습니다. 앱 화면과 기능 복원 범위와 구분하십시오.
- 개인 추가 커버와 개인 순서는 각 기기/브라우저/주소의 IndexedDB·localStorage에 있습니다. 이 저장소에는 개인 브라우저 데이터가 포함되지 않으며 주소 변경 시 자동 이전되지 않습니다. 확인한 로그인된 원본 화면에는 기본 17개 앨범이 표시되었습니다.
- ChatGPT 프로젝트의 대화 기록·첨부 원본 전체를 백업하는 작업은 아닙니다. 배포 사이트에 포함된 파일을 복원하는 백업입니다.
- 3D 빛·회전·동영상은 시간, 창 크기, 기기 GPU 및 브라우저에 따라 프레임이 달라집니다. 파일 동일성과 기능 동작을 검증하며 모든 환경의 스크린샷 픽셀 일치를 보장하지 않습니다.
