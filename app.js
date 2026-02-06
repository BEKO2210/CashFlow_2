(function(){
'use strict';

var DB_KEY = 'cashflow_v2';
var MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

var state = {
  income: 0,
  incomeExtra: 0,
  fixCosts: [],
  varBudgets: [],
  currentMonth: null,
  onboarded: false,
  months: {}
};

function getMonthKey(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function getMonthLabel(key) {
  if (!key) return '';
  var parts = key.split('-');
  return MONTHS_DE[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
}

function save() {
  try {
    var key = state.currentMonth || getMonthKey();
    state.months[key] = {
      income: state.income,
      incomeExtra: state.incomeExtra,
      fixCosts: state.fixCosts,
      varBudgets: state.varBudgets
    };
    localStorage.setItem(DB_KEY, JSON.stringify(state));
  } catch (e) {}
}

function load() {
  try {
    var raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      raw = localStorage.getItem('cashflow_data');
    }
    if (raw) {
      var parsed = JSON.parse(raw);
      state.income = parsed.income || 0;
      state.incomeExtra = parsed.incomeExtra || 0;
      state.fixCosts = parsed.fixCosts || [];
      state.varBudgets = parsed.varBudgets || [];
      state.currentMonth = parsed.currentMonth || getMonthKey();
      state.onboarded = parsed.onboarded || false;
      state.months = parsed.months || {};
      if (state.months[state.currentMonth]) {
        var m = state.months[state.currentMonth];
        state.income = m.income;
        state.incomeExtra = m.incomeExtra;
        state.fixCosts = m.fixCosts;
        state.varBudgets = m.varBudgets;
      }
    }
  } catch (e) {
    state = { income: 0, incomeExtra: 0, fixCosts: [], varBudgets: [], currentMonth: getMonthKey(), onboarded: false, months: {} };
  }
}

/* ====================== UTILS ====================== */

function $(id) { return document.getElementById(id); }

function formatCurrency(n) {
  var abs = Math.abs(n);
  var formatted = abs.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (n < 0 ? '\u2212' : '') + formatted + '\u2009€';
}

function parseAmount(str) {
  if (!str) return 0;
  var cleaned = str.replace(/[^0-9.,\-]/g, '').replace(/,/g, '.');
  var num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

function sumArray(arr) {
  var total = 0;
  for (var i = 0; i < arr.length; i++) total += arr[i].amount;
  return total;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function haptic() {
  if (navigator.vibrate) navigator.vibrate(8);
}

/* ====================== TOAST ====================== */

var toastTimer = null;
function showToast(msg) {
  var el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  requestAnimationFrame(function() {
    el.classList.add('show');
  });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() {
    el.classList.remove('show');
    setTimeout(function() { el.classList.add('hidden'); }, 350);
  }, 2200);
}

/* ====================== ANIMATED COUNTER ====================== */

function animateValue(el, start, end, duration) {
  if (start === end) {
    el.textContent = formatCurrency(end);
    return;
  }
  var startTime = null;
  var diff = end - start;
  function step(ts) {
    if (!startTime) startTime = ts;
    var progress = Math.min((ts - startTime) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = Math.round(start + diff * eased);
    el.textContent = formatCurrency(current);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ====================== SCREENS ====================== */

var screens = {
  onboarding: $('screen-onboarding'),
  dashboard: $('screen-dashboard'),
  fixkosten: $('screen-fixkosten'),
  variable: $('screen-variable'),
  settings: $('screen-settings')
};

var currentScreen = '';
var prevValues = { fix: 0, variable: 0, free: 0, income: 0 };

function showScreen(name) {
  for (var key in screens) {
    if (screens[key]) screens[key].classList.add('hidden');
  }
  if (screens[name]) {
    screens[name].classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  currentScreen = name;
}

/* ====================== ONBOARDING ====================== */

var inputIncome = $('input-income');
var inputIncomeExtra = $('input-income-extra');
var btnStart = $('btn-start');

function validateOnboarding() {
  var val = parseAmount(inputIncome.value);
  btnStart.disabled = val <= 0;
}

inputIncome.addEventListener('input', validateOnboarding);
inputIncomeExtra.addEventListener('input', validateOnboarding);

btnStart.addEventListener('click', function() {
  var inc = parseAmount(inputIncome.value);
  if (inc <= 0) return;
  haptic();
  state.income = inc;
  state.incomeExtra = parseAmount(inputIncomeExtra.value);
  state.onboarded = true;
  state.currentMonth = getMonthKey();
  prevValues = { fix: 0, variable: 0, free: 0, income: 0 };
  save();
  showScreen('dashboard');
  renderDashboard();
});

/* ====================== DASHBOARD ====================== */

function getTotalIncome() {
  return state.income + state.incomeExtra;
}

function renderDashboard() {
  var total = getTotalIncome();
  var fix = sumArray(state.fixCosts);
  var variable = sumArray(state.varBudgets);
  var free = total - fix - variable;
  var fixPct = total > 0 ? (fix / total) * 100 : 0;
  var varPct = total > 0 ? (variable / total) * 100 : 0;
  var freePct = total > 0 ? (free / total) * 100 : 0;

  animateValue($('dash-income'), prevValues.income, total, 500);
  $('month-selector').textContent = getMonthLabel(state.currentMonth);

  var barFix = $('bar-fix');
  var barVar = $('bar-var');
  var barFree = $('bar-free');

  if (total <= 0) {
    barFix.style.width = '0%';
    barVar.style.width = '0%';
    barFree.style.width = '100%';
  } else if (free < 0) {
    var overflowTotal = fix + variable;
    barFix.style.width = (fix / overflowTotal * 100) + '%';
    barVar.style.width = (variable / overflowTotal * 100) + '%';
    barFree.style.width = '0%';
  } else {
    barFix.style.width = fixPct + '%';
    barVar.style.width = varPct + '%';
    barFree.style.width = Math.max(freePct, 0) + '%';
  }

  animateValue($('metric-fix'), prevValues.fix, fix, 400);
  $('metric-fix-pct').textContent = fixPct.toFixed(0) + '% des Einkommens';

  animateValue($('metric-var'), prevValues.variable, variable, 400);
  $('metric-var-pct').textContent = varPct.toFixed(0) + '% des Einkommens';

  animateValue($('metric-free'), prevValues.free, free, 400);

  var freeCard = document.querySelector('.metric-card--free');
  if (free < 0) {
    freeCard.classList.add('negative');
    $('metric-free-pct').textContent = 'Defizit!';
  } else {
    freeCard.classList.remove('negative');
    $('metric-free-pct').textContent = freePct.toFixed(0) + '% frei verf\u00fcgbar';
  }

  prevValues = { fix: fix, variable: variable, free: free, income: total };
  renderInsight(fixPct, freePct, free);
}

function renderInsight(fixPct, freePct, free) {
  var card = $('insight-card');
  var icon = $('insight-icon');
  var text = $('insight-text');

  card.className = 'insight-card';

  if (free < 0) {
    card.classList.add('insight-card--critical');
    card.classList.remove('hidden');
    icon.textContent = '\u{1F6A8}';
    text.textContent = 'Du planst \u00fcber dein Einkommen. Reduziere Kosten oder erh\u00f6he dein Einkommen.';
    return;
  }
  if (fixPct > 50) {
    card.classList.add('insight-card--warning');
    card.classList.remove('hidden');
    icon.textContent = '\u{26A0}\u{FE0F}';
    text.textContent = 'Deine Fixkosten liegen bei \u00fcber 50\u2009%. Das schr\u00e4nkt deine Flexibilit\u00e4t ein.';
    return;
  }
  var usedPct = 100 - freePct;
  if (usedPct > 85) {
    card.classList.add('insight-card--danger');
    card.classList.remove('hidden');
    icon.textContent = '\u{26A0}\u{FE0F}';
    text.textContent = 'Dein Monat ist fast ausgesch\u00f6pft. Nur wenig Puffer \u00fcbrig.';
    return;
  }
  if (freePct > 30) {
    card.classList.add('insight-card--success');
    card.classList.remove('hidden');
    icon.textContent = '\u{1F525}';
    text.textContent = 'Starke finanzielle Flexibilit\u00e4t. \u00dcber 30\u2009% deines Einkommens ist frei.';
    return;
  }
  card.classList.add('hidden');
}

/* ====================== FIXKOSTEN ====================== */

function renderFixList() {
  var list = $('fix-list');
  list.innerHTML = '';
  var total = 0;

  for (var i = 0; i < state.fixCosts.length; i++) {
    var item = state.fixCosts[i];
    total += item.amount;
    list.appendChild(createCostItem(item, 'fix', i));
  }

  $('fix-total').textContent = formatCurrency(total);
  updateUsedChips('fix');
}

function createCostItem(item, type, index) {
  var div = document.createElement('div');
  div.className = 'cost-item';
  div.setAttribute('data-id', item.id);
  div.style.animationDelay = (index * 0.04) + 's';

  var nameSpan = document.createElement('span');
  nameSpan.className = 'cost-item-name';
  nameSpan.textContent = item.name;

  var amountSpan = document.createElement('span');
  amountSpan.className = 'cost-item-amount';
  amountSpan.textContent = formatCurrency(item.amount);

  var delBtn = document.createElement('button');
  delBtn.className = 'cost-item-delete';
  delBtn.setAttribute('aria-label', item.name + ' l\u00f6schen');
  delBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>';
  delBtn.addEventListener('click', function() {
    haptic();
    if (type === 'fix') deleteFixCost(item.id);
    else deleteVarBudget(item.id);
  });

  div.appendChild(nameSpan);
  div.appendChild(amountSpan);
  div.appendChild(delBtn);

  if (type === 'var') {
    var maxBudget = getTotalIncome();
    var sliderRow = document.createElement('div');
    sliderRow.className = 'slider-row';

    var slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = String(Math.max(maxBudget * 0.5, item.amount * 2, 500));
    slider.step = '10';
    slider.value = String(item.amount);
    slider.setAttribute('aria-label', item.name + ' Budget anpassen');

    var sliderVal = document.createElement('span');
    sliderVal.className = 'slider-val';
    sliderVal.textContent = formatCurrency(item.amount);

    slider.addEventListener('input', (function(id, valEl, amEl) {
      return function(e) {
        var newAmount = parseFloat(e.target.value);
        for (var j = 0; j < state.varBudgets.length; j++) {
          if (state.varBudgets[j].id === id) {
            state.varBudgets[j].amount = newAmount;
            break;
          }
        }
        valEl.textContent = formatCurrency(newAmount);
        amEl.textContent = formatCurrency(newAmount);
        $('var-total').textContent = formatCurrency(sumArray(state.varBudgets));
        save();
      };
    })(item.id, sliderVal, amountSpan));

    sliderRow.appendChild(slider);
    sliderRow.appendChild(sliderVal);
    div.appendChild(sliderRow);
  }

  return div;
}

function addFixCost(name, amount) {
  if (!name || amount <= 0) return;
  state.fixCosts.push({ id: genId(), name: name, amount: amount });
  save();
  renderFixList();
  showToast(name + ' hinzugef\u00fcgt');
}

function deleteFixCost(id) {
  var el = document.querySelector('#screen-fixkosten .cost-item[data-id="' + id + '"]');
  if (el) {
    el.classList.add('removing');
    el.addEventListener('animationend', function() {
      state.fixCosts = state.fixCosts.filter(function(c) { return c.id !== id; });
      save();
      renderFixList();
    });
  }
}

$('fix-add').addEventListener('click', function() {
  var name = $('fix-name').value.trim();
  var amount = parseAmount($('fix-amount').value);
  if (!name || amount <= 0) return;
  haptic();
  addFixCost(name, amount);
  $('fix-name').value = '';
  $('fix-amount').value = '';
  $('fix-name').focus();
});

$('fix-amount').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); $('fix-add').click(); }
});
$('fix-name').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); $('fix-amount').focus(); }
});

