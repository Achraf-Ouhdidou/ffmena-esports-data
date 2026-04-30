// ===== Public View Logic =====
document.addEventListener('DOMContentLoaded', () => {
  const tournamentSelectView = document.getElementById('tournamentSelectView');
  const leaderboardView = document.getElementById('leaderboardView');
  const tournamentGrid = document.getElementById('tournamentGrid');
  const tournamentInfo = document.getElementById('tournamentInfo');
  const btnBack = document.getElementById('btnBackToTournaments');

  const selPhase = document.getElementById('filterPhase');
  const selDay = document.getElementById('filterDay');
  const tabTeams = document.getElementById('tabTeams');
  const tabPlayers = document.getElementById('tabPlayers');
  const tableContainer = document.getElementById('tableContainer');

  let currentTab = 'teams';
  let selectedTournament = null;
  let currentSort = { col: null, dir: 'desc' };

  // Tab switching
  tabTeams.addEventListener('click', () => { currentTab = 'teams'; currentSort = { col: null, dir: 'desc' }; updateTabs(); loadData(); });
  tabPlayers.addEventListener('click', () => { currentTab = 'players'; currentSort = { col: null, dir: 'desc' }; updateTabs(); loadData(); });

  function updateTabs() {
    tabTeams.classList.toggle('active', currentTab === 'teams');
    tabPlayers.classList.toggle('active', currentTab === 'players');
  }

  // Back to tournament selection
  btnBack.addEventListener('click', () => {
    leaderboardView.classList.add('hidden');
    tournamentSelectView.classList.remove('hidden');
    selectedTournament = null;
  });

  // Load tournament cards
  async function init() {
    try {
      const tournaments = await DataService.getTournaments();
      if (tournaments.length === 0) {
        tournamentGrid.innerHTML = '<div class="empty-state"><h3>No Tournaments</h3><p>No tournaments have been created yet.</p></div>';
        return;
      }
      tournamentGrid.innerHTML = tournaments.map(t => {
        const logoHTML = t.logo
          ? `<div class="tournament-card-logo"><img src="${escapeAttr(t.logo)}" alt=""></div>`
          : `<div class="tournament-card-logo">${escapeHtml(t.name.charAt(0))}</div>`;
        return `
          <div class="tournament-card fade-in" data-id="${t.id}">
            ${logoHTML}
            <div class="tournament-card-info">
              <div class="tournament-card-name">${escapeHtml(t.name)}</div>
            </div>
            <div class="tournament-card-arrow">&rarr;</div>
          </div>
        `;
      }).join('');

      // Click handlers
      document.querySelectorAll('.tournament-card').forEach(card => {
        card.addEventListener('click', () => {
          const t = tournaments.find(x => x.id === card.dataset.id);
          if (t) selectTournament(t);
        });
      });
    } catch (e) {
      console.error(e);
      tournamentGrid.innerHTML = '<div class="empty-state"><h3>Error</h3><p>Failed to load tournaments. Check Firebase configuration.</p></div>';
    }
  }

  async function selectTournament(tournament) {
    selectedTournament = tournament;
    tournamentSelectView.classList.add('hidden');
    leaderboardView.classList.remove('hidden');

    // Set header
    const logoHTML = tournament.logo
      ? `<img class="tournament-info-logo" src="${escapeAttr(tournament.logo)}" alt="">`
      : '';
    tournamentInfo.innerHTML = `${logoHTML}<div class="tournament-info-name">${escapeHtml(tournament.name)}</div>`;

    // Load phases
    selPhase.innerHTML = '<option value="">All Phases</option>';
    selDay.innerHTML = '<option value="">All Days</option>';
    try {
      const phases = await DataService.getPhases(tournament.id);
      phases.forEach(p => {
        selPhase.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
      });
    } catch (e) { console.error(e); }

    currentSort = { col: null, dir: 'desc' };
    loadData();
  }

  selPhase.addEventListener('change', async () => {
    const pid = selPhase.value;
    selDay.innerHTML = '<option value="">All Days</option>';
    if (selectedTournament && pid) {
      try {
        const days = await DataService.getDays(selectedTournament.id, pid);
        days.forEach(d => {
          selDay.innerHTML += `<option value="${d.id}">${escapeHtml(d.name)}</option>`;
        });
      } catch (e) { console.error(e); }
    }
    loadData();
  });

  selDay.addEventListener('change', () => loadData());

  async function loadData() {
    if (!selectedTournament) return;

    const filters = { tournamentId: selectedTournament.id };
    if (selPhase.value) filters.phaseId = selPhase.value;
    if (selDay.value) filters.dayId = selDay.value;

    tableContainer.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
      const matches = await DataService.getMatches(filters);

      if (matches.length === 0) {
        tableContainer.innerHTML = '<div class="empty-state"><h3>No Data</h3><p>No matches found for the selected filters.</p></div>';
        return;
      }

      if (currentTab === 'teams') {
        renderTeams(DataService.aggregateTeams(matches));
      } else {
        renderPlayers(DataService.aggregatePlayers(matches));
      }
    } catch (e) {
      console.error(e);
      tableContainer.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(e.message)}</p></div>`;
    }
  }

  function renderTeams(teams) {
    // Apply custom sort if user clicked a column header
    if (currentSort.col) {
      sortArray(teams, currentSort.col, currentSort.dir);
    }
    // Default sort already applied by aggregateTeams (totalScore → booyah → kills)

    const cols = [
      { key: '_rank', label: '#', sortable: false },
      { key: 'teamName', label: 'Team' },
      { key: 'totalScore', label: 'Total Points' },
      { key: 'survivalScore', label: 'Survival' },
      { key: 'kills', label: 'Eliminations' },
      { key: 'booyah', label: 'Booyah' },
      { key: 'damage', label: 'Damage' },
      { key: 'matchesPlayed', label: 'Matches' },
      { key: 'bestRank', label: 'Best Rank' }
    ];

    tableContainer.innerHTML = buildTable(cols, teams, (row, i) => {
      const rankClass = i < 3 ? `rank-${i + 1}` : '';
      return `
        <td class="rank-cell ${rankClass}">${i + 1}</td>
        <td class="team-name">${escapeHtml(row.teamName)}</td>
        <td class="stat-highlight">${row.totalScore.toLocaleString()}</td>
        <td>${row.survivalScore.toLocaleString()}</td>
        <td>${row.kills.toLocaleString()}</td>
        <td>${row.booyah}</td>
        <td>${row.damage.toLocaleString()}</td>
        <td>${row.matchesPlayed}</td>
        <td>${row.bestRank === 99 ? '-' : row.bestRank}</td>
      `;
    });

    attachSortHandlers();
  }

  function renderPlayers(players) {
    if (currentSort.col) {
      sortArray(players, currentSort.col, currentSort.dir);
    }

    const cols = [
      { key: '_rank', label: '#', sortable: false },
      { key: 'playerName', label: 'Player' },
      { key: 'teamName', label: 'Team' },
      { key: 'kills', label: 'Eliminations' },
      { key: 'damage', label: 'Damage' },
      { key: 'assist', label: 'Assists' },
      { key: 'knockDown', label: 'Knock Downs' },
      { key: 'headshots', label: 'Headshots' },
      { key: 'matchesPlayed', label: 'Matches' }
    ];

    tableContainer.innerHTML = buildTable(cols, players, (row, i) => {
      const rankClass = i < 3 ? `rank-${i + 1}` : '';
      return `
        <td class="rank-cell ${rankClass}">${i + 1}</td>
        <td class="player-name">${escapeHtml(row.playerName)}</td>
        <td>${escapeHtml(row.teamName)}</td>
        <td class="stat-highlight">${row.kills.toLocaleString()}</td>
        <td>${row.damage.toLocaleString()}</td>
        <td>${row.assist}</td>
        <td>${row.knockDown}</td>
        <td>${row.headshots}</td>
        <td>${row.matchesPlayed}</td>
      `;
    });

    attachSortHandlers();
  }

  function buildTable(cols, data, rowRenderer) {
    const ths = cols.map(c => {
      const sorted = currentSort.col === c.key;
      const icon = sorted ? (currentSort.dir === 'asc' ? '&#9650;' : '&#9660;') : '';
      const cls = sorted ? 'sorted' : '';
      const sortable = c.sortable !== false ? `data-sort="${c.key}"` : '';
      return `<th class="${cls}" ${sortable}>${c.label}${icon ? `<span class="sort-icon">${icon}</span>` : ''}</th>`;
    }).join('');

    const rows = data.map((row, i) => `<tr class="fade-in" style="animation-delay:${Math.min(i * 0.015, 0.4)}s">${rowRenderer(row, i)}</tr>`).join('');

    return `<div class="table-wrapper"><table class="data-table"><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function attachSortHandlers() {
    document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (currentSort.col === col) {
          currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          currentSort = { col, dir: 'desc' };
        }
        loadData();
      });
    });
  }

  function sortArray(arr, col, dir) {
    arr.sort((a, b) => {
      let va = a[col], vb = b[col];
      if (typeof va === 'string') {
        return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return dir === 'asc' ? va - vb : vb - va;
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.escapeHtml = escapeHtml;

  init();
});
// ===== Toast Utility =====
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ===== Public View Logic =====
document.addEventListener('DOMContentLoaded', () => {
  const selTournament = document.getElementById('filterTournament');
  const selPhase = document.getElementById('filterPhase');
  const selDay = document.getElementById('filterDay');
  const tabTeams = document.getElementById('tabTeams');
  const tabPlayers = document.getElementById('tabPlayers');
  const tableContainer = document.getElementById('tableContainer');
  const statsRow = document.getElementById('statsRow');

  let currentTab = 'teams';
  let allTournaments = [];
  let phasesCache = {};
  let daysCache = {};
  let currentSort = { col: 'kills', dir: 'desc' };

  // Tab switching
  tabTeams.addEventListener('click', () => { currentTab = 'teams'; updateTabs(); loadData(); });
  tabPlayers.addEventListener('click', () => { currentTab = 'players'; updateTabs(); loadData(); });

  function updateTabs() {
    tabTeams.classList.toggle('active', currentTab === 'teams');
    tabPlayers.classList.toggle('active', currentTab === 'players');
  }

  // Load tournaments
  async function init() {
    try {
      allTournaments = await DataService.getTournaments();
      selTournament.innerHTML = '<option value="">All Tournaments</option>';
      allTournaments.forEach(t => {
        selTournament.innerHTML += `<option value="${t.id}">${escapeHtml(t.name)}</option>`;
      });
      await loadData();
    } catch (e) {
      console.error(e);
      showToast('Failed to load data. Check Firebase configuration.', 'error');
    }
  }

  selTournament.addEventListener('change', async () => {
    const tid = selTournament.value;
    selPhase.innerHTML = '<option value="">All Phases</option>';
    selDay.innerHTML = '<option value="">All Days</option>';
    if (tid) {
      const phases = await DataService.getPhases(tid);
      phasesCache = {};
      phases.forEach(p => {
        phasesCache[p.id] = p;
        selPhase.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
      });
    }
    loadData();
  });

  selPhase.addEventListener('change', async () => {
    const tid = selTournament.value;
    const pid = selPhase.value;
    selDay.innerHTML = '<option value="">All Days</option>';
    if (tid && pid) {
      const days = await DataService.getDays(tid, pid);
      daysCache = {};
      days.forEach(d => {
        daysCache[d.id] = d;
        selDay.innerHTML += `<option value="${d.id}">${escapeHtml(d.name)}</option>`;
      });
    }
    loadData();
  });

  selDay.addEventListener('change', () => loadData());

  async function loadData() {
    const filters = {};
    if (selTournament.value) filters.tournamentId = selTournament.value;
    if (selPhase.value) filters.phaseId = selPhase.value;
    if (selDay.value) filters.dayId = selDay.value;

    tableContainer.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
      const matches = await DataService.getMatches(filters);

      if (matches.length === 0) {
        statsRow.innerHTML = '';
        tableContainer.innerHTML = `<div class="empty-state"><h3>No Data Available</h3><p>No matches found for the selected filters.</p></div>`;
        return;
      }

      if (currentTab === 'teams') {
        renderTeams(DataService.aggregateTeams(matches), matches.length);
      } else {
        renderPlayers(DataService.aggregatePlayers(matches), matches.length);
      }
    } catch (e) {
      console.error(e);
      tableContainer.innerHTML = `<div class="empty-state"><h3>Error Loading Data</h3><p>${escapeHtml(e.message)}</p></div>`;
    }
  }

  function renderTeams(teams, matchCount) {
    // Stats
    const totalKills = teams.reduce((s, t) => s + t.kills, 0);
    const totalDamage = teams.reduce((s, t) => s + t.damage, 0);
    const totalBooyah = teams.reduce((s, t) => s + t.booyah, 0);
    statsRow.innerHTML = `
      <div class="stat-card fade-in"><div class="stat-value">${teams.length}</div><div class="stat-label">Teams</div></div>
      <div class="stat-card fade-in"><div class="stat-value">${matchCount}</div><div class="stat-label">Matches</div></div>
      <div class="stat-card fade-in"><div class="stat-value">${totalKills.toLocaleString()}</div><div class="stat-label">Total Eliminations</div></div>
      <div class="stat-card fade-in"><div class="stat-value">${totalDamage.toLocaleString()}</div><div class="stat-label">Total Damage</div></div>
      <div class="stat-card fade-in"><div class="stat-value">${totalBooyah}</div><div class="stat-label">Total Booyah</div></div>
    `;

    // Sort
    sortArray(teams, currentSort.col, currentSort.dir);

    const cols = [
      { key: '_rank', label: '#', sortable: false },
      { key: 'teamName', label: 'Team' },
      { key: 'kills', label: 'Eliminations' },
      { key: 'totalScore', label: 'Total Score' },
      { key: 'damage', label: 'Damage' },
      { key: 'booyah', label: 'Booyah' },
      { key: 'matchesPlayed', label: 'Matches' },
      { key: 'bestRank', label: 'Best Rank' },
      { key: 'survivalTime', label: 'Survival Time' },
      { key: 'revivals', label: 'Revivals' },
      { key: 'rescues', label: 'Rescues' }
    ];

    tableContainer.innerHTML = buildTable(cols, teams, (row, i) => {
      const rankClass = i < 3 ? `rank-${i + 1}` : '';
      return `
        <td class="rank-cell ${rankClass}">${i + 1}</td>
        <td class="team-name">${escapeHtml(row.teamName)}</td>
        <td class="stat-highlight">${row.kills.toLocaleString()}</td>
        <td>${row.totalScore.toLocaleString()}</td>
        <td>${row.damage.toLocaleString()}</td>
        <td>${row.booyah}</td>
        <td>${row.matchesPlayed}</td>
        <td>${row.bestRank}</td>
        <td>${row.survivalTime.toLocaleString()}</td>
        <td>${row.revivals}</td>
        <td>${row.rescues}</td>
      `;
    });

    attachSortHandlers(cols, teams, 'teams');
  }

  function renderPlayers(players, matchCount) {
    const totalKills = players.reduce((s, p) => s + p.kills, 0);
    const totalDamage = players.reduce((s, p) => s + p.damage, 0);
    statsRow.innerHTML = `
      <div class="stat-card fade-in"><div class="stat-value">${players.length}</div><div class="stat-label">Players</div></div>
      <div class="stat-card fade-in"><div class="stat-value">${matchCount}</div><div class="stat-label">Matches</div></div>
      <div class="stat-card fade-in"><div class="stat-value">${totalKills.toLocaleString()}</div><div class="stat-label">Total Eliminations</div></div>
      <div class="stat-card fade-in"><div class="stat-value">${totalDamage.toLocaleString()}</div><div class="stat-label">Total Damage</div></div>
    `;

    sortArray(players, currentSort.col, currentSort.dir);

    const cols = [
      { key: '_rank', label: '#', sortable: false },
      { key: 'playerName', label: 'Player' },
      { key: 'teamName', label: 'Team' },
      { key: 'kills', label: 'Eliminations' },
      { key: 'damage', label: 'Damage' },
      { key: 'assist', label: 'Assists' },
      { key: 'knockDown', label: 'Knock Downs' },
      { key: 'headshots', label: 'Headshots' },
      { key: 'matchesPlayed', label: 'Matches' },
      { key: 'maxKillDistance', label: 'Max Kill Dist' },
      { key: 'revivals', label: 'Revivals' }
    ];

    tableContainer.innerHTML = buildTable(cols, players, (row, i) => {
      const rankClass = i < 3 ? `rank-${i + 1}` : '';
      return `
        <td class="rank-cell ${rankClass}">${i + 1}</td>
        <td class="player-name">${escapeHtml(row.playerName)}</td>
        <td>${escapeHtml(row.teamName)}</td>
        <td class="stat-highlight">${row.kills.toLocaleString()}</td>
        <td>${row.damage.toLocaleString()}</td>
        <td>${row.assist}</td>
        <td>${row.knockDown}</td>
        <td>${row.headshots}</td>
        <td>${row.matchesPlayed}</td>
        <td>${row.maxKillDistance}</td>
        <td>${row.revivals}</td>
      `;
    });

    attachSortHandlers(cols, players, 'players');
  }

  function buildTable(cols, data, rowRenderer) {
    const ths = cols.map(c => {
      const sorted = currentSort.col === c.key;
      const icon = sorted ? (currentSort.dir === 'asc' ? '&#9650;' : '&#9660;') : '';
      const cls = sorted ? 'sorted' : '';
      const sortable = c.sortable !== false ? `data-sort="${c.key}"` : '';
      return `<th class="${cls}" ${sortable}>${c.label}${icon ? `<span class="sort-icon">${icon}</span>` : ''}</th>`;
    }).join('');

    const rows = data.map((row, i) => `<tr class="fade-in" style="animation-delay:${Math.min(i * 0.02, 0.5)}s">${rowRenderer(row, i)}</tr>`).join('');

    return `<div class="table-wrapper"><table class="data-table"><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function attachSortHandlers(cols, data, type) {
    document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (currentSort.col === col) {
          currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          currentSort = { col, dir: 'desc' };
        }
        loadData();
      });
    });
  }

  function sortArray(arr, col, dir) {
    arr.sort((a, b) => {
      let va = a[col], vb = b[col];
      if (typeof va === 'string') {
        return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return dir === 'asc' ? va - vb : vb - va;
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Expose escapeHtml globally
  window.escapeHtml = escapeHtml;

  init();
});
