const state = {
  selectedSeatId: null,
  seats: [],
  totalSeats: 0,
  available: 0,
  booked: 0
};

const el = {
  eventId: document.querySelector('#event-id'),
  userId: document.querySelector('#user-id'),
  totalSeatsInput: document.querySelector('#total-seats'),
  statTotal: document.querySelector('#stat-total'),
  statAvailable: document.querySelector('#stat-available'),
  statBooked: document.querySelector('#stat-booked'),
  statSelected: document.querySelector('#stat-selected'),
  seatGrid: document.querySelector('#seat-grid'),
  seatNote: document.querySelector('#seat-note'),
  logBox: document.querySelector('#log-box'),
  initBtn: document.querySelector('#init-btn'),
  refreshBtn: document.querySelector('#refresh-btn'),
  bookBtn: document.querySelector('#book-btn'),
  lockBtn: document.querySelector('#lock-btn'),
  confirmBtn: document.querySelector('#confirm-btn'),
  cancelBtn: document.querySelector('#cancel-btn')
};

function currentEventId() {
  return el.eventId.value.trim() || 'concert-2026';
}

function currentUserId() {
  return el.userId.value.trim() || 'userA';
}

function log(message, data = null) {
  const time = new Date().toLocaleTimeString();
  const line = `[${time}] ${message}`;
  el.logBox.textContent = `${line}${data ? `\n${JSON.stringify(data, null, 2)}` : ''}\n\n${el.logBox.textContent}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || JSON.stringify(data));
  }
  return data;
}

function updateStats() {
  el.statTotal.textContent = state.totalSeats;
  el.statAvailable.textContent = state.available;
  el.statBooked.textContent = state.booked;
  el.statSelected.textContent = state.selectedSeatId || '-';
}

function renderSeats() {
  el.seatGrid.innerHTML = '';

  if (state.seats.length === 0) {
    el.seatGrid.innerHTML = '<p>No seats yet. Initialize this event first.</p>';
    return;
  }

  for (const seat of state.seats) {
    const button = document.createElement('button');
    button.className = `seat ${seat.status.toLowerCase()}`;
    button.textContent = seat.seatId;
    button.type = 'button';

    if (seat.seatId === state.selectedSeatId) {
      button.classList.add('selected');
    }

    button.title = seat.lockOwner ? `${seat.status} by ${seat.lockOwner}` : seat.status;

    button.addEventListener('click', () => {
      state.selectedSeatId = seat.seatId;
      el.seatNote.textContent = `${seat.seatId}: ${seat.status}${seat.lockOwner ? ` (${seat.lockOwner})` : ''}`;
      renderSeats();
      updateStats();
    });

    el.seatGrid.appendChild(button);
  }
}

async function refresh() {
  const eventId = currentEventId();
  const [status, seatMap] = await Promise.all([
    api(`/api/events/${eventId}/status`),
    api(`/api/events/${eventId}/seats`)
  ]);

  state.totalSeats = status.totalSeats;
  state.available = status.available;
  state.booked = status.booked;
  state.seats = seatMap.seats;

  if (state.selectedSeatId && !state.seats.find((x) => x.seatId === state.selectedSeatId)) {
    state.selectedSeatId = null;
  }

  updateStats();
  renderSeats();
}

async function initEvent() {
  const eventId = currentEventId();
  const totalSeats = Number(el.totalSeatsInput.value || 100);
  const result = await api(`/api/events/${eventId}/init`, {
    method: 'POST',
    body: JSON.stringify({ totalSeats })
  });
  log('Event initialized', result);
  await refresh();
}

async function bookNext() {
  const eventId = currentEventId();
  const result = await api('/api/book', {
    method: 'POST',
    body: JSON.stringify({ eventId })
  });
  log('Seat booked', result);
  state.selectedSeatId = result.seatId;
  await refresh();
}

function requireSeat() {
  if (!state.selectedSeatId) {
    throw new Error('Select a seat first');
  }
}

async function lockSelected() {
  requireSeat();
  const result = await api('/api/lock', {
    method: 'POST',
    body: JSON.stringify({
      eventId: currentEventId(),
      seatId: state.selectedSeatId,
      userId: currentUserId()
    })
  });
  log(`Seat ${state.selectedSeatId} lock attempt`, result);
  await refresh();
}

async function confirmSelected() {
  requireSeat();
  const result = await api('/api/confirm', {
    method: 'POST',
    body: JSON.stringify({
      eventId: currentEventId(),
      seatId: state.selectedSeatId,
      userId: currentUserId()
    })
  });
  log(`Seat ${state.selectedSeatId} confirm attempt`, result);
  await refresh();
}

async function cancelSelected() {
  requireSeat();
  const result = await api('/api/cancel', {
    method: 'POST',
    body: JSON.stringify({
      eventId: currentEventId(),
      seatId: state.selectedSeatId,
      userId: currentUserId()
    })
  });
  log(`Seat ${state.selectedSeatId} cancel attempt`, result);
  await refresh();
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    log('Action failed', { error: error.message });
  }
}

el.initBtn.addEventListener('click', () => runAction(initEvent));
el.refreshBtn.addEventListener('click', () => runAction(refresh));
el.bookBtn.addEventListener('click', () => runAction(bookNext));
el.lockBtn.addEventListener('click', () => runAction(lockSelected));
el.confirmBtn.addEventListener('click', () => runAction(confirmSelected));
el.cancelBtn.addEventListener('click', () => runAction(cancelSelected));
el.eventId.addEventListener('change', () => runAction(refresh));

runAction(refresh);
setInterval(() => runAction(refresh), 5000);
