// ===== Admin Panel Logic =====
document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('loginSection');
  const adminPanel = document.getElementById('adminPanel');
  const loginForm = document.getElementById('loginForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const userEmail = document.getElementById('userEmail');

  // Tournament management
  const tournamentSelect = document.getElementById('tournamentSelect');
  const newTournamentName = document.getElementById('newTournamentName');
  const btnCreateTournament = document.getElementById('btnCreateTournament');
  const btnDeleteTournament = document.getElementById('btnDeleteTournament');

  // Phase management
  const phaseSelect = document.getElementById('phaseSelect');
  const newPhaseName = document.getElementById('newPhaseName');
  const btnCreatePhase = document.getElementById('btnCreatePhase');
  const btnDeletePhase = document.getElementById('btnDeletePhase');

  // Day management
  const daySelect = document.getElementById('daySelect');
  const newDayName = document.getElementById('newDayName');
  const btnCreateDay = document.getElementById('btnCreateDay');
  const btnDeleteDay = document.getElementById('btnDeleteDay');

  // File uploads
  const teamFileInput = document.getElementById('teamFile');
  const playerFileInput = document.getElementById('playerFile');
  const teamUploadZone = document.getElementById('teamUploadZone');
  const playerUploadZone = document.getElementById('playerUploadZone');
  const teamFileName = document.getElementById('teamFileName');
  const playerFileName = document.getElementById('playerFileName');
  const btnUploadMatch = document.getElementById('btnUploadMatch');

  // Matches list
  const matchesList = document.getElementById('matchesList');

  let teamCSVData = null;
  let playerCSVData = null;

  // ---- Auth ----
  auth.onAuthStateChanged(user => {
    if (user) {
      loginSection.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      userEmail.textContent = user.email;
      loadTournaments();
      loadMatches();
    } else {
      loginSection.classList.remove('hidden');
      adminPanel.classList.add('hidden');
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    try {
      await auth.signInWithEmailAndPassword(email, password);
      showToast('Signed in successfully', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  logoutBtn.addEventListener('click', () => auth.signOut());

  // ---- Tournament CRUD ----
  async function loadTournaments() {
    const tournaments = await DataService.getTournaments();
    tournamentSelect.innerHTML = '<option value="">-- Select Tournament --</option>';
    tournaments.forEach(t => {
      tournamentSelect.innerHTML += `<option value="${t.id}">${escapeHtml(t.name)}</option>`;
    });
    phaseSelect.innerHTML = '<option value="">-- Select Phase --</option>';
    daySelect.innerHTML = '<option value="">-- Select Day --</option>';
  }

  btnCreateTournament.addEventListener('click', async () => {
    const name = newTournamentName.value.trim();
    if (!name) return showToast('Enter tournament name', 'error');
    await DataService.createTournament(name);
    newTournamentName.value = '';
    showToast(`Tournament "${name}" created`, 'success');
    loadTournaments();
  });

  btnDeleteTournament.addEventListener('click', async () => {
    const id = tournamentSelect.value;
    if (!id) return showToast('Select a tournament first', 'error');
    if (!confirm('Delete this tournament and all its matches?')) return;
    await DataService.deleteTournament(id);
    showToast('Tournament deleted', 'success');
    loadTournaments();
    loadMatches();
  });

  tournamentSelect.addEventListener('change', async () => {
    const tid = tournamentSelect.value;
    phaseSelect.innerHTML = '<option value="">-- Select Phase --</option>';
    daySelect.innerHTML = '<option value="">-- Select Day --</option>';
    if (!tid) return;
    const phases = await DataService.getPhases(tid);
    phases.forEach(p => {
      phaseSelect.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
    });
  });

  // ---- Phase CRUD ----
  btnCreatePhase.addEventListener('click', async () => {
    const tid = tournamentSelect.value;
    if (!tid) return showToast('Select a tournament first', 'error');
    const name = newPhaseName.value.trim();
    if (!name) return showToast('Enter phase name', 'error');
    await DataService.createPhase(tid, name);
    newPhaseName.value = '';
    showToast(`Phase "${name}" created`, 'success');
    tournamentSelect.dispatchEvent(new Event('change'));
  });

  btnDeletePhase.addEventListener('click', async () => {
    const tid = tournamentSelect.value;
    const pid = phaseSelect.value;
    if (!pid) return showToast('Select a phase first', 'error');
    await DataService.deletePhase(tid, pid);
    showToast('Phase deleted', 'success');
    tournamentSelect.dispatchEvent(new Event('change'));
  });

  phaseSelect.addEventListener('change', async () => {
    const tid = tournamentSelect.value;
    const pid = phaseSelect.value;
    daySelect.innerHTML = '<option value="">-- Select Day --</option>';
    if (!tid || !pid) return;
    const days = await DataService.getDays(tid, pid);
    days.forEach(d => {
      daySelect.innerHTML += `<option value="${d.id}">${escapeHtml(d.name)}</option>`;
    });
  });

  // ---- Day CRUD ----
  btnCreateDay.addEventListener('click', async () => {
    const tid = tournamentSelect.value;
    const pid = phaseSelect.value;
    if (!pid) return showToast('Select a phase first', 'error');
    const name = newDayName.value.trim();
    if (!name) return showToast('Enter day name', 'error');
    await DataService.createDay(tid, pid, name);
    newDayName.value = '';
    showToast(`Day "${name}" created`, 'success');
    phaseSelect.dispatchEvent(new Event('change'));
  });

  btnDeleteDay.addEventListener('click', async () => {
    const tid = tournamentSelect.value;
    const pid = phaseSelect.value;
    const did = daySelect.value;
    if (!did) return showToast('Select a day first', 'error');
    await DataService.deleteDay(tid, pid, did);
    showToast('Day deleted', 'success');
    phaseSelect.dispatchEvent(new Event('change'));
  });

  // ---- File Upload Zones ----
  function setupUploadZone(zone, input, fileNameEl, type) {
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      handleFile(e.dataTransfer.files[0], type, fileNameEl);
    });
    input.addEventListener('change', () => {
      if (input.files[0]) handleFile(input.files[0], type, fileNameEl);
    });
  }

  function handleFile(file, type, fileNameEl) {
    if (!file || !file.name.endsWith('.csv')) {
      return showToast('Please upload a CSV file', 'error');
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = CSVParser.parse(e.target.result);
      if (parsed.length === 0) return showToast('CSV file is empty or invalid', 'error');
      if (type === 'team') {
        teamCSVData = parsed;
      } else {
        playerCSVData = parsed;
      }
      fileNameEl.textContent = `${file.name} (${parsed.length} rows)`;
      showToast(`${type === 'team' ? 'Team' : 'Player'} data loaded: ${parsed.length} rows`, 'success');
    };
    reader.readAsText(file);
  }

  setupUploadZone(teamUploadZone, teamFileInput, teamFileName, 'team');
  setupUploadZone(playerUploadZone, playerFileInput, playerFileName, 'player');

  // ---- Upload Match ----
  btnUploadMatch.addEventListener('click', async () => {
    const tid = tournamentSelect.value;
    const pid = phaseSelect.value;
    const did = daySelect.value;

    if (!tid) return showToast('Select a tournament', 'error');
    if (!pid) return showToast('Select a phase', 'error');
    if (!did) return showToast('Select a day', 'error');
    if (!teamCSVData && !playerCSVData) return showToast('Upload at least one CSV file', 'error');

    try {
      const matchData = {
        tournamentId: tid,
        phaseId: pid,
        dayId: did,
        tournamentName: tournamentSelect.options[tournamentSelect.selectedIndex].text,
        phaseName: phaseSelect.options[phaseSelect.selectedIndex].text,
        dayName: daySelect.options[daySelect.selectedIndex].text,
        teams: teamCSVData || [],
        players: playerCSVData || []
      };

      await DataService.saveMatch(matchData);
      showToast('Match data uploaded successfully', 'success');
      teamCSVData = null;
      playerCSVData = null;
      teamFileName.textContent = '';
      playerFileName.textContent = '';
      teamFileInput.value = '';
      playerFileInput.value = '';
      loadMatches();
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
    }
  });

  // ---- Load Matches List ----
  async function loadMatches() {
    const matches = await DataService.getMatches();
    if (matches.length === 0) {
      matchesList.innerHTML = '<div class="empty-state"><p>No matches uploaded yet.</p></div>';
      return;
    }
    // Sort newest first
    matches.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    matchesList.innerHTML = '<ul class="match-list">' + matches.map(m => `
      <li>
        <div>
          <strong>${escapeHtml(m.tournamentName || 'Unknown')}</strong>
          <span class="match-meta"> / ${escapeHtml(m.phaseName || '')} / ${escapeHtml(m.dayName || '')}</span>
        </div>
        <div>
          <span class="badge">${(m.teams || []).length} teams</span>
          <span class="badge">${(m.players || []).length} players</span>
          <button class="btn btn-danger btn-sm" onclick="deleteMatch('${m.id}')" style="margin-left:0.5rem">Delete</button>
        </div>
      </li>
    `).join('') + '</ul>';
  }

  window.deleteMatch = async function(id) {
    if (!confirm('Delete this match?')) return;
    await DataService.deleteMatch(id);
    showToast('Match deleted', 'success');
    loadMatches();
  };

  // Toast function (also used in public.js)
  window.showToast = showToast;
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

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  window.escapeHtml = escapeHtml;
});
