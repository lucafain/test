const STORAGE_KEYS = {
  inventory: 'frigorifico_inventory',
  orders: 'frigorifico_orders',
  adminHistory: 'frigorifico_admin_history',
  currentAdmin: 'frigorifico_current_admin',
  adminLogs: 'frigorifico_admin_logs',
  payments: 'frigorifico_payment_status',
  paymentLogs: 'frigorifico_payment_logs',
  manualPaymentWeek: 'frigorifico_manual_payment_week',
  customAdmins: 'frigorifico_custom_admins'
};

const AUTHORIZED_ADMINS = [
  {
    username: 'Martin',
    password: '1234',
    displayName: 'Martin',
    permissions: { managePayments: true, clearOrders: true }
  },
  {
    username: 'luca',
    password: 'Luca-admin',
    displayName: 'Luca',
    permissions: { managePayments: true, clearOrders: true, manageAdmins: true }
  },
  {
    username: 'franco',
    password: '1234',
    displayName: 'Franco',
    permissions: {}
  }
];

function normalizeAdminIdentifier(value) {
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

function getAllAuthorizedAdmins() {
  const customAdmins = loadCustomAdmins();
  return [...AUTHORIZED_ADMINS, ...customAdmins];
}

function findAuthorizedAdminByIdentifier(identifier) {
  if (!identifier) {
    return null;
  }

  const normalized = normalizeAdminIdentifier(identifier);
  if (!normalized) {
    return null;
  }

  const allAdmins = getAllAuthorizedAdmins();

  return (
    allAdmins.find(
      (admin) => normalizeAdminIdentifier(admin.username) === normalized
    ) ?? null
  );
}

const WEEK_RANGE_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long'
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2
});

let clearOrdersButtonRef = null;
let clearAdminHistoryButtonRef = null;
let clearAdminLogsButtonRef = null;
let clearPaymentLogsButtonRef = null;
let currentAdminRecord = null;
let adminLogsListRef = null;
let paymentsSectionRef = null;
let paymentLogsSectionRef = null;
let paymentsContentRef = null;
let paymentsToggleButtonRef = null;
let paymentsListRef = null;
let paymentsRangeLabelRef = null;
let paymentLogsListRef = null;
let adminManagementSectionRef = null;
let addAdminFormRef = null;
let addAdminMessageRef = null;
let customAdminsListRef = null;
let addAdminMessageTimeout = null;
let paymentsVisible = false;
let paymentOrdersCache = new Map();

const CRATE_OPTIONS = [
  { id: 'X', label: 'Cajón X' },
  { id: '6', label: 'Cajón de 6 cabezas' },
  { id: '7', label: 'Cajón de 7 cabezas' },
  { id: '8', label: 'Cajón de 8 cabezas' },
  { id: '9', label: 'Cajón de 9 cabezas' },
  { id: '10', label: 'Cajón de 10 cabezas' }
];

