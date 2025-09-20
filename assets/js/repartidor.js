const STORAGE_KEYS = {
  deliveryAccounts: 'frigorifico_delivery_accounts'
};

const MANAGER_ACCOUNTS = [
  {
    username: 'Martin',
    password: '1234',
    displayName: 'Martin',
    role: 'manager'
  },
  {
    username: 'luca',
    password: 'Luca-admin',
    displayName: 'Luca',
    role: 'manager'
  }
];

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

let currentAccount = null;
let loginSectionRef = null;
let loginFormRef = null;
let loginErrorRef = null;
let processingSectionRef = null;
let processingBarRef = null;
let processingLabelRef = null;
let portalSectionRef = null;
let nameDisplayRef = null;
let logoutButtonRef = null;
let managementCardRef = null;
let accountsListRef = null;
let addAccountFormRef = null;
let addAccountMessageRef = null;
let infoMessageRef = null;
let addAccountMessageTimeout = null;
let receiptCardRef = null;
let receiptFormRef = null;
let receiptPreviewRef = null;
let receiptPrintButtonRef = null;
let receiptEditButtonRef = null;
let receiptLocationInputRef = null;
let receiptItemInputRef = null;
let receiptQuantityInputRef = null;
let receiptPersonInputRef = null;
let receiptSignatureInputRef = null;
let receiptLocalDisplayRef = null;
let receiptProductDisplayRef = null;
let receiptAmountDisplayRef = null;
let receiptPersonDisplayRef = null;
let receiptSignatureLineRef = null;
let receiptTimestampRef = null;
let receiptDraft = null;

document.addEventListener('DOMContentLoaded', () => {
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  activatePage();
  setupLinkTransitions();

  loginSectionRef = document.getElementById('deliveryLoginSection');
  loginFormRef = document.getElementById('deliveryLoginForm');
  loginErrorRef = document.getElementById('deliveryLoginError');
  processingSectionRef = document.getElementById('deliveryProcessingSection');
  processingBarRef = document.getElementById('deliveryProcessingBar');
  processingLabelRef = document.getElementById('deliveryProcessingPercent');
  portalSectionRef = document.getElementById('deliveryPanel');
  nameDisplayRef = document.getElementById('deliveryNameDisplay');
  logoutButtonRef = document.getElementById('deliveryLogoutButton');
  managementCardRef = document.getElementById('deliveryManagementCard');
  accountsListRef = document.getElementById('deliveryAccountsList');
  addAccountFormRef = document.getElementById('addDeliveryForm');
  addAccountMessageRef = document.getElementById('addDeliveryMessage');
  infoMessageRef = document.getElementById('deliveryInfoMessage');
  receiptCardRef = document.getElementById('deliveryReceiptCard');
  receiptFormRef = document.getElementById('deliveryReceiptForm');
  receiptPreviewRef = document.getElementById('deliveryReceiptPreview');
  receiptPrintButtonRef = document.getElementById('deliveryReceiptPrintButton');
  receiptEditButtonRef = document.getElementById('deliveryReceiptEditButton');
  receiptLocationInputRef = document.getElementById('deliveryReceiptLocation');
  receiptItemInputRef = document.getElementById('deliveryReceiptItem');
  receiptQuantityInputRef = document.getElementById('deliveryReceiptQuantity');
  receiptPersonInputRef = document.getElementById('deliveryReceiptPerson');
  receiptSignatureInputRef = document.getElementById('deliveryReceiptSignature');
  receiptLocalDisplayRef = document.getElementById('deliveryReceiptLocal');
  receiptProductDisplayRef = document.getElementById('deliveryReceiptProduct');
  receiptAmountDisplayRef = document.getElementById('deliveryReceiptAmount');
  receiptPersonDisplayRef = document.getElementById('deliveryReceiptPersonName');
  receiptSignatureLineRef = document.getElementById('deliveryReceiptSignatureLine');
  receiptTimestampRef = document.getElementById('deliveryReceiptTimestamp');

  if (loginFormRef) {
    loginFormRef.addEventListener('submit', handleLoginSubmit);
  }

  if (logoutButtonRef) {
    logoutButtonRef.addEventListener('click', handleLogout);
  }

  if (addAccountFormRef) {
    addAccountFormRef.addEventListener('submit', handleAddDeliveryAccount);
  }

  if (accountsListRef) {
    accountsListRef.addEventListener('click', handleAccountsListClick);
  }

  if (receiptFormRef) {
    receiptFormRef.addEventListener('submit', handleReceiptSubmit);
  }

  if (receiptEditButtonRef) {
    receiptEditButtonRef.addEventListener('click', handleReceiptEditClick);
  }

  if (receiptPrintButtonRef) {
    receiptPrintButtonRef.addEventListener('click', handleReceiptPrintClick);
  }

  resetReceiptSection();
});

