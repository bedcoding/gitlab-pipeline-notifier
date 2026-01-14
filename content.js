// 알림을 이미 보낸 파이프라인 ID 추적
const notifiedPipelines = new Set();

// 알림 활성화 상태
let notificationEnabled = true;

// 안전한 storage 호출을 위한 헬퍼 함수
function safeStorageSet(data, callback) {
  // 확장 프로그램 재로드 시 기존 content script는 페이지에 남아있지만 chrome.runtime.id가 undefined가 되어 API 호출 시 에러 발생
  if (!chrome.runtime?.id) {
    return;
  }

  chrome.storage.sync.set(data, () => {
    if (chrome.runtime.lastError) {
      // Chrome API 특성상 접근만 해도 에러 확인으로 인식됨 (접근 안 하면 콘솔 경고 발생)
    }
    if (callback) callback();
  });
}

// 설정 로드
chrome.storage.sync.get({ notificationEnabled: true }, (result) => {
  notificationEnabled = result.notificationEnabled;
});

// 팝업으로부터 메시지 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TOGGLE_NOTIFICATION') {
    notificationEnabled = request.enabled;
    console.log(`[GitLab Pipeline Notifier] 알림 ${notificationEnabled ? '활성화' : '비활성화'}`);
  } else if (request.type === 'GET_PIPELINE_COUNT') {
    // 현재 탭의 running 파이프라인 개수 반환
    const runningPipelines = document.querySelectorAll('a.ci-status.ci-running[href*="/-/pipelines/"]');
    const uniquePipelines = new Set();

    runningPipelines.forEach(link => {
      const pipelineId = link.href?.match(/pipelines\/(\d+)/)?.[1];
      if (pipelineId) {
        uniquePipelines.add(pipelineId);
      }
    });

    sendResponse({ count: uniquePipelines.size });
  }
  return true; // 비동기 응답을 위해 true 반환
});


// 알림 보내기
function sendNotification(pipelineId, stageName, status) {
  if (!notificationEnabled) {
    console.log('[GitLab Pipeline Notifier] 알림이 비활성화되어 있습니다.');
    return;
  }

  // 확장 프로그램 재로드 시 기존 content script는 페이지에 남아있지만 chrome.runtime.id가 undefined가 되어 API 호출 시 에러 발생
  if (!chrome.runtime?.id) {
    console.log('[GitLab Pipeline Notifier] 확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침해주세요.');
    return;
  }

  const title = status === 'success'
    ? '✅ GitLab 빌드 완료'
    : '❌ GitLab 빌드 실패';

  const message = `Pipeline #${pipelineId} - ${stageName} 스테이지가 ${
    status === 'success' ? '성공적으로 완료' : '실패'
  }되었습니다.`;

  try {
    chrome.runtime.sendMessage({
      type: 'SHOW_NOTIFICATION',
      title: title,
      message: message,
      pipelineId: pipelineId
    }, (response) => {
      // 백그라운드 스크립트가 없을 수 있으므로 에러 무시
      if (chrome.runtime.lastError) {
        // Fallback: content script에서 직접 알림
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body: message,
            requireInteraction: false
          });
        }
      }
    });
  } catch (error) {
    console.log('[GitLab Pipeline Notifier] 알림 전송 실패:', error);
    // Fallback: content script에서 직접 알림
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        requireInteraction: false
      });
    }
  }

  console.log(`[GitLab Pipeline Notifier] ${title} - ${message}`);
}

// 이전 running 파이프라인 추적
let previousRunningPipelines = new Set();

// 리소스 정리를 위한 전역 변수
let updateInterval = null;
let pageObserver = null;
let urlObserver = null;

