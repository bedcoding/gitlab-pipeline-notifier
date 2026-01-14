// 백그라운드 스크립트 - 알림 관리

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SHOW_NOTIFICATION') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: request.title,
      message: request.message,
      priority: 2,
      requireInteraction: false
    }, (notificationId) => {
      sendResponse({ success: true, notificationId });

      // 10초 후 알림 자동 제거
      setTimeout(() => {
        chrome.notifications.clear(notificationId);
      }, 10000);
    });

    return true; // 비동기 응답을 위해 true 반환
  }
});
