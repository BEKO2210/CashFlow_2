(function(){
'use strict';

var DB_KEY = 'cashflow_data';
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
  } catch (e) { /* quota exceeded fallback */ }
}

function load() {
  try {
    var raw = localStorage.getItem(DB_KEY);
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

function $(id) { return document.getElementById(id); }
function formatCurrency(n) {
  var abs = Math.abs(n);
  var formatted = abs.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (n < 0 ? '-' : '') + formatted + ' €';
}

function parseAmount(str) {
  if (!str) return 0;
  var cleaned = str.replace(/[^0-9.,\-]/g, '').replace(/,/g, '.');
  var num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

function sumArray(arr) {
  var total = 0;
  for (var i = 0; i < arr.length; i++) {
    total += arr[i].amount;
  }
  return total;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/* ====================== SCREENS ====================== */

var screens = {
  onboarding: $('screen-onboarding'),
  dashboard: $('screen-dashboard'),
  fixkosten: $('screen-fixkosten'),
  variable: $('screen-variable'),
  settings: $('screen-settings')
};

function showScreen(name) {
  for (var key in screens) {
    if (screens[key]) {
      screens[key].classList.add('hidden');
    }
  }
  if (screens[name]) {
    screens[name].classList.remove('hidden');
    screens[name].scrollTop = 0;
    window.scrollTo(0, 0);
  }
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
  state.income = inc;
  state.incomeExtra = parseAmount(inputIncomeExtra.value);
  state.onboarded = true;
  state.currentMonth = getMonthKey();
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

  $('dash-income').textContent = formatCurrency(total);
  $('month-selector').textContent = getMonthLabel(state.currentMonth);

  /* Money Bar */
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

  /* Metrics */
  $('metric-fix').textContent = formatCurrency(fix);
  $('metric-fix-pct').textContent = fixPct.toFixed(0) + '% des Einkommens';
  $('metric-var').textContent = formatCurrency(variable);
  $('metric-var-pct').textContent = varPct.toFixed(0) + '% des Einkommens';
  $('metric-free').textContent = formatCurrency(free);

  var freeCard = document.querySelector('.metric-card--free');
  if (free < 0) {
    freeCard.classList.add('negative');
    $('metric-free-pct').textContent = 'Defizit!';
  } else {
    freeCard.classList.remove('negative');
    $('metric-free-pct').textContent = freePct.toFixed(0) + '% frei verfügbar';
  }

  /* Insight */
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
    text.textContent = 'Du planst über dein Einkommen. Reduziere Kosten oder erhöhe dein Einkommen.';
    return;
  }

  if (fixPct > 50) {
    card.classList.add('insight-card--warning');
    card.classList.remove('hidden');
    icon.textContent = '\u{26A0}\u{FE0F}';
    text.textContent = 'Deine Fixkosten liegen bei über 50%. Das schränkt deine Flexibilität ein.';
    return;
  }

  var usedPct = 100 - freePct;
  if (usedPct > 85) {
    card.classList.add('insight-card--danger');
    card.classList.remove('hidden');
    icon.textContent = '\u{26A0}\u{FE0F}';
    text.textContent = 'Dein Monat ist fast ausgeschöpft. Nur wenig Puffer übrig.';
    return;
  }

  if (freePct > 30) {
    card.classList.add('insight-card--success');
    card.classList.remove('hidden');
    icon.textContent = '\u{1F525}';
    text.textContent = 'Starke finanzielle Flexibilität. Über 30% deines Einkommens ist frei.';
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

    var div = document.createElement('div');
    div.className = 'cost-item';
    div.setAttribute('data-id', item.id);
    div.style.animationDelay = (i * 0.03) + 's';

    var nameSpan = document.createElement('span');
    nameSpan.className = 'cost-item-name';
    nameSpan.textContent = item.name;

    var amountSpan = document.createElement('span');
    amountSpan.className = 'cost-item-amount';
    amountSpan.textContent = formatCurrency(item.amount);

    var delBtn = document.createElement('button');
    delBtn.className = 'cost-item-delete';
    delBtn.setAttribute('aria-label', 'Löschen');
    delBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/></svg>';
    delBtn.addEventListener('click', (function(id) {
      return function() { deleteFixCost(id); };
    })(item.id));

    div.appendChild(nameSpan);
    div.appendChild(amountSpan);
    div.appendChild(delBtn);
    list.appendChild(div);
  }

  $('fix-total').textContent = formatCurrency(total);
  updateUsedChips('fix');
}

function addFixCost(name, amount) {
  if (!name || amount <= 0) return;
  state.fixCosts.push({ id: genId(), name: name, amount: amount });
  save();
  renderFixList();
}

function deleteFixCost(id) {
  var el = document.querySelector('.cost-item[data-id="' + id + '"]');
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
  addFixCost(name, amount);
  $('fix-name').value = '';
  $('fix-amount').value = '';
  $('fix-name').focus();
});

$('fix-amount').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    $('fix-add').click();
  }
});

