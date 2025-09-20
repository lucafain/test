const STORAGE_KEYS = {
  inventory: 'frigorifico_inventory',
  orders: 'frigorifico_orders',
  adminHistory: 'frigorifico_admin_history',
  currentAdmin: 'frigorifico_current_admin'
};

const AUTHORIZED_ADMINS = [
  { username: 'martin', password: '1234', displayName: 'Martin' },
  { username: 'luca', password: 'Luca-admin', displayName: 'Luca' }
];

const WEEK_RANGE_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long'
});

let clearOrdersButtonRef = null;
let currentAdminRecord = null;

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

  const loginSection = document.getElementById('loginSection');
  const panelSection = document.getElementById('panelSection');
  const loginForm = document.getElementById('loginForm');
  const adminNameDisplay = document.getElementById('adminNameDisplay');
  const logoutButton = document.getElementById('logoutButton');
  const inventoryRowsContainer = document.getElementById('inventoryRows');
  const saveInventoryButton = document.getElementById('saveInventory');
  const ordersHistory = document.getElementById('ordersHistory');
  clearOrdersButtonRef = document.getElementById('clearOrdersButton');
  const adminHistoryList = document.getElementById('adminHistory');
  const loginError = document.getElementById('loginError');

  let inventoryState = loadInventory();

  renderInventoryRows(inventoryState, inventoryRowsContainer);
  const hasOrders = renderOrdersHistory(ordersHistory);
  updateClearOrdersButton(hasOrders);
  renderAdminHistory(adminHistoryList);

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
    loginSection.classList.add('card--hidden');
    panelSection.classList.remove('card--hidden');
    loginForm.reset();

    persistAdminLogin(adminDisplayName);
    renderAdminHistory(adminHistoryList);
    updateClearOrdersButton(loadOrders().length > 0);

    localStorage.setItem(
      STORAGE_KEYS.currentAdmin,
      JSON.stringify({
        username: adminRecord.username,
        name: adminDisplayName
      })
    );
  });

  logoutButton.addEventListener('click', () => {
    panelSection.classList.add('card--hidden');
    loginSection.classList.remove('card--hidden');
    hideLoginError(loginError);
    currentAdminRecord = null;
    updateClearOrdersButton(false);
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

    inventoryState = updatedInventory;
    localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(updatedInventory));

    saveInventoryButton.textContent = 'Cambios guardados';
    saveInventoryButton.disabled = true;
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
  } else if (storedAdminRaw) {
    localStorage.removeItem(STORAGE_KEYS.currentAdmin);
  }
});

function getAuthorizedAdmin(name) {
  if (!name) {
    return null;
  }

  const normalizedName = name.toString().toLowerCase();
  return (
    AUTHORIZED_ADMINS.find(
      (admin) => admin.username.toLowerCase() === normalizedName
    ) ?? null
  );
}

function isHistoryClearAllowed(adminRecord) {
  if (!adminRecord) {
    return false;
  }

  const username = (
    adminRecord.username
      ?? adminRecord.displayName
      ?? adminRecord.name
      ?? ''
  ).toString().toLowerCase();

  return username === 'martin' || username === 'luca';
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
  return true;
}

function getWeekBoundaries(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const day = start.getDay();
  const diffToMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffToMonday);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setHours(0, 0, 0, 0);

  return { start, end };
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

function renderAdminHistory(container) {
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

  if (!history.length) {
    container.innerHTML = '<li>Aún no hay ingresos registrados.</li>';
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
}
