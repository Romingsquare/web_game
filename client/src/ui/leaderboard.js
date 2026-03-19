const list = document.getElementById('leaderboard-list');

// Set by network.js when welcome message arrives
let myId = null;

export function setMyId(id) {
  myId = id;
}

/**
 * Render the smart leaderboard.
 * @param {Array<{id,username,color,radius,rank}>} ranked - full sorted list from server
 * @param {number} total - total players in room
 */
export function updateLeaderboard(ranked, total) {
  if (!list || !ranked) {
    console.warn('[leaderboard] missing list or ranked', { list, ranked });
    return;
  }

  console.log('[leaderboard] update', { ranked, total });

  const topSlice = ranked.slice(0, 7);
  const myEntry  = ranked.find(p => p.id === myId);
  const myRank   = myEntry ? myEntry.rank : total;
  const inTop7   = myRank <= 7;
  const maxRadius = topSlice[0]?.radius || 1;

  const rows = [];

  for (const p of topSlice) {
    rows.push(buildRow(p, maxRadius, p.id === myId));
  }

  if (!inTop7) {
    rows.push(`<li class="lb-sep">···</li>`);
    if (myEntry) {
      rows.push(buildRow(myEntry, maxRadius, true));
    }
  }

  list.innerHTML = rows.join('');
  console.log('[leaderboard] rendered', rows.length, 'rows');
}

function buildRow(p, maxRadius, isSelf) {
  const barWidth = Math.round((p.radius / maxRadius) * 60);
  const name     = escapeHtml(p.username.length > 12
    ? p.username.slice(0, 12) + '…'
    : p.username);

  return `<li class="lb-row${isSelf ? ' lb-self' : ''}">
    <span class="lb-rank">#${p.rank}</span>
    <span class="lb-name">${name}</span>
    <span class="lb-bar-wrap">
      <span class="lb-bar" style="width:${barWidth}px;background:${escapeHtml(p.color)};"></span>
    </span>
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
