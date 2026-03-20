const list = document.getElementById('leaderboard-list');

let myId = null;

export function setMyId(id) {
  myId = id;
}

/**
 * Render the smart leaderboard.
 * @param {Array<{id,username,color,radius,rank}>} ranked - sorted by score
 * @param {number} total - total players in room
 */
export function updateLeaderboard(ranked, total) {
  if (!list) return;
  if (!ranked || ranked.length === 0) return;

  const countEl = document.getElementById('lb-player-count');
  if (countEl) countEl.textContent = `${total} player${total !== 1 ? 's' : ''}`;

  const topSlice = ranked.slice(0, 7);
  const myEntry  = ranked.find(p => p.id === myId);
  const myRank   = myEntry ? myEntry.rank : total;
  const inTop7   = myRank <= 7;
  const maxScore = topSlice[0]?.radius || 1;

  const rows = [];
  for (const p of topSlice) {
    rows.push(buildRow(p, maxScore, p.id === myId));
  }
  if (!inTop7 && myEntry) {
    rows.push(`<li class="lb-sep">···</li>`);
    rows.push(buildRow(myEntry, maxScore, true));
  }

  list.innerHTML = rows.join('');
}

function buildRow(p, maxScore, isSelf) {
  const barWidth = Math.round((p.radius / maxScore) * 60);
  const name     = escapeHtml(p.username.length > 12 ? p.username.slice(0, 12) + '…' : p.username);
  return `<li class="lb-row${isSelf ? ' lb-self' : ''}">
    <span class="lb-rank">#${p.rank}</span>
    <span class="lb-name">${name}</span>
    <span class="lb-bar-wrap"><span class="lb-bar" style="width:${barWidth}px;background:${escapeHtml(p.color)};"></span></span>
    <span class="lb-score">${p.radius}</span>
  </li>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
