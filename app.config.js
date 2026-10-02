/**
 * app.json 위에 얹는 한 겹 — **어느 커밋으로 만든 빌드인지**를 앱 안에 새긴다.
 *
 * 케이블로 깐 빌드는 빌드 번호가 늘 app.json의 2라(EAS만 원격 카운터로 올린다)
 * 「1.3.0 (2)」만 보고는 어느 코드까지 들어갔는지 알 수 없었다. 빌드할 때의
 * git 커밋(짧은 해시)을 extra.commit에 넣고, 설정의 버전 줄이 개발 빌드일 때만
 * 그 뒤에 붙인다. 작업 트리에 커밋 안 된 변경이 있으면 끝에 +를 단다.
 *
 * EAS 빌드에도 들어가지만 스토어 빌드는 번호도 해시도 보여 주지 않는다.
 */
const { execSync } = require('child_process');

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

module.exports = ({ config }) => {
  const hash = git('rev-parse --short HEAD');
  const dirty = git('status --porcelain') !== '';
  return {
    ...config,
    extra: {
      ...config.extra,
      commit: hash ? hash + (dirty ? '+' : '') : undefined,
    },
  };
};