$('fix-chips').addEventListener('click', function(e) {
  var chip = e.target.closest('.chip');
  if (!chip || chip.classList.contains('used')) return;
  haptic();
  $('fix-name').value = chip.getAttribute('data-name');
  $('fix-amount').value = '';
  $('fix-amount').focus();
});

/* ====================== VARIABLE BUDGETS ====================== */

function renderVarList() {
  var list = $('var-list');
  list.innerHTML = '';
  var total = 0;

  for (var i = 0; i < state.varBudgets.length; i++) {
    var item = state.varBudgets[i];
    total += item.amount;
    list.appendChild(createCostItem(item, 'var', i));
  }

  $('var-total').textContent = formatCurrency(total);
  updateUsedChips('var');
}

function addVarBudget(name, amount) {
  if (!name || amount <= 0) return;
  state.varBudgets.push({ id: genId(), name: name, amount: amount });
  save();
  renderVarList();
  showToast(name + ' hinzugef\u00fcgt');
}

function deleteVarBudget(id) {
  var el = document.querySelector('#screen-variable .cost-item[data-id="' + id + '"]');
  if (el) {
    el.classList.add('removing');
    el.addEventListener('animationend', function() {
      state.varBudgets = state.varBudgets.filter(function(c) { return c.id !== id; });
      save();
      renderVarList();
    });
  }
}

