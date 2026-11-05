window.jobsState = [];

    function setLoginMessage(message, isError = false) {
      const error = document.getElementById('login-error');
      const status = document.getElementById('login-status');
      if (isError) {
        error.innerText = message;
        error.classList.remove('hidden');
        status.classList.add('hidden');
      } else {
        error.classList.add('hidden');
        status.innerText = message;
        status.classList.remove('hidden');
      }
    }

    window.updateAuthUI = function({ configured, authenticated, email, message }) {
      const loginScreen = document.getElementById('login-screen');
      const submit = document.getElementById('login-submit');
      const signedInUser = document.getElementById('signed-in-user');

      loginScreen.classList.toggle('hidden', authenticated);
      const appHeader = document.querySelector('header');
      const appMain = document.querySelector('main');
      appHeader.inert = !authenticated;
      appMain.inert = !authenticated;
      appHeader.setAttribute('aria-hidden', String(!authenticated));
      appMain.setAttribute('aria-hidden', String(!authenticated));
      submit.disabled = !configured;
      signedInUser.innerText = authenticated ? email || '' : '';
      signedInUser.classList.toggle('hidden', !authenticated || !email);
      if (message) {
        setLoginMessage(message, !configured);
      } else if (configured && !authenticated) {
        setLoginMessage('ඔබේ Firebase Email/Password ගිණුමෙන් පුරනය වන්න.');
      }
    };

    async function handleLogin(event) {
      event.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const submit = document.getElementById('login-submit');

      submit.disabled = true;
      setLoginMessage('Firebase මඟින් ගිණුම තහවුරු කරමින්...');
      try {
        await window.firebaseSignIn(email, password);
        document.getElementById('login-password').value = '';
      } catch (error) {
        const messages = {
          'auth/invalid-credential': 'ඊමේල් ලිපිනය හෝ මුරපදය වැරදියි.',
          'auth/invalid-email': 'වලංගු ඊමේල් ලිපිනයක් ඇතුළත් කරන්න.',
          'auth/too-many-requests': 'උත්සාහයන් වැඩියි. ටික වේලාවකින් නැවත උත්සාහ කරන්න.',
          'auth/network-request-failed': 'ජාල සම්බන්ධතාවය පරීක්ෂා කර නැවත උත්සාහ කරන්න.'
        };
        setLoginMessage(messages[error.code] || `පුරනය වීමට නොහැකි විය: ${error.message}`, true);
        submit.disabled = false;
      }
    }
    window.handleLogin = handleLogin;

    async function handleLogout() {
      try {
        await window.firebaseSignOut();
      } catch (error) {
        showToast(`ඉවත් වීමට නොහැකි විය: ${error.message}`, 'error');
      }
    }
    window.handleLogout = handleLogout;

    const GOOGLE_CLIENT_ID_KEY = 'FLOOR_PAINT_GOOGLE_CLIENT_ID';
    const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
    const DEMO_JOB_IDS = new Set(['job-101', 'job-102', 'job-103']);
    let googleTokenClient = null;
    let googleAccessToken = null;
    let googleTokenExpiresAt = 0;
    let googleIdentityScriptPromise = null;
    let googleTokenResult = null;

    // Switch Top Navigation Tabs
    function switchTab(pageId) {
      document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
      document.getElementById(pageId).classList.remove('hidden');

      const tabs = ['page-new', 'page-manage', 'page-schedule'];
      tabs.forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        if (t === pageId) {
          btn.className = 'tab-button flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 text-white bg-gradient-to-r from-orange-600 to-amber-600 shadow-md';
        } else {
          btn.className = 'tab-button flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 text-slate-400 hover:text-slate-200';
        }
      });

      if (pageId === 'page-manage') renderJobsTable();
      if (pageId === 'page-schedule') renderScheduleView();
    }

    // Dynamic Balance Calculator
    function calculateBalance() {
      const total = parseFloat(document.getElementById('cust-total').value) || 0;
      const advance = parseFloat(document.getElementById('cust-advance').value) || 0;
      const balance = Math.max(0, total - advance);
      document.getElementById('display-balance').innerText = `රු. ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }

    // Toast alert message box
    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      const icon = document.getElementById('toast-icon');
      const msg = document.getElementById('toast-message');

      msg.innerText = message;
      if (type === 'success') {
        toast.className = 'fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100 bg-emerald-950 border border-emerald-600 text-emerald-100';
        icon.className = 'ph-bold ph-check-circle text-2xl text-emerald-400';
      } else {
        toast.className = 'fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100 bg-rose-950 border border-rose-600 text-rose-100';
        icon.className = 'ph-bold ph-warning-circle text-2xl text-rose-400';
      }

      setTimeout(() => {
        toast.classList.add('translate-y-[-150%]', 'opacity-0');
      }, 3500);
    }
    window.showToast = showToast;

    // Handle Creating New Job
    async function handleCreateJob(e) {
      e.preventDefault();
      const saveBtn = document.getElementById('save-job-btn');
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-xl"></i> Cloud එකට යවමින් පවතී...`;

      try {
        const name = document.getElementById('cust-name').value.trim();
        const phone = document.getElementById('cust-phone').value.trim();
        const email = document.getElementById('cust-email').value.trim();
        const address = document.getElementById('cust-address').value.trim();
        const sqft = parseFloat(document.getElementById('cust-sqft').value) || 0;
        const scheduledDate = document.getElementById('cust-date').value;
        const total = parseFloat(document.getElementById('cust-total').value) || 0;
        const advance = parseFloat(document.getElementById('cust-advance').value) || 0;
        const notes = document.getElementById('cust-notes').value.trim();

        const newJob = {
          id: 'job-' + Date.now(),
          name,
          phone,
          email,
          address,
          sqft,
          scheduledDate,
          total,
          advance,
          notes,
          status: 'SCHEDULED',
          createdAt: new Date().toISOString()
        };

        await window.cloudSaveJob(newJob);
        await syncCalendarAfterSave(newJob);

        document.getElementById('new-job-form').reset();
        calculateBalance();
        showToast('ඇණවුම සාර්ථකව Cloud එකට ඇතුළත් විය!', 'success');

        // Switch to schedule view to visualize the newly entered record
        setTimeout(() => switchTab('page-schedule'), 600);

      } catch (err) {
        const firestoreErrors = {
          'firebase/file-origin': 'මෙම පිටුව file:// ලෙස විවෘත කර ඇත. VS Code හි Live Server භාවිතා කර http://localhost වෙතින් නැවත විවෘත කර පුරනය වන්න.',
          'permission-denied': 'Firestore Rules විසින් ලිවීම අවහිර කර ඇත. Firebase Console හි මෙම යෙදුමේ painting_jobs path එකට පුරනය වූ පරිශීලකයාට අවසර දෙන්න.',
          'unavailable': 'Firestore වෙත සම්බන්ධ විය නොහැක. අන්තර්ජාල සම්බන්ධතාවය සහ Firebase Console හි Firestore Database එක පරීක්ෂා කරන්න.',
          'firestore/write-timeout': 'Firestore වෙතින් තහවුරු කිරීමක් ලැබුණේ නැත. Firebase Console හි Firestore Database සහ Rules පරීක්ෂා කර, job එක ඇතුළත් වී ඇත්දැයි බලන්න. නැවත Submit කිරීමට පෙර එය පරීක්ෂා කරන්න.'
        };
        const errorMessage = firestoreErrors[err.code] || err.message;
        showToast('සුරැකීමේදී දෝෂයක් ඇති විය: ' + errorMessage, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="ph-bold ph-cloud-arrow-up text-xl"></i><span>Cloud එකට සුරකින්න (Save to Cloud)</span>`;
      }
    }

    // Render Page 2: Table
    function renderJobsTable() {
      const tbody = document.getElementById('manage-table-body');
      const emptyState = document.getElementById('manage-empty-state');
      const search = (document.getElementById('manage-search').value || '').toLowerCase().trim();
      const filterStatus = document.getElementById('manage-filter-status').value;

      tbody.innerHTML = '';
      const list = window.jobsState || [];

      const filtered = list.filter(j => {
        const matchText = (j.name || '').toLowerCase().includes(search) || 
                          (j.phone || '').includes(search) || 
                          (j.address || '').toLowerCase().includes(search);
        const matchStatus = (filterStatus === 'ALL') || (j.status === filterStatus);
        return matchText && matchStatus;
      });

      filtered.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      if (filtered.length === 0) {
        emptyState.classList.remove('hidden');
        return;
      }
      emptyState.classList.add('hidden');

      filtered.forEach(job => {
        const balance = Math.max(0, (job.total || 0) - (job.advance || 0));
        const dt = new Date(job.scheduledDate);
        const dateStr = dt.toLocaleString('en-GB', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/40 transition-colors';
        tr.innerHTML = `
          <td class="px-4 py-4">
            <div class="font-bold text-white text-sm">${escapeHtml(job.name)}</div>
            <div class="text-xs text-orange-400 mt-0.5">
              <a href="tel:${escapeHtml(job.phone)}" class="hover:underline flex items-center gap-1">
                <i class="ph-bold ph-phone"></i> ${escapeHtml(job.phone)}
              </a>
            </div>
            ${job.email ? `<div class="text-[11px] text-slate-400 mt-0.5">${escapeHtml(job.email)}</div>` : ''}
          </td>
          <td class="px-4 py-4 max-w-xs">
            <div class="text-slate-300 text-xs">${escapeHtml(job.address)}</div>
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}" target="_blank" class="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 mt-1">
              <i class="ph-bold ph-map-pin"></i> Maps වලින් බලන්න
            </a>
          </td>
          <td class="px-4 py-4 font-semibold text-slate-200 text-xs whitespace-nowrap">
            ${Number(job.sqft || 0).toLocaleString()} sqft
          </td>
          <td class="px-4 py-4 whitespace-nowrap text-xs">
            <div class="font-bold text-white">රු. ${Number(job.total || 0).toLocaleString()}</div>
            <div class="text-emerald-400">Advance: රු. ${Number(job.advance || 0).toLocaleString()}</div>
            <div class="${balance > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}">Due: රු. ${balance.toLocaleString()}</div>
          </td>
          <td class="px-4 py-4 whitespace-nowrap text-xs">
            <div class="font-semibold text-slate-200">${dateStr}</div>
            <div class="text-[11px] text-slate-400">${getRelativeTimeLabel(job.scheduledDate)}</div>
          </td>
          <td class="px-4 py-4 whitespace-nowrap">
            ${getStatusBadge(job.status)}
          </td>
          <td class="px-4 py-4 text-right whitespace-nowrap">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="openEditModal('${job.id}')" title="වෙනස් කරන්න" class="p-2 rounded-xl bg-slate-800 hover:bg-orange-600/30 text-orange-400 hover:text-orange-300 border border-slate-700 transition">
                <i class="ph-bold ph-pencil-simple text-base"></i>
              </button>
              <button onclick="deleteJobConfirm('${job.id}')" title="මකන්න" class="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/30 text-rose-400 hover:text-rose-300 border border-slate-700 transition">
                <i class="ph-bold ph-trash text-base"></i>
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Render Page 3: Smart Priority Schedule & Google Calendar
    function renderScheduleView() {
      const urgentGrid = document.getElementById('urgent-jobs-grid');
      const upcomingGrid = document.getElementById('upcoming-jobs-grid');
      const pastGrid = document.getElementById('past-jobs-grid');

      urgentGrid.innerHTML = '';
      upcomingGrid.innerHTML = '';
      pastGrid.innerHTML = '';

      const list = window.jobsState || [];
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfTomorrow = new Date(startOfToday.getTime() + 2 * 24 * 60 * 60 * 1000);

      // Sort by scheduledDate ASC (nearest jobs first)
      const sorted = [...list].sort((a,b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

      let urgentCount = 0;
      let upcomingCount = 0;
      let pastCount = 0;

      sorted.forEach(job => {
        const jDate = new Date(job.scheduledDate);
        const card = createJobCard(job, jDate, startOfToday, endOfTomorrow);

        if (jDate < startOfToday && job.status === 'COMPLETED') {
          pastGrid.appendChild(card);
          pastCount++;
        } else if (jDate >= startOfToday && jDate < endOfTomorrow) {
          // Today or Tomorrow Priority
          urgentGrid.appendChild(card);
          urgentCount++;
        } else if (jDate >= endOfTomorrow) {
          upcomingGrid.appendChild(card);
          upcomingCount++;
        } else {
          // Passed date without completed status, keep in urgent attention
          urgentGrid.appendChild(card);
          urgentCount++;
        }
      });

      document.getElementById('badge-urgent-jobs').innerText = urgentCount;

      if (urgentCount === 0) {
        urgentGrid.innerHTML = `<div class="col-span-full p-6 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-500 text-sm">අද හෝ හෙට දිනට නියමිත කිසිදු ඇණවුමක් නැත.</div>`;
      }
      if (upcomingCount === 0) {
        upcomingGrid.innerHTML = `<div class="col-span-full p-6 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-500 text-sm">ඉදිරි දිනයන් සඳහා වැඩ සටහන් කර නොමැත.</div>`;
      }
      if (pastCount === 0) {
        pastGrid.innerHTML = `<div class="col-span-full p-6 text-center text-slate-500 text-sm">පසුගිය ඇණවුම් කිසිවක් නැත.</div>`;
      }
    }

    // Schedule Job Card
    function createJobCard(job, jDate, startOfToday, endOfTomorrow) {
      const isToday = jDate.toDateString() === (new Date()).toDateString();
      const isUrgent = (jDate >= startOfToday && jDate < endOfTomorrow);
      const balance = Math.max(0, (job.total || 0) - (job.advance || 0));

      const gCalUrl = generateGoogleCalendarUrl(job);
      const formattedDate = jDate.toLocaleString('en-GB', {
        weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      const card = document.createElement('div');
      card.className = `flex flex-col justify-between rounded-2xl p-5 border transition-all duration-200 hover:shadow-2xl ${
        isToday 
          ? 'bg-gradient-to-b from-slate-900 to-rose-950/20 border-rose-500/80 shadow-rose-950/40' 
          : isUrgent 
            ? 'bg-gradient-to-b from-slate-900 to-amber-950/20 border-amber-500/70' 
            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
      }`;

      card.innerHTML = `
        <div class="space-y-3">
          <!-- Top date badge -->
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold ${
                isToday ? 'bg-rose-500 text-white' : isUrgent ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-300'
              }">
                <i class="ph-bold ${isToday ? 'ph-fire' : 'ph-calendar'}"></i>
                ${isToday ? 'අද දිනයේ (TODAY)' : getRelativeTimeLabel(job.scheduledDate)}
              </span>
              <div class="text-sm font-bold text-white mt-2 flex items-center gap-1.5">
                <i class="ph-bold ph-clock text-orange-400"></i>
                ${formattedDate}
              </div>
            </div>
            ${getStatusBadge(job.status)}
          </div>

          <!-- Customer details -->
          <div class="pt-2 border-t border-slate-800/80">
            <h4 class="text-base font-bold text-white">${escapeHtml(job.name)}</h4>
            <div class="flex items-center gap-2 text-xs text-orange-400 font-medium mt-1">
              <a href="tel:${escapeHtml(job.phone)}" class="hover:underline flex items-center gap-1">
                <i class="ph-bold ph-phone-call"></i> ${escapeHtml(job.phone)}
              </a>
              ${job.email ? `<span class="text-slate-600">|</span><span class="text-slate-400">${escapeHtml(job.email)}</span>` : ''}
            </div>
            <div class="flex items-start gap-1.5 text-xs text-slate-300 mt-2">
              <i class="ph-bold ph-map-pin text-slate-500 mt-0.5 shrink-0"></i>
              <span>${escapeHtml(job.address)}</span>
            </div>
          </div>

          <!-- Financial and Area details -->
          <div class="grid grid-cols-2 gap-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs">
            <div>
              <div class="text-slate-500">වර්ග අඩි:</div>
              <div class="font-bold text-slate-200">${Number(job.sqft || 0).toLocaleString()} sqft</div>
            </div>
            <div>
              <div class="text-slate-500">සම්පූර්ණ මිල:</div>
              <div class="font-bold text-slate-200">රු. ${Number(job.total || 0).toLocaleString()}</div>
            </div>
            <div>
              <div class="text-slate-500">Advance:</div>
              <div class="font-medium text-emerald-400">රු. ${Number(job.advance || 0).toLocaleString()}</div>
            </div>
            <div>
              <div class="text-slate-500">ඉතිරි (Due):</div>
              <div class="font-bold ${balance > 0 ? 'text-amber-400' : 'text-slate-400'}">රු. ${balance.toLocaleString()}</div>
            </div>
          </div>

          ${job.notes ? `
            <div class="text-xs text-slate-400 bg-slate-800/30 p-2.5 rounded-xl border border-slate-800">
              <strong class="text-slate-300">සටහන:</strong> ${escapeHtml(job.notes)}
            </div>
          ` : ''}
        </div>

        <!-- Action Links: Google Calendar & Google Maps -->
        <div class="pt-4 mt-4 border-t border-slate-800 flex items-center gap-2">
          <a href="${gCalUrl}" target="_blank" class="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow transition">
            <i class="ph-bold ph-google-logo text-sm"></i>
            Google Calendar වෙත
          </a>
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}" target="_blank" title="Google Maps" class="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition">
            <i class="ph-bold ph-navigation-arrow text-base"></i>
          </a>
        </div>
      `;

      return card;
    }

    // Google Calendar Link generator
    function generateGoogleCalendarUrl(job) {
      const start = new Date(job.scheduledDate);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours duration

      const formatGCal = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

      const title = encodeURIComponent(`Floor Painting: ${job.name} (${job.sqft} sqft)`);
      const location = encodeURIComponent(job.address);
      const balance = Math.max(0, (job.total || 0) - (job.advance || 0));

      const details = encodeURIComponent(
        `🎨 Floor Painting Project Appointment\n\n` +
        `👤 පාරිභෝගිකයා: ${job.name}\n` +
        `📞 දුරකථනය: ${job.phone}\n` +
        `✉️ Email: ${job.email || 'N/A'}\n` +
        `📍 ස්ථානය: ${job.address}\n` +
        `📐 ප්‍රමාණය: ${job.sqft} Sq Ft\n` +
        `💰 සම්පූර්ණ මිල: LKR ${job.total}\n` +
        `💵 පෙර ගෙවීම්: LKR ${job.advance || 0}\n` +
        `⚖️ ඉතිරි මුදල: LKR ${balance}\n` +
        `📝 සටහන්: ${job.notes || 'None'}\n`
      );

      let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGCal(start)}/${formatGCal(end)}&details=${details}&location=${location}`;
      if (job.email) {
        url += `&add=${encodeURIComponent(job.email)}`;
      }
      return url;
    }

    // Edit Modal Open & Save
    function openEditModal(id) {
      const job = window.jobsState.find(j => j.id === id);
      if (!job) return;

      document.getElementById('edit-id').value = job.id;
      document.getElementById('edit-name').value = job.name || '';
      document.getElementById('edit-phone').value = job.phone || '';
      document.getElementById('edit-email').value = job.email || '';
      document.getElementById('edit-address').value = job.address || '';
      document.getElementById('edit-sqft').value = job.sqft || '';
      document.getElementById('edit-date').value = job.scheduledDate || '';
      document.getElementById('edit-total').value = job.total || 0;
      document.getElementById('edit-advance').value = job.advance || 0;
      document.getElementById('edit-status').value = job.status || 'SCHEDULED';
      document.getElementById('edit-notes').value = job.notes || '';

      document.getElementById('edit-modal').classList.remove('hidden');
    }

    function closeEditModal() {
      document.getElementById('edit-modal').classList.add('hidden');
    }

    async function handleSaveEdit(e) {
      e.preventDefault();
      const id = document.getElementById('edit-id').value;
      const job = window.jobsState.find(j => j.id === id);
      if (!job) return;

      const updatedJob = {
        ...job,
        name: document.getElementById('edit-name').value.trim(),
        phone: document.getElementById('edit-phone').value.trim(),
        email: document.getElementById('edit-email').value.trim(),
        address: document.getElementById('edit-address').value.trim(),
        sqft: parseFloat(document.getElementById('edit-sqft').value) || 0,
        scheduledDate: document.getElementById('edit-date').value,
        total: parseFloat(document.getElementById('edit-total').value) || 0,
        advance: parseFloat(document.getElementById('edit-advance').value) || 0,
        status: document.getElementById('edit-status').value,
        notes: document.getElementById('edit-notes').value.trim()
      };

      await window.cloudSaveJob(updatedJob);
      await syncCalendarAfterSave(updatedJob);
      closeEditModal();
      showToast('ඇණවුමේ විස්තර Cloud එකෙහි වෙනස් විය!', 'success');
    }

    async function deleteJobConfirm(id) {
      // Custom confirmation inside container
      const ok = window.confirm("මෙම ඇණවුම Cloud වෙතින් සම්පූර්ණයෙන්ම මකා දැමීමට ඔබට අවශ්‍යද?");
      if (!ok) return;

      await window.cloudDeleteJob(id);
      await syncCalendarAfterDelete(id);
      showToast('ඇණවුම Cloud එකෙන් මකා දමන ලදි.', 'success');
    }

    // Config Modal
    function openConfigModal() {
      const cfg = localStorage.getItem('FLOOR_PAINT_FIREBASE_CONFIG');
      if (cfg) document.getElementById('firebase-config-input').value = cfg;
      document.getElementById('google-calendar-client-id').value = localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || '';
      updateGoogleCalendarStatus();
      document.getElementById('config-modal').classList.remove('hidden');
    }

    function updateGoogleCalendarStatus(message) {
      const status = document.getElementById('google-calendar-status');
      if (!status) return;
      if (message) {
        status.innerText = message;
      } else if (googleAccessToken && Date.now() < googleTokenExpiresAt) {
        status.innerText = 'Google Calendar සම්බන්ධයි (මෙම session එකට)';
      } else {
        googleAccessToken = null;
        status.innerText = 'Google සම්බන්ධ කර නැත';
      }
    }

    function loadGoogleIdentityServices() {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        return Promise.resolve();
      }
      if (!googleIdentityScriptPromise) {
        googleIdentityScriptPromise = new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.onload = resolve;
          script.onerror = () => reject(new Error('Google Sign-In library could not be loaded.'));
          document.head.appendChild(script);
        });
      }
      return googleIdentityScriptPromise;
    }

    async function requestGoogleCalendarAccess(clientId) {
      await loadGoogleIdentityServices();
      googleTokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_CALENDAR_SCOPE,
        callback: (response) => {
          if (response.error) {
            googleTokenResult.reject(new Error(response.error_description || response.error));
            googleTokenResult = null;
            return;
          }
          googleAccessToken = response.access_token;
          googleTokenExpiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
          googleTokenResult.resolve();
          googleTokenResult = null;
        },
        error_callback: (error) => {
          if (googleTokenResult) {
            googleTokenResult.reject(new Error(error.message || 'Google sign-in popup failed.'));
            googleTokenResult = null;
          }
        }
      });

      await new Promise((resolve, reject) => {
        googleTokenResult = { resolve, reject };
        googleTokenClient.requestAccessToken({ prompt: 'consent' });
      });
    }

    async function googleCalendarRequest(path, options = {}) {
      if (!googleAccessToken || Date.now() >= googleTokenExpiresAt) {
        googleAccessToken = null;
        updateGoogleCalendarStatus('Google token කල් ඉකුත් වී ඇත. නැවත සම්බන්ධ කරන්න.');
        throw new Error('Google Calendar session expired. Reconnect Google Calendar in Firebase settings.');
      }

      const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      if (response.status === 204) return null;

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error && result.error.message ? result.error.message : `Google Calendar request failed (${response.status}).`);
      }
      return result;
    }

    function calendarEventForJob(job) {
      const start = new Date(job.scheduledDate);
      if (Number.isNaN(start.getTime())) {
        throw new Error(`Invalid scheduled date for ${job.name || job.id}.`);
      }
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const balance = Math.max(0, (job.total || 0) - (job.advance || 0));
      const description = [
        'Floor Painting Project Appointment',
        `Customer: ${job.name}`,
        `Phone: ${job.phone}`,
        `Email: ${job.email || 'N/A'}`,
        `Area: ${job.sqft} Sq Ft`,
        `Total: LKR ${job.total}`,
        `Advance: LKR ${job.advance || 0}`,
        `Due: LKR ${balance}`,
        `Status: ${job.status}`,
        `Notes: ${job.notes || 'None'}`
      ].join('\n');

      const event = {
        summary: `Floor Painting: ${job.name} (${job.sqft} sqft)`,
        location: job.address || '',
        description,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        extendedProperties: { private: { floorPaintJobId: String(job.id) } }
      };
      if (job.email) event.attendees = [{ email: job.email }];
      return event;
    }

    async function findCalendarEventsForJob(jobId) {
      const params = new URLSearchParams({
        privateExtendedProperty: `floorPaintJobId=${jobId}`,
        maxResults: '250'
      });
      const result = await googleCalendarRequest(`/calendars/primary/events?${params}`);
      return result.items || [];
    }

    async function syncCalendarJob(job, sendUpdates = job.email ? 'all' : 'none') {
      const event = calendarEventForJob(job);
      const matches = await findCalendarEventsForJob(job.id);
      if (matches.length) {
        const [primary, ...duplicates] = matches;
        await googleCalendarRequest(`/calendars/primary/events/${encodeURIComponent(primary.id)}?sendUpdates=${sendUpdates}`, {
          method: 'PUT',
          body: JSON.stringify(event)
        });
        for (const duplicate of duplicates) {
          await googleCalendarRequest(`/calendars/primary/events/${encodeURIComponent(duplicate.id)}?sendUpdates=${sendUpdates}`, { method: 'DELETE' });
        }
      } else {
        await googleCalendarRequest(`/calendars/primary/events?sendUpdates=${sendUpdates}`, {
          method: 'POST',
          body: JSON.stringify(event)
        });
      }
    }

    async function syncCalendarAfterSave(job) {
      if (!googleAccessToken) return;
      try {
        await syncCalendarJob(job);
        showToast('Job එක Google Calendar සමඟ Sync විය.', 'success');
      } catch (err) {
        updateGoogleCalendarStatus('Calendar sync දෝෂයක්. නැවත සම්බන්ධ කරන්න.');
        showToast('Job එක සුරැකිණි, නමුත් Calendar Sync අසාර්ථකයි: ' + err.message, 'error');
      }
    }

    async function syncCalendarAfterDelete(jobId) {
      if (!googleAccessToken) return;
      try {
        const matches = await findCalendarEventsForJob(jobId);
        for (const event of matches) {
          await googleCalendarRequest(`/calendars/primary/events/${encodeURIComponent(event.id)}?sendUpdates=all`, { method: 'DELETE' });
        }
      } catch (err) {
        updateGoogleCalendarStatus('Calendar sync දෝෂයක්. නැවත සම්බන්ධ කරන්න.');
        showToast('Job එක මකා දැමුවා, නමුත් Calendar event එක මැකීම අසාර්ථකයි: ' + err.message, 'error');
      }
    }

    async function connectGoogleCalendar() {
      const clientId = document.getElementById('google-calendar-client-id').value.trim();
      if (!clientId) {
        showToast('පළමුව Google OAuth Client ID එක ඇතුළත් කරන්න.', 'error');
        return;
      }
      if (location.protocol === 'file:') {
        showToast('Google සම්බන්ධ කිරීමට VS Code Live Server වැනි localhost web server එකකින් app එක විවෘත කරන්න.', 'error');
        return;
      }

      localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId);
      updateGoogleCalendarStatus('Google සමඟ සම්බන්ධ වෙමින්...');
      try {
        await requestGoogleCalendarAccess(clientId);
        for (const job of (window.jobsState || [])) {
          if (!DEMO_JOB_IDS.has(String(job.id))) {
            await syncCalendarJob(job, 'none');
          }
        }
        updateGoogleCalendarStatus();
        showToast('Google Calendar සම්බන්ධ කර ඇති අතර සියලුම jobs Sync කරන ලදි.', 'success');
      } catch (err) {
        googleAccessToken = null;
        updateGoogleCalendarStatus('Google සම්බන්ධ කිරීම අසාර්ථකයි.');
        showToast('Google Calendar සම්බන්ධ කිරීම අසාර්ථකයි: ' + err.message, 'error');
      }
    }
    window.connectGoogleCalendar = connectGoogleCalendar;

    function disconnectGoogleCalendar() {
      if (googleAccessToken && window.google && window.google.accounts && window.google.accounts.oauth2) {
        window.google.accounts.oauth2.revoke(googleAccessToken, () => {});
      }
      googleAccessToken = null;
      googleTokenExpiresAt = 0;
      updateGoogleCalendarStatus('Google Calendar වෙතින් ඉවත් විය.');
    }
    window.disconnectGoogleCalendar = disconnectGoogleCalendar;

    function closeConfigModal() {
      document.getElementById('config-modal').classList.add('hidden');
    }

    function saveFirebaseConfig() {
      const val = document.getElementById('firebase-config-input').value.trim();
      if (!val) {
        showToast('කරුණාකර Firebase Config එක ඇතුළත් කරන්න.', 'error');
        return;
      }
      try {
        JSON.parse(val);
        localStorage.setItem('FLOOR_PAINT_FIREBASE_CONFIG', val);
        showToast('Firebase Config සාර්ථකව සුරකින ලදි. පිටුව නැවත විවෘත වේ...', 'success');
        setTimeout(() => location.reload(), 1200);
      } catch (err) {
        showToast('වලංගු නොවන JSON ආකෘතියකි.', 'error');
      }
    }

    // Refresh Data trigger
    function refreshData() {
      renderJobsTable();
      renderScheduleView();
      showToast('දත්ත Refresh කරන ලදි.', 'success');
    }

    // Global renderer called on snapshots
    window.renderAllViews = function() {
      document.getElementById('badge-total-jobs').innerText = (window.jobsState || []).length;
      renderJobsTable();
      renderScheduleView();
    };

    // Helper utilities
    function getStatusBadge(status) {
      switch (status) {
        case 'COMPLETED':
          return '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"><i class="ph-bold ph-check"></i> අවසන්</span>';
        case 'IN_PROGRESS':
          return '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30"><i class="ph-bold ph-arrows-clockwise"></i> කරමින් පවතී</span>';
        case 'CANCELLED':
          return '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30"><i class="ph-bold ph-x"></i> අවලංගුයි</span>';
        case 'SCHEDULED':
        default:
          return '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30"><i class="ph-bold ph-clock"></i> නියමිතයි</span>';
      }
    }

    function getRelativeTimeLabel(dateString) {
      const jobDate = new Date(dateString);
      const today = new Date();
      today.setHours(0,0,0,0);
      const target = new Date(jobDate);
      target.setHours(0,0,0,0);

      const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'අද (Today)';
      if (diffDays === 1) return 'හෙට (Tomorrow)';
      if (diffDays === 2) return 'අනිද්දා (In 2 days)';
      if (diffDays > 2) return `දින ${diffDays} කින් ඉදිරියට`;
      if (diffDays === -1) return 'ඊයේ (Yesterday)';
      return `දින ${Math.abs(diffDays)} කට පෙර`;
    }

    function escapeHtml(text) {
      if (!text) return '';
      return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function fillSampleForm() {
      const pad = (n) => String(n).padStart(2, '0');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      document.getElementById('cust-name').value = 'සම්පත් ජයසිංහ';
      document.getElementById('cust-phone').value = '0779988776';
      document.getElementById('cust-email').value = 'sampath.jaya@gmail.com';
      document.getElementById('cust-address').value = 'නො. 84, පරණ පාර, මහරගම';
      document.getElementById('cust-sqft').value = '1750';
      document.getElementById('cust-total').value = '160000';
      document.getElementById('cust-advance').value = '60000';
      document.getElementById('cust-date').value = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}T10:00`;
      document.getElementById('cust-notes').value = 'Heavy-duty polyurethane floor finish for automobile workshop';
      calculateBalance();
      showToast('නියැදි (Sample) දත්ත පෝරමයට පුරවන ලදි.');
    }

    // Clock init
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('live-date-header').innerText = new Date().toLocaleDateString('si-LK', options);