function handleLoginSubmit(event) {
  event.preventDefault();

  if (!loginFormRef) {
    return;
  }

  const formData = new FormData(loginFormRef);
  const username = (formData.get('deliveryUser') ?? '').toString();
  const password = (formData.get('deliveryPassword') ?? '').toString();

  const account = findDeliveryAccount(username);
  if (!account || account.password !== password) {
    showLoginError('Usuario o contraseña incorrectos.');
    return;
  }

  clearLoginError();
  loginFormRef.reset();
  if (portalSectionRef) {
    portalSectionRef.classList.add('card--hidden');
  }

  if (loginSectionRef) {
    loginSectionRef.classList.add('card--hidden');
  }

  startProcessingTransition(
    processingSectionRef,
    processingBarRef,
    () => {
      enterDeliveryPortal(account);
    },
    processingLabelRef
  );
}

function findDeliveryAccount(identifier) {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) {
    return null;
  }

  const managerAccount = MANAGER_ACCOUNTS.find(
    (account) => normalizeIdentifier(account.username) === normalized
  );

  if (managerAccount) {
    return { ...managerAccount };
  }

  const storedAccounts = loadDeliveryAccounts();
  const storedAccount = storedAccounts.find(
    (account) => normalizeIdentifier(account.username) === normalized
  );

  if (!storedAccount) {
    return null;
  }

  return {
    username: storedAccount.username,
    password: storedAccount.password,
    displayName: storedAccount.displayName ?? storedAccount.username,
    role: storedAccount.role ?? 'delivery',
    createdAt: storedAccount.createdAt ?? null
  };
}

function enterDeliveryPortal(account) {
  currentAccount = account;

  if (loginSectionRef) {
    loginSectionRef.classList.add('card--hidden');
  }

  if (processingSectionRef) {
    processingSectionRef.classList.add('card--hidden');
  }

  if (portalSectionRef) {
    portalSectionRef.classList.remove('card--hidden');
    activateCard(portalSectionRef);
  }

  if (nameDisplayRef) {
    nameDisplayRef.textContent = account.displayName ?? account.username;
  }

  updateManagementVisibility();
  resetReceiptSection();
}

function updateManagementVisibility() {
  const isManager = currentAccount?.role === 'manager';

  if (managementCardRef) {
    managementCardRef.hidden = !isManager;

    if (isManager) {
      renderDeliveryAccounts(true);
    } else if (accountsListRef) {
      accountsListRef.innerHTML = '';
    }
  }

  if (infoMessageRef) {
    infoMessageRef.textContent = isManager
      ? 'Agregue nuevas credenciales para repartidores o quite accesos que ya no utilicen.'
      : 'Espere las indicaciones del administrador antes de registrar retiros o entregas.';
  }
}