$('fix-name').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    $('fix-amount').focus();
  }
});

/* Fix Quick Chips */
var fixChips = $('fix-chips');
fixChips.addEventListener('click', function(e) {
  var chip = e.target.closest('.chip');
  if (!chip || chip.classList.contains('used')) return;
  var name = chip.getAttribute('data-name');
  $('fix-name').value = name;
  $('fix-amount').value = '';
  $('fix-amount').focus();
});

/* ====================== VARIABLE BUDGETS ====================== */

function renderVarList() {
  var list = $('var-list');
  list.innerHTML = '';
  var total = 0;
  var maxBudget = getTotalIncome();

  for (var i = 0; i < state.varBudgets.length; i++) {
    var item = state.varBudgets[i];
    total += item.amount;

    var div = document.createElement('div');
    div.className = 'cost-item';
    div.setAttribute('data-id', item.id);
    div.style.animationDelay = (i * 0.03) + 's';

    var nameSpan = document.createElement('span');
    nameSpan.className = 'cost-item-name';
    nameSpan.textContent = item.name;

    var amountSpan = document.createElement('span');
    amountSpan.className = 'cost-item-amount';
    amountSpan.textContent = formatCurrency(item.amount);

    var delBtn = document.createElement('button');
    delBtn.className = 'cost-item-delete';
    delBtn.setAttribute('aria-label', 'Löschen');
    delBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/></svg>';
    delBtn.addEventListener('click', (function(id) {
      return function() { deleteVarBudget(id); };
    })(item.id));

    div.appendChild(nameSpan);
    div.appendChild(amountSpan);
    div.appendChild(delBtn);

    /* Slider Row */
    var sliderRow = document.createElement('div');
    sliderRow.className = 'slider-row';

    var slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = String(Math.max(maxBudget * 0.5, item.amount * 2, 500));
    slider.step = '10';
    slider.value = String(item.amount);
    slider.setAttribute('aria-label', item.name + ' Budget');

    var sliderVal = document.createElement('span');
    sliderVal.className = 'slider-val';
    sliderVal.textContent = formatCurrency(item.amount);

    slider.addEventListener('input', (function(id, valEl) {
      return function(e) {
        var newAmount = parseFloat(e.target.value);
        for (var j = 0; j < state.varBudgets.length; j++) {
          if (state.varBudgets[j].id === id) {
            state.varBudgets[j].amount = newAmount;
            break;
          }
        }
        valEl.textContent = formatCurrency(newAmount);
        var parentItem = e.target.closest('.cost-item');
        if (parentItem) {
          parentItem.querySelector('.cost-item-amount').textContent = formatCurrency(newAmount);
        }
        var t = sumArray(state.varBudgets);
        $('var-total').textContent = formatCurrency(t);
        save();
      };
    })(item.id, sliderVal));

    sliderRow.appendChild(slider);
    sliderRow.appendChild(sliderVal);

    div.style.flexWrap = 'wrap';
    sliderRow.style.width = '100%';
    div.appendChild(sliderRow);
    list.appendChild(div);
  }

  $('var-total').textContent = formatCurrency(total);
  updateUsedChips('var');
}

function addVarBudget(name, amount) {
  if (!name || amount <= 0) return;
  state.varBudgets.push({ id: genId(), name: name, amount: amount });
  save();
  renderVarList();
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
  addVarBudget(name, amount);
  $('var-name').value = '';
  $('var-amount').value = '';
  $('var-name').focus();
});

$('var-amount').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    $('var-add').click();
  }
});