document.addEventListener('DOMContentLoaded', () => {
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  activatePage();
  setupLinkTransitions();

  const loginSection = document.getElementById('loginSection');
  const panelSection = document.getElementById('panelSection');
  const loginForm = document.getElementById('loginForm');
  const adminNameDisplay = document.getElementById('adminNameDisplay');
  const logoutButton = document.getElementById('logoutButton');
  const inventoryRowsContainer = document.getElementById('inventoryRows');
  const saveInventoryButton = document.getElementById('saveInventory');
  const ordersHistory = document.getElementById('ordersHistory');
  clearOrdersButtonRef = document.getElementById('clearOrdersButton');
  clearAdminHistoryButtonRef = document.getElementById('clearAdminHistoryButton');
  clearAdminLogsButtonRef = document.getElementById('clearAdminLogsButton');
  clearPaymentLogsButtonRef = document.getElementById('clearPaymentLogsButton');
  const adminHistoryList = document.getElementById('adminHistory');
  adminLogsListRef = document.getElementById('adminLogs');
  paymentsSectionRef = document.getElementById('paymentsSection');
  paymentLogsSectionRef = document.getElementById('paymentLogsSection');
  paymentsContentRef = document.getElementById('paymentsContent');
  paymentsToggleButtonRef = document.getElementById('paymentsToggle');
  paymentsListRef = document.getElementById('paymentsList');
  paymentsRangeLabelRef = document.getElementById('paymentsRangeLabel');
  paymentLogsListRef = document.getElementById('paymentLogs');
  adminManagementSectionRef = document.getElementById('adminManagementSection');
  addAdminFormRef = document.getElementById('addAdminForm');
  addAdminMessageRef = document.getElementById('addAdminMessage');
  customAdminsListRef = document.getElementById('customAdminsList');
  const loginError = document.getElementById('loginError');
  const processingSection = document.getElementById('adminProcessingSection');
  const processingBar = document.getElementById('adminProcessingBar');
  const processingLabel = document.getElementById('adminProcessingPercent');

  ensureManualPaymentWeekActive();

  let inventoryState = loadInventory();

  renderInventoryRows(inventoryState, inventoryRowsContainer);
  const hasOrders = renderOrdersHistory(ordersHistory);
  updateClearOrdersButton(hasOrders);
  renderAdminHistory(adminHistoryList);
  renderAdminLogs(adminLogsListRef);
  renderCustomAdminsList(customAdminsListRef);
  updateAdminResetButtons();

  if (paymentsToggleButtonRef) {
    paymentsToggleButtonRef.addEventListener('click', () => {
      if (!isPaymentsAdmin(currentAdminRecord)) {
        return;
      }

      paymentsVisible = true;
      if (paymentsContentRef) {
        paymentsContentRef.hidden = false;
      }
      paymentsToggleButtonRef.textContent = 'Actualizar listado';
      refreshPaymentsView();
    });
  }

  if (paymentsListRef) {
    paymentsListRef.addEventListener('change', handlePaymentStatusChange);
  }

  if (clearOrdersButtonRef) {
    clearOrdersButtonRef.addEventListener('click', () => {
      if (!currentAdminRecord || !isHistoryClearAllowed(currentAdminRecord)) {
        return;
      }

      const confirmation = window.confirm(
        '¿Seguro que desea borrar todo el historial de pedidos? Esta acción no se puede deshacer.'
      );

      if (!confirmation) {
        return;
      }

      localStorage.removeItem(STORAGE_KEYS.orders);
      const hasOrdersAfterClear = renderOrdersHistory(ordersHistory);
      updateClearOrdersButton(hasOrdersAfterClear);
      const activeAdminName = getActiveAdminDisplayName();
      if (activeAdminName) {
        appendAdminLog('Borró el historial de pedidos', activeAdminName);
      }
    });
  }

  if (clearAdminHistoryButtonRef) {
    clearAdminHistoryButtonRef.addEventListener('click', () => {
      if (!currentAdminRecord || !isHistoryClearAllowed(currentAdminRecord)) {
        return;
      }

      const confirmation = window.confirm(
        '¿Seguro que desea reiniciar el registro de ingresos de administradores? Esta acción no se puede deshacer.'
      );

      if (!confirmation) {
        return;
      }

      localStorage.removeItem(STORAGE_KEYS.adminHistory);
      renderAdminHistory(adminHistoryList);
      updateAdminResetButtons();
      const activeAdminName = getActiveAdminDisplayName();
      if (activeAdminName) {
        appendAdminLog('Reinició el registro de ingresos de administradores', activeAdminName);
      }
    });
  }

  if (clearAdminLogsButtonRef) {
    clearAdminLogsButtonRef.addEventListener('click', () => {
      if (!currentAdminRecord || !isHistoryClearAllowed(currentAdminRecord)) {
        return;
      }

      const confirmation = window.confirm(
        '¿Seguro que desea reiniciar el registro de acciones? Esta acción no se puede deshacer.'
      );

      if (!confirmation) {
        return;
      }

      localStorage.removeItem(STORAGE_KEYS.adminLogs);
      renderAdminLogs(adminLogsListRef);
      updateAdminResetButtons();
      const activeAdminName = getActiveAdminDisplayName();
      if (activeAdminName) {
        appendAdminLog('Reinició el registro de acciones', activeAdminName);
      }
    });
  }

  if (clearPaymentLogsButtonRef) {
    clearPaymentLogsButtonRef.addEventListener('click', () => {
      if (!currentAdminRecord || !isHistoryClearAllowed(currentAdminRecord)) {
        return;
      }

      const confirmation = window.confirm(
        '¿Seguro que desea reiniciar el registro de pagos? Esta acción no se puede deshacer.'
      );

      if (!confirmation) {
        return;
      }

      localStorage.removeItem(STORAGE_KEYS.paymentLogs);
      renderPaymentLogs(paymentLogsListRef);
      updateAdminResetButtons();
      const activeAdminName = getActiveAdminDisplayName();
      if (activeAdminName) {
        appendAdminLog('Reinició el registro de pagos', activeAdminName);
      }
    });
  }

  if (addAdminFormRef) {
    addAdminFormRef.addEventListener('submit', (event) => {
      event.preventDefault();

      if (!currentAdminRecord || !hasAdminPermission(currentAdminRecord, 'manageAdmins')) {
        return;
      }

      const formData = new FormData(addAdminFormRef);
      const name = (formData.get('newAdminName') || '').toString().trim();
      const password = (formData.get('newAdminPassword') || '').toString().trim();

      if (!name) {
        showAddAdminMessage('Ingrese un nombre para el nuevo administrador.', 'error');
        if (addAdminFormRef.newAdminName) {
          addAdminFormRef.newAdminName.focus();
        }
        return;
      }

      if (!password) {
        showAddAdminMessage('Ingrese una contraseña para el nuevo administrador.', 'error');
        if (addAdminFormRef.newAdminPassword) {
          addAdminFormRef.newAdminPassword.focus();
        }
        return;
      }

      const existingAdmin = findAuthorizedAdminByIdentifier(name);
      if (existingAdmin) {
        showAddAdminMessage('Ya existe un administrador con ese nombre.', 'error');
        return;
      }

      const customAdmins = loadCustomAdmins();
      customAdmins.push({
        username: name,
        password,
        displayName: name,
        permissions: {}
      });

      saveCustomAdmins(customAdmins);
      renderCustomAdminsList(customAdminsListRef);
      addAdminFormRef.reset();
      showAddAdminMessage(`Se agregó a ${name} como administrador.`, 'success');

      const activeAdminName = getActiveAdminDisplayName();
      if (activeAdminName) {
        appendAdminLog(`Agregó a ${name} como administrador`, activeAdminName);
      }
    });
  }

  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const name = (formData.get('adminName') || '').toString().trim();
    const password = (formData.get('adminPassword') || '').toString().trim();

    if (!name) {
      loginForm.adminName.focus();
      return;
    }

    if (!password) {
      loginForm.adminPassword.focus();
      return;
    }

    const adminRecord = getAuthorizedAdmin(name);

    if (!adminRecord || adminRecord.password !== password) {
      showLoginError(loginError, 'Usuario o contraseña incorrectos.');
      loginForm.adminPassword.value = '';
      loginForm.adminPassword.focus();
      return;
    }

    hideLoginError(loginError);

    const adminDisplayName = adminRecord.displayName ?? adminRecord.username;

    currentAdminRecord = adminRecord;
    adminNameDisplay.textContent = adminDisplayName;
    persistAdminLogin(adminDisplayName);
    renderAdminHistory(adminHistoryList);
    appendAdminLog('Inició sesión', adminDisplayName);
    updateAdminPermissions(currentAdminRecord);

    localStorage.setItem(
      STORAGE_KEYS.currentAdmin,
      JSON.stringify({
        username: adminRecord.username,
        name: adminDisplayName
      })
    );

    loginForm.reset();
    loginSection.classList.add('card--hidden');
    panelSection.classList.add('card--hidden');

    startProcessingTransition(processingSection, processingBar, () => {
      panelSection.classList.remove('card--hidden');
      activateCard(panelSection);
      updateClearOrdersButton(loadOrders().length > 0);
    }, processingLabel);
  });

  logoutButton.addEventListener('click', () => {
    const activeAdminName = getActiveAdminDisplayName();
    if (activeAdminName) {
      appendAdminLog('Cerró sesión', activeAdminName);
    }
    panelSection.classList.add('card--hidden');
    loginSection.classList.remove('card--hidden');
    activateCard(loginSection);
    if (processingSection) {
      processingSection.classList.add('card--hidden');
    }
    hideLoginError(loginError);
    currentAdminRecord = null;
    updateClearOrdersButton(false);
    paymentsVisible = false;
    updateAdminPermissions(null);
    localStorage.removeItem(STORAGE_KEYS.currentAdmin);
  });

  saveInventoryButton.addEventListener('click', () => {
    const updatedInventory = CRATE_OPTIONS.map((crate) => {
      const stockInput = inventoryRowsContainer.querySelector(
        `input[data-type="stock"][data-id="${crate.id}"]`
      );
      const priceInput = inventoryRowsContainer.querySelector(
        `input[data-type="price"][data-id="${crate.id}"]`
      );

      const stock = Number.parseInt(stockInput?.value ?? '0', 10);
      const price = Number.parseFloat(priceInput?.value ?? '0');

      return {
        id: crate.id,
        label: crate.label,
        stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
        price: Number.isFinite(price) && price >= 0 ? price : 0
      };
    });

    const previousInventoryMap = new Map(
      (inventoryState ?? []).map((item) => [item.id, item])
    );

    const changeDescriptions = [];

    updatedInventory.forEach((item) => {
      const previous = previousInventoryMap.get(item.id);
      const stockChanged = previous?.stock !== item.stock;
      const priceChanged = previous?.price !== item.price;

      if (!stockChanged && !priceChanged) {
        return;
      }

      const fragments = [];
      if (stockChanged) {
        const previousStock = Number.isFinite(previous?.stock)
          ? previous.stock
          : 0;
        fragments.push(`stock ${previousStock} → ${item.stock}`);
      }

      if (priceChanged) {
        const previousPrice = Number.isFinite(previous?.price)
          ? previous.price
          : 0;
        fragments.push(`precio ${previousPrice} → ${item.price}`);
      }

      changeDescriptions.push(`${item.label}: ${fragments.join(', ')}`);
    });

    inventoryState = updatedInventory;
    localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(updatedInventory));

    saveInventoryButton.textContent = 'Cambios guardados';
    saveInventoryButton.disabled = true;
    const activeAdminName = getActiveAdminDisplayName();
    if (activeAdminName) {
      if (changeDescriptions.length) {
        appendAdminLog(
          `Actualizó el inventario (${changeDescriptions.join(' | ')})`,
          activeAdminName
        );
      } else {
        appendAdminLog('Guardó el inventario sin cambios', activeAdminName);
      }
    }
    setTimeout(() => {
      saveInventoryButton.textContent = 'Guardar cambios';
      saveInventoryButton.disabled = false;
    }, 1500);
  });

  inventoryRowsContainer.addEventListener('input', () => {
    saveInventoryButton.textContent = 'Guardar cambios';
    saveInventoryButton.disabled = false;
  });

  const storedAdminRaw = localStorage.getItem(STORAGE_KEYS.currentAdmin);
  const storedAdmin = parseStoredAdmin(storedAdminRaw);
  const matchedAdmin = storedAdmin
    ? getAuthorizedAdmin(storedAdmin.username ?? storedAdmin.name)
    : null;

  if (matchedAdmin) {
    const adminDisplayName = storedAdmin?.name ?? matchedAdmin.displayName ?? matchedAdmin.username;
    currentAdminRecord = matchedAdmin;
    adminNameDisplay.textContent = adminDisplayName;
    loginSection.classList.add('card--hidden');
    panelSection.classList.remove('card--hidden');
    updateClearOrdersButton(loadOrders().length > 0);
    updateAdminPermissions(currentAdminRecord);
    activateCard(panelSection);
  } else if (storedAdminRaw) {
    localStorage.removeItem(STORAGE_KEYS.currentAdmin);
    activateCard(loginSection);
  } else {
    activateCard(loginSection);
  }
});