function handleLogout() {
  currentAccount = null;

  if (portalSectionRef) {
    portalSectionRef.classList.add('card--hidden');
  }

  if (loginSectionRef) {
    loginSectionRef.classList.remove('card--hidden');
    activateCard(loginSectionRef);
  }

  if (processingSectionRef) {
    processingSectionRef.classList.add('card--hidden');
  }

  resetProgressBar(processingBarRef);
  resetProgressLabel(processingLabelRef);

  if (nameDisplayRef) {
    nameDisplayRef.textContent = '';
  }

  if (loginFormRef) {
    loginFormRef.reset();
  }

  if (managementCardRef) {
    managementCardRef.hidden = true;
  }

  if (accountsListRef) {
    accountsListRef.innerHTML = '';
  }

  if (infoMessageRef) {
    infoMessageRef.textContent = 'Espere las indicaciones del administrador antes de registrar retiros o entregas.';
  }

  clearLoginError();
  clearAddAccountMessage();
  resetReceiptSection();
}

function handleReceiptSubmit(event) {
  event.preventDefault();

  if (!receiptFormRef) {
    return;
  }

  if (typeof receiptFormRef.reportValidity === 'function' && !receiptFormRef.reportValidity()) {
    return;
  }

  const formData = new FormData(receiptFormRef);
  const location = (formData.get('deliveryReceiptLocation') ?? '').toString().trim();
  const product = (formData.get('deliveryReceiptItem') ?? '').toString().trim();
  const quantityValue = (formData.get('deliveryReceiptQuantity') ?? '').toString();
  const person = (formData.get('deliveryReceiptPerson') ?? '').toString().trim();
  const signature = (formData.get('deliveryReceiptSignature') ?? '').toString().trim();

  if (!location || !product || !quantityValue || !person) {
    return;
  }

  const quantity = Number.parseInt(quantityValue, 10);
  const normalizedQuantity = Number.isFinite(quantity) ? quantity : quantityValue;

  receiptDraft = {
    location,
    product,
    quantity: normalizedQuantity,
    person,
    signature
  };

  renderReceiptPreview();
  showReceiptPreview();
}

function renderReceiptPreview() {
  if (!receiptDraft) {
    return;
  }

  if (receiptLocalDisplayRef) {
    receiptLocalDisplayRef.textContent = receiptDraft.location;
  }

  if (receiptProductDisplayRef) {
    receiptProductDisplayRef.textContent = receiptDraft.product;
  }

  if (receiptAmountDisplayRef) {
    receiptAmountDisplayRef.textContent = `${receiptDraft.quantity}`;
  }

  if (receiptPersonDisplayRef) {
    receiptPersonDisplayRef.textContent = receiptDraft.person;
  }

  if (receiptSignatureLineRef) {
    receiptSignatureLineRef.textContent = receiptDraft.signature ?? '';
  }

  if (receiptTimestampRef) {
    receiptTimestampRef.textContent = DATE_TIME_FORMATTER.format(new Date());
  }
}

function showReceiptPreview() {
  if (receiptFormRef) {
    receiptFormRef.hidden = true;
  }

  if (receiptPreviewRef) {
    receiptPreviewRef.hidden = false;

    if (receiptCardRef) {
      activateCard(receiptCardRef);
    }

    if (typeof receiptPreviewRef.scrollIntoView === 'function') {
      const behavior = shouldReduceMotion() ? 'auto' : 'smooth';
      receiptPreviewRef.scrollIntoView({ block: 'start', behavior });
    }
  }
}

function showReceiptForm() {
  if (receiptPreviewRef) {
    receiptPreviewRef.hidden = true;
  }

  if (receiptFormRef) {
    receiptFormRef.hidden = false;
  }
}

function handleReceiptEditClick() {
  if (!receiptDraft) {
    showReceiptForm();
    return;
  }

  if (receiptLocationInputRef) {
    receiptLocationInputRef.value = receiptDraft.location;
  }

  if (receiptItemInputRef) {
    receiptItemInputRef.value = receiptDraft.product;
  }

  if (receiptQuantityInputRef) {
    receiptQuantityInputRef.value = receiptDraft.quantity;
  }

  if (receiptPersonInputRef) {
    receiptPersonInputRef.value = receiptDraft.person;
  }

  if (receiptSignatureInputRef) {
    receiptSignatureInputRef.value = receiptDraft.signature ?? '';
  }

  showReceiptForm();

  if (receiptLocationInputRef && typeof receiptLocationInputRef.focus === 'function') {
    receiptLocationInputRef.focus();
  }
}

