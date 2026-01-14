# GitLab Pipeline Notifier
GitLab 파이프라인 빌드 완료 시 macOS 알림을 보내주는 Chrome 확장 프로그램입니다.
빌드를 돌려놓고 까먹는 경우가 많아서, 빌드 상태가 변경되면 자동으로 알림을 보내도록 만들었습니다.

## 사용 방법
1. GitLab 파이프라인 페이지 접속 (예: `https://gitlab.com/your-project/-/pipelines`)
2. 처음 접속 시 알림 권한 허용
3. 확장 프로그램 팝업에서 **"알림 테스트"** 버튼으로 알림이 제대로 오는지 확인
4. 빌드 시작 후 다른 작업을 하다가 알림을 받으세요!
   - ✅ 성공: "GitLab 빌드 완료"
   - ❌ 실패: "GitLab 빌드 실패"

## 알림 설정
알림이 오지 않는다면 다음 3가지를 모두 확인하세요:

### 1. macOS 시스템 설정
**시스템 설정 → 알림 → Google Chrome** 에서:
- ✅ "알림 허용" 체크
- ✅ 알림 스타일: "배너" 또는 "알림" 선택
- ✅ "알림 센터에 표시" 체크

> ⚠️ macOS에서 Chrome의 알림을 차단하면 아무리 Chrome 설정을 해도 알림이 오지 않습니다!

### 2. Chrome 브라우저 설정
**Chrome 설정 → 개인정보 보호 및 보안 → 사이트 설정 → 알림** 에서:
- ✅ "사이트에서 알림 전송 요청 가능" 체크
- ✅ 차단된 사이트 목록에 GitLab 또는 확장 프로그램이 없는지 확인

### 3. 확장 프로그램 알림 테스트
1. 확장 프로그램 아이콘 클릭
2. **"알림 테스트"** 버튼 클릭
3. 알림이 오면 정상, 안 오면 위의 1, 2번 다시 확인

## 개발자를 위한 정보
### 이 프로젝트를 로컬에서 직접 로드할 경우
1. 크롬 브라우저를 열고 주소창에 `chrome://extensions/` 입력
2. 우측 상단의 **"개발자 모드"** 활성화
3. **"압축해제된 확장 프로그램을 로드합니다"** 클릭
4. 이 프로젝트의 `gitlab-pipeline-notifier` 폴더 선택
5. 알림 권한 허용

### 소스코드 수정 후 반영
1. 코드 수정 후 `chrome://extensions/` 페이지에서 확장 프로그램 옆 새로고침 버튼 클릭
2. GitLab 페이지도 새로고침
3. 브라우저 콘솔(F12)에서 `[GitLab Pipeline Notifier]` 로그 확인 가능

### GitLab 도메인 설정하기

회사 내부 GitLab 등 다른 도메인을 추가하려면:

1. **`config.js` 파일 수정** (메인 설정)
   ```javascript
   domains: [
     'gitlab.com',
     'gitlab.yourdomain.com'  // 여기에 추가
   ]
   ```

2. **`manifest.json` 파일도 수정 필요** (Chrome 확장 제약)
   - `host_permissions`: 도메인 패턴 추가 (예: `*://gitlab.yourdomain.com/*`)
   - `content_scripts`의 `matches`: 파이프라인 URL 패턴 추가

   > ⚠️ `manifest.json`은 JSON 파일이라 JavaScript import가 불가능해서 수동으로 동기화해야 합니다.