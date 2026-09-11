// ===== Admin Panel =====
document.addEventListener('DOMContentLoaded', () => {

  // ---- DOM refs ----
  const loginSection  = document.getElementById('loginSection');
  const adminPanel    = document.getElementById('adminPanel');
  const loginForm     = document.getElementById('loginForm');
  const logoutBtn     = document.getElementById('logoutBtn');
  const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
  const headerEmail   = document.getElementById('headerUserEmail');

  // sidebar
  const sidebarLinks  = document.querySelectorAll('.sidebar-link[data-section]');
  const sections      = document.querySelectorAll('.admin-panel-section');

  // tournament create
  const newTournamentName = document.getElementById('newTournamentName');
  const btnCreateTournament = document.getElementById('btnCreateTournament');
  const logoFile      = document.getElementById('logoFile');
  const logoUploadZone= document.getElementById('logoUploadZone');
  const logoPreview   = document.getElementById('logoPreview');
  const btnClearLogo  = document.getElementById('btnClearLogo');

  // phase & day (inside tournament section)
  const newPhaseName  = document.getElementById('newPhaseName');
  const btnCreatePhase= document.getElementById('btnCreatePhase');
  const phaseSelectForDay = document.getElementById('phaseSelectForDay');
  const newDayName    = document.getElementById('newDayName');
  const btnCreateDay  = document.getElementById('btnCreateDay');
  const phasesDaysPanel = document.getElementById('phasesDaysPanel');
  const phasePanelTitle = document.getElementById('phasePanelTitle');

  // upload section selectors
  const uploadTSelect = document.getElementById('uploadTournamentSelect');
  const uploadPSelect = document.getElementById('uploadPhaseSelect');
  const uploadDSelect = document.getElementById('uploadDaySelect');
  const teamFileInput  = document.getElementById('teamFile');
  const playerFileInput= document.getElementById('playerFile');
  const teamUploadZone = document.getElementById('teamUploadZone');
  const playerUploadZone=document.getElementById('playerUploadZone');
  const teamFileName   = document.getElementById('teamFileName');
  const playerFileName = document.getElementById('playerFileName');
  const btnUploadMatch = document.getElementById('btnUploadMatch');
  const matchesList    = document.getElementById('matchesList');
  const matchCount     = document.getElementById('matchCount');
  const matchFilterT   = document.getElementById('matchFilterTournament');
  const matchSearch    = document.getElementById('matchSearch');

  // settings
  const settingUserEmail = document.getElementById('settingUserEmail');

  let logoBase64 = null;
  let teamCSVData = null;
  let playerCSVData = null;
  let activeTournamentId = null;
  let activeTournamentName = '';
  let allMatchesCache = [];
  let allTournamentsList = [];

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-admin-action]');
    if (!button) return;

    const actions = {
      'manage-tournament': () => window.adminManageTournament(button.dataset.id, button.dataset.name),
      'upload-logo': () => window.adminUploadLogoFor(button.dataset.id),
      'delete-tournament': () => window.adminDeleteTournament(button.dataset.id, button.dataset.name),
      'delete-phase': () => window.adminDeletePhase(button.dataset.id, button.dataset.name),
      'delete-day': () => window.adminDeleteDay(button.dataset.phaseId, button.dataset.id, button.dataset.name),
      'delete-match': () => window.adminDeleteMatch(button.dataset.id)
    };
    const action = actions[button.dataset.adminAction];
    if (action) action();
  });

  // ─── AUTH ───────────────────────────────────────
  function showLogin() {
    loginSection.classList.remove('hidden');
    adminPanel.classList.add('hidden');
    headerEmail.textContent = '';
    logoutBtn.style.display = 'none';
  }

  async function showAdmin(user) {
    loginSection.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    headerEmail.textContent = user.email;
    logoutBtn.style.display = '';
    if (settingUserEmail) settingUserEmail.textContent = user.email;
    await Promise.all([loadAllTournaments(), loadDashboard(), loadMatchesSection()]);
  }

  async function initializeSession() {
    try {
      const session = await AuthService.getSession();
      if (session.user) await showAdmin(session.user);
      else showLogin();
    } catch (error) {
      showToast('Unable to connect to the admin server', 'error');
      showLogin();
    }
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass  = document.getElementById('loginPassword').value;
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const session = await AuthService.login(email, pass);
      await showAdmin(session.user);
      showToast('Signed in', 'success');
    } catch (err) {
      const retryLater = err.status === 429;
      showToast(retryLater ? 'Too many attempts. Try again later.' : 'Invalid email or password.', 'error');
    } finally {
      submitButton.disabled = false;
    }
  });

  const doLogout = async () => {
    try {
      await AuthService.logout();
    } finally {
      showLogin();
    }
  };
  logoutBtn.addEventListener('click', doLogout);
  if (settingsLogoutBtn) settingsLogoutBtn.addEventListener('click', doLogout);

  initializeSession();

  // ─── SIDEBAR NAVIGATION ─────────────────────────
  sidebarLinks.forEach(link => {
    link.addEventListener('click', () => {
      sidebarLinks.forEach(l => l.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      link.classList.add('active');
      const sec = document.getElementById('section-' + link.dataset.section);
      if (sec) sec.classList.add('active');

      if (link.dataset.section === 'matches') loadMatchesSection();
      if (link.dataset.section === 'dashboard') loadDashboard();
    });
  });

  // ─── LOGO UPLOAD ────────────────────────────────
  logoUploadZone.addEventListener('click', () => logoFile.click());
  logoUploadZone.addEventListener('dragover', e => { e.preventDefault(); logoUploadZone.classList.add('dragover'); });
  logoUploadZone.addEventListener('dragleave', () => logoUploadZone.classList.remove('dragover'));
  logoUploadZone.addEventListener('drop', e => {
    e.preventDefault();
    logoUploadZone.classList.remove('dragover');
    handleLogoFile(e.dataTransfer.files[0]);
  });
  logoFile.addEventListener('change', () => { if (logoFile.files[0]) handleLogoFile(logoFile.files[0]); });

  if (btnClearLogo) {
    btnClearLogo.addEventListener('click', () => {
      logoBase64 = null;
      logoPreview.innerHTML = '';
      logoFile.value = '';
      btnClearLogo.style.display = 'none';
      showToast('Logo cleared', 'info');
    });
  }

  function handleLogoFile(file) {
    if (!file) return;
    const valid = ['image/png','image/jpeg','image/jpg','image/webp'];
    if (!valid.includes(file.type)) return showToast('Logo must be PNG, JPG, or WebP', 'error');
    if (file.size > 500 * 1024)    return showToast('Logo must be under 500KB', 'error');
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const max = 256;
        let w = img.width, h = img.height;
        if (w > max || h > max) {
          if (w > h) { h = Math.round(h * max / w); w = max; }
          else       { w = Math.round(w * max / h); h = max; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        logoBase64 = canvas.toDataURL('image/png', 0.9);
        logoPreview.innerHTML = `<img src="${logoBase64}" alt="Preview">`;
        if (btnClearLogo) btnClearLogo.style.display = '';
        showToast('Logo ready', 'success');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ─── LOAD ALL TOURNAMENTS (shared) ──────────────
  async function loadAllTournaments() {
    try {
      allTournamentsList = await DataService.getTournaments();
      renderTournamentList();
      populateUploadTSelect();
      populateMatchFilterSelect();
    } catch (e) {
      showToast('Failed to load tournaments', 'error');
    }
  }

  function renderTournamentList() {
    const el = document.getElementById('tournamentListAdmin');
    if (!el) return;
    if (!allTournamentsList.length) {
      el.innerHTML = '<div class="empty-state"><h3>No tournaments</h3><p>Create your first tournament above.</p></div>';
      return;
    }
    el.innerHTML = allTournamentsList.map(t => `
      <div class="match-list-item" style="display:flex;align-items:center;gap:1rem;padding:0.75rem 1rem;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:0.5rem;transition:all 0.2s ease;cursor:pointer" data-tid="${t.id}">
        <div style="width:40px;height:40px;border-radius:var(--radius);background:var(--bg-4);border:1px solid var(--border-hi);display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:900;color:var(--yellow);font-size:1.1rem;flex-shrink:0;overflow:hidden">
          ${t.logo ? `<img src="${escapeAttr(t.logo)}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius)" alt="">` : escapeHtml(t.name.charAt(0))}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:0.85rem">${escapeHtml(t.name)}</div>
          <div style="font-size:0.7rem;color:var(--text-3)">${new Date(t.createdAt||0).toLocaleDateString()}</div>
        </div>
        <div style="display:flex;gap:0.5rem;flex-shrink:0">
          <button class="btn btn-ghost btn-sm" data-admin-action="manage-tournament" data-id="${t.id}" data-name="${escapeAttr(t.name)}">Manage</button>
          <button class="btn btn-ghost btn-sm" data-admin-action="upload-logo" data-id="${t.id}" title="Update logo">Logo</button>
          <button class="btn btn-danger btn-sm" data-admin-action="delete-tournament" data-id="${t.id}" data-name="${escapeAttr(t.name)}">Delete</button>
        </div>
      </div>`).join('');
  }

  function populateUploadTSelect() {
    uploadTSelect.innerHTML = '<option value="">-- Select Tournament --</option>';
    allTournamentsList.forEach(t => {
      uploadTSelect.innerHTML += `<option value="${t.id}">${escapeHtml(t.name)}</option>`;
    });
  }

  function populateMatchFilterSelect() {
    if (!matchFilterT) return;
    matchFilterT.innerHTML = '<option value="">All Tournaments</option>';
    allTournamentsList.forEach(t => {
      matchFilterT.innerHTML += `<option value="${t.id}">${escapeHtml(t.name)}</option>`;
    });
  }

  // ─── CREATE TOURNAMENT ──────────────────────────
  btnCreateTournament.addEventListener('click', async () => {
    const name = newTournamentName.value.trim();
    if (!name) return showToast('Enter a tournament name', 'error');
    btnCreateTournament.disabled = true;
    try {
      await DataService.createTournament(name, logoBase64);
      newTournamentName.value = '';
      logoBase64 = null;
      logoPreview.innerHTML = '';
      if (btnClearLogo) btnClearLogo.style.display = 'none';
      logoFile.value = '';
      showToast(`"${name}" created`, 'success');
      await loadAllTournaments();
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
    btnCreateTournament.disabled = false;
  });

  // ─── MANAGE TOURNAMENT (phases & days) ──────────
  window.adminManageTournament = async function(tid, name) {
    activeTournamentId = tid;
    activeTournamentName = name;
    phasesDaysPanel.style.display = '';
    phasePanelTitle.textContent = `${name} — Phases & Days`;
    await refreshPhaseList();
    phasesDaysPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.adminUploadLogoFor = async function(tid) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.png,.jpg,.jpeg,.webp';
    input.onchange = () => {
      if (!input.files[0]) return;
      handleLogoFileForTournament(input.files[0], tid);
    };
    input.click();
  };

  function handleLogoFileForTournament(file, tid) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = async () => {
        const max = 256;
        let w = img.width, h = img.height;
        if (w > max || h > max) {
          if (w > h) { h = Math.round(h * max / w); w = max; }
          else       { w = Math.round(w * max / h); h = max; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const b64 = canvas.toDataURL('image/png', 0.9);
        await DataService.updateTournamentLogo(tid, b64);
        showToast('Logo updated', 'success');
        await loadAllTournaments();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  window.adminDeleteTournament = async function(tid, name) {
    if (!confirm(`Delete tournament "${name}" and ALL its matches? This cannot be undone.`)) return;
    try {
      await DataService.deleteTournament(tid);
      showToast('Tournament deleted', 'success');
      if (activeTournamentId === tid) {
        activeTournamentId = null;
        phasesDaysPanel.style.display = 'none';
      }
      await loadAllTournaments();
      await loadDashboard();
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  // ─── PHASES ─────────────────────────────────────
  btnCreatePhase.addEventListener('click', async () => {
    if (!activeTournamentId) return showToast('Select a tournament first', 'error');
    const name = newPhaseName.value.trim();
    if (!name) return showToast('Enter a phase name', 'error');
    btnCreatePhase.disabled = true;
    try {
      await DataService.createPhase(activeTournamentId, name);
      newPhaseName.value = '';
      showToast(`Phase "${name}" created`, 'success');
      await refreshPhaseList();
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
    btnCreatePhase.disabled = false;
  });

  async function refreshPhaseList() {
    const phaseList = document.getElementById('phaseList');
    if (!phaseList || !activeTournamentId) return;
    const phases = await DataService.getPhases(activeTournamentId);

    phaseSelectForDay.innerHTML = '<option value="">-- Select Phase --</option>';
    phases.forEach(p => {
      phaseSelectForDay.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
    });

    if (!phases.length) {
      phaseList.innerHTML = '<div style="color:var(--text-3);font-size:0.78rem;padding:0.5rem 0">No phases yet.</div>';
      return;
    }
    phaseList.innerHTML = phases.map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border);font-size:0.8rem">
        <span>${escapeHtml(p.name)}</span>
        <button class="btn btn-danger btn-sm" data-admin-action="delete-phase" data-id="${p.id}" data-name="${escapeAttr(p.name)}">Delete</button>
      </div>`).join('');
  }

  window.adminDeletePhase = async function(pid, name) {
    if (!confirm(`Delete phase "${name}"?`)) return;
    await DataService.deletePhase(activeTournamentId, pid);
    showToast('Phase deleted', 'success');
    await refreshPhaseList();
    document.getElementById('dayList').innerHTML = '';
  };

  // ─── DAYS ────────────────────────────────────────
  phaseSelectForDay.addEventListener('change', () => refreshDayList());

  btnCreateDay.addEventListener('click', async () => {
    if (!activeTournamentId) return showToast('Select a tournament first', 'error');
    const pid = phaseSelectForDay.value;
    if (!pid) return showToast('Select a phase first', 'error');
    const name = newDayName.value.trim();
    if (!name) return showToast('Enter a day name', 'error');
    btnCreateDay.disabled = true;
    try {
      await DataService.createDay(activeTournamentId, pid, name);
      newDayName.value = '';
      showToast(`Day "${name}" created`, 'success');
      await refreshDayList();
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
    btnCreateDay.disabled = false;
  });

  async function refreshDayList() {
    const dayList = document.getElementById('dayList');
    if (!dayList || !activeTournamentId) return;
    const pid = phaseSelectForDay.value;
    if (!pid) { dayList.innerHTML = ''; return; }
    const days = await DataService.getDays(activeTournamentId, pid);
    if (!days.length) {
      dayList.innerHTML = '<div style="color:var(--text-3);font-size:0.78rem;padding:0.5rem 0">No days yet.</div>';
      return;
    }
    dayList.innerHTML = days.map(d => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border);font-size:0.8rem">
        <span>${escapeHtml(d.name)}</span>
        <button class="btn btn-danger btn-sm" data-admin-action="delete-day" data-phase-id="${phaseSelectForDay.value}" data-id="${d.id}" data-name="${escapeAttr(d.name)}">Delete</button>
      </div>`).join('');
  }

  window.adminDeleteDay = async function(pid, did, name) {
    if (!confirm(`Delete day "${name}"?`)) return;
    await DataService.deleteDay(activeTournamentId, pid, did);
    showToast('Day deleted', 'success');
    await refreshDayList();
  };

  // ─── UPLOAD SELECTORS ────────────────────────────
  uploadTSelect.addEventListener('change', async () => {
    const tid = uploadTSelect.value;
    uploadPSelect.innerHTML = '<option value="">-- Select Phase --</option>';
    uploadDSelect.innerHTML = '<option value="">-- Select Day --</option>';
    if (!tid) return;
    const phases = await DataService.getPhases(tid);
    phases.forEach(p => { uploadPSelect.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`; });
  });

  uploadPSelect.addEventListener('change', async () => {
    const tid = uploadTSelect.value;
    const pid = uploadPSelect.value;
    uploadDSelect.innerHTML = '<option value="">-- Select Day --</option>';
    if (!tid || !pid) return;
    const days = await DataService.getDays(tid, pid);
    days.forEach(d => { uploadDSelect.innerHTML += `<option value="${d.id}">${escapeHtml(d.name)}</option>`; });
  });

  // ─── FILE UPLOAD ZONES ───────────────────────────
  setupUploadZone(teamUploadZone, teamFileInput, teamFileName, 'team');
  setupUploadZone(playerUploadZone, playerFileInput, playerFileName, 'player');

  function setupUploadZone(zone, input, labelEl, type) {
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      handleCSV(e.dataTransfer.files[0], type, labelEl, zone);
    });
    input.addEventListener('change', () => { if (input.files[0]) handleCSV(input.files[0], type, labelEl, zone); });
  }

  function handleCSV(file, type, labelEl, zone) {
    if (!file || !file.name.toLowerCase().endsWith('.csv')) return showToast('Upload a CSV file', 'error');
    if (file.size > CSVParser.MAX_FILE_SIZE) return showToast('CSV must be 2MB or smaller', 'error');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = CSVParser.parse(ev.target.result, type);
        if (type === 'team') teamCSVData = parsed;
        else                 playerCSVData = parsed;
        labelEl.textContent = `✓ ${file.name} (${parsed.length} rows)`;
        zone.classList.add('has-file');
        showToast(`${type === 'team' ? 'Teams' : 'Players'} CSV loaded: ${parsed.length} rows`, 'success');
      } catch (error) {
        if (type === 'team') teamCSVData = null;
        else                 playerCSVData = null;
        labelEl.textContent = '';
        zone.classList.remove('has-file');
        showToast(error.message, 'error');
      }
    };
    reader.onerror = () => showToast('Could not read the CSV file', 'error');
    reader.readAsText(file);
  }

  // ─── UPLOAD MATCH ────────────────────────────────
  btnUploadMatch.addEventListener('click', async () => {
    const tid = uploadTSelect.value;
    const pid = uploadPSelect.value;
    const did = uploadDSelect.value;
    if (!tid) return showToast('Select a tournament', 'error');
    if (!pid) return showToast('Select a phase', 'error');
    if (!did) return showToast('Select a day', 'error');
    if (!teamCSVData && !playerCSVData) return showToast('Upload at least one CSV file', 'error');

    btnUploadMatch.disabled = true;
    btnUploadMatch.textContent = 'Uploading…';
    try {
      await DataService.saveMatch({
        tournamentId:   tid,
        phaseId:        pid,
        dayId:          did,
        tournamentName: uploadTSelect.options[uploadTSelect.selectedIndex].text,
        phaseName:      uploadPSelect.options[uploadPSelect.selectedIndex].text,
        dayName:        uploadDSelect.options[uploadDSelect.selectedIndex].text,
        teams:   teamCSVData   || [],
        players: playerCSVData || []
      });
      showToast('Match uploaded successfully', 'success');
      teamCSVData = null; playerCSVData = null;
      teamFileName.textContent = '';    playerFileName.textContent = '';
      teamFileInput.value = '';        playerFileInput.value = '';
      teamUploadZone.classList.remove('has-file');
      playerUploadZone.classList.remove('has-file');
      await loadDashboard();
    } catch (e) {
      showToast('Upload failed: ' + e.message, 'error');
    }
    btnUploadMatch.disabled = false;
    btnUploadMatch.textContent = 'Upload Match';
  });

  // ─── MATCH HISTORY ───────────────────────────────
  async function loadMatchesSection() {
    try {
      allMatchesCache = await DataService.getMatches();
      allMatchesCache.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      if (matchCount) matchCount.textContent = allMatchesCache.length + ' total';
      renderMatchList(allMatchesCache);
    } catch (e) { showToast('Failed to load matches', 'error'); }
  }

  if (matchFilterT) matchFilterT.addEventListener('change', filterMatches);
  if (matchSearch)  matchSearch.addEventListener('input',   filterMatches);

  function filterMatches() {
    const tid = matchFilterT ? matchFilterT.value : '';
    const q   = matchSearch  ? matchSearch.value.toLowerCase() : '';
    let list  = allMatchesCache;
    if (tid) list = list.filter(m => m.tournamentId === tid);
    if (q)   list = list.filter(m =>
      (m.tournamentName||'').toLowerCase().includes(q) ||
      (m.phaseName||'').toLowerCase().includes(q) ||
      (m.dayName||'').toLowerCase().includes(q)
    );
    renderMatchList(list);
  }

  function renderMatchList(matches) {
    if (!matchesList) return;
    if (!matches.length) {
      matchesList.innerHTML = '<div class="empty-state"><h3>No Matches</h3><p>No matches found.</p></div>';
      return;
    }
    matchesList.innerHTML = '<ul class="match-list">' + matches.map(m => `
      <li>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:0.82rem">${escapeHtml(m.tournamentName || '—')}</div>
          <div class="match-meta">${escapeHtml(m.phaseName||'')} ${m.phaseName && m.dayName ? '›' : ''} ${escapeHtml(m.dayName||'')} &nbsp;·&nbsp; ${m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</div>
        </div>
        <div class="match-actions">
          <span class="badge">${(m.teams||[]).length} teams</span>
          <span class="badge">${(m.players||[]).length} players</span>
          <button class="btn btn-danger btn-sm" data-admin-action="delete-match" data-id="${m.id}">Delete</button>
        </div>
      </li>`).join('') + '</ul>';
  }

  window.adminDeleteMatch = async function(id) {
    if (!confirm('Delete this match?')) return;
    await DataService.deleteMatch(id);
    showToast('Match deleted', 'success');
    await loadMatchesSection();
    await loadDashboard();
  };

  if (document.getElementById('btnRefreshMatches')) {
    document.getElementById('btnRefreshMatches').addEventListener('click', loadMatchesSection);
  }

  // ─── DASHBOARD ───────────────────────────────────
  async function loadDashboard() {
    try {
      const [tournaments, matches] = await Promise.all([
        DataService.getTournaments(),
        DataService.getMatches()
      ]);

      const teams   = new Set();
      const players = new Set();
      matches.forEach(m => {
        (m.teams   || []).forEach(t => teams.add(t['Team Name']   || t.teamName));
        (m.players || []).forEach(p => players.add(p['Player Name'] || p.playerName));
      });

      setText('dashTournaments', tournaments.length);
      setText('dashMatches',     matches.length);
      setText('dashTeams',       teams.size);
      setText('dashPlayers',     players.size);

      // recent 5 matches
      const recent5 = [...matches].sort((a,b) => (b.createdAt||0) - (a.createdAt||0)).slice(0,5);
      const rc = document.getElementById('recentMatchesCard');
      if (rc) {
        if (!recent5.length) {
          rc.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No matches yet.</p></div>';
        } else {
          rc.innerHTML = '<ul class="match-list">' + recent5.map(m => `
            <li>
              <div>
                <div style="font-weight:700;font-size:0.82rem">${escapeHtml(m.tournamentName||'—')}</div>
                <div class="match-meta">${escapeHtml(m.phaseName||'')} ${m.phaseName&&m.dayName?'›':''} ${escapeHtml(m.dayName||'')}</div>
              </div>
              <div style="display:flex;gap:0.4rem">
                <span class="badge">${(m.teams||[]).length}T</span>
                <span class="badge">${(m.players||[]).length}P</span>
              </div>
            </li>`).join('') + '</ul>';
        }
      }
    } catch (e) { console.error('Dashboard error', e); }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ─── SETTINGS ────────────────────────────────────
  const btnExportMatches = document.getElementById('btnExportMatches');
  if (btnExportMatches) {
    btnExportMatches.addEventListener('click', async () => {
      const matches = await DataService.getMatches();
      downloadJSON(matches, 'ffmena_matches.json');
    });
  }

  const btnBackupT = document.getElementById('btnBackupTournaments');
  if (btnBackupT) {
    btnBackupT.addEventListener('click', async () => {
      const tournaments = await DataService.getTournaments();
      downloadJSON(tournaments, 'ffmena_tournaments.json');
    });
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast(`${filename} downloaded`, 'success');
  }

  // ─── TOAST ───────────────────────────────────────
  window.showToast = showToast;
  function showToast(msg, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => {
      t.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => t.remove(), 300);
    }, 3500);
  }

  // ─── HELPERS ─────────────────────────────────────
  window.escapeHtml = escapeHtml;
  function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
});