function handleReceiptPrintClick() {
  if (!receiptDraft) {
    return;
  }

  if (typeof window.print === 'function') {
    window.print();
  }
}

function resetReceiptSection() {
  receiptDraft = null;

  if (receiptFormRef) {
    receiptFormRef.reset();
    receiptFormRef.hidden = false;
  }

  if (receiptPreviewRef) {
    receiptPreviewRef.hidden = true;
  }

  if (receiptSignatureLineRef) {
    receiptSignatureLineRef.textContent = '';
  }

  if (receiptTimestampRef) {
    receiptTimestampRef.textContent = '';
  }

  if (receiptLocalDisplayRef) {
    receiptLocalDisplayRef.textContent = '';
  }

  if (receiptProductDisplayRef) {
    receiptProductDisplayRef.textContent = '';
  }

  if (receiptAmountDisplayRef) {
    receiptAmountDisplayRef.textContent = '';
  }

  if (receiptPersonDisplayRef) {
    receiptPersonDisplayRef.textContent = '';
  }

  if (receiptSignatureInputRef) {
    receiptSignatureInputRef.value = '';
  }

  if (receiptCardRef) {
    receiptCardRef.scrollTop = 0;
  }
}

function handleAddDeliveryAccount(event) {
  event.preventDefault();

  if (!currentAccount || currentAccount.role !== 'manager' || !addAccountFormRef) {
    return;
  }

  const formData = new FormData(addAccountFormRef);
  const username = (formData.get('newDeliveryUser') ?? '').toString().trim();
  const password = (formData.get('newDeliveryPassword') ?? '').toString();

  if (!username || !password) {
    showAddAccountMessage('Complete el usuario y la contraseña para continuar.', 'error');
    return;
  }

  const normalized = normalizeIdentifier(username);
  if (!normalized) {
    showAddAccountMessage('Ingrese un usuario válido.', 'error');
    return;
  }

  if (isDeliveryUsernameTaken(normalized)) {
    showAddAccountMessage('Ese usuario ya está registrado. Elija otro nombre.', 'error');
    return;
  }

  const deliveryAccounts = loadDeliveryAccounts();
  deliveryAccounts.push({
    username,
    password,
    displayName: username,
    role: 'delivery',
    createdAt: new Date().toISOString()
  });

  saveDeliveryAccounts(deliveryAccounts);
  addAccountFormRef.reset();
  renderDeliveryAccounts(true);
  showAddAccountMessage('Repartidor agregado correctamente.', 'success');
}

function handleAccountsListClick(event) {
  if (!currentAccount || currentAccount.role !== 'manager') {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const removeButton = target.closest('[data-remove-account]');
  if (!removeButton || !(removeButton instanceof HTMLElement)) {
    return;
  }

  const { removeAccount } = removeButton.dataset;
  if (!removeAccount) {
    return;
  }

  const normalized = normalizeIdentifier(removeAccount);
  if (!normalized) {
    return;
  }

  const deliveryAccounts = loadDeliveryAccounts();
  const filtered = deliveryAccounts.filter(
    (account) => normalizeIdentifier(account.username) !== normalized
  );

  if (filtered.length === deliveryAccounts.length) {
    return;
  }

  if (!window.confirm(`¿Desea quitar el acceso del usuario "${removeAccount}"?`)) {
    return;
  }

  saveDeliveryAccounts(filtered);
  renderDeliveryAccounts(true);
  showAddAccountMessage(`Se quitó el usuario "${removeAccount}".`, 'success');
}

function renderDeliveryAccounts(showActions) {
  if (!accountsListRef) {
    return;
  }

  accountsListRef.innerHTML = '';

  const deliveryAccounts = loadDeliveryAccounts();
  if (!deliveryAccounts.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'history__empty';
    emptyItem.textContent = 'Todavía no se registraron repartidores.';
    accountsListRef.append(emptyItem);
    return;
  }

  const sortedAccounts = [...deliveryAccounts].sort((a, b) => {
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }

    if (a.createdAt) {
      return -1;
    }

    if (b.createdAt) {
      return 1;
    }

    return a.username.localeCompare(b.username, 'es');
  });

  sortedAccounts.forEach((account) => {
    const item = document.createElement('li');
    item.className = 'history__item deliveryAccounts__item';

    const content = document.createElement('div');
    content.className = 'deliveryAccounts__content';

    const info = document.createElement('p');
    info.className = 'deliveryAccounts__info';
    const label = document.createElement('strong');
    label.textContent = 'Usuario:';
    info.append(label, document.createTextNode(` ${account.username}`));

    const meta = document.createElement('p');
    meta.className = 'deliveryAccounts__meta';
    meta.textContent = account.createdAt
      ? `Registrado el ${formatDate(account.createdAt)}`
      : 'Registro sin fecha disponible';

    content.append(info, meta);
    item.append(content);

    if (showActions) {
      const actions = document.createElement('div');
      actions.className = 'deliveryAccounts__actions';

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'button button--danger button--small';
      removeButton.dataset.removeAccount = account.username;
      removeButton.textContent = 'Quitar';

      actions.append(removeButton);
      item.append(actions);
    }

    accountsListRef.append(item);
  });
}