$('var-add').addEventListener('click', function() {
  var name = $('var-name').value.trim();
  var amount = parseAmount($('var-amount').value);
  if (!name || amount <= 0) return;
  haptic();
  addVarBudget(name, amount);
  $('var-name').value = '';
  $('var-amount').value = '';
  $('var-name').focus();
});

$('var-amount').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); $('var-add').click(); }
});
$('var-name').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); $('var-amount').focus(); }
});

$('var-chips').addEventListener('click', function(e) {
  var chip = e.target.closest('.chip');
  if (!chip || chip.classList.contains('used')) return;
  haptic();
  $('var-name').value = chip.getAttribute('data-name');
  $('var-amount').value = '';
  $('var-amount').focus();
});

/* ====================== CHIPS ====================== */

function updateUsedChips(type) {
  var container = type === 'fix' ? $('fix-chips') : $('var-chips');
  var items = type === 'fix' ? state.fixCosts : state.varBudgets;
  var usedNames = items.map(function(i) { return i.name.toLowerCase(); });
  var chips = container.querySelectorAll('.chip');
  for (var i = 0; i < chips.length; i++) {
    var chipName = chips[i].getAttribute('data-name').toLowerCase();
    chips[i].classList.toggle('used', usedNames.indexOf(chipName) >= 0);
  }
}

