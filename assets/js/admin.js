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
  const adminHistoryList = document.getElementById('adminHistory');
  const loginError = document.getElementById('loginError');

  let inventoryState = loadInventory();

  renderInventoryRows(inventoryState, inventoryRowsContainer);
  renderOrdersHistory(ordersHistory);
  renderAdminHistory(adminHistoryList);

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

    adminNameDisplay.textContent = adminDisplayName;
    loginSection.classList.add('card--hidden');
    panelSection.classList.remove('card--hidden');
    loginForm.reset();

    persistAdminLogin(adminDisplayName);
    renderAdminHistory(adminHistoryList);

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
        price: Number.isFinite(price) && price >= 0 ? Number(price.toFixed(2)) : 0
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
    adminNameDisplay.textContent = adminDisplayName;
    loginSection.classList.add('card--hidden');
    panelSection.classList.remove('card--hidden');
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
          <input type="number" min="0" step="0.01" data-type="price" data-id="${item.id}" value="${item.price}">
        </div>
      `
    )
    .join('');
}

function renderOrdersHistory(container) {
  const stored = localStorage.getItem(STORAGE_KEYS.orders);
  let orders = [];
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        orders = parsed;
      }
    } catch (error) {
      console.error('Error al leer pedidos guardados', error);
    }
  }

  if (!orders.length) {
    container.innerHTML = '<li>No hay pedidos registrados aún.</li>';
    return;
  }

  const formatter = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  container.innerHTML = orders
    .slice()
    .reverse()
    .map((order) => {
      const timestamp = order.timestamp ? formatter.format(new Date(order.timestamp)) : 'Fecha no disponible';
      const quantityNumber = Number.parseInt(order.quantity ?? '', 10);
      const hasQuantity = Number.isFinite(quantityNumber) && quantityNumber > 0;

      return `
        <li>
          <strong>${order.storeName}</strong> (${timestamp})<br>
          ${order.storeAddress}<br>
          Pedido: ${hasQuantity ? `${quantityNumber} × ${order.crateSize}` : order.crateSize}
        </li>
      `;
    })
    .join('');
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