function getAuthorizedAdmin(name) {
  if (!name) {
    return null;
  }

  return findAuthorizedAdminByIdentifier(name);
}

function hasAdminPermission(adminRecord, permissionKey) {
  if (!adminRecord || !permissionKey) {
    return false;
  }

  const identifier = (
    adminRecord.username
      ?? adminRecord.displayName
      ?? adminRecord.name
      ?? ''
  );

  const matchedAdmin = findAuthorizedAdminByIdentifier(identifier);
  if (!matchedAdmin) {
    return false;
  }

  const permissions = matchedAdmin.permissions ?? {};
  return Boolean(permissions[permissionKey]);
}

function isHistoryClearAllowed(adminRecord) {
  return hasAdminPermission(adminRecord, 'clearOrders');
}

function parseStoredAdmin(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === 'object') {
      const result = {};
      if (typeof parsed.username === 'string') {
        result.username = parsed.username;
      }
      if (typeof parsed.name === 'string') {
        result.name = parsed.name;
      }

      if ('username' in result || 'name' in result) {
        return result;
      }
    }
  } catch (error) {
    if (typeof rawValue === 'string') {
      return { name: rawValue };
    }
  }

  return null;
}

function getActiveAdminDisplayName() {
  if (currentAdminRecord) {
    return (
      currentAdminRecord.displayName
      ?? currentAdminRecord.name
      ?? currentAdminRecord.username
      ?? ''
    );
  }

  return '';
}