function showLoginError(message) {
  if (!loginErrorRef) {
    return;
  }

  loginErrorRef.textContent = message;
  loginErrorRef.hidden = false;
}

function clearLoginError() {
  if (!loginErrorRef) {
    return;
  }

  loginErrorRef.hidden = true;
  loginErrorRef.textContent = '';
}

function showAddAccountMessage(message, type) {
  if (!addAccountMessageRef) {
    return;
  }

  addAccountMessageRef.textContent = message;
  addAccountMessageRef.hidden = false;
  addAccountMessageRef.classList.remove('form__message--error', 'form__message--success');

  if (type === 'error') {
    addAccountMessageRef.classList.add('form__message--error');
  } else if (type === 'success') {
    addAccountMessageRef.classList.add('form__message--success');
  }

  if (addAccountMessageTimeout) {
    window.clearTimeout(addAccountMessageTimeout);
  }

  addAccountMessageTimeout = window.setTimeout(() => {
    if (addAccountMessageRef) {
      addAccountMessageRef.hidden = true;
    }
  }, 3500);
}

function clearAddAccountMessage() {
  if (!addAccountMessageRef) {
    return;
  }

  addAccountMessageRef.hidden = true;
  addAccountMessageRef.textContent = '';
  addAccountMessageRef.classList.remove('form__message--error', 'form__message--success');

  if (addAccountMessageTimeout) {
    window.clearTimeout(addAccountMessageTimeout);
    addAccountMessageTimeout = null;
  }
}

function isDeliveryUsernameTaken(normalizedIdentifier) {
  if (!normalizedIdentifier) {
    return false;
  }

  const matchesManager = MANAGER_ACCOUNTS.some(
    (account) => normalizeIdentifier(account.username) === normalizedIdentifier
  );

  if (matchesManager) {
    return true;
  }

  const deliveryAccounts = loadDeliveryAccounts();
  return deliveryAccounts.some(
    (account) => normalizeIdentifier(account.username) === normalizedIdentifier
  );
}

function loadDeliveryAccounts() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.deliveryAccounts);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => entry && typeof entry.username === 'string' && typeof entry.password === 'string')
      .map((entry) => ({
        username: entry.username,
        password: entry.password,
        displayName: entry.displayName ?? entry.username,
        role: entry.role ?? 'delivery',
        createdAt: entry.createdAt ?? null
      }));
  } catch (error) {
    console.error('Error al leer los repartidores almacenados', error);
    return [];
  }
}

function saveDeliveryAccounts(accounts) {
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.deliveryAccounts,
      JSON.stringify(accounts)
    );
  } catch (error) {
    console.error('No se pudieron guardar los repartidores', error);
  }
}

