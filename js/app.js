/* ===== APP: Routing, Leaderboard, Score Submission ===== */

const App = (() => {
  // ★ PASTE YOUR FIREBASE DATABASE URL HERE (Step 2 in the guide)
  const FIREBASE_DB_URL = 'https://wedding-run-poodle-default-rtdb.firebaseio.com';

  const pages = {
    main: document.getElementById('page-main'),
    game: document.getElementById('page-game'),
    leader: document.getElementById('page-leader'),
  };

  const overlay = document.getElementById('overlay-gameover');

  function init() {
    bindEvents();
    navigateTo('main');
  }

  function navigateTo(name) {
    if (name !== 'game' && typeof Game !== 'undefined') Game.stop();

    Object.values(pages).forEach(p => p.classList.remove('active'));
    pages[name].classList.add('active');
    overlay.classList.add('hidden');

    if (name === 'game' && typeof Game !== 'undefined') {
      requestAnimationFrame(() => Game.start());
    }
    if (name === 'leader') renderLeaderboard();
  }

  function bindEvents() {
    document.getElementById('btn-start').addEventListener('click', () => navigateTo('game'));
    document.getElementById('btn-leaderboard').addEventListener('click', () => navigateTo('leader'));
    document.getElementById('btn-play-again').addEventListener('click', () => navigateTo('game'));
    document.getElementById('btn-skip-submit').addEventListener('click', () => navigateTo('leader'));
    document.getElementById('back-game').addEventListener('click', e => { e.preventDefault(); navigateTo('main'); });
    document.getElementById('back-leader').addEventListener('click', e => { e.preventDefault(); navigateTo('main'); });
    document.getElementById('score-form').addEventListener('submit', handleSubmit);
  }

  function showGameOver(score) {
    document.getElementById('final-score-value').textContent = score;
    overlay.classList.remove('hidden');
    document.getElementById('score-form').reset();
  }

  function handleSubmit(e) {
    e.preventDefault();
    const nick = document.getElementById('input-nickname').value.trim();
    const team = document.getElementById('input-team').value;
    if (!nick || !team) return;
    const msg = document.getElementById('input-message').value.trim();
    const score = parseInt(document.getElementById('final-score-value').textContent, 10);

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '등록 중...';

    saveScore({ nickname: nick, team, score, message: msg || '', timestamp: Date.now() })
      .then(() => navigateTo('leader'))
      .catch(() => {
        alert('저장에 실패했습니다. 다시 시도해주세요.');
        btn.disabled = false;
        btn.textContent = 'SUBMIT';
      });
  }

  /* ===== FIREBASE DATABASE ===== */

  async function getScores() {
    if (!FIREBASE_DB_URL) return getLocal();

    try {
      const res = await fetch(FIREBASE_DB_URL + '/scores.json');
      const data = await res.json();
      if (!data) return [];
      return Object.values(data);
    } catch {
      return getLocal();
    }
  }

  async function saveScore(entry) {
    saveLocal(entry);

    if (!FIREBASE_DB_URL) return;

    await fetch(FIREBASE_DB_URL + '/scores.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  }

  /* ===== LOCAL STORAGE FALLBACK ===== */

  function getLocal() {
    try { return JSON.parse(localStorage.getItem('heartrun_scores')) || []; }
    catch { return []; }
  }

  function saveLocal(entry) {
    const s = getLocal();
    s.push(entry);
    localStorage.setItem('heartrun_scores', JSON.stringify(s));
  }

  /* ===== LEADERBOARD ===== */

  async function renderLeaderboard() {
    const list = document.getElementById('leader-list');
    list.innerHTML = '<div class="leader-empty">불러오는 중...</div>';

    const scores = await getScores();
    scores.sort((a, b) => b.score - a.score);

    if (!scores.length) {
      list.innerHTML = '<div class="leader-empty">아직 기록이 없어요!<br>게임을 플레이해 보세요 💕</div>';
      return;
    }

    list.innerHTML = scores.map((e, i) => {
      const r = i + 1;
      const rc = r <= 3 ? ` rank-${r}` : '';
      const tl = e.team === 'bride' ? 'TEAM BRIDE' : 'TEAM GROOM';
      return `
        <div class="leader-entry">
          <div class="leader-rank-num${rc}">${r}</div>
          <div class="leader-name-col">
            <div class="leader-name">${esc(e.nickname)}</div>
            <div class="leader-team-label ${e.team}">${tl}</div>
          </div>
          <div class="leader-msg-col">${esc(e.message)}</div>
          <div class="leader-score-col">${e.score}</div>
        </div>`;
    }).join('');
  }

  function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

  return { init, showGameOver, navigateTo };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