function showLoginError(container, message) {
  if (!container) return;
  container.textContent = message;
  container.hidden = false;
}

function hideLoginError(container) {
  if (!container) return;
  container.textContent = '';
  container.hidden = true;
}

function loadInventory() {
  const stored = localStorage.getItem(STORAGE_KEYS.inventory);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) {
        return CRATE_OPTIONS.map((option) => {
          const match = parsed.find((item) => item.id === option.id);
          return {
            id: option.id,
            label: option.label,
            stock: match?.stock ?? 0,
            price: match?.price ?? 0
          };
        });
      }
    } catch (error) {
      console.error('Error al leer el inventario almacenado', error);
    }
  }

  return CRATE_OPTIONS.map((option) => ({
    id: option.id,
    label: option.label,
    stock: 0,
    price: 0
  }));
}

function renderInventoryRows(inventory, container) {
  container.innerHTML = inventory
    .map(
      (item) => `
        <div class="table__row" role="row">
          <span>${item.label}</span>
          <input type="number" min="0" step="1" data-type="stock" data-id="${item.id}" value="${item.stock}">
          <input type="number" min="0" step="any" data-type="price" data-id="${item.id}" value="${item.price}">
        </div>
      `
    )
    .join('');
}

function loadOrders() {
  const stored = localStorage.getItem(STORAGE_KEYS.orders);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error('Error al leer pedidos guardados', error);
  }

  return [];
}

function updateClearOrdersButton(hasOrdersParam) {
  if (!clearOrdersButtonRef) {
    return;
  }

  if (!isHistoryClearAllowed(currentAdminRecord)) {
    clearOrdersButtonRef.hidden = true;
    clearOrdersButtonRef.disabled = true;
    return;
  }

  clearOrdersButtonRef.hidden = false;
  const hasOrders = typeof hasOrdersParam === 'boolean'
    ? hasOrdersParam
    : loadOrders().length > 0;

  clearOrdersButtonRef.disabled = !hasOrders;
}

function updateAdminResetButtons() {
  const canReset = isHistoryClearAllowed(currentAdminRecord);

  configureResetButton(
    clearAdminHistoryButtonRef,
    canReset,
    loadAdminHistoryEntries().length > 0
  );

  configureResetButton(
    clearAdminLogsButtonRef,
    canReset,
    loadAdminLogs().length > 0
  );

  configureResetButton(
    clearPaymentLogsButtonRef,
    canReset,
    loadPaymentLogs().length > 0
  );
}

function configureResetButton(button, canReset, hasEntries) {
  if (!button) {
    return;
  }

  if (!canReset) {
    button.hidden = true;
    button.disabled = true;
    return;
  }

  button.hidden = false;
  button.disabled = !hasEntries;
}

function renderOrdersHistory(container) {
  const orders = loadOrders();

  if (!orders.length) {
    container.innerHTML = '<li class="history__empty">No hay pedidos registrados aún.</li>';
    return false;
  }

  const formatter = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const groupsMap = new Map();
  const ordersWithoutDate = [];

  orders.forEach((order) => {
    const timestampValue = Number(order.timestamp);
    if (!Number.isFinite(timestampValue)) {
      ordersWithoutDate.push(order);
      return;
    }

    const orderDate = new Date(timestampValue);
    if (Number.isNaN(orderDate.getTime())) {
      ordersWithoutDate.push(order);
      return;
    }

    const boundaries = getWeekBoundaries(orderDate);
    const key = boundaries.start.toISOString();

    if (!groupsMap.has(key)) {
      groupsMap.set(key, { ...boundaries, orders: [] });
    }

    groupsMap.get(key).orders.push(order);
  });

  const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => b.start - a.start);

  if (ordersWithoutDate.length) {
    sortedGroups.push({ start: null, end: null, orders: ordersWithoutDate.slice(), unknown: true });
  }

  const groupHtml = sortedGroups
    .map((group) => {
      const groupTitle = group.unknown
        ? 'Pedidos sin fecha registrada'
        : formatWeekRange(group.start, group.end);

      const itemsHtml = group.orders
        .slice()
        .sort((a, b) => {
          const timeA = Number(a.timestamp);
          const timeB = Number(b.timestamp);
          const safeA = Number.isFinite(timeA) ? timeA : 0;
          const safeB = Number.isFinite(timeB) ? timeB : 0;
          return safeB - safeA;
        })
        .map((order) => {
          const timeValue = Number(order.timestamp);
          const hasTimestamp = Number.isFinite(timeValue);
          const timestampLabel = hasTimestamp
            ? formatter.format(new Date(timeValue))
            : 'Fecha no disponible';

          const quantityNumber = Number.parseInt(order.quantity ?? '', 10);
          const hasQuantity = Number.isFinite(quantityNumber) && quantityNumber > 0;

          const quantityLabel = hasQuantity
            ? `${quantityNumber} × ${order.crateSize}`
            : order.crateSize;

          return `
            <li class="history__item">
              <strong>${order.storeName}</strong> (${timestampLabel})<br>
              ${order.storeAddress}<br>
              Pedido: ${quantityLabel}
            </li>
          `;
        })
        .join('');

      return `
        <li class="history__group">
          <h4 class="history__groupTitle">${groupTitle}</h4>
          <ul class="history__groupList">
            ${itemsHtml}
          </ul>
        </li>
      `;
    })
    .join('');

  container.innerHTML = groupHtml;

  if (paymentsVisible && isPaymentsAdmin(currentAdminRecord)) {
    refreshPaymentsView();
  }

  return true;
}