function normalizeIdentifier(value) {
  if (!value) {
    return '';
  }

  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function formatDate(value) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Registro sin fecha disponible';
    }

    return DATE_TIME_FORMATTER.format(date);
  } catch (error) {
    console.error('No se pudo formatear la fecha', error);
    return 'Registro sin fecha disponible';
  }
}

function activateCard(cardElement) {
  if (!cardElement) {
    return;
  }

  cardElement.classList.remove('card--active');
  void cardElement.offsetWidth;
  cardElement.classList.add('card--active');

  const cleanupDelay = shouldReduceMotion() ? 0 : 500;
  setTimeout(() => {
    cardElement.classList.remove('card--active');
  }, cleanupDelay);
}

function startProcessingTransition(section, bar, callback, label) {
  if (!section) {
    callback();
    return;
  }

  section.classList.remove('card--hidden');
  activateCard(section);

  resetProgressBar(bar);
  resetProgressLabel(label);

  const duration = shouldReduceMotion() ? 0 : 4000;

  animateProgressBar(bar, duration);
  animateProgressLabel(label, duration);

  if (duration === 0) {
    section.classList.add('card--hidden');
    resetProgressBar(bar);
    completeProgressLabel(label);
    callback();
    return;
  }

  setTimeout(() => {
    section.classList.add('card--hidden');
    resetProgressBar(bar);
    completeProgressLabel(label);
    callback();
  }, duration);
}

function animateProgressBar(bar, duration) {
  if (!bar) {
    return;
  }

  bar.classList.remove('progress__bar--animate');
  bar.style.transitionDuration = `${duration}ms`;

  void bar.offsetWidth;
  bar.classList.add('progress__bar--animate');
}

function resetProgressBar(bar) {
  if (!bar) {
    return;
  }

  bar.classList.remove('progress__bar--animate');
  bar.style.transitionDuration = '';
}

function animateProgressLabel(label, duration) {
  if (!label) {
    return;
  }

  const previousFrameId = Number.parseInt(label.dataset.progressAnimationFrame ?? '', 10);
  if (Number.isFinite(previousFrameId)) {
    cancelAnimationFrame(previousFrameId);
  }

  const start = performance.now();

  const tick = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    label.textContent = `${Math.round(progress * 100)}%`;

    if (progress < 1) {
      const frameId = requestAnimationFrame(tick);
      label.dataset.progressAnimationFrame = String(frameId);
    } else {
      delete label.dataset.progressAnimationFrame;
    }
  };

  if (duration === 0) {
    label.textContent = '100%';
    delete label.dataset.progressAnimationFrame;
    return;
  }

  const frameId = requestAnimationFrame(tick);
  label.dataset.progressAnimationFrame = String(frameId);
}

function resetProgressLabel(label) {
  if (!label) {
    return;
  }

  const frameId = Number.parseInt(label.dataset.progressAnimationFrame ?? '', 10);
  if (Number.isFinite(frameId)) {
    cancelAnimationFrame(frameId);
  }

  delete label.dataset.progressAnimationFrame;
  label.textContent = '0%';
}

function completeProgressLabel(label) {
  if (!label) {
    return;
  }

  label.textContent = '100%';
  delete label.dataset.progressAnimationFrame;
}

function shouldReduceMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function activatePage() {
  if (document.body && document.body.classList.contains('page--transition')) {
    requestAnimationFrame(() => {
      document.body.classList.add('page--ready');
      document.body.classList.remove('page--exit');
    });
  }
}

function setupLinkTransitions() {
  const links = document.querySelectorAll('a[data-transition]');
  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || link.target === '_blank') {
        return;
      }

      event.preventDefault();
      triggerPageExit(() => {
        window.location.href = href;
      });
    });
  });
}

function triggerPageExit(callback) {
  if (!document.body) {
    callback();
    return;
  }

  document.body.classList.add('page--exit');

  if (shouldReduceMotion()) {
    callback();
    return;
  }

  window.setTimeout(callback, 350);
}
