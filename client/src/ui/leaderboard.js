const list = document.getElementById('leaderboard-list');

/**
 * Update the leaderboard DOM panel.
 * @param {Array<{username: string, radius: number}>} top - sorted top-10 from server
 * @param {string} localId - local player's id to highlight their row
 */
export function updateLeaderboard(top, localId) {
  if (!list) return;

  list.innerHTML = top.map((entry, i) => {
    const isMe = entry.id && entry.id === localId;
    return `<li style="${isMe ? 'color:#5865f2;font-weight:600;' : ''}">
      <span>${i + 1}. ${escapeHtml(entry.username)}</span>
      <span>${entry.radius}</span>
    </li>`;
  }).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
