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