/* ====================== NAVIGATION ====================== */

$('nav-fix').addEventListener('click', function() {
  haptic();
  showScreen('fixkosten');
  renderFixList();
});

$('nav-var').addEventListener('click', function() {
  haptic();
  showScreen('variable');
  renderVarList();
});

$('back-fix').addEventListener('click', function() {
  haptic();
  showScreen('dashboard');
  renderDashboard();
});

$('back-var').addEventListener('click', function() {
  haptic();
  showScreen('dashboard');
  renderDashboard();
});

$('btn-settings').addEventListener('click', function() {
  haptic();
  $('settings-income').value = state.income || '';
  $('settings-income-extra').value = state.incomeExtra || '';
  showScreen('settings');
});

$('back-settings').addEventListener('click', function() {
  haptic();
  showScreen('dashboard');
  renderDashboard();
});

$('btn-save-settings').addEventListener('click', function() {
  var inc = parseAmount($('settings-income').value);
  if (inc <= 0) return;
  haptic();
  state.income = inc;
  state.incomeExtra = parseAmount($('settings-income-extra').value);
  save();
  showScreen('dashboard');
  renderDashboard();
  showToast('Einstellungen gespeichert');
});

$('btn-reset').addEventListener('click', function() {
  if (confirm('Alle Daten unwiderruflich l\u00f6schen?')) {
    haptic();
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem('cashflow_data');
    state = { income: 0, incomeExtra: 0, fixCosts: [], varBudgets: [], currentMonth: getMonthKey(), onboarded: false, months: {} };
    prevValues = { fix: 0, variable: 0, free: 0, income: 0 };
    showScreen('onboarding');
    inputIncome.value = '';
    inputIncomeExtra.value = '';
    btnStart.disabled = true;
    showToast('Daten gel\u00f6scht');
  }
});