function updateAdminPermissions(adminRecord) {
  const isPaymentsAdminActive = isPaymentsAdmin(adminRecord);

  if (paymentsSectionRef) {
    if (isPaymentsAdminActive) {
      paymentsSectionRef.classList.remove('card--hidden');
      if (paymentsToggleButtonRef) {
        paymentsToggleButtonRef.disabled = false;
        paymentsToggleButtonRef.textContent = paymentsVisible
          ? 'Actualizar listado'
          : 'Ver pedidos de la semana';
      }
      if (paymentsVisible) {
        if (paymentsContentRef) {
          paymentsContentRef.hidden = false;
        }
        refreshPaymentsView();
      } else if (paymentsContentRef) {
        paymentsContentRef.hidden = true;
      }
    } else {
      paymentsSectionRef.classList.add('card--hidden');
      paymentsVisible = false;
      if (paymentsContentRef) {
        paymentsContentRef.hidden = true;
      }
      if (paymentsToggleButtonRef) {
        paymentsToggleButtonRef.textContent = 'Ver pedidos de la semana';
      }
    }
  }

  if (paymentLogsSectionRef) {
    if (isPaymentsAdminActive) {
      paymentLogsSectionRef.classList.remove('card--hidden');
      renderPaymentLogs(paymentLogsListRef);
    } else {
      paymentLogsSectionRef.classList.add('card--hidden');
      if (paymentLogsListRef) {
        paymentLogsListRef.innerHTML = '';
      }
    }
  }

  if (adminManagementSectionRef) {
    if (hasAdminPermission(adminRecord, 'manageAdmins')) {
      adminManagementSectionRef.classList.remove('card--hidden');
      renderCustomAdminsList(customAdminsListRef);
    } else {
      adminManagementSectionRef.classList.add('card--hidden');
      if (addAdminFormRef) {
        addAdminFormRef.reset();
      }
      hideAddAdminMessage();
    }
  }

  updateAdminResetButtons();
}

function isPaymentsAdmin(adminRecord) {
  return hasAdminPermission(adminRecord, 'managePayments');
}

function handlePaymentStatusChange(event) {
  const target = event.target;
  if (!target || !target.matches('select[data-order-id]')) {
    return;
  }

  if (!isPaymentsAdmin(currentAdminRecord)) {
    return;
  }

  const orderId = target.dataset.orderId;
  if (!orderId) {
    return;
  }

  const desiredStatus = target.value === 'paid' ? 'paid' : 'pending';
  const order = paymentOrdersCache.get(orderId);
  if (!order) {
    return;
  }

  const adminName = getActiveAdminDisplayName();
  const updated = updatePaymentState(orderId, desiredStatus, adminName, order);

  if (updated) {
    refreshPaymentsView();
  }
}