// 파이프라인 카운트 업데이트 및 완료 감지
function updatePipelineCount() {
  console.log(`[GitLab Pipeline Notifier] 파이프라인 감시 시작`);

  // OFF 상태면 아무것도 안 함
  if (!notificationEnabled) {
    safeStorageSet({ pipelineCount: 0, isActive: false });
    previousRunningPipelines.clear();
    return;
  }

  // running 상태인 파이프라인만 찾기
  const runningPipelines = document.querySelectorAll('a.ci-status.ci-running[href*="/-/pipelines/"]');
  const currentRunningPipelines = new Set();

  runningPipelines.forEach(link => {
    const pipelineId = link.href?.match(/pipelines\/(\d+)/)?.[1];
    if (pipelineId) {
      currentRunningPipelines.add(pipelineId);
      // 파이프라인이 running 상태가 되면 알림 기록에서 제거 (재실행 시 다시 알림 받기 위해)
      if (notifiedPipelines.has(pipelineId)) {
        console.log(`[파이프라인 재실행 감지] Pipeline #${pipelineId} - 알림 기록 초기화`);
        notifiedPipelines.delete(pipelineId);
      }
    }
  });

  // 완료된 파이프라인 찾기 (이전에는 running이었는데 지금은 없음)
  const completedPipelines = [...previousRunningPipelines].filter(
    id => !currentRunningPipelines.has(id)
  );

  // 완료된 파이프라인이 있으면 알림
  if (completedPipelines.length > 0) {
    console.log(`[파이프라인 완료 감지] ${completedPipelines.join(', ')}`);

    completedPipelines.forEach(pipelineId => {
      checkCompletedPipeline(pipelineId);
    });
  }

  // 현재 상태 저장
  previousRunningPipelines = new Set(currentRunningPipelines);

  const count = currentRunningPipelines.size;
  safeStorageSet({
    pipelineCount: count,
    isActive: count > 0
  });
}

// 완료된 파이프라인의 상태 확인 및 알림
function checkCompletedPipeline(pipelineId) {
  // 해당 파이프라인의 링크 찾기
  const pipelineLinks = document.querySelectorAll(`a[href*="/-/pipelines/${pipelineId}"]`);

  pipelineLinks.forEach(link => {
    const status = link.classList.contains('ci-status-icon-success') ? 'success' :
                   link.classList.contains('ci-status-icon-failed') ? 'failed' :
                   link.classList.contains('ci-status') && link.classList.contains('ci-failed') ? 'failed' :
                   link.classList.contains('ci-status') && link.classList.contains('ci-success') ? 'success' : null;

    if (status && !notifiedPipelines.has(pipelineId)) {
      console.log(`[알림 발송] Pipeline #${pipelineId}: ${status}`);
      sendNotification(pipelineId, 'Pipeline', status);
      notifiedPipelines.add(pipelineId);

      // 30분 후 알림 기록 제거
      setTimeout(() => {
        notifiedPipelines.delete(pipelineId);
      }, 30 * 60 * 1000);
    }
  });
}


// 리소스 정리 함수
function cleanup() {
  console.log('[GitLab Pipeline Notifier] 리소스 정리 시작');

  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }

  if (pageObserver) {
    pageObserver.disconnect();
    pageObserver = null;
  }

  if (urlObserver) {
    urlObserver.disconnect();
    urlObserver = null;
  }

  previousRunningPipelines.clear();
}

// 페이지 로드 시 초기화
function initialize() {
  console.log('[GitLab Pipeline Notifier] 초기화 시작');

  // 기존 리소스 정리
  cleanup();

  // 알림 권한 요청
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      console.log('[GitLab Pipeline Notifier] 알림 권한:', permission);
    });
  }

  // 초기 파이프라인 감시 (DOM 로딩 대기)
  setTimeout(() => {
    updatePipelineCount();
  }, 1000);

  // 새로운 파이프라인이 추가될 수 있으므로 전체 페이지 감시
  pageObserver = new MutationObserver((mutations) => {
    const hasNewPipelines = mutations.some(mutation =>
      Array.from(mutation.addedNodes).some(node =>
        node.nodeType === 1 &&
        (node.querySelector?.('[data-testid="widget-mini-pipeline-graph"]') ||
         node.matches?.('[data-testid="widget-mini-pipeline-graph"]'))
      )
    );

    if (hasNewPipelines) {
      setTimeout(() => {
        updatePipelineCount();
      }, 500);
    }
  });

  const pipelineList = document.querySelector('[data-testid="pipeline-table-row"]')?.parentElement
                    || document.querySelector('tbody');

  if (pipelineList) {
    pageObserver.observe(pipelineList, {
      childList: true,
      subtree: true
    });
  }

  // 주기적으로 활성 상태 업데이트 (5초마다)
  updateInterval = setInterval(updatePipelineCount, 5000);
}

// 페이지 로드 완료 후 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// 페이지 변경 감지 (SPA 라우팅)
let currentUrl = location.href;

if (document.querySelector('body')) {
  urlObserver = new MutationObserver(() => {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      if (location.href.includes('pipelines')) {
        setTimeout(initialize, 1000);
      } else {
        // 파이프라인 페이지를 떠나면 비활성화 상태로 설정하고 리소스 정리
        cleanup();
        safeStorageSet({ isActive: false, pipelineCount: 0 });
      }
    }
  });

  urlObserver.observe(document.querySelector('body'), { childList: true, subtree: true });
}
