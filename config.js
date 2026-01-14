// GitLab 도메인 설정 - 여기서 한 번만 수정하면 됩니다
const GITLAB_CONFIG = {
  // 지원할 GitLab 도메인들
  domains: [
    'gitlab.com'
    // 필요시 여기에 추가:
    // 'gitlab.yourdomain.com',
  ],

  // URL 패턴 생성 헬퍼
  getUrlPatterns: function() {
    return this.domains.map(domain => `*://*.${domain}/*/-/pipelines*`);
  }
};

// Chrome 확장에서 사용할 수 있도록 export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GITLAB_CONFIG;
}