function refreshPaymentsView() {
  if (!paymentsListRef || !paymentsRangeLabelRef) {
    return;
  }

  if (!isPaymentsAdmin(currentAdminRecord)) {
    return;
  }

  const { start, end } = getActivePaymentsWeek(new Date());
  paymentsRangeLabelRef.textContent = formatWeekRange(start, end);

  const startTime = start.getTime();
  const endTime = end.getTime();

  const orders = loadOrders()
    .filter((order) => {
      const timestamp = Number(order?.timestamp);
      return Number.isFinite(timestamp) && timestamp >= startTime && timestamp <= endTime;
    })
    .sort((a, b) => {
      const timeA = Number(a?.timestamp);
      const timeB = Number(b?.timestamp);
      const safeA = Number.isFinite(timeA) ? timeA : 0;
      const safeB = Number.isFinite(timeB) ? timeB : 0;
      return safeB - safeA;
    });

  paymentOrdersCache = new Map();

  if (!orders.length) {
    paymentsListRef.innerHTML = '<li class="history__empty">No hay pedidos registrados en la semana actual.</li>';
    return;
  }

  const paymentStates = loadPaymentStates();

  const pendingOrders = [];

  orders.forEach((order) => {
    const orderId = getOrderIdentifier(order);
    if (!orderId) {
      return;
    }

    const stateRecord = paymentStates[orderId];
    if (stateRecord?.status === 'paid') {
      return;
    }

    pendingOrders.push({ order, orderId, stateRecord });
    paymentOrdersCache.set(orderId, order);
  });

  if (!pendingOrders.length) {
    paymentsListRef.innerHTML = '<li class="history__empty">No hay pedidos pendientes de cobro en la semana actual.</li>';
    return;
  }

  const listHtml = pendingOrders
    .map(({ order, orderId, stateRecord }) => {
      const timestamp = Number(order.timestamp);
      const timestampLabel = Number.isFinite(timestamp)
        ? DATE_TIME_FORMATTER.format(new Date(timestamp))
        : 'Fecha no disponible';

      const quantityNumber = Number.parseInt(order.quantity ?? '', 10);
      const hasQuantity = Number.isFinite(quantityNumber) && quantityNumber > 0;
      const crateLabel = order.crateSize ?? 'Pedido sin detalle';
      const quantityLabel = hasQuantity ? `${quantityNumber} × ${crateLabel}` : crateLabel;

      const totalValue = Number(order.totalPrice);
      const showTotal = Number.isFinite(totalValue) && totalValue > 0;
      const totalLabel = showTotal
        ? `<div class="payment__meta">Total estimado: ${formatCurrencyValue(totalValue)}</div>`
        : '';

      const statusValue = stateRecord?.status === 'paid' ? 'paid' : 'pending';
      const updatedMeta = stateRecord?.updatedAt
        ? `Actualizado por ${stateRecord.admin ?? 'Administrador'} el ${DATE_TIME_FORMATTER.format(new Date(stateRecord.updatedAt))}`
        : 'Sin registro de cobro.';

      return `
        <li class="history__item">
          <div class="payment__header">
            <strong>${order.storeName ?? 'Cliente sin nombre'}</strong>
            <span class="payment__meta">${timestampLabel}</span>
          </div>
          <div class="payment__details">${order.storeAddress ?? 'Dirección no indicada'}</div>
          <div class="payment__details">Pedido: ${quantityLabel}</div>
          ${totalLabel}
          <div class="payment__control">
            <label for="payment-status-${orderId}">Cobrado</label>
            <select id="payment-status-${orderId}" class="payment__statusSelect" data-order-id="${orderId}">
              <option value="pending"${statusValue === 'pending' ? ' selected' : ''}>No</option>
              <option value="paid"${statusValue === 'paid' ? ' selected' : ''}>Sí</option>
            </select>
            <span class="payment__meta">${updatedMeta}</span>
          </div>
        </li>
      `;
    })
    .join('');

  paymentsListRef.innerHTML = listHtml;
}

function getActivePaymentsWeek(referenceDate) {
  const manualWeek = loadManualPaymentWeek();

  if (manualWeek) {
    const start = new Date(manualWeek.start);
    const end = new Date(manualWeek.end);

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
      return { start, end };
    }
  }

  return getWeekBoundaries(referenceDate);
}

function getOrderIdentifier(order) {
  const timestamp = Number(order?.timestamp);
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return String(timestamp);
  }

  return null;
}

function getWeekBoundaries(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const day = start.getDay();
  const diffToMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffToMonday);

  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function ensureManualPaymentWeekActive() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  saveManualPaymentWeek(start.getTime(), end.getTime());
}

function loadManualPaymentWeek() {
  const stored = localStorage.getItem(STORAGE_KEYS.manualPaymentWeek);
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const start = Number(parsed.start);
      const end = Number(parsed.end);

      if (Number.isFinite(start) && Number.isFinite(end) && start <= end) {
        return { start, end };
      }
    }
  } catch (error) {
    console.error('Error al leer la semana manual de pagos', error);
  }

  return null;
}

function saveManualPaymentWeek(startTime, endTime) {
  const start = Number(startTime);
  const end = Number(endTime);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return;
  }

  try {
    localStorage.setItem(
      STORAGE_KEYS.manualPaymentWeek,
      JSON.stringify({ start, end })
    );
  } catch (error) {
    console.error('Error al guardar la semana manual de pagos', error);
  }
}

function formatWeekRange(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date)) {
    return 'Semana sin fecha';
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = WEEK_RANGE_FORMATTER.format(start);
  const endLabel = WEEK_RANGE_FORMATTER.format(end);

  if (sameYear) {
    return `Del ${startLabel} al ${endLabel} de ${start.getFullYear()}`;
  }

  return `Del ${startLabel} de ${start.getFullYear()} al ${endLabel} de ${end.getFullYear()}`;
}

function persistAdminLogin(name) {
  const stored = localStorage.getItem(STORAGE_KEYS.adminHistory);
  let history = [];

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        history = parsed;
      }
    } catch (error) {
      console.error('Error al leer historial de administradores', error);
    }
  }

  history.push({ name, timestamp: Date.now() });
  const trimmedHistory = history.slice(-20);
  localStorage.setItem(STORAGE_KEYS.adminHistory, JSON.stringify(trimmedHistory));
}

function loadAdminHistoryEntries() {
  const stored = localStorage.getItem(STORAGE_KEYS.adminHistory);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error('Error al leer historial de administradores', error);
  }

  return [];
}

function renderAdminHistory(container) {
  if (!container) {
    return;
  }

  const history = loadAdminHistoryEntries();

  if (!history.length) {
    container.innerHTML = '<li>Aún no hay ingresos registrados.</li>';
    updateAdminResetButtons();
    return;
  }

  const formatter = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  container.innerHTML = history
    .slice()
    .reverse()
    .map((entry) => `
      <li>
        <strong>${entry.name}</strong><br>
        ${formatter.format(new Date(entry.timestamp))}
      </li>
    `)
    .join('');

  updateAdminResetButtons();
}