/* ====================== MONTH SWITCH ====================== */

$('btn-new-month').addEventListener('click', function() {
  haptic();
  $('modal-month').classList.remove('hidden');
});

$('month-cancel').addEventListener('click', function() {
  $('modal-month').classList.add('hidden');
});

$('modal-backdrop').addEventListener('click', function() {
  $('modal-month').classList.add('hidden');
});

$('month-carry').addEventListener('click', function() {
  haptic();
  save();
  var now = new Date();
  var next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  state.currentMonth = getMonthKey(next);
  save();
  $('modal-month').classList.add('hidden');
  renderDashboard();
  showToast('Monat gewechselt \u2013 Werte \u00fcbernommen');
});

$('month-fresh').addEventListener('click', function() {
  haptic();
  save();
  var now = new Date();
  var next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  state.currentMonth = getMonthKey(next);
  state.fixCosts = [];
  state.varBudgets = [];
  prevValues = { fix: 0, variable: 0, free: 0, income: state.income + state.incomeExtra };
  save();
  $('modal-month').classList.add('hidden');
  renderDashboard();
  showToast('Neuer Monat gestartet');
});

/* ====================== SWIPE BACK ====================== */

var touchStartX = 0;
var touchStartY = 0;

document.addEventListener('touchstart', function(e) {
  touchStartX = e.changedTouches[0].clientX;
  touchStartY = e.changedTouches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', function(e) {
  var dx = e.changedTouches[0].clientX - touchStartX;
  var dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
  if (dx > 80 && dy < 60 && touchStartX < 40) {
    if (currentScreen === 'fixkosten') { $('back-fix').click(); }
    else if (currentScreen === 'variable') { $('back-var').click(); }
    else if (currentScreen === 'settings') { $('back-settings').click(); }
  }
}, { passive: true });

/* ====================== PWA INSTALL ====================== */

var deferredPrompt = null;
var installBanner = $('install-banner');

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  if (isStandalone()) return;
  deferredPrompt = e;
  installBanner.classList.remove('hidden');
});

$('install-btn').addEventListener('click', function() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(function() {
    deferredPrompt = null;
    installBanner.classList.add('hidden');
  });
});

$('install-dismiss').addEventListener('click', function() {
  installBanner.classList.add('hidden');
  deferredPrompt = null;
});

window.addEventListener('appinstalled', function() {
  installBanner.classList.add('hidden');
  deferredPrompt = null;
});

/* ====================== SERVICE WORKER ====================== */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('service-worker.js').catch(function() {});
  });
}

/* ====================== KEYBOARD NAV ====================== */

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (!$('modal-month').classList.contains('hidden')) {
      $('modal-month').classList.add('hidden');
      return;
    }
    if (currentScreen === 'fixkosten') $('back-fix').click();
    else if (currentScreen === 'variable') $('back-var').click();
    else if (currentScreen === 'settings') $('back-settings').click();
  }
});

/* ====================== INIT ====================== */

function init() {
  load();
  if (state.onboarded && state.income > 0) {
    prevValues = {
      fix: sumArray(state.fixCosts),
      variable: sumArray(state.varBudgets),
      free: getTotalIncome() - sumArray(state.fixCosts) - sumArray(state.varBudgets),
      income: getTotalIncome()
    };
    showScreen('dashboard');
    renderDashboard();
  } else {
    showScreen('onboarding');
  }
}

init();

})();