$('var-name').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    $('var-amount').focus();
  }
});

/* Var Quick Chips */
var varChips = $('var-chips');
varChips.addEventListener('click', function(e) {
  var chip = e.target.closest('.chip');
  if (!chip || chip.classList.contains('used')) return;
  var name = chip.getAttribute('data-name');
  $('var-name').value = name;
  $('var-amount').value = '';
  $('var-amount').focus();
});

/* ====================== USED CHIPS ====================== */

function updateUsedChips(type) {
  var chipsContainer, items;
  if (type === 'fix') {
    chipsContainer = $('fix-chips');
    items = state.fixCosts;
  } else {
    chipsContainer = $('var-chips');
    items = state.varBudgets;
  }
  var usedNames = items.map(function(i) { return i.name.toLowerCase(); });
  var chips = chipsContainer.querySelectorAll('.chip');
  for (var i = 0; i < chips.length; i++) {
    var chipName = chips[i].getAttribute('data-name').toLowerCase();
    if (usedNames.indexOf(chipName) >= 0) {
      chips[i].classList.add('used');
    } else {
      chips[i].classList.remove('used');
    }
  }
}

/* ====================== NAVIGATION ====================== */

$('nav-fix').addEventListener('click', function() {
  showScreen('fixkosten');
  renderFixList();
});

$('nav-var').addEventListener('click', function() {
  showScreen('variable');
  renderVarList();
});

$('back-fix').addEventListener('click', function() {
  showScreen('dashboard');
  renderDashboard();
});

$('back-var').addEventListener('click', function() {
  showScreen('dashboard');
  renderDashboard();
});

$('btn-settings').addEventListener('click', function() {
  $('settings-income').value = state.income || '';
  $('settings-income-extra').value = state.incomeExtra || '';
  showScreen('settings');
});

$('back-settings').addEventListener('click', function() {
  showScreen('dashboard');
  renderDashboard();
});

$('btn-save-settings').addEventListener('click', function() {
  var inc = parseAmount($('settings-income').value);
  if (inc <= 0) return;
  state.income = inc;
  state.incomeExtra = parseAmount($('settings-income-extra').value);
  save();
  showScreen('dashboard');
  renderDashboard();
});

$('btn-reset').addEventListener('click', function() {
  if (confirm('Alle Daten unwiderruflich löschen?')) {
    localStorage.removeItem(DB_KEY);
    state = { income: 0, incomeExtra: 0, fixCosts: [], varBudgets: [], currentMonth: getMonthKey(), onboarded: false, months: {} };
    showScreen('onboarding');
    inputIncome.value = '';
    inputIncomeExtra.value = '';
    btnStart.disabled = true;
  }
});

/* ====================== MONTH SWITCH ====================== */

$('btn-new-month').addEventListener('click', function() {
  $('modal-month').classList.remove('hidden');
});

$('month-cancel').addEventListener('click', function() {
  $('modal-month').classList.add('hidden');
});

document.querySelector('.modal-backdrop').addEventListener('click', function() {
  $('modal-month').classList.add('hidden');
});

$('month-carry').addEventListener('click', function() {
  save();
  var now = new Date();
  var next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  state.currentMonth = getMonthKey(next);
  save();
  $('modal-month').classList.add('hidden');
  renderDashboard();
});

$('month-fresh').addEventListener('click', function() {
  save();
  var now = new Date();
  var next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  state.currentMonth = getMonthKey(next);
  state.fixCosts = [];
  state.varBudgets = [];
  save();
  $('modal-month').classList.add('hidden');
  renderDashboard();
});

/* ====================== PWA INSTALL ====================== */

var deferredPrompt = null;
var installBanner = $('install-banner');
var installBtn = $('install-btn');
var installDismiss = $('install-dismiss');

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  if (isStandalone()) return;
  deferredPrompt = e;
  installBanner.classList.remove('hidden');
});

installBtn.addEventListener('click', function() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(function() {
    deferredPrompt = null;
    installBanner.classList.add('hidden');
  });
});

installDismiss.addEventListener('click', function() {
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

/* ====================== INIT ====================== */

function init() {
  load();
  if (state.onboarded && state.income > 0) {
    showScreen('dashboard');
    renderDashboard();
  } else {
    showScreen('onboarding');
  }
}

init();

})();