function loadAdminLogs() {
  const stored = localStorage.getItem(STORAGE_KEYS.adminLogs);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error('Error al leer el registro de acciones', error);
  }

  return [];
}

function appendAdminLog(action, adminName) {
  if (!action || !adminName) {
    return;
  }

  const logs = loadAdminLogs();
  logs.push({ action, admin: adminName, timestamp: Date.now() });
  const trimmedLogs = logs.slice(-50);
  localStorage.setItem(STORAGE_KEYS.adminLogs, JSON.stringify(trimmedLogs));
  renderAdminLogs(adminLogsListRef);
}

function renderAdminLogs(container) {
  if (!container) {
    return;
  }

  const logs = loadAdminLogs();

  if (!logs.length) {
    container.innerHTML = '<li class="history__empty">Aún no hay acciones registradas.</li>';
    updateAdminResetButtons();
    return;
  }

  const formatter = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  container.innerHTML = logs
    .slice()
    .reverse()
    .map((entry) => `
      <li>
        <strong>${entry.admin}</strong><br>
        ${entry.action}<br>
        ${formatter.format(new Date(entry.timestamp))}
      </li>
    `)
    .join('');

  updateAdminResetButtons();
}

function loadPaymentStates() {
  const stored = localStorage.getItem(STORAGE_KEYS.payments);
  if (!stored) {
    return {};
  }

  try {
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error('Error al leer el estado de pagos', error);
  }

  return {};
}

function persistPaymentStates(states) {
  try {
    localStorage.setItem(STORAGE_KEYS.payments, JSON.stringify(states));
  } catch (error) {
    console.error('Error al guardar el estado de pagos', error);
  }
}

function updatePaymentState(orderId, status, adminName, order) {
  if (!orderId) {
    return false;
  }

  const sanitizedStatus = status === 'paid' ? 'paid' : 'pending';
  const states = loadPaymentStates();
  const previousStatus = states[orderId]?.status ?? 'pending';

  if (previousStatus === sanitizedStatus) {
    return false;
  }

  const safeAdminName = typeof adminName === 'string' && adminName.trim()
    ? adminName.trim()
    : 'Administrador';

  states[orderId] = {
    status: sanitizedStatus,
    updatedAt: Date.now(),
    admin: safeAdminName
  };

  persistPaymentStates(states);

  const storeName = typeof order?.storeName === 'string' && order.storeName.trim()
    ? order.storeName.trim()
    : 'Cliente sin nombre';
  const crateLabel = order?.crateSize ?? 'Pedido';
  const quantityNumber = Number.parseInt(order?.quantity ?? '', 10);
  const hasQuantity = Number.isFinite(quantityNumber) && quantityNumber > 0;
  const quantityLabel = hasQuantity ? `${quantityNumber} × ${crateLabel}` : crateLabel;
  const totalValue = Number(order?.totalPrice);
  const totalFragment = Number.isFinite(totalValue) && totalValue > 0
    ? ` (total estimado ${formatCurrencyValue(totalValue)})`
    : '';

  if (sanitizedStatus === 'paid') {
    const action = `Marcó como cobrado el pedido de ${storeName} (${quantityLabel})${totalFragment}`;
    appendPaymentLog(action, safeAdminName);
  }
  return true;
}

function loadPaymentLogs() {
  const stored = localStorage.getItem(STORAGE_KEYS.paymentLogs);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error('Error al leer el registro de pagos', error);
  }

  return [];
}

function appendPaymentLog(action, adminName) {
  if (!action) {
    return;
  }

  const logs = loadPaymentLogs();
  logs.push({
    action,
    admin: adminName ?? 'Administrador',
    timestamp: Date.now()
  });

  const trimmedLogs = logs.slice(-50);

  try {
    localStorage.setItem(STORAGE_KEYS.paymentLogs, JSON.stringify(trimmedLogs));
  } catch (error) {
    console.error('Error al guardar el registro de pagos', error);
  }

  renderPaymentLogs(paymentLogsListRef);
}

function renderPaymentLogs(container) {
  if (!container) {
    return;
  }

  const logs = loadPaymentLogs();

  if (!logs.length) {
    container.innerHTML = '<li class="history__empty">Aún no hay movimientos registrados.</li>';
    updateAdminResetButtons();
    return;
  }

  container.innerHTML = logs
    .slice()
    .reverse()
    .map((entry) => `
      <li>
        <strong>${entry.admin}</strong><br>
        ${entry.action}<br>
        ${DATE_TIME_FORMATTER.format(new Date(entry.timestamp))}
      </li>
    `)
    .join('');

  updateAdminResetButtons();
}

function sanitizeCustomAdminEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const usernameValue = typeof entry.username === 'string'
    ? entry.username.trim()
    : '';

  const passwordValue = typeof entry.password === 'string'
    ? entry.password
    : '';

  if (!usernameValue || !passwordValue) {
    return null;
  }

  const displayNameValue = typeof entry.displayName === 'string' && entry.displayName.trim()
    ? entry.displayName.trim()
    : usernameValue;

  const permissionsValue = entry.permissions && typeof entry.permissions === 'object' && !Array.isArray(entry.permissions)
    ? { ...entry.permissions }
    : {};

  return {
    username: usernameValue,
    password: passwordValue,
    displayName: displayNameValue,
    permissions: permissionsValue
  };
}

