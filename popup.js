// 팝업 로드 시 상태 확인
document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('toggleNotification');
  const statusText = document.getElementById('statusText');
  const pipelineCount = document.getElementById('pipelineCount');
  const statusIndicator = document.getElementById('statusIndicator');

  // 저장된 설정 불러오기
  const result = await chrome.storage.sync.get({
    notificationEnabled: true,
    pipelineCount: 0,
    isActive: false,
    firstTimeGitlabShown: false
  });

  toggle.checked = result.notificationEnabled;

  // 초기 상태 확인
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isGitLabTab = activeTab?.url?.includes('/-/pipelines');

  if (isGitLabTab) {
    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_PIPELINE_COUNT' });
      pipelineCount.textContent = `${response?.count || 0}개`;
    } catch (e) {
      pipelineCount.textContent = `${result.pipelineCount}개`;
    }
  } else {
    pipelineCount.textContent = '0개';
  }

  // 상태 표시
  const initialStatus = !isGitLabTab ? 'not-gitlab' : (result.isActive ? 'active' : 'idle');
  updateStatus(result.notificationEnabled, initialStatus);

  // 스낵바 표시 로직
  if (result.notificationEnabled) {
    if (isGitLabTab) {
      // 파이프라인 탭: 최초 1회만 표시
      if (!result.firstTimeGitlabShown) {
        showSnackbar('GitLab 파이프라인 탭에서만 알림을 받을 수 있습니다');
        await chrome.storage.sync.set({ firstTimeGitlabShown: true });
      }
    } else {
      // 그 외 페이지: 항상 표시
      showSnackbar('GitLab 파이프라인 탭에서만 알림을 받을 수 있습니다');
    }
  }

  // 토글 이벤트
  toggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await chrome.storage.sync.set({ notificationEnabled: enabled });

    // 모든 GitLab 탭에 메시지 전송 (config.js에서 도메인 가져오기)
    const tabs = await chrome.tabs.query({
      url: GITLAB_CONFIG.getUrlPatterns()
    });

    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'TOGGLE_NOTIFICATION',
        enabled: enabled
      }).catch(() => {
        // 탭이 준비되지 않은 경우 무시
      });
    });

    // 현재 탭 상태 확인
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isCurrentGitLab = currentTab?.url?.includes('/-/pipelines');
    const currentState = await chrome.storage.sync.get({ isActive: false });
    const status = !isCurrentGitLab ? 'not-gitlab' : (currentState.isActive ? 'active' : 'idle');

    updateStatus(enabled, status);
  });

  // 테스트 버튼 이벤트
  document.getElementById('testNotification').addEventListener('click', () => {
    chrome.runtime.sendMessage({
      type: 'SHOW_NOTIFICATION',
      title: '알림 테스트',
      message: '알림 동작이 정상적으로 확인되었습니다.',
      pipelineId: 'test'
    });
  });

  // 주기적으로 상태 업데이트
  setInterval(async () => {
    // 현재 활성 탭 확인
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isGitLabTab = activeTab?.url?.includes('/-/pipelines');

    const currentState = await chrome.storage.sync.get({
      pipelineCount: 0,
      isActive: false,
      notificationEnabled: true
    });

    if (currentState.notificationEnabled) {
      if (isGitLabTab) {
        // GitLab 탭을 보고 있으면 해당 탭에 직접 개수 요청
        try {
          const response = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_PIPELINE_COUNT' });
          pipelineCount.textContent = `${response?.count || 0}개`;
        } catch (e) {
          // content script가 준비되지 않았으면 storage 값 사용
          pipelineCount.textContent = `${currentState.pipelineCount}개`;
        }
      } else {
        // GitLab이 아닌 다른 탭을 보고 있으면 0개 표시
        pipelineCount.textContent = '0개';
      }
    }

    // 상태 업데이트: GitLab 탭 여부와 활성 상태 전달
    const status = !isGitLabTab ? 'not-gitlab' : (currentState.isActive ? 'active' : 'idle');
    updateStatus(currentState.notificationEnabled, status);
  }, 1000);
});

function updateStatus(enabled, status) {
  const statusText = document.getElementById('statusText');
  const statusIndicator = document.getElementById('statusIndicator');
  const pipelineCount = document.getElementById('pipelineCount');

  if (!enabled) {
    statusText.textContent = '비활성화';
    statusIndicator.className = 'status-indicator status-inactive';
    pipelineCount.textContent = '비활성화';
  } else {
    if (status === 'active') {
      statusText.textContent = '감지 중';
      statusIndicator.className = 'status-indicator status-active';
    } else if (status === 'not-gitlab') {
      statusText.textContent = '파이프라인 안보임';
      statusIndicator.className = 'status-indicator status-inactive';
    } else {
      statusText.textContent = '대기 중';
      statusIndicator.className = 'status-indicator status-inactive';
    }
  }
}

function showSnackbar(message) {
  const snackbar = document.getElementById('snackbar');
  snackbar.textContent = message;
  snackbar.classList.add('show');

  // 3초 후 자동으로 사라지기
  setTimeout(() => {
    snackbar.classList.remove('show');
  }, 3000);
}
