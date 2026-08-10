const LEAGUES = [
  { id: 'worldcup', title: 'World Cup 2026', file: 'data.json' },
  { id: 'premier-league', title: 'Premier League', file: 'premier-league.json' },
  { id: 'laliga', title: 'La Liga', file: 'laliga.json' },
  { id: 'serie-a', title: 'Serie A', file: 'serie-a.json' },
];

const state = {
  league: 'worldcup',
  matches: [],
};

const STATUS_LABELS = {
  IN_PLAY: 'Live',
  PAUSED: 'Live',
  SCHEDULED: 'Scheduled',
  FINISHED: 'Finished',
  POSTPONED: 'Postponed',
  CANCELLED: 'Cancelled',
};

function formatTime(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date);
}

function setActiveLeagueTab(leagueId) {
  document.querySelectorAll('.league-tab').forEach(button => {
    button.classList.toggle('active', button.dataset.league === leagueId);
  });
}

function getLeagueById(leagueId) {
  return LEAGUES.find(league => league.id === leagueId) || LEAGUES[0];
}

function updateOverview(liveCount, upcomingCount, finishedCount) {
  document.getElementById('overview-live').textContent = liveCount;
  document.getElementById('overview-upcoming').textContent = upcomingCount;
  document.getElementById('overview-finished').textContent = finishedCount;
}

function getStatusClass(status) {
  if (status === 'IN_PLAY' || status === 'PAUSED') return 'live';
  if (status === 'SCHEDULED') return 'scheduled';
  return 'finished';
}

function renderMatchCard(match) {
  const status = STATUS_LABELS[match.status] || match.status || 'Live';
  const statusClass = getStatusClass(match.status);
  const score = match.score?.fullTime ? `${match.score.fullTime.home ?? 0}–${match.score.fullTime.away ?? 0}` : '–';
  const matchTime = match.status === 'SCHEDULED' ? formatTime(match.utcDate) : `${match.minute ? match.minute + "'" : ''}`;
  const venue = match.venue || '';

  return `
    <article class="match-card match-row ${statusClass}">
      <div class="match-side">
        <span class="match-state">${status}</span>
        <span class="team-name">${match.homeTeam?.shortName || match.homeTeam?.name || 'Home'}</span>
        <span class="team-name away">${match.awayTeam?.shortName || match.awayTeam?.name || 'Away'}</span>
      </div>
      <div class="match-score">${score}</div>
      <div class="match-meta">
        <span class="match-time" title="Kick-off time">${match.status === 'SCHEDULED' ? formatTime(match.utcDate) : matchTime}</span>
        ${venue ? `<span class="match-venue" title="Venue">${venue}</span>` : ''}
      </div>
    </article>
  `;
}

function renderMatchList(containerId, matches, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!matches.length) {
    container.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
    return;
  }
  container.innerHTML = matches.map(renderMatchCard).join('');
}

function getFilteredMatches(matches) {
  const live = [];
  const upcoming = [];
  const finished = [];

  matches.forEach(match => {
    const status = match.status;
    if (status === 'IN_PLAY' || status === 'PAUSED') live.push(match);
    else if (status === 'SCHEDULED') upcoming.push(match);
    else finished.push(match);
  });

  upcoming.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  live.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  finished.sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate));

  return { live, upcoming, finished };
}

function showUpdatedTime() {
  const updatedLabel = document.getElementById('updated-at');
  if (!updatedLabel) return;
  updatedLabel.textContent = new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date());
}

async function loadHome() {
  try {
    const responses = await Promise.all(LEAGUES.map(league => fetch(`${league.file}?t=${Date.now()}`)));
    const payloads = await Promise.all(responses.map(response => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    }));

    const matches = payloads.flatMap(payload => Array.isArray(payload.matches) ? payload.matches : []);
    const { live, upcoming, finished } = getFilteredMatches(matches);
    updateOverview(live.length, upcoming.length, finished.length);
    renderMatchList('live-list', live, 'No live matches right now.');
    renderMatchList('upcoming-list', upcoming, 'No upcoming matches found.');
    showUpdatedTime();
  } catch (error) {
    document.getElementById('live-list').innerHTML = `<p class="empty-state">Unable to load scores.</p>`;
    document.getElementById('upcoming-list').innerHTML = `<p class="empty-state">Unable to load upcoming matches.</p>`;
    console.error(error);
  }
}

function initLeagueNav() {
  document.querySelectorAll('.league-tab').forEach(button => {
    button.addEventListener('click', () => {
      loadLeague(button.dataset.league);
    });
  });
}

async function loadLeague(leagueId) {
  const league = getLeagueById(leagueId);
  state.league = league.id;
  setActiveLeagueTab(league.id);
  localStorage.setItem('selectedLeague', league.id);

  try {
    const response = await fetch(`${league.file}?t=${Date.now()}`);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const payload = await response.json();
    const matches = Array.isArray(payload.matches) ? payload.matches : [];
    state.matches = matches;
    const { live, upcoming, finished } = getFilteredMatches(matches);
    updateOverview(live.length, upcoming.length, finished.length);
    renderMatchList('live-list', live, 'No live matches right now.');
    renderMatchList('upcoming-list', upcoming, 'No upcoming matches found.');
    showUpdatedTime();
  } catch (error) {
    document.getElementById('live-list').innerHTML = `<p class="empty-state">Unable to load scores.</p>`;
    document.getElementById('upcoming-list').innerHTML = `<p class="empty-state">Unable to load upcoming matches.</p>`;
    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initLeagueNav();
  const pageType = document.body.dataset.page;
  const pageLeague = document.body.dataset.league;
  const refreshButton = document.getElementById('refresh-button');

  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      if (pageType === 'home') loadHome();
      else if (pageType === 'league' && pageLeague) loadLeague(pageLeague);
    });
  }

  if (pageType === 'home') {
    loadHome();
  } else if (pageType === 'league' && pageLeague) {
    loadLeague(pageLeague);
  }
});