function loadCustomAdmins() {
  const stored = localStorage.getItem(STORAGE_KEYS.customAdmins);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      const deduplicated = new Map();

      parsed.forEach((entry) => {
        const sanitized = sanitizeCustomAdminEntry(entry);
        if (!sanitized) {
          return;
        }

        const key = normalizeAdminIdentifier(sanitized.username);
        if (!key) {
          return;
        }

        deduplicated.set(key, sanitized);
      });

      return Array.from(deduplicated.values());
    }
  } catch (error) {
    console.error('Error al leer administradores adicionales', error);
  }

  return [];
}

function saveCustomAdmins(admins) {
  if (!Array.isArray(admins)) {
    localStorage.removeItem(STORAGE_KEYS.customAdmins);
    return;
  }

  const deduplicated = new Map();

  admins.forEach((entry) => {
    const sanitized = sanitizeCustomAdminEntry(entry);
    if (!sanitized) {
      return;
    }

    const key = normalizeAdminIdentifier(sanitized.username);
    if (!key) {
      return;
    }

    deduplicated.set(key, sanitized);
  });

  const serialized = JSON.stringify(Array.from(deduplicated.values()));

  try {
    localStorage.setItem(STORAGE_KEYS.customAdmins, serialized);
  } catch (error) {
    console.error('Error al guardar administradores adicionales', error);
  }
}

function renderCustomAdminsList(container) {
  if (!container) {
    return;
  }

  const admins = loadCustomAdmins();

  if (!admins.length) {
    container.innerHTML = '<li class="history__empty">Aún no hay administradores agregados.</li>';
    return;
  }

  container.innerHTML = admins
    .map((admin) => `
      <li>
        <strong>${admin.displayName ?? admin.username}</strong>
      </li>
    `)
    .join('');
}

function showAddAdminMessage(message, type) {
  if (!addAdminMessageRef) {
    return;
  }

  if (addAdminMessageTimeout) {
    clearTimeout(addAdminMessageTimeout);
    addAdminMessageTimeout = null;
  }

  addAdminMessageRef.textContent = message;
  addAdminMessageRef.hidden = false;
  addAdminMessageRef.classList.remove('form__message--error', 'form__message--success');

  if (type === 'error') {
    addAdminMessageRef.classList.add('form__message--error');
  } else if (type === 'success') {
    addAdminMessageRef.classList.add('form__message--success');
  }

  addAdminMessageTimeout = setTimeout(() => {
    hideAddAdminMessage();
  }, 4000);
}

function hideAddAdminMessage() {
  if (!addAdminMessageRef) {
    return;
  }

  if (addAdminMessageTimeout) {
    clearTimeout(addAdminMessageTimeout);
    addAdminMessageTimeout = null;
  }

  addAdminMessageRef.textContent = '';
  addAdminMessageRef.hidden = true;
  addAdminMessageRef.classList.remove('form__message--error', 'form__message--success');
}

function formatCurrencyValue(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return CURRENCY_FORMATTER.format(0);
  }

  return CURRENCY_FORMATTER.format(numericValue);
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

  setTimeout(callback, 350);
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

  if (bar) {
    resetProgressBar(bar);
  }

  if (label) {
    resetProgressLabel(label);
  }

  const duration = shouldReduceMotion() ? 0 : 4000;

  if (bar) {
    animateProgressBar(bar, duration);
  }

  if (label) {
    animateProgressLabel(label, duration);
  }

  if (duration === 0) {
    section.classList.add('card--hidden');
    if (bar) {
      resetProgressBar(bar);
    }
    if (label) {
      completeProgressLabel(label);
    }
    callback();
    return;
  }

  setTimeout(() => {
    section.classList.add('card--hidden');
    if (bar) {
      resetProgressBar(bar);
    }
    if (label) {
      completeProgressLabel(label);
    }
    callback();
  }, duration);
}

function animateProgressBar(bar, duration) {
  if (!bar) {
    return;
  }

  bar.classList.remove('progress__bar--animate');
  bar.style.transitionDuration = `${duration}ms`;
  bar.style.width = '0%';
  void bar.offsetWidth;

  if (duration === 0) {
    bar.style.width = '100%';
    return;
  }

  bar.classList.add('progress__bar--animate');
}

function resetProgressBar(bar) {
  if (!bar) {
    return;
  }

  bar.classList.remove('progress__bar--animate');
  bar.style.transitionDuration = '';
  bar.style.width = '0%';
}

function animateProgressLabel(label, duration) {
  if (!label) {
    return;
  }

  cancelProgressLabelAnimation(label);

  if (duration === 0) {
    label.textContent = '100%';
    return;
  }

  label.textContent = '0%';
  const start = performance.now();

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    label.textContent = `${Math.round(progress * 100)}%`;

    if (progress < 1) {
      const frameId = requestAnimationFrame(update);
      label.dataset.progressAnimationFrame = String(frameId);
    } else {
      delete label.dataset.progressAnimationFrame;
    }
  }

  const frameId = requestAnimationFrame(update);
  label.dataset.progressAnimationFrame = String(frameId);
}

function resetProgressLabel(label) {
  if (!label) {
    return;
  }

  cancelProgressLabelAnimation(label);
  label.textContent = '0%';
}

function completeProgressLabel(label) {
  if (!label) {
    return;
  }

  cancelProgressLabelAnimation(label);
  label.textContent = '100%';
}

function cancelProgressLabelAnimation(label) {
  const frameId = Number.parseInt(label?.dataset?.progressAnimationFrame ?? '', 10);
  if (Number.isFinite(frameId)) {
    cancelAnimationFrame(frameId);
  }
  if (label?.dataset) {
    delete label.dataset.progressAnimationFrame;
  }
}

function shouldReduceMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
